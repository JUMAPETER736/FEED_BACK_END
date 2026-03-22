

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