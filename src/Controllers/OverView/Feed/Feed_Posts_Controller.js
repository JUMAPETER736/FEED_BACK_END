

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
