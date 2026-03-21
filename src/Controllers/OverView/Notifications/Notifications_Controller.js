

import { asyncHandler } from "../../../utils/asyncHandler.js";
import Notification from "../../../models/apps/notifications/notification.model.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import {
  getMongoosePaginationOptions,
  getStaticThumbnailFilePath,
  getThumbnailLocalPath,
} from "../../../utils/helpers.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import mongoose from "mongoose";
import CommentNotification from "../../../models/apps/notifications/commentNotification.model.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
/**
 * Utility function which returns the pipeline stages to structure the notification schema with common lookups.
 * @returns {mongoose.PipelineStage[]}
 */
/**
 * Utility function which returns the pipeline stages to structure the notification schema with common lookups.
 * @returns {mongoose.PipelineStage[]}
 */

const notificationCommonAggregation = (receiverId) => {
  console.log("Starting aggregation for receiverId:", receiverId);
  return [
    {
      $match: {
        owner: new mongoose.Types.ObjectId(receiverId),
      },
    },
    {
      $facet: {
        getAllCommentNotification: [
          ...notificationCommonAggregation(),
          {
            $match: {
              notificationType: "onCommentPost",
            },
          },
        ],
        likeNotifications: [
          ...notificationCommonAggregation(),
          {
            $match: {
              notificationType: "postLiked",
            },
          },
        ],
        replyNotifications: [
          ...notificationCommonAggregation(),
          {
            $match: {
              notificationType: "reply",
            },
          },
        ],
        followUnFollowNotification: [
          ...notificationCommonAggregation(),
          {
            $match: {
              notificationType: "followed",
            },
          },
        ],
        favoriteNotification: [
          ...notificationCommonAggregation(),
          {
            $match: {
              notificationType: "bookMarked",
            },
          },
        ],
        friendSuggestionNotification: [
          ...notificationCommonAggregation(),
          {
            $match: {
              notificationType: "friendSuggestion",
            },
          },
        ],
      },
    },
    {
      $project: {
        notifications: {
          $concatArrays: [
            "$commentNotifications",
            "$likeNotifications",
            "$replyNotifications",
            "$followUnFollowNotifications"
          ],
        },
      },
    },
    {
      $unwind: "$notifications",
    },
    {
      $replaceRoot: { newRoot: "$notifications" },
    },
    {
      $sort: { createdAt: -1 },
    },
  ];
};