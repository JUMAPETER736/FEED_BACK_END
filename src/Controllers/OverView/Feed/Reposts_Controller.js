

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

const getUserReposts = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?._id;

        const userReposts = await FeedRepost.find({ repostedByUserId: userId })
            .populate('originalPostId')
            .populate('repostedByUserId')
            .sort({ createdAt: -1 });

        return res.status(200).json(
            new ApiResponse(200, { reposts: userReposts }, "User reposts fetched successfully")
        );
    } catch (error) {
        console.error("Get user reposts error:", error);
        return res.status(500).json(
            new ApiResponse(500, {}, "Failed to fetch user reposts")
        );
    }
});



const getRepostedPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    console.log("Starting getRepostedPosts for user:", req.user?._id);


     try {


            const postAggregation = FeedPost.aggregate([

                 // STEP 1: Only repost wrappers created by this user
            {
                $match: {
                    repostedByUserId: userId,
                    originalPostId: { $exists: true, $ne: null },
                },
            },

              // STEP 2: Newest repost first
            { $sort: { createdAt: -1 } },

              // STEP 3: REPOST WRAPPER'S OWN STATS
            {
                $lookup: {
                    from: "feedlikes",
                    localField: "_id",
                    foreignField: "postId",
                    as: "repostLikes",
                },
            },
            {
                $lookup: {
                    from: "feedbookmarks",
                    localField: "_id",
                    foreignField: "postId",
                    as: "repostBookmarks",
                },
            },
            {
                $lookup: {
                    from: "feedposts",
                    let: { wrapperId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$originalPostId", "$$wrapperId"] },
                                        { $ne: ["$repostedByUserId", null] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "repostReposts",
                },
            },
            {
                $lookup: {
                    from: "feedshares",
                    localField: "_id",
                    foreignField: "postId",
                    as: "repostShares",
                },
            },
            {
                $lookup: {
                    from: "feedcomments",
                    localField: "_id",
                    foreignField: "postId",
                    as: "repostComments",
                },
            },

            // STEP 4: LOOKUP ORIGINAL POST DATA
            {
                $addFields: {
                    _originalPostIdObj: {
                        $cond: {
                            if: {
                                $and: [
                                    { $ne: ["$originalPostId", null] },
                                    { $ne: ["$originalPostId", ""] },
                                ],
                            },
                            then: { $toObjectId: "$originalPostId" },
                            else: null,
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "feedposts",
                    localField: "_originalPostIdObj",
                    foreignField: "_id",
                    as: "_originalPostData",
                },
            },
            { $unwind: { path: "$_originalPostData", preserveNullAndEmptyArrays: true } },


            // STEP 5: ORIGINAL POST AUTHOR
            //  foreignField changed from "_id" to "owner"
            {
                $lookup: {
                    from: "socialprofiles",
                    localField: "_originalPostData.author",  // User ObjectId
                    foreignField: "owner",                    //  was "_id"
                    as: "_origAuthorProfile",
                },
            },
            { $unwind: { path: "$_origAuthorProfile", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "_origAuthorProfile.owner",
                    foreignField: "_id",
                    as: "_origAuthorAccount",
                },
            },
            { $unwind: { path: "$_origAuthorAccount", preserveNullAndEmptyArrays: true } },

            // REPOSTER USER INFO
            //  localField changed from "repostedByUser._id" to "repostedByUserId"
            {
                $lookup: {
                    from: "users",
                    localField: "repostedByUserId",
                    foreignField: "_id",
                    as: "_reposterAccount",
                },
            },
            { $unwind: { path: "$_reposterAccount", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "socialprofiles",
                    localField: "repostedByUserId",          //  was "repostedByUser._id"
                    foreignField: "owner",
                    as: "_reposterProfile",
                },
            },
            { $unwind: { path: "$_reposterProfile", preserveNullAndEmptyArrays: true } },


            ]);


            const posts = await FeedPost.aggregatePaginate(
            postAggregation,
            getMongoosePaginationOptions({
                page: parseInt(page),
                limit: parseInt(limit),
                customLabels: {
                    totalDocs: "totalRepostedPosts",
                    docs: "repostedPosts",
                },
            })
        );

        console.log("All Reposted Posts fetched successfully:", posts.totalRepostedPosts);

        return res
            .status(200)
            .json(new ApiResponse(200, posts, "All Reposted Posts fetched successfully"));

         } catch (error) {
              console.error("Error fetching reposted posts:", error);
             
              return res
              .status(500)
             .json(new ApiResponse(500, {}, `Error: ${error.message}`));

     }


 });


 export { toggleRepost, getUserReposts, getRepostedPosts };