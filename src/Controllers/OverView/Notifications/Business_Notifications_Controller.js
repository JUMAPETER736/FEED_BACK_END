
import mongoose from "mongoose";
import { BusinessNotification } from "../../../Models/Notifications/Business_Notification_Model.js";
import { emitUnreadCountUpdate } from "../../../Sockets/socket.js";
import { ApiResponse }  from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";

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
            $skip: (page - 1) * pageSize, // Fixed: Calculate skip correctly
        },
        {
            $limit: pageSize,
        },
    ];
};


export const getUserBusinessNotification = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const notifications = await BusinessNotification.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId), // Assuming recipient field exists in Notification schema
                },
            },
            ...unifiedNotificationCommonAggregation(page, limit)
        ]);

        // Get total count for pagination
        const totalCount = await BusinessNotification.countDocuments({
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

    } catch (error) {
        console.log("Something went wrong", error);
        return res.status(500).json({
            error: "Failed to fetch notifications",
            message: error.message
        });
    }
});



export const markNotificationRead = asyncHandler(async (req, res) => {

    try {
        const { notificationId } = req.params;

        if (!notificationId) {
            return res.status(400).json({
                status: 400,
                data: null,
                message: 'Notification ID is required',
            });
        }

        const notification = await BusinessNotification.findOneAndUpdate(
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

        await emitUnreadCountUpdate(req, req.user._id);

        return res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));


    } catch (error) {
        console.log("Something went wrong", error);
        return res.status(500).json({
            error: "Failed to fetch notifications",
            message: error.message
        });
    }
});


export const deleteNotification = asyncHandler(async (req, res) => {
    try {
        const { notificationId } = req.params;
        if (!notificationId) {
            return res.status(400).json({
                status: 400,
                data: null,
                message: 'Notification ID is required',
            });
        }

        const isNotificationAvailable = await BusinessNotification.findById(notificationId);
        if (!isNotificationAvailable) {
            return res.status(400).json({
                status: 400,
                data: null,
                message: 'Notification not found',
            });
        }

        await BusinessNotification.findByIdAndDelete(notificationId);

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



export const markNotificationUnread = asyncHandler(async (req, res) => {
    try {
        const { notificationId } = req.params;

        if (!notificationId) {
            return res.status(400).json({
                status: 400,
                data: null,
                message: 'Notification ID is required',
            });
        }

        const notification = await BusinessNotification.findOneAndUpdate(
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

        await emitUnreadCountUpdate(req, req.user._id);

        return res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));


    } catch (error) {
        console.log("Something went wrong", error);
        return res.status(500).json({
            error: "Failed to fetch notifications",
            message: error.message
        });
    }
});
