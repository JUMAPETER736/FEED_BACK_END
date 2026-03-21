

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



const commentNotificationAggregation = () => {
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
        // createdAt: {$ifNull: ["$createdAt", new Date(0)]},
        sender: { $arrayElemAt: ["$sender", 0] }, // Take the first element of the array as sender
      },
    },
  ];
};


const getAllUnifiedNotifications = asyncHandler(async (req, res) => {

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const userId = req.user._id;

  const notifications = await UnifiedNotification.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId), // Assuming recipient field exists in Notification schema
      },
    },
    ...unifiedNotificationCommonAggregation(page, limit)
  ]);

  // Get total count for pagination
  const totalCount = await UnifiedNotification.countDocuments({
    owner: new mongoose.Types.ObjectId(userId)
  });

  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;

  return res.status(200).json({
    data: notifications,
    currentPage: page,
    totalPages: totalPages,
    hasNextPage: hasNextPage
  });


});


const getAllNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $facet: {
        likeNotifications: [
          ...notificationCommonAggregation(),
          {
            $sort: {
              createdAt: -1
            },
          },
        ],
        commentNotifications: [
          ...notificationCommonAggregation(),
          {
            $sort: {
              createdAt: -1
            },
          },
        ],
        replyNotifications: [
          ...notificationCommonAggregation(),
          {
            $sort: {
              createdAt: -1
            },
          },
        ],
        followUnFollowNotification: [
          ...notificationCommonAggregation(),
          {
            $sort: { createdAt: -1 },
          },
        ],
        favoriteNotification: [
          ...notificationCommonAggregation(),
          {
            $sort: { createdAt: -1 },
          },
        ],
        friendSuggestionNotification: [
          ...notificationCommonAggregation(),
          {
            $sort: { createdAt: -1 },
          },
        ],
        // unfollowNotification:[
        //   ...notificationCommonAggregation(),
        //   {
        //     $sort: { createdAt: -1 },
        //   },
        // ],
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, notifications || [], 'Notifications fetched successfully'));
});



const getAllCommentNotification = asyncHandler(async (req, res) => {
  const notifications = await CommentNotification.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user._id), // Assuming recipient field exists in Notification schema
      },
    },
    ...commentNotificationAggregation(),
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(200, notifications || [], "Notifications fetched successfully")
    );
});



/**
* Controller function to mark a notification as read.
* @param {Request} req Express request object
* @param {Response} res Express response object
* @returns {Promise<void>}
*/
const markNotificationRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  if (!notificationId) {
    return res.status(400).json({
      status: 400,
      data: null,
      message: 'Notification ID is required',
    });
  }


  const notification = await UnifiedNotification.findOneAndUpdate(
    {
      _id: notificationId,
      owner: req.user._id, // Ensure the notification belongs to the authenticated user
    },
    {
      $set: {
        read: true,
      },
    },
    {
      new: true,
    }
  );


  if (!notification) {
    return res.status(404).json(new ApiResponse(404, null, 'Notification not found'));
  }

  emitUnreadCountUpdate(req, String(req.user._id));

  return res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));

});


const deleteNotification = asyncHandler(async (req, res) => {
  try {

    const { notificationId } = req.params;
    if (!notificationId) {
      return res.status(400).json({
        status: 400,
        data: null,
        message: 'Notification ID is required',
      });
    }

    const isNotificationAvailable = await UnifiedNotification.findById(notificationId);
    if (!isNotificationAvailable) {
      return res.status(400).json({
        status: 400,
        data: null,
        message: 'Notification not found',
      });
    }

    await UnifiedNotification.findByIdAndDelete(notificationId);

    await emitUnreadCountUpdate(req, req.user._id);

    return res.status(200).json({
      status: 200,
      data: isNotificationAvailable,
      message: "Notification deleted"
    });

  } catch (error) {
    console.log("Something went wrong", error);
    return res.status(500).json({
      error: "Failed to fetch notifications",
      message: error.message
    });
  }

});


const markNotificationUnread = asyncHandler(async (req, res) => {
  try {

    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        status: 400,
        data: null,
        message: 'Notification ID is required',
      });
    }


    const notification = await UnifiedNotification.findOneAndUpdate(
      {
        _id: notificationId,
        owner: req.user._id, // Ensure the notification belongs to the authenticated user
      },
      {
        $set: {
          read: false,
        },
      },
      {
        new: true,
      }
    );


    if (!notification) {
      return res.status(404).json(new ApiResponse(404, null, 'Notification not found'));
    }

    emitUnreadCountUpdate(req, String(req.user._id));

    return res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));

  } catch (error) {
    console.log("Something went wrong", error);
    return res.status(500).json({
      error: "Failed to fetch notifications",
      message: error.message
    });
  }

});


export { getAllNotifications, getAllUnifiedNotifications, markNotificationRead, getAllCommentNotification, deleteNotification, markNotificationUnread };
