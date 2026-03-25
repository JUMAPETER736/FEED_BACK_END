

import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";

import {
  SocialCloseFriends,
  SocialMutedPosts,
  SocialMutedStories,
  SocialFavorites,
  SocialRestricted
} from "../../../models/apps/social-media/userFollowingShowMoreOptions.models.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { User } from "../../../models/apps/auth/user.models.js";

/* ==================== HELPERS ==================== */
const validateUserId = (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
};


const populateUserDetails = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const socialProfile = await SocialProfile.findOne({ owner: userId });

  const userDetails = {
    _id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.avatar) {
    userDetails.avatar = {
      url: user.avatar.url,
      localPath: user.avatar.localPath,
      _id: user.avatar._id,
    };
  }

  if (socialProfile) {
    userDetails.coverImage = socialProfile.coverImage;
    userDetails.firstName = socialProfile.firstName;
    userDetails.lastName = socialProfile.lastName;
    userDetails.bio = socialProfile.bio;
    userDetails.dob = socialProfile.dob;
    userDetails.location = socialProfile.location;
    userDetails.countryCode = socialProfile.countryCode;
    userDetails.phoneNumber = socialProfile.phoneNumber;
    userDetails.profileId = socialProfile._id;
  }

  return userDetails;
};