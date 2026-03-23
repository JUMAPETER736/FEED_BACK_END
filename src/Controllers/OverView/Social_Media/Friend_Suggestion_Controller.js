

import mongoose from "mongoose";
import { emitSocketEvent } from "../../../socket/index.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js"
import { User } from "../../../models/apps/auth/user.models.js";
//  * Create a friend suggestion notification
//  * @param {import("express").Request} req
//  * @param {import("express").Response} res
const unifiedNotificationCommonAggregation = () => {
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
    {
      $lookup: {
        from: 'users',
        foreignField: '_id',
        localField: 'data.suggestedUserId',
        as: 'suggestedUser',
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        'data.suggestedUser': { $arrayElemAt: ['$suggestedUser', 0] }, // Add suggested user details to data field
      },
    },
    {
      $project: {
        suggestedUser: 0, // Remove the separate suggestedUser field if needed
      },
    },
  ];
};