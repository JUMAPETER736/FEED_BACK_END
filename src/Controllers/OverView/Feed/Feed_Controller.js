

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


    // STEP 11: Favorites
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
    { $addFields: { isFavorite: { $gt: [{ $size: "$isFavoriteArray" }, 0] } } },
    { $project: { isFavoriteArray: 0 } },

    // STEP 12: Restricted
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
    { $addFields: { isRestricted: { $gt: [{ $size: "$isRestrictedArray" }, 0] } } },
    { $project: { isRestrictedArray: 0 } },


     // STEP 13: Reposter user details
    {
      $lookup: {
        from: "users",
        localField: "repostedByUserId",
        foreignField: "_id",
        as: "repostedUser",
        pipeline: [
          {
            $lookup: {
              from: "socialprofiles",
              localField: "_id",
              foreignField: "owner",
              as: "profile",
            },
          },
          { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              avatar: 1,
              email: 1,
              username: 1,
              createdAt: 1,
              updatedAt: 1,
              coverImage: "$profile.coverImage",
              firstName: "$profile.firstName",
              lastName: "$profile.lastName",
              bio: "$profile.bio",
              owner: "$_id",
            },
          },
        ],
      },
    },
    { $addFields: { repostedUser: { $arrayElemAt: ["$repostedUser", 0] } } },

    // STEP 14: Post author
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


     // STEP 15: Lookup ORIGINAL POST
    // Uses _safeOriginalPostId so standalone posts (repostedByUserId=null)
    // never match anything → originalPost = []
    {
      $addFields: {
        _safeOriginalPostId: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: "$originalPostId",
            else: "$$REMOVE",
          },
        },
      },
    },
    {
      $lookup: {
        from: "feedposts",
        localField: "_safeOriginalPostId",
        foreignField: "_id",
        as: "originalPost",
        pipeline: [
          {
            $lookup: {
              from: "socialprofiles",
              localField: "author",
              foreignField: "owner",
              as: "authorProfile",
            },
          },
          { $unwind: { path: "$authorProfile", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "users",
              localField: "authorProfile.owner",
              foreignField: "_id",
              as: "authorAccount",
            },
          },
          { $unwind: { path: "$authorAccount", preserveNullAndEmptyArrays: true } },
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
              from: "feedbookmarks",
              localField: "_id",
              foreignField: "postId",
              as: "bookmarks",
            },
          },
          {
            $lookup: {
              from: "feedposts",
              let: { origId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$originalPostId", "$$origId"] },
                        { $ne: ["$repostedByUserId", null] }
                      ]
                    }
                  }
                }
              ],
              as: "reposts",
            },
          },
          {
            $lookup: {
              from: "feedshares",
              localField: "_id",
              foreignField: "postId",
              as: "shares",
            },
          },
          {
            $lookup: {
              from: "users",
              let: { reposterIds: "$reposts.repostedByUserId" },
              pipeline: [
                { $match: { $expr: { $in: ["$_id", "$$reposterIds"] } } },
                {
                  $lookup: {
                    from: "socialprofiles",
                    localField: "_id",
                    foreignField: "owner",
                    as: "profile",
                  },
                },
                { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
                {
                  $project: {
                    _id: 1,
                    avatar: 1,
                    username: 1,
                    email: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    coverImage: "$profile.coverImage",
                    firstName: "$profile.firstName",
                    lastName: "$profile.lastName",
                    bio: "$profile.bio",
                    owner: "$_id",
                  },
                },
              ],
              as: "originalPostReposter",
            },
          },
          {
            $project: {
              _id: 1,
              __v: 1,
              content: 1,
              duration: 1,
              feedShortsBusinessId: 1,
              tags: 1,
              contentType: 1,
              numberOfPages: 1,
              fileNames: 1,
              fileTypes: 1,
              fileSizes: 1,
              files: 1,
              fileIds: 1,
              thumbnail: 1,
              createdAt: 1,
              updatedAt: 1,
              originalPostId: { $literal: null },
              isReposted: { $literal: false },
              repostedByUserId: { $literal: null },
              repostedUsers: { $literal: [] },
              author: {
                _id: "$authorProfile._id",
                coverImage: "$authorProfile.coverImage",
                firstName: "$authorProfile.firstName",
                lastName: "$authorProfile.lastName",
                bio: "$authorProfile.bio",
                dob: "$authorProfile.dob",
                location: "$authorProfile.location",
                countryCode: "$authorProfile.countryCode",
                phoneNumber: "$authorProfile.phoneNumber",
                owner: "$authorProfile.owner",
                createdAt: "$authorProfile.createdAt",
                updatedAt: "$authorProfile.updatedAt",
                __v: "$authorProfile.__v",
                account: {
                  _id: "$authorAccount._id",
                  avatar: "$authorAccount.avatar",
                  username: "$authorAccount.username",
                  email: "$authorAccount.email",
                  createdAt: "$authorAccount.createdAt",
                  updatedAt: "$authorAccount.updatedAt",
                },
              },
              originalPostReposter: "$originalPostReposter",
              bookmarks: "$bookmarks",
              commentCount: { $size: "$comments" },
              likeCount: { $size: "$likes" },
              bookmarkCount: { $size: "$bookmarks" },
              repostCount: { $size: "$reposts" },
              shareCount: { $size: "$shares" },
            },
          },
        ],
      },
    },


     // Remove the temporary safe-id field
    { $project: { _safeOriginalPostId: 0 } },

    // Safety net — standalone posts always get []
    {
      $addFields: {
        originalPost: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: "$originalPost",
            else: [],
          },
        },
      },
    },

    // STEP 16: author array → object
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

    // STEP 17: UI helpers
    {
      $addFields: {
        isExpanded: false,
        isLocal: false,
      },
    },

    // STEP 18: Cleanup
    // ✅ FIX: originalPostId is NO LONGER removed here so getAllFeed
    //         post-processing loop can use it
    {
      $project: {
        followersEntity: 0,
        // originalPostId: 0,  ← REMOVED - this was breaking getAllFeed
      },
    },


    ];
};



const feedAggregation = (req) => {
  const userId = new mongoose.Types.ObjectId(req.user?._id);

  return [


     {
      $lookup: {
        from: "businessproducts",
        let: { businessId: "$feedShortsBusinessId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [{ $toString: "$_id" }, "$$businessId"]
              }
            }
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
                      {
                        $project: {
                          avatar: 1,
                          username: 1,
                          _id: 1,
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
                {
                  $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    account: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$author",
              preserveNullAndEmptyArrays: true
            }
          }
        ],
        as: "businessDetails"
      }
    },


 {
      $addFields: {
        isBusinessPost: {
          $and: [
            { $ne: ["$feedShortsBusinessId", null] },
            { $ne: ["$feedShortsBusinessId", ""] },
            { $gt: [{ $size: { $ifNull: ["$businessDetails", []] } }, 0] }
          ]
        }
      }
    },

    {
      $lookup: {
        from: "businessprofiles",
        let: {
          ownerId: "$author",
          isBusinessPost: "$isBusinessPost"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$$isBusinessPost", true] },
                  { $eq: ["$owner", "$$ownerId"] }
                ]
              }
            }
          },
          {
            $project: {
              businessName: 1,
              businessType: 1,
              businessDescription: 1,
              backgroundPhoto: 1,
              contact: 1
            }
          }
        ],
        as: "businessProfile"
      }
    },

    {
      $addFields: {
        "businessDetails.businessProfile": {
          $ifNull: [{ $arrayElemAt: ["$businessProfile", 0] }, null]
        }
      }
    },

    {
      $unwind: {
        path: "$businessDetails",
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $project: {
        businessProfile: 0
      }
    },


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
    {
      $addFields: {
        isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
      },
    },
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
    {
      $lookup: {
        from: "users",
        localField: "repostedByUserId",
        foreignField: "_id",
        as: "repostedUserAccount",
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
      $lookup: {
        from: "socialprofiles",
        localField: "repostedByUserId",
        foreignField: "owner",
        as: "repostedUserProfile",
        pipeline: [
          {
            $project: {
              firstName: 1,
              lastName: 1,
              bio: 1,
              coverImage: 1,
              _id: 1,
              owner: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        repostedUser: {
          $cond: {
            if: { $gt: [{ $size: "$repostedUserAccount" }, 0] },
            then: {
              $mergeObjects: [
                { $arrayElemAt: ["$repostedUserAccount", 0] },
                { $arrayElemAt: ["$repostedUserProfile", 0] }
              ]
            },
            else: null
          }
        }
      },
    },
     {
      $project: {
        repostedUserAccount: 0,
        repostedUserProfile: 0,
      },
    },

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

    // ✅ FIX: Use _safeOriginalPostId to prevent standalone posts
    //         from accidentally matching something via null lookup
    {
      $addFields: {
        _safeOriginalPostId: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: "$originalPostId",
            else: "$$REMOVE",
          },
        },
      },
    },

    {
      $lookup: {
        from: "feedposts",
        localField: "_safeOriginalPostId",
        foreignField: "_id",
        as: "originalPost",
        pipeline: [
          {
            $lookup: {
              from: "socialprofiles",
              localField: "author",
              foreignField: "owner",
              as: "authorProfile",
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
                {
                  $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    bio: 1,
                    coverImage: 1,
                    dob: 1,
                    location: 1,
                    countryCode: 1,
                    phoneNumber: 1,
                    owner: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    account: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              author: { $arrayElemAt: ["$authorProfile", 0] },
            },
          },
          {
            $project: {
              authorProfile: 0,
            },
          },

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
              as: "originalPostReposterAccount",
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
            $lookup: {
              from: "socialprofiles",
              localField: "repostedByUserId",
              foreignField: "owner",
              as: "originalPostReposterProfile",
              pipeline: [
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                    bio: 1,
                    coverImage: 1,
                    _id: 1,
                    owner: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              originalPostReposter: {
                $cond: {
                  if: { $gt: [{ $size: "$originalPostReposterAccount" }, 0] },
                  then: [
                    {
                      $mergeObjects: [
                        { $arrayElemAt: ["$originalPostReposterAccount", 0] },
                        { $arrayElemAt: ["$originalPostReposterProfile", 0] }
                      ]
                    }
                  ],
                  else: []
                }
              }
            },
          },
          {
            $project: {
              originalPostReposterAccount: 0,
              originalPostReposterProfile: 0,
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
              let: { origId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$originalPostId", "$$origId"] },
                        { $ne: ["$repostedByUserId", null] }
                      ]
                    }
                  }
                }
              ],
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


 // Remove temp field
    { $project: { _safeOriginalPostId: 0 } },

    // Safety net — standalone posts always get []
    {
      $addFields: {
        originalPost: {
          $cond: {
            if: { $ne: ["$repostedByUserId", null] },
            then: "$originalPost",
            else: [],
          },
        },
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

    // ✅ FIX: originalPostId is NO LONGER removed here
    //         so post-processing loop in getAllFeed can use it
    {
      $project: {
        followersEntity: 0,
        // originalPostId: 0,  ← REMOVED - this was the root cause
      },
    },



    ];
};



const createFeed = asyncHandler(async (req, res) => {
   console.log("creating feed");

    const {
      content,
        tags,
        contentType,
        duration,
        numberOfPages,
        fileNames,
        fileTypes,
        fileSizes,
        feedShortsBusinessId,
        // fileIds,
   } = req.body;

    const { fileIds } = req.body;

    const author = req.user._id;

    if (req.files) {
        /**
         * @type {{ url: string; localPath: string; }[]}
         */
        // console.log(req.files);
        let files = {};
        let durationData = {};
        let fileTypesData = {};
        let fileNamesData = {};
        let fileSizeData = {};
        let numberOfPagesData = {};
        let fileIdsData = [];
        console.log("step 1");
        if (!isNotNullOrEmpty(duration)) {
        console.log("duration is null or empty");
        } else {
        // console.log("You can map the duration object " + duration);
        try {
            console.log("duration insidetry type of duration " + typeof duration);
            if (typeof duration === "string") {
            const jsonData = JSON.parse(duration);
            durationData = {
                fileId: jsonData.fileId,
                duration: jsonData.duration,
            };
            } else {
            durationData = duration.map((durationObject) => {
                const jsonData = JSON.parse(durationObject);
                // console.log(`durationObject ${jsonData.fileId}`);
                return { fileId: jsonData.fileId, duration: jsonData.duration };
            });
            }

            // durationData = processDurationData(duration);
            // console.log(processDurationData(duration));
        } catch (error) {
            console.log(`errror ${error}`);
        }

        // console.log(durationData);
        // console.log("After mapping durationData type of:" + typeof durationData);
        }



if (!isNotNullOrEmpty(fileTypes)) {
      console.log("fileTypes is null or empty");
    } else {
      console.log("You can map the duration object " + fileTypes);
      try {
        console.log(
          "fileTypes insidetry type of fileTypes " + typeof fileTypes
        );
        if (typeof fileTypes === "string") {
          const jsonData = JSON.parse(fileTypes);
          fileTypesData = {
            fileId: jsonData.fileId,
            fileType: jsonData.fileType,
          };
        } else {
          fileTypesData = fileTypes.map((fileTypesObject) => {
            const jsonData = JSON.parse(fileTypesObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, fileType: jsonData.fileType };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }

    if (!isNotNullOrEmpty(numberOfPages)) {
      console.log("numberOfPages is null or empty");
    } else {
      console.log("You can map the numberOfPages object " + numberOfPages);
      try {
        console.log(
          "numberOfPages insidetry type of numberOfPages " +
          typeof numberOfPages
        );
        if (typeof numberOfPages === "string") {
          const jsonData = JSON.parse(numberOfPages);
          numberOfPagesData = {
            fileId: jsonData.fileId,
            numberOfPage: jsonData.numberOfPages,
          };
        } else {
          numberOfPagesData = numberOfPages.map((numberOfPagesObject) => {
            const jsonData = JSON.parse(numberOfPagesObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return {
              fileId: jsonData.fileId,
              numberOfPage: jsonData.numberOfPages,
            };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }


    if (!isNotNullOrEmpty(fileNames)) {
      console.log("fileNames is null or empty");
    } else {
      console.log("You can map the fileNames object " + fileNames);
      try {
        // console.log(
        //   "fileNames insidetry type of fileNames " + typeof fileNames
        // );
        if (typeof fileNames === "string") {
          const jsonData = JSON.parse(fileNames);
          fileNamesData = {
            fileId: jsonData.fileId,
            fileName: jsonData.fileName,
          };
        } else {
          fileNamesData = fileNames.map((fileNameObject) => {
            const jsonData = JSON.parse(fileNameObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, fileName: jsonData.fileName };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }

    if (!isNotNullOrEmpty(fileSizes)) {
      console.log("fileSizes is null or empty");
    } else {
      console.log("You can map the fileSizes object " + fileSizes);
      try {
        if (typeof fileSizes === "string") {
          const jsonData = JSON.parse(fileSizes);
          fileSizeData = {
            fileId: jsonData.fileId,
            fileSize: jsonData.fileSize,
          };
        } else {
          fileSizeData = fileTypes.map((fileSizeObject) => {
            const jsonData = JSON.parse(fileSizeObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, fileSize: jsonData.fileSize };
          });
        }

      } catch (error) {
        console.log(`errror ${error}`);
      }
    }


    
    fileIdsData = processStringToArray(fileIds);


    let position = -1;
    if (contentType == "mixed_files") {
      console.log("content type mixed files ");
      console.log(req.files.files);
      console.log("after loggging req.file");
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file, index) => {
            // const fileId = file.originalname;

            const originalNameWithoutExt = path.parse(file.originalname).name;
            // const fileId = fileIdsData[index] || null;
            // console.log(`file index ${index} `);
            // console.log(
            //   `File type: ${fileTypesData[index].fileType} fileId: ${fileId}`
            // );
            position = index;
            const fileUrl = getStaticMixedFilesFeedPath(req, file.filename);
            console.log(`FILE URL ${fileUrl}`);
            const fileLocalPath = getMixedFilesFeedImageLocalPath(
              file.filename
            );
            return {
              fileId: originalNameWithoutExt,
              url: fileUrl,
              localPath: fileLocalPath,
            };
          })
          : [];
      // console.log("content type mixed files");
      // console.log(typeof files);
    } else if (contentType == "image") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedImagePath(req, file.filename);
            const fileLocalPath = getFeedImageLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
      // console.log(typeof files);
    } else if (contentType == "audio") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedAudioPath(req, file.filename);
            const fileLocalPath = getFeedAudioLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    } else if (contentType == "video") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedVideoPath(req, file.filename);
            const fileLocalPath = getFeedVideoLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    } else if (contentType == "docs") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedDocsPath(req, file.filename);
            const fileLocalPath = getFeedDocsLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    }

    else if (contentType == "vn") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedVnPath(req, file.filename);
            const fileLocalPath = getFeedVnLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    }

     else if (contentType == "multiple_images") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedMultipleImagePath(
              req,
              file.filename
            );
            const fileLocalPath = getFeedMultipleImageLocalPath(
              file.filename
            );
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    }

    /**
     * @type {{ thumbnailUrl: string; thumbnailLocalPath: string; }[]}
     */
    // const thumbnails = req.files.feed_thumbnail || [];

    // const thumbnail = thumbnails.map((image, index) => {
    //   const fileId = fileIdsData[index] || null; // match file_id by index or use null if not available
    //   const imageUrl = getStaticFeedThumbnailPath(req, image.filename);
    //   const imageLocalPath = getFeedThumbnailLocalPath(image.filename);

    //   console.log("thumbnail file id: " + fileId);
    //   return {
    //     fileId,
    //     thumbnailUrl: imageUrl,
    //     thumbnailLocalPath: imageLocalPath,
    //   };
    // });
    const thumbnail =
      req.files.feed_thumbnail && req.files.feed_thumbnail?.length
        ? req.files.feed_thumbnail.map((image, index) => {
          // const fileId = fileIdsData[index] || null;
          const originalNameWithoutExt = path.parse(image.originalname).name;

          // console.log(
          //   `index ${index} position ${position} file ids ${fileIdsData}`
          // );
          // console.log("Getting some thumbnails fileId " + fileId);
          const imageUrl = getStaticFeedThumbnailPath(req, image.filename);
          const imageLocalPath = getFeedThumbnailLocalPath(image.filename);

          // console.log("Getting some thumbnails image url " + imageUrl);
          return {
            fileId: originalNameWithoutExt,
            thumbnailUrl: imageUrl,
            thumbnailLocalPath: imageLocalPath,
          };
        })
        : [];

    // console.log("Ready to create feed thumbnail" + thumbnail);
    // console.log(thumbnail);
    console.log("feedShortsBusinessId", feedShortsBusinessId);


    const post = await FeedPost.create({
      content: content,
      duration: durationData,
      tags: tags || [],
      author: author,
      files: files,
      thumbnail: thumbnail,
      contentType: contentType,
      numberOfPages: numberOfPagesData,
      fileNames: fileNamesData,
      fileTypes: fileTypesData,
      fileIds: fileIdsData,
      fileSizes: fileSizeData,
      feedShortsBusinessId: feedShortsBusinessId,
      // fileIds: fileIds,
    });
    if (!post) {
      throw new ApiError(500, "Error while creating feed");
    }

    const createdPost = await FeedPost.aggregate([
      {
        $match: {
          _id: post._id,
        },
      },
      ...feedCommonAggregation(req),
    ]);

    console.log("Feed created");
    return res
      .status(201)
      .json(new ApiResponse(201, createdPost[0], "Feed created successfully"));
  } else {
    const post = await FeedPost.create({
      content: content,
      tags: tags || [],
      author: author,
      contentType: contentType,
    });

    if (!post) {
      throw new ApiError(500, "Error while creating feed");
    }

    const createdPost = await FeedPost.aggregate([
      {
        $match: {
          _id: post._id,
        },
      },
      ...feedCommonAggregation(req),
    ]);

    return res
      .status(201)
      .json(new ApiResponse(201, createdPost[0], "Feed created successfully"));



    }
}

);



const getAllFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;


 const postAggregation = FeedPost.aggregate([
    ...feedCommonAggregation(req),
    { $sort: { createdAt: -1 } },

    {
      $lookup: {
        from: "feedbookmarks",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postId", "$$postId"] },
                  { $eq: ["$bookmarkedBy", new mongoose.Types.ObjectId(req.user?._id)] }
                ]
              }
            }
          }
        ],
        as: "userBookmark"
      }
    },
    {
      $lookup: {
        from: "feedbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "allBookmarks"
      }
    },
    {
      $addFields: {
        isBookmarked: {
          $cond: {
            if: { $gt: [{ $size: "$userBookmark" }, 0] },
            then: true,
            else: false
          }
        },
        bookmarkCount: { $size: "$allBookmarks" },
        bookmarkedByUserIds: "$allBookmarks.bookmarkedBy"
      }
    },
    {
      $project: {
        userBookmark: 0,
        allBookmarks: 0
      }
    }
  ]);

  try {
    const posts = await FeedPost.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page,
        limit,
        customLabels: {
          totalDocs: "totalPosts",
          docs: "posts",
        },
      })
    );

    // ✅ FIX: This loop now actually runs because originalPostId
    //         is preserved in the aggregation output above
    for (let post of posts.posts) {
      if (post.isReposted && post.originalPostId) {

        // Only fix posts where originalPost is still empty
        // (the aggregation may have already populated it correctly)
        if (!post.originalPost || post.originalPost.length === 0) {

          const originalPost = await FeedPost.findById(post.originalPostId);

          if (originalPost) {
            // ✅ FIX: Use findOne({ owner: ... }) not findById
            // because author field is a User ObjectId, not profile ObjectId
            const authorProfile = await SocialProfile.findOne({
              owner: originalPost.author
            }).populate({
              path: 'owner',
              select: 'avatar username email createdAt updatedAt _id'
            });

            if (authorProfile) {
              const builtAuthor = {
                _id: authorProfile._id,
                coverImage: authorProfile.coverImage,
                firstName: authorProfile.firstName,
                lastName: authorProfile.lastName,
                bio: authorProfile.bio,
                dob: authorProfile.dob,
                location: authorProfile.location,
                countryCode: authorProfile.countryCode,
                phoneNumber: authorProfile.phoneNumber,
                owner: authorProfile.owner?._id || authorProfile.owner,
                createdAt: authorProfile.createdAt,
                updatedAt: authorProfile.updatedAt,
                __v: authorProfile.__v,
              };

              if (authorProfile.owner) {
                builtAuthor.account = {
                  _id: authorProfile.owner._id,
                  avatar: authorProfile.owner.avatar,
                  username: authorProfile.owner.username,
                  email: authorProfile.owner.email,
                  createdAt: authorProfile.owner.createdAt,
                  updatedAt: authorProfile.owner.updatedAt
                };
              }

              post.originalPost = [{
                _id: originalPost._id,
                author: builtAuthor,
                content: originalPost.content || "",
                contentType: originalPost.contentType || "text",
                files: originalPost.files || [],
                fileIds: originalPost.fileIds || [],
                fileTypes: originalPost.fileTypes || [],
                fileNames: originalPost.fileNames || [],
                fileSizes: originalPost.fileSizes || [],
                duration: originalPost.duration || [],
                thumbnail: originalPost.thumbnail || [],
                numberOfPages: originalPost.numberOfPages || [],
                tags: originalPost.tags || [],
                feedShortsBusinessId: originalPost.feedShortsBusinessId || null,
                createdAt: originalPost.createdAt,
                updatedAt: originalPost.updatedAt,
                originalPostId: null,
                isReposted: false,
                repostedByUserId: null,
                repostedUsers: [],
                originalPostReposter: [],
                bookmarks: [],
                commentCount: 0,
                likeCount: 0,
                bookmarkCount: 0,
                repostCount: 0,
                shareCount: 0,
              }];
            }
          }
        }

        // Fix the repostedUser if missing
        if (!post.repostedUser && post.repostedByUserId) {
          const repostedByUser = await User.findById(post.repostedByUserId);

          if (repostedByUser) {
            const repostedUserProfile = await SocialProfile.findOne({
              owner: repostedByUser._id
            });

            const safeUser = {
              _id: repostedUserProfile?._id || repostedByUser._id,
              username: repostedByUser.username,
              email: repostedByUser.email,
              createdAt: repostedByUser.createdAt,
              updatedAt: repostedByUser.updatedAt,
            };

            if (repostedByUser.avatar) {
              safeUser.avatar = {
                url: repostedByUser.avatar.url,
                localPath: repostedByUser.avatar.localPath,
                _id: repostedByUser.avatar._id,
              };
            }

            if (repostedUserProfile) {
              safeUser.coverImage = repostedUserProfile.coverImage;
              safeUser.firstName = repostedUserProfile.firstName;
              safeUser.lastName = repostedUserProfile.lastName;
              safeUser.bio = repostedUserProfile.bio;
              safeUser.owner = repostedByUser._id;
            }

            post.repostedUser = safeUser;
          }
        }
      }

      // Fix missing contentType
      if (!post.contentType) {
        if (post.files && post.files.length > 0) {
          const fileTypes = post.fileTypes?.map(f => f.fileType || "").filter(Boolean) || [];
          const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
          const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
          const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

          if (hasVideo && hasImage) {
            post.contentType = "mixed_files";
          } else if (hasVideo) {
            post.contentType = "video";
          } else if (hasAudio) {
            post.contentType = "vn";
          } else if (hasImage) {
            post.contentType = "mixed_files";
          } else {
            post.contentType = "text";
          }
        } else {
          post.contentType = "text";
        }
      }

      // ✅ Remove originalPostId from final response
      // (it was only needed for the post-processing loop above)
      delete post.originalPostId;
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { data: posts }, "Get All Feed fetched successfully"));
  } catch (e) {
    console.log("Error fetching posts: ", e);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Error fetching posts"));
  }
});



const getFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  console.log("Starting getFeed for user:", req.user?._id);


   try {


     const userId = new mongoose.Types.ObjectId(req.user?._id);

    // ── Step 1: Get ranked post IDs from Python rec service ───────
    let recommendedIds = [];
    let recSourceMap   = {};
    let rankedOrder    = {};
    let endOfFeed      = false;
    let recItems       = [];  // declared here so it's accessible when sorting posts below

    try {
      const recResponse = await getFeedRecommendations(
        req.user._id.toString(),
        parseInt(limit),
        parseInt(page)
      );

      recItems  = recResponse.items || [];
      endOfFeed = recResponse.end_of_feed || false;

      console.log("Rec system", recItems);

      if (recItems.length) {
        recommendedIds = recItems
          .map((r) => r.post_id)
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        recSourceMap = Object.fromEntries(recItems.map((r) => [r.post_id, r.rec_source]));
        rankedOrder  = Object.fromEntries(recItems.map((r) => [r.post_id, r.position]));
      }
    } catch (recErr) {
      console.warn("[getFeed] Rec service unavailable, falling back to chronological:", recErr.message);
    }

    // End of feed — no more posts to show
    if (endOfFeed) {
      return res.status(200).json(
        new ApiResponse(200, {
          data: { posts: [], totalPosts: 0, page: parseInt(page), limit: parseInt(limit) },
          endOfFeed: true,
        }, "End of feed")
      );
    }

    // ── Step 2: Build aggregation pipeline ────────────────────────
    // If rec service returned IDs — filter to those posts only
    // If rec service is down — run on all posts (chronological fallback)
    // Build pipeline stages
    // When rec service is active:
    //   1. $match to filter only recommended posts
    //   2. $addFields __recPosition using $indexOfArray so MongoDB knows the ranked order
    //   3. $sort by __recPosition — preserves Python's order through the entire pipeline
    // When rec service is down: sort chronologically as before
    const matchStage = recommendedIds.length
      ? [{ $match: { _id: { $in: recommendedIds } } }]
      : [];

    // __recPosition is added early so it survives all subsequent $lookup/$unwind stages.
    // The actual $sort by __recPosition is placed at the very end of the pipeline
    // (just before cleanup $project) so $unwind stages can't disrupt it.
    const recPositionStage = recommendedIds.length
      ? [{
          $addFields: {
            __recPosition: { $indexOfArray: [recommendedIds, "$_id"] },
          },
        }]
      : [];


      


    } catch (e) {
        console.error("Error fetching posts:", e);
        return res
        .status(500)
        .json(new ApiResponse(500, {}, `Error fetching posts: ${e.message}`));
    }

}

);
