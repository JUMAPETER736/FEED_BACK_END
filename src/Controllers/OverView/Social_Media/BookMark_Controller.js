


import mongoose from "mongoose";
import { SocialBookmark } from "../../../models/apps/social-media/bookmark.models.js";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";

const toggleBookmark = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);
  if (!post) throw new ApiError(404, "Post does not exist");

  const existing = await SocialBookmark.findOne({ postId, bookmarkedBy: req.user._id });

  if (existing) {
    await SocialBookmark.findOneAndDelete({ postId, bookmarkedBy: req.user._id });
    return res
      .status(200)
      .json(new ApiResponse(200, { isBookmarked: false }, "Bookmark removed successfully"));
  }

  await SocialBookmark.create({ postId: post._id, bookmarkedBy: req.user._id });

  return res
    .status(200)
    .json(new ApiResponse(200, { isBookmarked: true }, "Post bookmarked successfully"));
});