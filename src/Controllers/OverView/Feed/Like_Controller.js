

import { FeedComment } from "../../../models/apps/feed/feed_comment.model.js";
import { FeedCommentReply } from "../../../models/apps/feed/feed_comment.reply.models.js";
import { FeedLike } from "../../../models/apps/feed/feed_like.models.js";
import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { emitSocketEvent } from "../../../socket/index.js";
import mongoose from "mongoose";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import { unifiedNotificationCommonAggregation } from "../../../aggregations/unifiedNotifications.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";



const feedCommonAggregation = (req) => {
  const userId = new mongoose.Types.ObjectId(req.user?._id);

  return [
    // Lookup for comments
    {
      $lookup: {
        from: "feedcomments",
        localField: "_id",
        foreignField: "postId",
        as: "comments",
      },
    },
    {
      $addFields: {
        comments: { $size: "$comments" },
      },
    },

    // Lookup for likes and calculate likes count
    {
      $lookup: {
        from: "feedlikes",
        localField: "_id",
        foreignField: "postId",
        as: "likes",
      },
    },
    {
      $addFields: {
        likes: { $size: "$likes" },
      },
    },

    // Lookup to check if the post is liked by the current user
    {
      $lookup: {
        from: "feedlikes",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postId", "$$postId"] },
                  { $eq: ["$likedBy", userId] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isLikedArray",
      },
    },
    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$isLikedArray" }, 0] },
      },
    },
    {
      $project: {
        isLikedArray: 0,
      },
    },

    // Ensure feedShortsBusinessId is a non-null string
    {
      $addFields: {
        feedShortsBusinessId: { $ifNull: ["$feedShortsBusinessId", ""] },
      },
    },

    // Lookup for follow status
    {
      $lookup: {
        from: "socialfollows",
        let: { authorId: { $arrayElemAt: ["$author._id", 0] } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$followerId", userId] },
                  { $eq: ["$followeeId", "$$authorId"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isFollowing",
      },
    },
    {
      $addFields: {
        isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
      },
    },

    // Lookup for bookmark status
    {
      $lookup: {
        from: "bookmarks",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postId", "$$postId"] },
                  { $eq: ["$userId", userId] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isBookmarkedArray",
      },
    },
    {
      $addFields: {
        isBookmarked: { $gt: [{ $size: "$isBookmarkedArray" }, 0] },
      },
    },
    {
      $project: {
        isFollowingArray: 0,
        isBookmarkedArray: 0,
      },
    },

    // Lookup for bookmark count
    {
      $lookup: {
        from: "feedbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "bookmarks",
      },
    },
    {
      $addFields: {
        bookmarkCount: { $size: "$bookmarks" },
      },
    },
    {
      $project: {
        bookmarks: 0,
      },
    },

    // Check if author is in close friends
    {
      $lookup: {
        from: "socialclosefriends",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", userId] },
                  { $eq: ["$closeFriendId", "$$authorId"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isCloseFriendArray",
      },
    },
    {
      $addFields: {
        isInCloseFriends: { $gt: [{ $size: "$isCloseFriendArray" }, 0] },
      },
    },
    {
      $project: {
        isCloseFriendArray: 0,
      },
    },

    // Check if author's posts are muted
    {
      $lookup: {
        from: "socialmutedposts",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", userId] },
                  { $eq: ["$mutedUserId", "$$authorId"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isMutedPostsArray",
      },
    },
    {
      $addFields: {
        isPostsMuted: { $gt: [{ $size: "$isMutedPostsArray" }, 0] },
      },
    },
    {
      $project: {
        isMutedPostsArray: 0,
      },
    },

    // Check if author's stories are muted
    {
      $lookup: {
        from: "socialmutedstories",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", userId] },
                  { $eq: ["$mutedUserId", "$$authorId"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isMutedStoriesArray",
      },
    },
    {
      $addFields: {
        isStoriesMuted: { $gt: [{ $size: "$isMutedStoriesArray" }, 0] },
      },
    },
    {
      $project: {
        isMutedStoriesArray: 0,
      },
    },

    // Check if author is in favorites
    {
      $lookup: {
        from: "socialfavorites",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", userId] },
                  { $eq: ["$favoriteUserId", "$$authorId"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isFavoriteArray",
      },
    },
    {
      $addFields: {
        isFavorite: { $gt: [{ $size: "$isFavoriteArray" }, 0] },
      },
    },
    {
      $project: {
        isFavoriteArray: 0,
      },
    },

    // Check if author is restricted
    {
      $lookup: {
        from: "socialrestricteds",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", userId] },
                  { $eq: ["$restrictedUserId", "$$authorId"] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isRestrictedArray",
      },
    },
    {
      $addFields: {
        isRestricted: { $gt: [{ $size: "$isRestrictedArray" }, 0] },
      },
    },
    {
      $project: {
        isRestrictedArray: 0,
      },
    },

    // Lookup for repostedUser details
    {
      $lookup: {
        from: "users",
        localField: "repostedByUserId",
        foreignField: "_id",
        as: "repostedUser",
        pipeline: [
          {
            $project: {
              avatar: 1,
              email: 1,
              username: 1,
              _id: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        repostedUser: { $arrayElemAt: ["$repostedUser", 0] },
      },
    },

    // Lookup for the post's author
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
                  $project: {
                    avatar: 1,
                    email: 1,
                    username: 1,
                    _id: 1,
                    createdAt: 1,
                    updatedAt: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              account: { $ifNull: [{ $arrayElemAt: ["$account", 0] }, {}] },
            },
          },
        ],
      },
    },

    // Lookup for original post details
    {
      $lookup: {
        from: "feedpost",
        localField: "_id",
        foreignField: "originalPostId",
        as: "originalPost",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "originalPostReposter",
              pipeline: [
                {
                  $project: {
                    avatar: 1,
                    email: 1,
                    username: 1,
                    _id: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    feedShortsBusinessId: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              author: {
                $cond: {
                  if: { $gt: [{ $size: "$originalPostReposter" }, 0] },
                  then: { $arrayElemAt: ["$author", 0] },
                  else: "$originalPostReposter",
                },
              },
            },
          },
        ],
      },
    },

    {
      $lookup: {
        from: "feedposts",
        localField: "originalPostId",
        foreignField: "_id",
        as: "originalPost",
        pipeline: [
          {
            $lookup: {
              from: "feedcomments",
              localField: "_id",
              foreignField: "postId",
              as: "comments",
            },
          },
          {
            $lookup: {
              from: "feedlikes",
              localField: "_id",
              foreignField: "postId",
              as: "likes",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "repostedByUserId",
              foreignField: "_id",
              as: "originalPostReposter",
              pipeline: [
                {
                  $project: {
                    avatar: 1,
                    email: 1,
                    username: 1,
                    _id: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    feedShortsBusinessId: 1,
                  },
                },
              ],
            },
          },
          {
            $lookup: {
              from: "feedbookmarks",
              localField: "_id",
              foreignField: "postId",
              as: "bookmarks",
            },
          },
          {
            $addFields: {
              commentCount: { $size: "$comments" },
              likeCount: { $size: "$likes" },
              bookmarkCount: { $size: "$bookmarks" },
              author: {
                $cond: {
                  if: { $gt: [{ $size: "$originalPostReposter" }, 0] },
                  then: { $arrayElemAt: ["$author", 0] },
                  else: "$originalPostReposter",
                },
              },
            },
          },
          {
            $project: {
              comments: 0,
              likes: 0,
            },
          },
          {
            $lookup: {
              from: "feedposts",
              localField: "_id",
              foreignField: "originalPostId",
              as: "reposts",
            },
          },
          {
            $addFields: {
              repostCount: { $size: "$reposts" },
            },
          },
          {
            $project: {
              reposts: 0,
            },
          },
        ],
      },
    },

    {
      $addFields: {
        author: {
          $cond: {
            if: { $isArray: "$author" },
            then: { $arrayElemAt: ["$author", 0] },
            else: "$author",
          },
        },
      },
    },

    {
      $addFields: {
        isExpanded: false,
        isLocal: false,
      },
    },

    {
      $project: {
        followersEntity: 0,
        originalPostId: 0,
      },
    },
  ];
};