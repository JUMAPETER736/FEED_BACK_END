

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


// Get shared posts with full feed structure
const getSharedPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    console.log("Starting getSharedPosts for user:", req.user?._id);

    try {
        const userId = new mongoose.Types.ObjectId(req.user?._id);

        // Start aggregation from FeedShare, similar to FeedBookmark pattern
        const postAggregation = FeedShare.aggregate([
            // Match only shares by current user
            {
                $match: {
                    sharedBy: userId,
                },
            },
            // Sort by when they shared (most recent first)
            {
                $sort: { createdAt: -1 },
            },
            // Lookup the post
            {
                $lookup: {
                    from: "feedposts",
                    localField: "postId",
                    foreignField: "_id",
                    as: "post",
                },
            },
            // Unwind the post
            {
                $unwind: {
                    path: "$post",
                    preserveNullAndEmptyArrays: false,
                },
            },
            // Store share metadata before replacing root
            {
                $addFields: {
                    "post.shareId": "$_id",
                    "post.sharedBy": "$sharedBy",
                    "post.sharedAt": "$createdAt",
                    "post.shareMethod": "$shareMethod",
                    "post.shareNote": "$shareNote"
                }
            },
            // Replace root with post so feedCommonAggregation works
            {
                $replaceRoot: {
                    newRoot: "$post"
                }
            },

            // Now apply feedCommonAggregation (it expects post at root level)
            ...feedCommonAggregation(req),

            // ============================================
            // LIKES AGGREGATION
            // ============================================
            {
                $lookup: {
                    from: "feedlikes",
                    localField: "_id",
                    foreignField: "postId",
                    as: "postLikes"
                }
            },
            {
                $addFields: {
                    likedByUserIds: {
                        $map: {
                            input: "$postLikes",
                            as: "like",
                            in: "$$like.likedBy"
                        }
                    },
                    likes: { $size: "$postLikes" },
                    isLiked: {
                        $in: [userId, "$postLikes.likedBy"]
                    }
                }
            },
            {
                $project: {
                    postLikes: 0
                }
            },

            // ============================================
            // BOOKMARKS AGGREGATION
            // ============================================
            {
                $lookup: {
                    from: "feedbookmarks",
                    localField: "_id",
                    foreignField: "postId",
                    as: "bookmarks"
                }
            },
            {
                $addFields: {
                    bookmarkedByUserIds: "$bookmarks.bookmarkedBy",
                    bookmarkCount: { $size: "$bookmarks" },
                    isBookmarked: {
                        $in: [userId, "$bookmarks.bookmarkedBy"]
                    }
                }
            },
            {
                $project: {
                    bookmarks: 0
                }
            },

            // ============================================
            // REPOSTS AGGREGATION
            // ============================================
            {
                $lookup: {
                    from: "feedreposts",
                    localField: "_id",
                    foreignField: "originalPostId",
                    as: "postReposts"
                }
            },
            {
                $addFields: {
                    repostedByUserIds: {
                        $map: {
                            input: "$postReposts",
                            as: "repost",
                            in: "$$repost.repostedByUserId"
                        }
                    },
                    repostCount: { $size: "$postReposts" },
                    isReposted: {
                        $in: [userId, "$postReposts.repostedByUserId"]
                    }
                }
            },
            {
                $project: {
                    postReposts: 0
                }
            },

            // ============================================
            // SHARES AGGREGATION
            // ============================================
            {
                $lookup: {
                    from: "feedshares",
                    localField: "_id",
                    foreignField: "postId",
                    as: "postShares"
                }
            },
            {
                $addFields: {
                    sharedByUserIds: {
                        $map: {
                            input: "$postShares",
                            as: "share",
                            in: "$$share.sharedBy"
                        }
                    },
                    shareCount: { $size: "$postShares" },
                    isShared: true // Always true since we're fetching shared posts
                }
            },
            {
                $project: {
                    postShares: 0
                }
            }
        ]);

        console.log("Executing aggregation with pagination");

        const posts = await FeedShare.aggregatePaginate(
            postAggregation,
            getMongoosePaginationOptions({
                page: parseInt(page),
                limit: parseInt(limit),
                customLabels: {
                    totalDocs: "totalSharedPosts",
                    docs: "sharedPosts",
                },
            })
        );

        // Post-processing for reposted posts (same as getAllFeed)
        for (let post of posts.sharedPosts) {
            if (post.isReposted && post.originalPostId) {
                const originalPost = await FeedPost.findById(post.originalPostId);

                if (originalPost) {
                    const author = await SocialProfile.findById(originalPost.author)
                        .populate('owner');

                    if (author) {
                        post.author = {
                            _id: author._id,
                            coverImage: author.coverImage,
                            firstName: author.firstName,
                            lastName: author.lastName,
                            bio: author.bio,
                            dob: author.dob,
                            location: author.location,
                            countryCode: author.countryCode,
                            phoneNumber: author.phoneNumber,
                            owner: author.owner,
                            createdAt: author.createdAt,
                            updatedAt: author.updatedAt,
                            __v: author.__v,
                        };

                        if (author.owner) {
                            post.author.account = {
                                _id: author.owner._id,
                                avatar: author.owner.avatar,
                                username: author.owner.username,
                                email: author.owner.email,
                                createdAt: author.owner.createdAt,
                                updatedAt: author.owner.updatedAt
                            };
                        }

                        post.content = originalPost.content || post.content;
                        post.tags = originalPost.tags || post.tags;
                        post.fileIds = originalPost.fileIds || post.fileIds;
                        post.files = originalPost.files || post.files;
                        post.contentType = originalPost.contentType || post.contentType;

                        if (!post.contentType) {
                            post.contentType = "text";
                        }

                        if (!post.originalPost) {
                            post.originalPost = [];
                        }

                        if (post.originalPost.length === 0) {
                            post.originalPost.push({
                                _id: originalPost._id,
                                author: post.author,
                                content: originalPost.content,
                                contentType: originalPost.contentType,
                                files: originalPost.files,
                                fileIds: originalPost.fileIds,
                                tags: originalPost.tags,
                                createdAt: originalPost.createdAt,
                            });
                        }

                        post.comments = originalPost.comments || post.comments;
                        post.likes = originalPost.likes || post.likes;
                        post.reposts = originalPost.reposts || post.reposts;
                        post.repostedUsersCount = originalPost.repostedUsersCount || post.repostedUsersCount;
                    }

                    if (post.repostedByUserId) {
                        const repostedByUser = await User.findById(post.repostedByUserId);

                        if (repostedByUser) {
                            const repostedUserProfile = await SocialProfile.findOne({
                                owner: repostedByUser._id
                            });

                            const safeUser = {
                                _id: repostedUserProfile?._id || repostedByUser._id,
                                username: repostedByUser.username,
                                email: repostedByUser.email,
                                createdAt: repostedByUser.createdAt,
                                updatedAt: repostedByUser.updatedAt,
                            };

                            if (repostedByUser.avatar) {
                                safeUser.avatar = {
                                    url: repostedByUser.avatar.url,
                                    localPath: repostedByUser.avatar.localPath,
                                    _id: repostedByUser.avatar._id,
                                };
                            }

                            if (repostedUserProfile) {
                                safeUser.coverImage = repostedUserProfile.coverImage;
                                safeUser.firstName = repostedUserProfile.firstName;
                                safeUser.lastName = repostedUserProfile.lastName;
                                safeUser.bio = repostedUserProfile.bio;
                                safeUser.owner = repostedByUser._id;
                            }

                            post.repostedUser = safeUser;
                        }
                    }
                }
            }

            // Set contentType if not set
            if (!post.contentType) {
                if (post.files && post.files.length > 0) {
                    const fileTypes = post.files.map(f => f.fileType || "").filter(Boolean);
                    const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
                    const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
                    const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

                    if (hasVideo && hasImage) {
                        post.contentType = "mixed_files";
                    } else if (hasVideo) {
                        post.contentType = "videos";
                    } else if (hasAudio) {
                        post.contentType = "vn";
                    } else if (hasImage) {
                        post.contentType = "mixed_files";
                    } else {
                        post.contentType = "text";
                    }
                } else {
                    post.contentType = "text";
                }
            }
        }

        console.log("All Shared Posts fetched successfully:", posts.totalSharedPosts);

        // Return posts directly (matching getFeed pattern)
        return res
            .status(200)
            .json(
                new ApiResponse(200, posts, "All Shared Posts fetched successfully")
            );
    } catch (error) {
        console.error("Error fetching shared posts:", error);
        return res
            .status(500)
            .json(new ApiResponse(500, {}, `Error: ${error.message}`));
    }
});

export { toggleShare, getUserShares, getPostShares, getSharedPosts };
