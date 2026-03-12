

import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import { FeedShare } from "../../../models/apps/feed/feed_share.models.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import mongoose from "mongoose";
import { feedCommonAggregation } from "./feed.controllers.js";


// Toggle share (createctly like bookmark and like or delete) - exa
const toggleShare = asyncHandler(async (req, res) => {
    try {
        const { postId } = req.params;
        const { shareMethod, shareNote } = req.body;
        const userId = req.user?._id;

        console.log("Toggle share - postId:", postId, "userId:", userId);

        // Validate postId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new ApiError(400, "Invalid post ID");
        }

        // Find the post
        const post = await FeedPost.findById(postId);

        if (!post) {
            throw new ApiError(404, "Post not found");
        }

        console.log("Post found:", post._id);

        // Check if user already shared this post
        const existingShare = await FeedShare.findOne({
            postId: post._id,
            sharedBy: userId,
        });

        if (existingShare) {
            // UNSHARE - Delete the share
            console.log("Existing share found, deleting...");

            await FeedShare.findByIdAndDelete(existingShare._id);

            // Get updated count and user IDs
            const remainingShares = await FeedShare.find({
                postId: post._id
            });

            const updatedShareCount = remainingShares.length;
            const sharedByUserIds = remainingShares.map(s => s.sharedBy);

            console.log("Unshare successful. New count:", updatedShareCount);

            return res.status(200).json(
                new ApiResponse(200, {
                    isShared: false,
                    shareCount: updatedShareCount,
                    sharedByUserIds: sharedByUserIds,
                }, "Post unshared successfully")
            );
        } else {
            // SHARE - Create new share
            console.log("Creating new share...");

            const share = await FeedShare.create({
                postId: post._id,
                sharedBy: userId,
                shareMethod: shareMethod || 'other',
                shareNote: shareNote || "",
            });

            console.log("Share created:", share._id);

            // Get updated count and user IDs
            const allShares = await FeedShare.find({
                postId: post._id
            });

            const updatedShareCount = allShares.length;
            const sharedByUserIds = allShares.map(s => s.sharedBy);

            console.log("Share successful. New count:", updatedShareCount);

            return res.status(201).json(
                new ApiResponse(201, {
                    isShared: true,
                    shareCount: updatedShareCount,
                    sharedByUserIds: sharedByUserIds,
                    shareId: share._id,
                }, "Post shared successfully")
            );
        }
    } catch (error) {
        console.error("Toggle share error:", error);

        // Handle duplicate key error (if unique index is set)
        if (error.code === 11000) {
            return res.status(400).json(
                new ApiResponse(400, {}, "You have already shared this post")
            );
        }

        return res.status(500).json(
            new ApiResponse(500, {}, error.message || "Failed to toggle share")
        );
    }
});


// Get all shares for a specific user (legacy - simple list)
const getUserShares = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?._id;
        const { page = 1, limit = 10 } = req.query;

        const userShares = await FeedShare.find({ sharedBy: userId })
            .populate('postId')
            .populate('sharedBy')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const totalShares = await FeedShare.countDocuments({ sharedBy: userId });

        return res.status(200).json(
            new ApiResponse(200, {
                shares: userShares,
                totalShares,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalShares / parseInt(limit))
            }, "User shares fetched successfully")
        );
    } catch (error) {
        console.error("Get user shares error:", error);
        return res.status(500).json(
            new ApiResponse(500, {}, "Failed to fetch user shares")
        );
    }
});




// Get all users who shared a specific post
const getPostShares = asyncHandler(async (req, res) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        // Validate postId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new ApiError(400, "Invalid post ID");
        }

        const shares = await FeedShare.find({ postId })
            .populate('sharedBy')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const totalShares = await FeedShare.countDocuments({ postId });

        return res.status(200).json(
            new ApiResponse(200, {
                shares,
                totalShares,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalShares / parseInt(limit))
            }, "Post shares fetched successfully")
        );
    } catch (error) {
        console.error("Get post shares error:", error);
        return res.status(500).json(
            new ApiResponse(500, {}, "Failed to fetch post shares")
        );
    }
});


