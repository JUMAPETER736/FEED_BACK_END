

import mongoose from "mongoose";
import { SocialBlock } from "../../../models/apps/social-media/block.models.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";

// Block user
const blockUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    
    console.log("BLOCK Request Received");
    console.log("Current User ID:", currentUserId);
    console.log("Target User ID:", userId);
    console.log("Method:", req.method);
 

    // Prevent self-blocking
    if (userId === currentUserId.toString()) {
        console.log("Self-block attempt");
        throw new ApiError(400, "You cannot block yourself");
    }

    // Check if user exists
    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
        console.log("User not found:", userId);
        throw new ApiError(404, "User does not exist");
    }

    console.log("✓ User found:", userToBlock.username);

    // Check if already blocked
    const existingBlock = await SocialBlock.findOne({
        blockerId: currentUserId,
        blockedId: new mongoose.Types.ObjectId(userId),
    });

    if (existingBlock) {
        console.log("You  blocked");
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { blocked: true },
                    "You blocked"
                )
            );
    }

    // Block: Create new block document
    console.log("✓ Blocking user...");
    await SocialBlock.create({
        blockerId: currentUserId,
        blockedId: new mongoose.Types.ObjectId(userId),
    });

    console.log(" Blocked successfully");
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { blocked: true },
                "Blocked successfully"
            )
        );
});


// Unblock user
const unblockUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    console.log("UNBLOCK Request Received");
    console.log("Current User ID:", currentUserId);
    console.log("Target User ID:", userId);
    console.log("Method:", req.method);


    // Check if block exists
    const existingBlock = await SocialBlock.findOne({
        blockerId: currentUserId,
        blockedId: new mongoose.Types.ObjectId(userId),
    });

    if (!existingBlock) {
        console.log(" User is not blocked");
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { blocked: false },
                    "User is not blocked"
                )
            );
    }

    // Unblock: Delete the block document
    console.log("Unblocking user...");
    await SocialBlock.findByIdAndDelete(existingBlock._id);

    console.log(" User unblocked successfully");
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { blocked: false },
                "User unblocked successfully"
            )
        );
});


// Toggle block/unblock (your original function)
const blockUnblockUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;


    console.log("Block/Unblock TOGGLE Request Received");
    console.log("Current User ID:", currentUserId);
    console.log("Target User ID:", userId);
    console.log("Method:", req.method);
    console.log("Headers:", req.headers);


    // Prevent self-blocking
    if (userId === currentUserId.toString()) {
        console.log(" Self-block attempt");
        throw new ApiError(400, "You cannot block yourself");
    }

    // Check if user exists
    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
        console.log("User not found:", userId);
        throw new ApiError(404, "User does not exist");
    }

    console.log("User found:", userToBlock.username);

    // Check if already blocked
    const existingBlock = await SocialBlock.findOne({
        blockerId: currentUserId,
        blockedId: new mongoose.Types.ObjectId(userId),
    });

    if (existingBlock) {
        console.log("Existing block found - Unblocking...");
        await SocialBlock.findByIdAndDelete(existingBlock._id);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { blocked: false },
                    "User unblocked successfully"
                )
            );
    } else {
        console.log("✓ No existing block - Blocking...");
        await SocialBlock.create({
            blockerId: currentUserId,
            blockedId: new mongoose.Types.ObjectId(userId),
        });

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { blocked: true },
                    "User blocked successfully"
                )
            );
    }
});
