

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

const getLikedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  console.log("Starting getLikedPosts for user:", req.user?._id);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    const postAggregation = FeedLike.aggregate([
      // Match only likes by the current user
      {
        $match: {
          likedBy: userId,
          postId: { $exists: true, $ne: null } // Only get post likes (not comment/reply likes)
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort by when they liked it
      },
      // Lookup the actual post
      {
        $lookup: {
          from: "feedposts",
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      {
        $unwind: {
          path: "$post",
          preserveNullAndEmptyArrays: false, // Skip if post was deleted
        },
      },

      // Store like metadata before replacing root
      {
        $addFields: {
          "post.likeId": "$_id",
          "post.likedBy": "$likedBy",
          "post.likedAt": "$createdAt"
        }
      },

      // Replace root with post so feedCommonAggregation works
      {
        $replaceRoot: {
          newRoot: "$post"
        }
      },

      // Apply feedCommonAggregation (it expects post at root level)
      ...feedCommonAggregation(req),

      // ============================================
      // LIKES AGGREGATION
      // ============================================
      {
        $lookup: {
          from: "feedlikes",
          localField: "_id",
          foreignField: "postId",
          as: "postLikes"
        }
      },
      {
        $addFields: {
          likedByUserIds: {
            $map: {
              input: "$postLikes",
              as: "like",
              in: "$$like.likedBy"
            }
          },
          likes: { $size: "$postLikes" },
          isLiked: true // Always true since we're fetching liked posts
        }
      },
      {
        $project: {
          postLikes: 0
        }
      },

      // ============================================
      // BOOKMARKS AGGREGATION
      // ============================================
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",
          foreignField: "postId",
          as: "bookmarks"
        }
      },
      {
        $addFields: {
          bookmarkedByUserIds: "$bookmarks.bookmarkedBy",
          bookmarkCount: { $size: "$bookmarks" },
          isBookmarked: {
            $in: [userId, "$bookmarks.bookmarkedBy"]
          }
        }
      },
      {
        $project: {
          bookmarks: 0
        }
      }
    ]);

    console.log("Executing aggregation with pagination");

    const posts = await FeedLike.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
          totalDocs: "totalLikedPosts",
          docs: "likedPosts",
        },
      })
    );

    // Post-processing for reposted posts (same as getAllFeed)
    for (let post of posts.likedPosts) {
      if (post.isReposted && post.originalPostId) {
        const originalPost = await FeedPost.findById(post.originalPostId);

        if (originalPost) {
          const author = await SocialProfile.findById(originalPost.author)
            .populate('owner');

          if (author) {
            post.author = {
              _id: author._id,
              coverImage: author.coverImage,
              firstName: author.firstName,
              lastName: author.lastName,
              bio: author.bio,
              dob: author.dob,
              location: author.location,
              countryCode: author.countryCode,
              phoneNumber: author.phoneNumber,
              owner: author.owner,
              createdAt: author.createdAt,
              updatedAt: author.updatedAt,
              __v: author.__v,
            };

            if (author.owner) {
              post.author.account = {
                _id: author.owner._id,
                avatar: author.owner.avatar,
                username: author.owner.username,
                email: author.owner.email,
                createdAt: author.owner.createdAt,
                updatedAt: author.owner.updatedAt
              };
            }

            post.content = originalPost.content || post.content;
            post.tags = originalPost.tags || post.tags;
            post.fileIds = originalPost.fileIds || post.fileIds;
            post.files = originalPost.files || post.files;
            post.contentType = originalPost.contentType || post.contentType;

            if (!post.contentType) {
              post.contentType = "text";
            }

            if (!post.originalPost) {
              post.originalPost = [];
            }

            if (post.originalPost.length === 0) {
              post.originalPost.push({
                _id: originalPost._id,
                author: post.author,
                content: originalPost.content,
                contentType: originalPost.contentType,
                files: originalPost.files,
                fileIds: originalPost.fileIds,
                tags: originalPost.tags,
                createdAt: originalPost.createdAt,
              });
            }

            post.comments = originalPost.comments || post.comments;
            post.likes = originalPost.likes || post.likes;
            post.reposts = originalPost.reposts || post.reposts;
            post.repostedUsersCount = originalPost.repostedUsersCount || post.repostedUsersCount;
          }

          if (post.repostedByUserId) {
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
      }

      // Set contentType if not set
      if (!post.contentType) {
        if (post.files && post.files.length > 0) {
          const fileTypes = post.files.map(f => f.fileType || "").filter(Boolean);
          const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
          const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
          const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

          if (hasVideo && hasImage) {
            post.contentType = "mixed_files";
          } else if (hasVideo) {
            post.contentType = "videos";
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
    }

    console.log("All Liked Posts fetched successfully:", posts.totalLikedPosts);

    // Return posts directly (matching getFeed pattern)
    return res
      .status(200)
      .json(
        new ApiResponse(200, posts, "All Liked Posts fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching liked posts:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Error: ${error.message}`));
  }
});


const likeDislikeFeedPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  console.log("=== LIKE/UNLIKE REQUEST ===");
  console.log("PostId received:", postId);

  const post = await FeedPost.findById(postId);

  // Check for post existence
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  console.log("Post found. Is repost?", !!post.originalPostId);

  // See if user has already liked THIS SPECIFIC POST (wrapper or original)
  const existingLike = await FeedLike.findOne({
    postId: post._id,  // ← Use the exact ID received (wrapper or original)
    likedBy: req.user._id,
  });

  console.log("Existing like?", !!existingLike);

  if (existingLike) {
    // Unlike: remove the like record
    await FeedLike.findByIdAndDelete(existingLike._id);
    console.log("✓ Deleted like");

    // Get updated like count and user IDs FOR THIS SPECIFIC POST
    const allLikes = await FeedLike.find({ postId: post._id }).select('likedBy');
    const likedByUserIds = allLikes.map(like => like.likedBy.toString());

    console.log("✓ New count:", allLikes.length);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: false,
          likeCount: allLikes.length,
          likedByUserIds: likedByUserIds
        },
        "Post unliked successfully"
      )
    );
  } else {
    // Like: create new like record FOR THIS SPECIFIC POST
    await FeedLike.create({
      postId: post._id,  // ← Use the exact ID (wrapper or original)
      likedBy: req.user._id,
    });

    console.log("✓ Created like");

    // Get updated like count and user IDs
    const allLikes = await FeedLike.find({ postId: post._id }).select('likedBy');
    const likedByUserIds = allLikes.map(like => like.likedBy.toString());

    console.log("✓ New count:", allLikes.length);

    // Don't create notification if user is liking their own post
    if (post.author.toString() !== req.user._id.toString()) {
      // Create notification for the post author
      await UnifiedNotification.create({
        owner: post.author,
        sender: req.user._id,
        message: `${req.user.username} has liked your post.`,
        avatar: req.user.avatar,
        type: "postLiked",
        data: {
          postId: post._id,
          for: "feed",
          commentId: null,
          commentReplyId: null,
        },
      });

      // Fetch the created notification with aggregation
      const notifications = await UnifiedNotification.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(post.author),
          },
        },
        ...unifiedNotificationCommonAggregation(),
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 1,
        },
      ]);

      const likeNotification = notifications[0];

      if (likeNotification) {
        // Emit socket event for real-time notification
        emitSocketEvent(
          req,
          post.author.toString(),
          "postLiked",
          likeNotification
        );

        // Update unread count
        emitUnreadCountUpdate(req, post.author);
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: true,
          likeCount: allLikes.length,
          likedByUserIds: likedByUserIds
        },
        "Post liked successfully"
      )
    );
  }
});


const likeDislikeFeedComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await FeedComment.findById(commentId);

  // Check for comment existence
  if (!comment) {
    throw new ApiError(404, "Comment does not exist");
  }

  // See if user has already liked the comment
  const existingLike = await FeedLike.findOne({
    commentId: comment._id,
    likedBy: req.user._id,
  });

  if (existingLike) {
    // Unlike: remove the like record
    await FeedLike.findByIdAndDelete(existingLike._id);

    // Get updated like count and user IDs
    const allLikes = await FeedLike.find({ commentId: comment._id }).select('likedBy');
    const likedByUserIds = allLikes.map(like => like.likedBy.toString());

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: false,
          likeCount: allLikes.length,
          likedByUserIds: likedByUserIds
        },
        "Comment unliked successfully"
      )
    );
  } else {
    // Like: create new like record
    await FeedLike.create({
      commentId: comment._id,
      likedBy: req.user._id,
    });

    // Get updated like count and user IDs
    const allLikes = await FeedLike.find({ commentId: comment._id }).select('likedBy');
    const likedByUserIds = allLikes.map(like => like.likedBy.toString());

    const commentOwner = comment.author;

    // Don't create notification if user is liking their own comment
    if (commentOwner.toString() !== req.user._id.toString()) {
      // Verify comment owner exists
      const user = await User.findById(commentOwner);

      if (!user) {
        throw new ApiError(404, "Comment owner not found");
      }

      // Create notification for comment owner
      await UnifiedNotification.create({
        owner: commentOwner,
        sender: req.user._id,
        message: `${req.user.username} liked your comment`,
        avatar: req.user.avatar,
        type: "postLiked",
        data: {
          postId: comment.postId,
          for: "feed",
          commentId: comment._id,
          commentReplyId: null,
        },
      });

      // Fetch the created notification
      const notifications = await UnifiedNotification.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(commentOwner),
          },
        },
        ...unifiedNotificationCommonAggregation(),
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 1,
        },
      ]);

      const newNotification = notifications[0];

      if (newNotification) {
        // Emit socket event
        emitSocketEvent(
          req,
          commentOwner.toString(),
          "postLiked",
          newNotification
        );

        // Update unread count
        emitUnreadCountUpdate(req, commentOwner);
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: true,
          likeCount: allLikes.length,
          likedByUserIds: likedByUserIds
        },
        "Comment liked successfully"
      )
    );
  }
});

const likeDislikeFeedCommentReply = asyncHandler(async (req, res) => {
  const { commentReplyId } = req.params;

  const commentReply = await FeedCommentReply.findById(commentReplyId);

  // Check for comment reply existence
  if (!commentReply) {
    throw new ApiError(404, "Comment reply does not exist");
  }

  // Get the parent comment for notification context
  const parentComment = await FeedComment.findById(commentReply.commentId);

  if (!parentComment) {
    throw new ApiError(404, "Parent comment not found");
  }

  // See if user has already liked the comment reply
  const existingLike = await FeedLike.findOne({
    commentReplyId: commentReply._id,
    likedBy: req.user._id,
  });

  if (existingLike) {
    // Unlike: remove the like record
    await FeedLike.findByIdAndDelete(existingLike._id);

    // Get updated like count and user IDs
    const allLikes = await FeedLike.find({ commentReplyId: commentReply._id }).select('likedBy');
    const likedByUserIds = allLikes.map(like => like.likedBy.toString());

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: false,
          likeCount: allLikes.length,
          likedByUserIds: likedByUserIds
        },
        "Comment reply unliked successfully"
      )
    );
  } else {
    // Like: create new like record
    await FeedLike.create({
      commentReplyId: commentReply._id,
      likedBy: req.user._id,
    });

    // Get updated like count and user IDs
    const allLikes = await FeedLike.find({ commentReplyId: commentReply._id }).select('likedBy');
    const likedByUserIds = allLikes.map(like => like.likedBy.toString());

    const replyOwner = commentReply.author;

    // Don't create notification if user is liking their own reply
    if (replyOwner.toString() !== req.user._id.toString()) {
      // Create notification for reply owner
      await UnifiedNotification.create({
        owner: replyOwner,
        sender: req.user._id,
        message: `${req.user.username} liked your comment`,
        avatar: req.user.avatar,
        type: "postLiked",
        data: {
          postId: parentComment.postId,
          for: "feed",
          commentId: parentComment._id,
          commentReplyId: commentReply._id,
        },
      });

      // Fetch the created notification
      const notifications = await UnifiedNotification.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(replyOwner),
          },
        },
        ...unifiedNotificationCommonAggregation(),
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 1,
        },
      ]);

      const newNotification = notifications[0];

      if (newNotification) {
        // Emit socket event
        emitSocketEvent(
          req,
          replyOwner.toString(),
          "postLiked",
          newNotification
        );

        // Update unread count
        emitUnreadCountUpdate(req, replyOwner);
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked: true,
          likeCount: allLikes.length,
          likedByUserIds: likedByUserIds
        },
        "Comment reply liked successfully"
      )
    );
  }
});

export {
  likeDislikeFeedPost,
  likeDislikeFeedComment,
  likeDislikeFeedCommentReply,
  getLikedPosts,
};