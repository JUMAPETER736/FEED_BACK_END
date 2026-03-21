

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

const likeNotificationAggregation = () => {
  return [
    {
      $lookup: {
        from: 'users',
        foreignField: '_id',
        localField: 'sender',
        as: 'sender',
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
        sender: { $arrayElemAt: ['$sender', 0] }, // Take the first element of the array as sender
      },
    },
  ];
};


const unifiedNotificationCommonAggregation = (page = 1, pageSize = 5) => {
  return [
    {
      $lookup: {
        from: 'users',
        foreignField: '_id',
        localField: 'sender',
        as: 'sender',
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
        sender: { $arrayElemAt: ['$sender', 0] },
      },
    },
    {
      $project: {
        _id: 1,
        owner: 1,
        sender: 1,
        message: 1,
        avatar: 1,
        createdAt: 1,
        read: 1,
        type: 1,
        data: 1,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: (page - 1) * pageSize, // Skip the number of documents based on the page
    },
    {
      $limit: pageSize, // Limit the number of documents per page
    },
  ];
};
