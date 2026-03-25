

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