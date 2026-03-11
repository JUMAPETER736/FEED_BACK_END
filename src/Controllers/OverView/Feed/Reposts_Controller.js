

import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import { FeedRepost } from "../../../models/apps/feed/feed_repost.models.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import mongoose from "mongoose";



const toggleRepost = asyncHandler(async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment } = req.body;
        const userId = req.user?._id;

        console.log(" Toggle repost - postId:", postId, "userId:", userId);

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new ApiError(400, "Invalid post ID");
        }

        const originalPost = await FeedPost.findById(postId).populate("author");

        if (!originalPost) {
            throw new ApiError(404, "Post not found");
        }

        console.log(" Original post found:", originalPost._id);

        // ============================================
        // Check BOTH collections for existing repost
        // ============================================
        const existingRepostRecord = await FeedRepost.findOne({
            originalPostId: originalPost._id,
            repostedByUserId: userId,
        });

        const existingRepostWrapper = await FeedPost.findOne({
            originalPostId: originalPost._id,
            repostedByUserId: userId,
        });

        if (existingRepostRecord || existingRepostWrapper) {
            // ============================================
            // UNREPOST - Delete from BOTH collections
            // ============================================
            console.log(" Deleting repost from both collections...");

            if (existingRepostRecord) {
                await FeedRepost.findByIdAndDelete(existingRepostRecord._id);
                console.log("   Deleted from FeedRepost");
            }

            if (existingRepostWrapper) {
                await FeedPost.findByIdAndDelete(existingRepostWrapper._id);
                console.log("   Deleted from FeedPost");
            }

            // Get updated count (from FeedPost wrappers)
            const remainingWrappers = await FeedPost.find({
                originalPostId: originalPost._id,
                repostedByUserId: { $exists: true, $ne: null }
            });

            const updatedRepostCount = remainingWrappers.length;
            const repostedByUserIds = remainingWrappers.map(r => r.repostedByUserId);

            console.log(" Unrepost successful. New count:", updatedRepostCount);

            return res.status(200).json(
                new ApiResponse(200, {
                    isReposted: false,
                    repostCount: updatedRepostCount,
                    repostedByUserIds: repostedByUserIds,
                }, "Post unreposted successfully")
            );
        } else {
            // ============================================
            // REPOST - Create in BOTH collections
            // ============================================
            console.log("Creating repost in both collections...");

            //  Create in FeedRepost (for your getRepostedPosts endpoint)
            const repostRecord = await FeedRepost.create({
                originalPostId: originalPost._id,
                repostedByUserId: userId,
                repostComment: comment || "",
                originalContent: originalPost.content || "",
                originalTags: originalPost.tags || [],
                originalComments: originalPost.comments || 0,
                originalAuthorId: originalPost.author._id || originalPost.author,
                originalLikes: originalPost.likes || 0,
            });

            console.log(" Created in FeedRepost:", repostRecord._id);

            // Create wrapper in FeedPost (for feed display)
            const repostWrapper = await FeedPost.create({
                // Repost identification
                originalPostId: originalPost._id,
                repostedByUserId: userId,

                // Copy author from original post (REQUIRED)
                author: originalPost.author._id || originalPost.author,

                // Optional comment
                content: comment || "",

                // Empty arrays (wrapper has no media)
                tags: [],
                files: [],
                fileIds: [],
                thumbnail: [],
                duration: [],
                fileNames: [],
                fileTypes: [],
                fileSizes: [],
                numberOfPages: [],

                // Metadata
                contentType: "",
                feedShortsBusinessId: null,

                // Timestamps
                createdAt: new Date(),
                updatedAt: new Date()
            });

            console.log("Created wrapper in FeedPost:", repostWrapper._id);

            // VERIFY both records were saved
            const verifyRecord = await FeedRepost.findById(repostRecord._id);
            const verifyWrapper = await FeedPost.findById(repostWrapper._id);

            console.log(" Verification:");
            console.log("  FeedRepost exists:", verifyRecord ? "YES " : "NO ");
            console.log("  FeedPost wrapper exists:", verifyWrapper ? "YES " : "NO ");

            if (!verifyRecord || !verifyWrapper) {
                console.error("CRITICAL: Failed to create repost!");

                // Cleanup
                if (verifyRecord) await FeedRepost.findByIdAndDelete(repostRecord._id);
                if (verifyWrapper) await FeedPost.findByIdAndDelete(repostWrapper._id);

                throw new ApiError(500, "Failed to create repost");
            }

            // Get updated count (from FeedPost wrappers)
            const allWrappers = await FeedPost.find({
                originalPostId: originalPost._id,
                repostedByUserId: { $exists: true, $ne: null }
            });

            const updatedRepostCount = allWrappers.length;
            const repostedByUserIds = allWrappers.map(r => r.repostedByUserId);

            console.log("Repost created successfully!");
            console.log("  Count:", updatedRepostCount);
            console.log("  FeedRepost ID:", repostRecord._id);
            console.log("  FeedPost wrapper ID:", repostWrapper._id);

            return res.status(201).json(
                new ApiResponse(201, {
                    isReposted: true,
                    repostCount: updatedRepostCount,
                    repostedByUserIds: repostedByUserIds,
                    repostId: repostRecord._id,
                    wrapperId: repostWrapper._id,
                }, "Post reposted successfully")
            );
        }
    } catch (error) {
        console.error("Toggle repost error:", error);
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        if (error.code === 11000) {
            return res.status(400).json(
                new ApiResponse(400, {}, "You have already reposted this post")
            );
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json(
                new ApiResponse(400, {}, `Validation error: ${messages.join(', ')}`)
            );
        }

        return res.status(500).json(
            new ApiResponse(500, {}, error.message || "Failed to toggle repost")
        );
    }
});

