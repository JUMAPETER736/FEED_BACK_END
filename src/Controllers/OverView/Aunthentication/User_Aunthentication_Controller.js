import crypto from "crypto";
import jwt from "jsonwebtoken";
import { UserLoginType, UserRolesEnum } from "../../../Constants.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import asyncHanDler from "express-async-handler";
import USER from "../../../data/models/userModel.js";
import generateToken from "../../../config/generateToken.js"

import {
  getLocalPath,
  getStaticFilePath,
  getAvatarLocalPath,
  getStaticAvatarFilePath,
  removeLocalFile,
} from "../../../Utils/Helpers.js";

import {

  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  otpMailgenContent, // Import OTP email template
  sendEmail,

} from "../../../utils/mail.js";

import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GenerateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // attach refresh token to the user document to avoid refreshing the access token with multiple refresh tokens
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {

    console.log('Something went wrong while generating the access token', error)
    throw new ApiError(
      500,
      "Something went wrong while generating the access token"
    );
  }
};

const RegisterNewUser = asyncHanDler(async (req, res) => {
  const { email, username, password, role } = req.body;

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }
  const user = await User.create({
    email,
    password,
    username,
    isEmailVerified: false,
    role: role || UserRolesEnum.USER,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: generateToken(user.id),
    });
  } else {
    res.status(400);
    throw new Error("Failed to create the user");
  }
});

async function HandleGoogleLogin(idToken) {
  try {
    // Verify the ID token with Google's server
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    // Check if the user with email already exists
    const user = await User.findOne({ email });

    if (user) {
      // Handle existing user logic if needed
      return user;
    } else {
      // Create a new user using Google profile information and additional details
      const createdUser = await User.create({
        email: email,
        username: payload.email?.split("@")[0],
        password: payload.profile._json.sub, // Set user's password as sub (coming from the google)
        avatar: {
          url: payload.picture,
          localPath: "",
        },
        isEmailVerified: true, // Set email as verified since it's coming from Google
        role: UserRolesEnum.USER,
        loginType: UserLoginType.GOOGLE,
        // Add more details as needed
      });

      if (createdUser) {
        return createdUser;
      } else {
        throw new Error("Error while registering the user");
      }
    }
  } catch (error) {
    throw error;
  }
}

// Create a function to handle the Google login logic
const GoogleLoginHandler = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "idToken is required" });
    }

    const user = await handleGoogleLogin(idToken);

    const { accessToken, refreshToken } = await GenerateAccessAndRefreshTokens(
      user._id
    );

    // You can customize the response based on your needs
    return res
      .status(200)
      .json({ success: true, user, accessToken, refreshToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const RegisterUser = asyncHandler(async (req, res) => {
  const { email, username, password, role } = req.body;

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }
  const user = await User.create({
    email,
    password,
    username,
    isEmailVerified: false,
    role: role || UserRolesEnum.USER,
  });

  /**
   * unHashedToken: unHashed token is something we will send to the user's mail
   * hashedToken: we will keep record of hashedToken to validate the unHashedToken in verify email controller
   * tokenExpiry: Expiry to be checked before validating the incoming token
   */
  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  /**
   * assign hashedToken and tokenExpiry in DB till user clicks on email verification link
   * The email verification is handled by {@link verifyEmail}
   */
  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get(
        "host"
      )}/api/v1/users/verify-email/${unHashedToken}`
    ),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: createdUser },
        "Users registered successfully and verification email has been sent on your email."
      )
    );
});

const LoginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  console.log(`login user: username: ${username} password: ${password} email: ${email}`)

  if (!username && !email) {
    console.log('username or email required')
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    console.log('user not found')
    throw new ApiError(404, "User does not exist");
  }

  if (user.loginType !== UserLoginType.EMAIL_PASSWORD) {
    // If user is registered with some other method, we will ask him/her to use the same method as registered.
    // This shows that if user is registered with methods other than email password, he/she will not be able to login with password. Which makes password field redundant for the SSO
    console.log('login type not equal to email password')

    throw new ApiError(
      400,
      "You have previously registered using " +
      user.loginType?.toLowerCase() +
      ". Please use the " +
      user.loginType?.toLowerCase() +
      " login option to access your account."
    );

  }

  // Compare the incoming password with hashed password
  console.log('Compare the incoming password with hashed password')
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    console.log('invalid credentials')
    throw new ApiError(401, "Invalid user credentials");
  }

  console.log('invalid credentials')

  const { accessToken, refreshToken } = await GenerateAccessAndRefreshTokens(
    user._id
  );

  // get the user document ignoring the password and refreshToken field

  console.log('get the user document ignoring the password and refreshToken field')
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
  );

  // TODO: Add more options to make cookie more secure and reliable
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  console.log('res 200')
  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // set the access token in the cookie
    .cookie("refreshToken", refreshToken, options) // set the refresh token in the cookie
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken }, // send access and refresh token in response if client decides to save them by themselves
        "User logged in successfully"
      )
    );
});

const LogoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const VerifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params;

  if (!verificationToken) {
    throw new ApiError(400, "Email verification token is missing");
  }

  // generate a hash from the token that we are receiving
  let hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // While registering the user, same time when we are sending the verification mail
  // we have saved a hashed value of the original email verification token in the db
  // We will try to find user with the hashed token generated by received token
  // If we find the user another check is if token expiry of that token is greater than current time if not that means it is expired
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  // If we found the user that means the token is valid
  // Now we can remove the associated email token and expiry date as we no  longer need them
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  // Tun the email verified flag to `true`
  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { isEmailVerified: true }, "Email is verified"));
});

// This controller is called when user is logged in and he has snackbar that your email is not verified
// In case he did not get the email or the email verification token is expired
// he will be able to resend the token while he is logged in
const ResendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  // if email is already verified throw an error
  if (user.isEmailVerified) {
    throw new ApiError(409, "Email is already verified!");
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken(); // generate email verification creds

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get(
        "host"
      )}/api/v1/users/verify-email/${unHashedToken}`
    ),
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "E-mail has been sent to your mail ID"));
});

const RefreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // check if incoming refresh token is same as the refresh token attached in the user document
    // This shows that the refresh token is used or not
    // Once it is used, we are replacing it with new refresh token below
    if (incomingRefreshToken !== user?.refreshToken) {
      // If token is valid but is used already
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await GenerateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const ForgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Get email from the client and check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  // Generate a temporary token
  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken(); // generate password reset creds

  // save the hashed version a of the token and expiry in the DB
  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  // Send mail with the password reset link. It should be the link of the frontend url with token
  await sendEmail({
    email: user?.email,
    subject: "Password reset request",
    mailgenContent: forgotPasswordMailgenContent(
      user.username,
      // ! NOTE: Following link should be the link of the frontend page responsible to request password reset
      // ! Frontend will send the below token with the new password in the request body to the backend reset password endpoint
      // * Ideally take the url from the .env file which should be teh url of the frontend
      `${req.protocol}://${req.get(
        "host"
      )}/api/v1/users/reset-password/${unHashedToken}`
    ),
  });
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset mail has been sent on your mail id"
      )
    );
});

const ResetForgottenPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  // Create a hash of the incoming reset token

  let hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // See if user with hash similar to resetToken exists
  // If yes then check if token expiry is greater than current date

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  });

  // If either of the one is false that means the token is invalid or expired
  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  // if everything is ok and token id valid
  // reset the forgot password token and expiry
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;

  // Set the provided password as the new password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

const ChangeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  // check the old password
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid old password");
  }

  // assign new password in plain text
  // We have a pre save method attached to user schema which automatically hashes the password whenever added/modified
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});



// Email Sending Implementation with Corrected OTP

const ForgotPasswordRequestOTP = asyncHandler(async (req, res) => {
  const { email, username, userId } = req.body;

  console.log("FORGOT PASSWORD REQUEST - Email:", email, "Username:", username, "UserID:", userId);

  // Validate at least one field is provided
  if (!email && !username && !userId) {
    return res.status(400).json({
      success: false,
      message: "Please provide email, username, or user ID",
      statusCode: 400,
      data: null
    });
  }

  // Build search query
  let searchQuery = {};
  if (userId) {
    searchQuery._id = userId;
  } else if (email) {
    searchQuery.email = email.toLowerCase().trim();
  } else if (username) {
    searchQuery.username = username.toLowerCase().trim();
  }

  const user = await User.findOne(searchQuery);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found. Please check your email, username, or user ID.",
      statusCode: 404,
      data: null
    });
  }

  console.log("USER FOUND - ID:", user._id, "Email:", user.email);

  // Generate OTP and reset token
  const otp = user.generateResetOTP();
  const resetToken = user.generateResetToken();

  await user.save({ validateBeforeSave: false });

  console.log("Generated OTP:", otp);
  console.log("OTP Length:", otp.length);
  console.log("Generated Reset Token:", resetToken);

  // SEND OTP VIA EMAIL - Using the proper template
  try {
    console.log("Attempting to send OTP email to:", user.email);

    await sendEmail({
      email: user.email,
      subject: "Password Reset OTP - FlashApp",
      mailgenContent: otpMailgenContent(user.username || 'User', otp),
    });

    console.log(`OTP email sent successfully to ${user.email}`);

  } catch (emailError) {
    console.error("Failed to send email:", emailError);
    console.error("Error message:", emailError.message);
    console.error("Error stack:", emailError.stack);

    //  Return error to client
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP email. Please try again later.",
      statusCode: 500,
      data: {
        error: emailError.message
      }
    });
  }

  return res.status(200).json({
    success: true,
    message: "OTP sent to your email",
    statusCode: 200,
    data: {
      resetToken,
      email: user.email,
    }
  });
});

//  Enhanced OTP verification with detailed logging and type conversion
const VerifyResetOTP = asyncHandler(async (req, res) => {
  const { resetToken, otp } = req.body;


  console.log("VERIFY OTP REQUEST");
  console.log(" Reset Token:", resetToken);
  console.log(" Received OTP:", otp);
  console.log(" Received OTP Type:", typeof otp);
  console.log(" Received OTP Length:", otp ? otp.length : 0);


  if (!resetToken || !otp) {
    return res.status(400).json({
      success: false,
      message: "Please provide reset token and OTP",
      statusCode: 400,
      data: null
    });
  }

  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    console.log("Invalid or expired reset token");
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset token",
      statusCode: 400,
      data: null
    });
  }

  // DETAILED LOGGING

  console.log("USER FOUND");
  console.log(" User Email:", user.email);
  console.log(" User ID:", user._id);
  console.log(" Stored OTP:", user.resetOTP);
  console.log(" Stored OTP Type:", typeof user.resetOTP);
  console.log(" Stored OTP Length:", user.resetOTP ? user.resetOTP.length : 0);
  console.log(" OTP Expiry:", new Date(user.resetOTPExpire));
  console.log(" Current Time:", new Date());
  console.log(" Is Expired?", user.resetOTPExpire < Date.now());


  // CONVERT BOTH TO STRING FOR SAFE COMPARISON
  const storedOTP = String(user.resetOTP).trim();
  const receivedOTP = String(otp).trim();

  console.log("COMPARISON");
  console.log("  Stored OTP (string):", storedOTP);
  console.log("  Received OTP (string):", receivedOTP);
  console.log("  Are they equal?", storedOTP === receivedOTP);


  // Check OTP with proper type conversion
  if (storedOTP !== receivedOTP) {
    console.log("OTP MISMATCH");
    console.log("  Expected:", storedOTP);
    console.log("  Got:", receivedOTP);
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
      statusCode: 400,
      data: null
    });
  }

  // Check expiry separately for better error messages
  if (user.resetOTPExpire < Date.now()) {
    console.log("OTP EXPIRED");
    return res.status(400).json({
      success: false,
      message: "OTP has expired. Please request a new one.",
      statusCode: 400,
      data: null
    });
  }

  console.log("OTP VERIFIED SUCCESSFULLY");

  return res.status(200).json({
    success: true,
    message: "OTP verified successfully",
    statusCode: 200,
    data: {
      resetToken,
      verified: true,
    }
  });
});

const ResetPasswordWithOTP = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  console.log("RESET PASSWORD REQUEST");
  console.log("Token:", token);
  console.log("New Password:", newPassword ? "provided" : "missing");

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Please provide token and new password",
      statusCode: 400,
      data: null
    });
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    console.log("Invalid or expired reset token");
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset token",
      statusCode: 400,
      data: null
    });
  }

  // Update password
  user.password = newPassword; // Will be hashed by pre-save hook
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.resetOTP = undefined;
  user.resetOTPExpire = undefined;

  await user.save({ validateBeforeSave: false });

  console.log("Password reset successful for:", user.email);

  return res.status(200).json({
    success: true,
    message: "Password reset successful",
    statusCode: 200,
    data: {}
  });
});




const AssignRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  user.role = role;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Role changed for the user"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const HandleSocialLogin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const { accessToken, refreshToken } = await GenerateAccessAndRefreshTokens(
    user._id
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(301)
    .cookie("accessToken", accessToken, options) // set the access token in the cookie
    .cookie("refreshToken", refreshToken, options) // set the refresh token in the cookie
    .redirect(
      // redirect user to the frontend with access and refresh token in case user is not using cookies
      `${process.env.CLIENT_SSO_REDIRECT_URL}?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
});

const UpdateUserAvatar = asyncHandler(async (req, res) => {
  // Check if user has uploaded an avatar
  if (!req.file?.filename) {
    throw new ApiError(400, "Avatar image is required");
  }

  // get avatar file system url and local path
  const avatarUrl = getStaticAvatarFilePath(req, req.file?.filename);
  const avatarLocalPath = getAvatarLocalPath(req.file?.filename);

  const user = await User.findById(req.user._id);

  let updatedUser = await User.findByIdAndUpdate(
    req.user._id,

    {
      $set: {
        // set the newly uploaded avatar
        avatar: {
          url: avatarUrl,
          localPath: avatarLocalPath,
        },
      },
    },
    { new: true }
  ).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
  );

  // remove the old avatar
  removeLocalFile(user.avatar.localPath);

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar updated successfully"));
});



// AUTHENTICATION & REGISTRATION

export {

  RegisterUser,
  RegisterNewUser,
  LoginUser,
  LogoutUser,
  GoogleLoginHandler,
  HandleSocialLogin,

  // TOKEN & SESSION MANAGEMENT
  RefreshAccessToken,


  // EMAIL VERIFICATION
  VerifyEmail,
  ResendEmailVerification,


  // PASSWORD MANAGEMENT
  ChangeCurrentPassword,
  ForgotPasswordRequest,
  ResetForgottenPassword,


  // PASSWORD RESET WITH OTP (New Method)
  ForgotPasswordRequestOTP,
  VerifyResetOTP,
  ResetPasswordWithOTP,


  // USER PROFILE & ROLES
  GetCurrentUser,
  UpdateUserAvatar,
  AssignRole,

};