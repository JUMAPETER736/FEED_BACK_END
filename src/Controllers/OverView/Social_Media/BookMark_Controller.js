


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

const getMyBookmarkedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const { postCommonAggregation } = await import("./post.controllers.js");

  // Get ALL bookmarked postIds from everyone in the system
  const allBookmarkedPostIds = await SocialBookmark.distinct("postId");

  if (!allBookmarkedPostIds.length) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalBookmarkedShorts: 0,
          bookmarkedShorts: [],
          page: Number(page),
          limit: Number(limit),
          totalPages: 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
        "No bookmarked shorts found"
      )
    );
  }

  const objectIds = allBookmarkedPostIds
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id.toString());
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const postAggregation = SocialPost.aggregate([
    { $match: { _id: { $in: objectIds } } },
    { $sort: { createdAt: -1 } },
    ...postCommonAggregation(req),
  ]);

  const posts = await SocialPost.aggregatePaginate(
    postAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: { totalDocs: "totalBookmarkedShorts", docs: "bookmarkedShorts" },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "Bookmarked shorts fetched successfully"));
});

export { toggleBookmark, getMyBookmarkedPosts };