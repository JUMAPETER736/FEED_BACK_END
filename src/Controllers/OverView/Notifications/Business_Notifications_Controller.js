

import { BusinessNotification } from "../../../models/apps/business/businesspost/notification/business.notification.model.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import mongoose from "mongoose";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";


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