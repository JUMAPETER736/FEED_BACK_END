

import mongoose from "mongoose";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../constants.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { FeedBookmark } from "../../../models/apps/feed/feed_bookmark.models.js";
import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import { FeedFollowUnfollow } from "../../../models/apps/feed/feed_followUnfollow.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { SocialFollow } from "../../../models/apps/social-media/follow.models.js";
import { FeedFollow } from "../../../models/apps/feed/feed_follow.models.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getFeedRecommendations } from "../../../services/recommendation.system.service.js";
// import { FeedFollow } from "../../../models/apps/feed/feed_followUnfollow.models.js";

import {
  getLocalPath,
  getMongoosePaginationOptions,
  getStaticFeedImagePath,
  getFeedImageLocalPath,
  getStaticMixedFilesFeedPath,
  getMixedFilesFeedImageLocalPath,
  getFeedAudioLocalPath,
  getStaticFeedAudioPath,
  getStaticFeedVideoPath,
  getStaticFeedThumbnailPath,
  getFeedVideoLocalPath,
  getFeedThumbnailLocalPath,
  getStaticFeedDocsPath,
  getFeedDocsLocalPath,
  getStaticFeedVnPath,
  getFeedVnLocalPath,
  getStaticFeedMultipleImagePath,
  getFeedMultipleImageLocalPath,
  getStaticThumbnailFilePath,
  removeLocalFile,
} from "../../../utils/helpers.js";
import path from "path";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { url } from "inspector";
import { pipeline } from "stream";
/**
 * @param {string} userId
 * @param {import("express").Request} req
 * @description Utility function which returns the pipeline stages to structure the social post schema with calculations like, likes count, comments count, isLiked, isBookmarked etc
 * @returns {mongoose.PipelineStage[]}
 */
// Check if the user has uploaded a thumbnail and extract file path



const feedCommonAggregation = (req) => {
  const userId = new mongoose.Types.ObjectId(req.user?._id);

  return [


 // STEP 1: Comments
    {
      $lookup: {
        from: "feedcomments",
        localField: "_id",
        foreignField: "postId",
        as: "postComments",
      },
    },
    { $addFields: { comments: { $size: "$postComments" } } },
    { $project: { postComments: 0 } },

    // STEP 2: Likes
    {
      $lookup: {
        from: "feedlikes",
        localField: "_id",
        foreignField: "postId",
        as: "postLikes",
      },
    },
    {
      $addFields: {
        likedByUserIds: { $map: { input: "$postLikes", as: "like", in: "$$like.likedBy" } },
        likes: { $size: "$postLikes" },
        isLiked: { $in: [userId, "$postLikes.likedBy"] },
      },
    },
    { $project: { postLikes: 0 } },



        // STEP 3: Bookmarks
    {
      $lookup: {
        from: "feedbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "postBookmarks",
      },
    },
    {
      $addFields: {
        bookmarkedByUserIds: "$postBookmarks.bookmarkedBy",
        bookmarkCount: { $size: "$postBookmarks" },
        isBookmarked: { $in: [userId, "$postBookmarks.bookmarkedBy"] },
      },
    },
    { $project: { postBookmarks: 0 } },

    // STEP 4: Reposts on THIS post (ObjectId match)
    {
      $lookup: {
        from: "feedposts",
        localField: "_id",
        foreignField: "originalPostId",
        as: "postReposts",
      },
    },
    {
      $addFields: {
        repostedByUserIds: {
          $map: { input: "$postReposts", as: "r", in: "$$r.repostedByUserId" },
        },
        repostCount: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: 0,
            else: { $size: "$postReposts" },
          },
        },
        isRepostedByMe: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: false,
            else: {
              $in: [
                userId,
                { $map: { input: "$postReposts", as: "r", in: "$$r.repostedByUserId" } },
              ],
            },
          },
        },
      },
    },
    { $project: { postReposts: 0 } },


    // STEP 5: Reposts on THIS post (String match - covers legacy data)
    {
      $lookup: {
        from: "feedposts",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$originalPostId", { $toString: "$$postId" }] },
                  { $ne: ["$repostedByUserId", null] }
                ]
              }
            }
          }
        ],
        as: "postRepostsStr",
      },
    },
    {
      $addFields: {
        repostedByUserIds: {
          $setUnion: [
            "$repostedByUserIds",
            { $map: { input: "$postRepostsStr", as: "r", in: "$$r.repostedByUserId" } }
          ]
        },
        repostCount: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: 0,
            else: {
              $add: [
                "$repostCount",
                { $size: "$postRepostsStr" }
              ]
            },
          },
        },
      },
    },
    { $project: { postRepostsStr: 0 } },

    // STEP 6: feedShortsBusinessId
    {
      $addFields: {
        feedShortsBusinessId: { $ifNull: ["$feedShortsBusinessId", ""] },
      },
    },


     // STEP 7: Follow status
    {
      $lookup: {
        from: "socialfollows",
        let: { authorId: "$author" },
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
    { $addFields: { isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] } } },

    // STEP 8: Close friends
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
    { $addFields: { isInCloseFriends: { $gt: [{ $size: "$isCloseFriendArray" }, 0] } } },
    { $project: { isCloseFriendArray: 0 } },


     // STEP 9: Muted posts
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
    { $addFields: { isPostsMuted: { $gt: [{ $size: "$isMutedPostsArray" }, 0] } } },
    { $project: { isMutedPostsArray: 0 } },

    // STEP 10: Muted stories
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
    { $addFields: { isStoriesMuted: { $gt: [{ $size: "$isMutedStoriesArray" }, 0] } } },
    { $project: { isMutedStoriesArray: 0 } },



    ];
};