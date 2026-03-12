

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




async function processPost(post) {
  // Handle reposted posts
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

        if (author.owner && author.owner.account) {
          post.author.account = author.owner.account;
        } else if (author.account) {
          post.author.account = author.account;
        }

        post.content = originalPost.content || post.content;
        post.tags = originalPost.tags || post.tags;
        post.fileIds = originalPost.fileIds || post.fileIds;
        post.files = originalPost.files || post.files;
        post.contentType = originalPost.contentType || post.contentType;

        if (!post.originalPost) {
          post.originalPost = [];
        }

        if (post.originalPost.length === 0) {
          post.originalPost.push({
            _id: originalPost._id,
            author: author,
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

      // Handle repostedByUserId
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


function isNotNullOrEmpty(obj) {
  return obj !== null && obj !== undefined && Object.keys(obj).length > 0;
}

function processStringToArray(str) {
  // Check if the string is neither null nor empty
  if (str && str.trim() !== "") {
    // Remove square brackets
    const cleanedStr = str.replace(/[\[\]]/g, "");

    // Split the string by commas and trim each item
    const arr = cleanedStr.split(",").map(
      (item) => item.trim().replace(/^"|"$/g, "") // Remove leading and trailing double quotes
    );

    return arr;
  } else {
    // Return an empty array if the string is null, undefined, or empty
    return [];
  }
}


const getPostById = asyncHandler(async (req, res) => {
  try {

    const { postId } = req.params;
    const isPostAvailable = await FeedPost.findById(postId);

    if (!isPostAvailable) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Common feed aggregation
    const postAggregation = FeedPost.aggregate([
      { $match: { _id: isPostAvailable._id } },
      ...feedAggregation(req),
      { $limit: 1 },


      //  Check if current user bookmarked this post
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

      // Get all users who bookmarked this post
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",
          foreignField: "postId",
          as: "allBookmarks"
        }
      },

      //  ADD FIELDS: Set bookmark-related fields
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

      //  Remove temporary fields
      {
        $project: {
          userBookmark: 0,
          allBookmarks: 0
        }
      },

    ]);

    const posts = await postAggregation;
    if (posts.isReposted) {
      posts[0].originalPostId = posts[0].originalPost[0]._id;
    }



    if (posts[0].isReposted && posts[0].originalPostId) {
      // Fetch the original post using originalPostId
      const originalPost = await FeedPost.findById(posts[0].originalPostId).populate("author");
      posts[0].originalPost[0] = originalPost;

      console.log("Post: ", posts[0]);

      if (originalPost) {
        // Fetch the original post's author
        const author = await SocialProfile.findById(originalPost.author)
          .populate("owner");

        if (author) {
          // Set the author field at the root level
          posts[0].author = {
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

          // Add account info to author
          if (author.owner) {
            posts[0].author.account = {
              _id: author.owner._id,
              avatar: author.owner.avatar,
              username: author.owner.username,
              email: author.owner.email,
              createdAt: author.owner.createdAt,
              updatedAt: author.owner.updatedAt
            };
          }

          // Populate the reposted post with attributes from the original post
          posts[0].content = originalPost.content || posts[0].content;
          posts[0].tags = originalPost.tags || posts[0].tags;
          posts[0].fileIds = originalPost.fileIds || posts[0].fileIds;
          posts[0].files = originalPost.files || posts.files;
          posts[0].contentType = originalPost.contentType || posts[0].contentType;

          // Ensure contentType is set
          if (!posts[0].contentType) {
            posts[0].contentType = "text";
          }

          // Ensure originalPost array exists
          if (!posts[0].originalPost) {
            posts[0].originalPost = [];
          }

          // Add original post data if not already there
          if (posts[0].originalPost.length === 0) {
            posts[0].originalPost.push({
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

          posts[0].comments = originalPost.comments || posts[0].comments;
          posts[0].likes = originalPost.likes || posts[0].likes;
          posts[0].reposts = originalPost.reposts || posts[0].reposts;
          posts[0].repostedUsersCount =
            originalPost.repostedUsersCount || posts[0].repostedUsersCount;
        }

        // Fetch the user who reposted
        if (posts[0].repostedByUserId) {
          const repostedByUser = await User.findById(posts[0].repostedByUserId);

          if (repostedByUser) {
            // Fetch the social profile for the user who reposted
            const repostedUserProfile = await SocialProfile.findOne({
              owner: repostedByUser._id
            });

            // Create a safe user object
            const safeUser = {
              _id: repostedUserProfile?._id || repostedByUser._id,
              username: repostedByUser.username,
              email: repostedByUser.email,
              createdAt: repostedByUser.createdAt,
              updatedAt: repostedByUser.updatedAt,
            };

            // Add avatar if exists
            if (repostedByUser.avatar) {
              safeUser.avatar = {
                url: repostedByUser.avatar.url,
                localPath: repostedByUser.avatar.localPath,
                _id: repostedByUser.avatar._id,
              };
            }

            // Add profile info if exists
            if (repostedUserProfile) {
              safeUser.coverImage = repostedUserProfile.coverImage;
              safeUser.firstName = repostedUserProfile.firstName;
              safeUser.lastName = repostedUserProfile.lastName;
              safeUser.bio = repostedUserProfile.bio;
              safeUser.owner = repostedByUser._id;
            }

            posts[0].repostedUser = safeUser;
          }
        }
      }
    }

    // Set contentType for non-reposted posts if not set
    if (!posts[0].contentType) {
      if (posts[0].files && posts[0].files.length > 0) {
        const fileTypes = posts[0].files.map(f => f.fileType || "").filter(Boolean);
        const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
        const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
        const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

        if (hasVideo && hasImage) {
          posts[0].contentType = "mixed_files";
        } else if (hasVideo) {
          posts[0].contentType = "videos";
        } else if (hasAudio) {
          posts[0].contentType = "vn";
        } else if (hasImage) {
          posts[0].contentType = "mixed_files";
        } else {
          posts[0].contentType = "text";
        }
      } else {
        posts[0].contentType = "text";
      }
    }


    // Prepare response data
    const responseData = {
      data: {
        posts: posts
      }
    };

    // Send the response with fetched post
    return res
      .status(200)
      .json(new ApiResponse(200, responseData, "Post fetched successfully"));

  } catch (error) {
    console.log("Something went wrong", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Error fetching posts"));
  }

});