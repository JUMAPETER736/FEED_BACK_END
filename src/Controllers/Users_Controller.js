import asyncHandler from "express-async-handler";
import User from "../data/models/userModel.js";
import generateToken from "../config/generateToken.js";

//  REGISTER FUNCTION
const RegisterUser = asyncHandler(async (req, res) => {
    const { name, email, password, pic } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error("Please enter all fields");
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error("User already exists");
    }

    const user = await User.create({
        name,
        email,
        password,
        pic,
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

//  AUTH FUNCTION
const AuthUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            pic: user.pic,
            token: generateToken(user.id),
        });
    } else {
        res.status(401);
        throw new Error("Invalid Email or password");
    }
});

// FORGOT PASSWORD REQUEST - SUPPORTS EMAIL, USERNAME, AND USER ID
const ForgotPasswordRequest = asyncHandler(async (req, res) => {
    const { email, username, userId } = req.body;

    console.log("\n" + "=".repeat(80));
    console.log("📧 FORGOT PASSWORD REQUEST RECEIVED");
    console.log("=".repeat(80));
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log("Email provided:", email);
    console.log("Username provided:", username);
    console.log("User ID provided:", userId);
    console.log("=".repeat(80) + "\n");

    // Validate that at least one field is provided
    if (!email && !username && !userId) {
        console.log("❌ VALIDATION FAILED: No email, username, or userId provided");
        return res.status(400).json({
            success: false,
            message: "Please provide email, username, or user ID",
            statusCode: 400,
            data: null
        });
    }

    // Build search query - Priority: userId > email > username
    let searchQuery = {};
    let searchType = "";

    if (userId) {
        searchQuery._id = userId;
        searchType = "USER ID";
        console.log("🔍 Searching by USER ID:", userId);
    } else if (email) {
        searchQuery.email = email.toLowerCase().trim();
        searchType = "EMAIL";
        console.log("🔍 Searching by EMAIL:", searchQuery.email);
    } else if (username) {
        searchQuery.username = username.toLowerCase().trim();
        searchType = "USERNAME";
        console.log("🔍 Searching by USERNAME:", searchQuery.username);
    }

    console.log("📋 Final Search Query:", JSON.stringify(searchQuery, null, 2));
    console.log("🔎 Search Type:", searchType);

    try {
        // Find user
        const user = await User.findOne(searchQuery);

        if (!user) {
            console.log("\n❌ USER NOT FOUND");
            console.log("Search criteria:", JSON.stringify(searchQuery, null, 2));

            // Debug: List sample users (REMOVE IN PRODUCTION)
            const allUsers = await User.find({}, 'username email _id').limit(5);
            console.log("📊 Sample users in database:");
            allUsers.forEach(u => {
                console.log(`   - ID: ${u._id}, Username: ${u.username}, Email: ${u.email}`);
            });
            console.log("=".repeat(80) + "\n");

            return res.status(404).json({
                success: false,
                message: "User not found. Please check your email, username, or user ID.",
                statusCode: 404,
                data: null
            });
        }

        console.log("\n✅ USER FOUND!");
        console.log("   User ID:", user._id);
        console.log("   Username:", user.username);
        console.log("   Email:", user.email);

        // Generate OTP and reset token
        const otp = user.generateResetOTP();
        const resetToken = user.generateResetToken();

        await user.save();

        console.log("🔐 Generated OTP:", otp);
        console.log("🎟️  Generated Reset Token:", resetToken);
        console.log("=".repeat(80) + "\n");

        // TODO: Send OTP via email
        console.log(`📨 Password Reset OTP for ${user.email}: ${otp}`);

        return res.status(200).json({
            success: true,
            message: "OTP sent to your email",
            statusCode: 200,
            data: {
                resetToken,
                email: user.email,
            },
        });

    } catch (error) {
        console.log("\n💥 ERROR in forgotPasswordRequest:");
        console.log("   Message:", error.message);
        console.log("   Stack:", error.stack);
        console.log("=".repeat(80) + "\n");

        return res.status(500).json({
            success: false,
            message: error.message || "An error occurred while processing your request",
            statusCode: 500,
            data: null
        });
    }
});

// VERIFY OTP (STEP 2)
const VerifyResetOTP = asyncHandler(async (req, res) => {
    const { resetToken, otp } = req.body;

    console.log("\n📋 VERIFY OTP REQUEST");
    console.log("   Token:", resetToken);
    console.log("   OTP:", otp);

    if (!resetToken || !otp) {
        res.status(400);
        throw new Error("Please provide reset token and OTP");
    }

    const user = await User.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
        console.log("❌ Invalid or expired reset token");
        res.status(400);
        throw new Error("Invalid or expired reset token");
    }

    // Check OTP
    if (user.resetOTP !== otp || user.resetOTPExpire < Date.now()) {
        console.log("❌ Invalid or expired OTP");
        console.log("   Expected:", user.resetOTP);
        console.log("   Received:", otp);
        res.status(400);
        throw new Error("Invalid or expired OTP");
    }

    console.log("✅ OTP verified successfully");

    res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        statusCode: 200,
        data: {
            resetToken,
            verified: true,
        },
    });
});

//  RESET PASSWORD (STEP 3)
const ResetForgottenPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    console.log("\n🔑 RESET PASSWORD REQUEST");

    if (!token || !newPassword) {
        res.status(400);
        throw new Error("Please provide token and new password");
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        res.status(400);
        throw new Error(
            "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character"
        );
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
        console.log("❌ Invalid or expired reset token");
        res.status(400);
        throw new Error("Invalid or expired reset token");
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    user.resetOTP = null;
    user.resetOTPExpire = null;

    await user.save();

    console.log("✅ Password reset successful for:", user.email);

    res.status(200).json({
        success: true,
        message: "Password reset successful",
        statusCode: 200,
        data: {},
    });
});

//RESEND EMAIL VERIFICATION
const ResendEmailVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error("Please provide email");
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // Check if already verified
    if (user.isEmailVerified) {
        res.status(400);
        throw new Error("Email is already verified");
    }

    // Generate new verification OTP
    const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();

    user.emailVerificationOTP = verificationOTP;
    user.emailVerificationExpire = Date.now() + 600000; // 10 minutes

    await user.save();

    // Send verification email
    console.log(`📧 Verification OTP for ${user.email}: ${verificationOTP}`);

    res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
        statusCode: 200,
        data: {
            email: user.email,
            otpSent: true,
        },
    });
});

export {
    RegisterUser,
    AuthUser,
    ForgotPasswordRequest,
    VerifyResetOTP,
    ResetForgottenPassword,
    ResendEmailVerification,
};