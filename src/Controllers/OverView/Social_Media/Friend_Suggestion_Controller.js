

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


const createFriendSuggestionNotification = asyncHandler(async (req, res) => {
  const { suggestedUserId } = req.body; // Suggested friend
  const { ownerId } = req.body; // Recipient of the notification

  if (!ownerId || !suggestedUserId) {
    return res.status(400).json(new ApiResponse(400, null, 'ownerId and suggestedUserId are required'));
  }
  const user = await User.findById(ownerId);

  if (!user) {
   throw new ApiError(404, "User does not exist");
  }

  try {
    // Check if owner is not suggesting to themselves
    if (ownerId.toString() !== req.user._id.toString()) {
      console.log(`Creating friend suggestion notification for user with ID: ${ownerId}`);

      // Create Unified Notification
      await UnifiedNotification.create({
        owner: ownerId,
        sender: ownerId,
        message: `you have a new friend suggestion ${suggestedUserId}`,
        avatar: req.user.avatar,
        type: 'friendSuggestion',
        data: {
          suggestedUserId: new mongoose.Types.ObjectId(suggestedUserId),
        },
      });

      // Retrieve the latest notification
      const notifications = await UnifiedNotification.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(ownerId),
            // sender: req.user._id,
          },
        },
        ...unifiedNotificationCommonAggregation(),
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      const newNotification = notifications[0];

      if (!newNotification) {
        throw new ApiError(500, 'Internal server error');
      }

      console.log(`New friend suggestion notification: ${newNotification}`);

      // Emit socket event
      emitSocketEvent(req, ownerId, 'friendsSuggestions', newNotification);

      return res.status(201).json(
        new ApiResponse(201, newNotification, 'Friend suggestion notification created successfully')
      );
    }

    return res.status(400).json(new ApiResponse(400, null, 'Cannot suggest a friend to yourself'));
  } catch (error) {
    console.error('Error creating friend suggestion notification:', error);
    return res.status(error.status || 500).json(new ApiResponse(error.status || 500, null, error.message || 'An error occurred'));
  }
});
export {
  createFriendSuggestionNotification
};