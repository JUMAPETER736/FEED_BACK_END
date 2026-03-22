

import mongoose from "mongoose";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { SocialCommentReply } from "../../../models/apps/social-media/comment.reply.models.js";
import { SocialComment } from "../../../models/apps/social-media/comment.models.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import {
  getMongoosePaginationOptions,
  getStaticThumbnailFilePath,
  getThumbnailLocalPath,
} from "../../../utils/helpers.js";
import { ApiError } from "../../../utils/ApiError.js";

import {
  getCommentImageLocalPath,
  getStaticCommentImageFilePath,
  getCommentAudioLocalPath,
  getStaticCommentAudioFilePath,
  getCommentDocsLocalPath,
  getStaticCommentDocsFilePath,
  getCommentThumbnailLocalPath,
  getStaticCommentThumbnailFilePath,
  getCommentGifLocalPath,
  getStaticCommentGifFilePath,
  getStaticCommentVideoFilePath,
  getCommentVideoLocalPath,
  removeLocalFile,
} from "../../../utils/helpers.js";
import { User } from "../../../models/apps/auth/user.models.js";
import Notification from "../../../models/apps/notifications/notification.model.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
import CommentNotification from "../../../models/apps/notifications/commentNotification.model.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";

/**
 * @param {string} userId
 * @param {import("express").Request} req
 * @description Utility function which returns the pipeline stages to structure the social post schema with calculations like, likes count, comments count, isLiked, isBookmarked etc
 * @returns {mongoose.PipelineStage[]}
 */



const postCommonAggregation = (req) => {
  return [
    {
      $lookup: {
        from: "socialcomments",
        localField: "_id",
        foreignField: "postId",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "postId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "postId",
        as: "isLiked",
        pipeline: [
          {
            $match: {
              likedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
        ],
      },
    },
     {
      $lookup: {
        from: "socialbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "isBookmarked",
        pipeline: [
          {
            $match: {
              bookmarkedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
        ],
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
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              account: { $first: "$account" },
            },
          },
        ],
      },
    },

    {
      $addFields: {
        // author: { $first: "$author" },
        author: {
          $mergeObjects: [
            { $first: "$author" },
            { authorId: "$author._id" }, // Assuming the author ID is available in the "author" field
          ],
        },
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: {
            if: {
              $gte: [
                {
                  // if the isLiked key has document in it
                  $size: "$isLiked",
                },
                1,
              ],
            },
            then: true,
            else: false,
          },
        },
        isBookmarked: {
          $cond: {
            if: {
              $gte: [
                {
                  // if the isBookmarked key has document in it
                  $size: "$isBookmarked",
                },
                1,
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
  ];
};



const unifiedNotificationCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sender: { $arrayElemAt: ["$sender", 0] }, // Take the first element of the array as sender
      },
    },
  ];
};


onst addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const {
    content,
    contentType,
    localUpdateId,
    duration,
    fileName,
    fileType,
    fileSize,
    numberOfPages,
    gif,
  } = req.body;

  const isPostAvailable = await SocialPost.findById(postId);
  if (!isPostAvailable) {
    return res.status(404).json({
      success: false,
      message: "Social Post not found",
      data: {}
    });
  }


  if (req.files) {
    try {
      const audios =
        req.files.audio && req.files.audio.length
          ? req.files.audio.map((aud) => {
            const audioUrl = getStaticCommentAudioFilePath(req, aud.filename);
            const audioLocalPath = getCommentAudioLocalPath(aud.filename);
            return { url: audioUrl, localPath: audioLocalPath };
          })
          : [];

      const images =
        req.files.image && req.files.image.length
          ? req.files.image.map((img) => {
            const imageUrl = getStaticCommentImageFilePath(req, img.filename);
            const imageLocalPath = getCommentImageLocalPath(img.filename);
            return { url: imageUrl, localPath: imageLocalPath };
          })
          : [];
      const videos =
        req.files.video && req.files.video.length
          ? req.files.video.map((vid) => {
            const videoUrl = getStaticCommentVideoFilePath(req, vid.filename);
            const videoLocalPath = getCommentVideoLocalPath(vid.filename);
            return { url: videoUrl, localPath: videoLocalPath };
          })
          : [];

      const thumbnails =
        req.files.thumbnail && req.files.thumbnail.length
          ? req.files.thumbnail.map((tn) => {
            const thumbnailUrl = getStaticCommentThumbnailFilePath(
              req,
              tn.filename
            );
            const thumbnailLocalPath = getCommentThumbnailLocalPath(
              tn.filename
            );
            return { url: thumbnailUrl, localPath: thumbnailLocalPath };
          })
          : [];

      const docs =
        req.files.docs && req.files.docs.length
          ? req.files.docs.map((doc) => {
            const docUrl = getStaticCommentDocsFilePath(req, doc.filename);
            const docLocalPath = getCommentDocsLocalPath(doc.filename);
            return { url: docUrl, localPath: docLocalPath };
          })
          : [];
