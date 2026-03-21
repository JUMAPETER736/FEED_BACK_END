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


const postCommonAggregation = (req) => {
  const currentUserId = req.user?._id
    ? new mongoose.Types.ObjectId(req.user._id)
    : null;

  const currentUserIdStr = req.user?._id ? req.user._id.toString() : null;

  return [
    {
      $lookup: {
        from: "businessproducts",
        let: { businessId: "$feedShortsBusinessId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: "$_id" }, "$$businessId"] },
            },
          },
          {
            $lookup: {
              from: "socialprofiles",
              localField: "owner",
              foreignField: "owner",
              as: "author",
              pipeline: [
                {
                  $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "account",
                    pipeline: [
                      { $project: { avatar: 1, username: 1, _id: 1 } },
                    ],
                  },
                },
                {
                  $addFields: {
                    account: {
                      $ifNull: [{ $arrayElemAt: ["$account", 0] }, {}],
                    },
                  },
                },
                { $project: { _id: 1, firstName: 1, lastName: 1, account: 1 } },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ],
        as: "businessDetails",
      },
    },
    {
      $addFields: {
        isBusinessPost: {
          $and: [
            { $ne: ["$feedShortsBusinessId", null] },
            { $ne: ["$feedShortsBusinessId", ""] },
            { $gt: [{ $size: { $ifNull: ["$businessDetails", []] } }, 0] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "businessprofiles",
        let: { ownerId: "$author", isBusinessPost: "$isBusinessPost" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$$isBusinessPost", true] },
                  { $eq: ["$owner", "$$ownerId"] },
                ],
              },
            },
          },
          {
            $project: {
              businessName: 1,
              businessType: 1,
              businessDescription: 1,
              backgroundPhoto: 1,
              contact: 1,
            },
          },
        ],
        as: "businessProfile",
      },
    },
    {
      $addFields: {
        "businessDetails.businessProfile": {
          $ifNull: [{ $arrayElemAt: ["$businessProfile", 0] }, null],
        },
      },
    },
    { $unwind: { path: "$businessDetails", preserveNullAndEmptyArrays: true } },
    { $project: { businessProfile: 0 } },

    // Core lookups 
    {
      $lookup: {
        from: "socialcomments",
        localField: "_id",
        foreignField: "postId",
        as: "commentsData",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "postId",
        as: "likesData",
      },
    },
    {
      $lookup: {
        from: "socialbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "bookmarksData",
      },
    },

    //  Follow status 
    {
      $lookup: {
        from: "socialfollows",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [{ $toString: "$followerId" }, currentUserIdStr] },
                  {
                    $eq: [
                      { $toString: "$followeeId" },
                      { $toString: "$$authorId" },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isFollowingArr",
      },
    },

    //  Author lookup
    {
      $lookup: {
        from: "socialprofiles",
        localField: "author",
        foreignField: "owner",
        as: "author",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "account",
              pipeline: [
                {
                  $project: { avatar: 1, email: 1, username: 1, _id: 1 },
                },
              ],
            },
          },
          { $addFields: { account: { $first: "$account" } } },
        ],
      },
    },

    // Computed fields 
    {
      $addFields: {
        author: {
          $mergeObjects: [
            { $first: "$author" },
            { authorId: "$author._id" },
          ],
        },
        likedByIds: { $map: { input: "$likesData", as: "like", in: "$$like.likedBy" } },
        commentedByIds: {
          $filter: {
            input: {
              $map: {
                input: "$commentsData",
                as: "comment",
                in: { $ifNull: ["$$comment.commentedBy", "$$comment.author"] },
              },
            },
            as: "id",
            cond: { $ne: ["$$id", null] },
          },
        },
        bookmarkedByIds: { $map: { input: "$bookmarksData", as: "bookmark", in: "$$bookmark.bookmarkedBy" } },
        likes: { $size: "$likesData" },
        bookmarks: { $size: "$bookmarksData" },
        comments: { $size: "$commentsData" },
        isLiked: {
          $cond: {
            if: { $eq: [currentUserIdStr, null] },
            then: false,
            else: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$likesData",
                          as: "like",
                          cond: { $eq: [{ $toString: "$$like.likedBy" }, currentUserIdStr] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        isBookmarked: {
          $cond: {
            if: { $eq: [currentUserIdStr, null] },
            then: false,
            else: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$bookmarksData",
                          as: "bookmark",
                          cond: { $eq: [{ $toString: "$$bookmark.bookmarkedBy" }, currentUserIdStr] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        isFollowing: { $gt: [{ $size: "$isFollowingArr" }, 0] },
      },
    },

    //  Clean up
    {
      $project: {
        isFollowingArr: 0,
        likesData: 0,
        bookmarksData: 0,
        commentsData: 0,
      },
    },
  ];
};