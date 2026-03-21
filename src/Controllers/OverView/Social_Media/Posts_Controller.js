import mongoose from "mongoose";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../constants.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { SocialBookmark } from "../../../models/apps/social-media/bookmark.models.js";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { SocialFollow } from "../../../models/apps/social-media/follow.models.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { SocialLike } from "../../../models/apps/social-media/like.models.js";
import { SocialComment } from "../../../models/apps/social-media/comment.models.js";
import { getShotsRecommendations } from "../../../services/recommendation.system.service.js";

import {
  getLocalPath,
  getMongoosePaginationOptions,
  getStaticFilePath,
  getThumbnailLocalPath,
  getStaticThumbnailFilePath,
  removeLocalFile,
} from "../../../utils/helpers.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";

//  Shorts-only match filter
const SHORTS_MATCH = {
  feedShortsBusinessId: { $exists: true, $ne: null, $ne: "" },
};

// Helper to convert IDs to ObjectIds safely 
const toObjectIds = (ids) =>
  ids
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id.toString());
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);



const createPost = asyncHandler(async (req, res) => {
  const { content, tags, fileId, feedShortsBusinessId } = req.body;

  const images =
    req.files.images && req.files.images?.length
      ? req.files.images.map((image) => ({
        url: getStaticFilePath(req, image.filename),
        localPath: getLocalPath(image.filename),
      }))
      : [];

  const thumbnail =
    req.files.thumbnail && req.files.thumbnail?.length
      ? req.files.thumbnail.map((image) => ({
        thumbnailUrl: getStaticThumbnailFilePath(req, image.filename),
        thumbnailLocalPath: getThumbnailLocalPath(image.filename),
      }))
      : [];

  const author = req.user._id;

  const post = await SocialPost.create({
    content,
    tags: tags || [],
    author,
    images,
    thumbnail,
    fileId,
    feedShortsBusinessId,
  });

  if (!post) throw new ApiError(500, "Error while creating a post");

  const createdPost = await SocialPost.aggregate([
    { $match: { _id: post._id } },
    ...postCommonAggregation(req),
  ]);

  return res.status(201).json(new ApiResponse(201, createdPost[0], "Short created successfully"));
});

