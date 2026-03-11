

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

            // STEP 7: ORIGINAL POST LIVE STATS
            {
                $lookup: {
                    from: "feedlikes",
                    localField: "_originalPostData._id",
                    foreignField: "postId",
                    as: "_origLikes",
                },
            },
            {
                $lookup: {
                    from: "feedbookmarks",
                    localField: "_originalPostData._id",
                    foreignField: "postId",
                    as: "_origBookmarks",
                },
            },

              //  Only count real repost wrappers for _origReposts
            {
                $lookup: {
                    from: "feedposts",
                    let: { origId: "$_originalPostData._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$originalPostId", "$$origId"] },
                                        { $ne: ["$repostedByUserId", null] }  // only real repost wrappers
                                    ]
                                }
                            }
                        }
                    ],
                    as: "_origReposts",
                },
            },
            {
                $lookup: {
                    from: "feedshares",
                    localField: "_originalPostData._id",
                    foreignField: "postId",
                    as: "_origShares",
                },
            },
            {
                $lookup: {
                    from: "feedcomments",
                    localField: "_originalPostData._id",
                    foreignField: "postId",
                    as: "_origComments",
                },
            },

            // STEP 8: ORIGINAL POST REPOSTER PROFILES
            {
                $lookup: {
                    from: "users",
                    let: { reposterIds: "$_origReposts.repostedByUserId" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$reposterIds"] } } },
                        {
                            $lookup: {
                                from: "socialprofiles",
                                localField: "_id",
                                foreignField: "owner",
                                as: "profile",
                            },
                        },
                        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                avatar: 1,
                                username: 1,
                                email: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                coverImage: "$profile.coverImage",
                                firstName: "$profile.firstName",
                                lastName: "$profile.lastName",
                                bio: "$profile.bio",
                                owner: "$_id",
                            },
                        },
                    ],
                    as: "_origReposters",
                },
            },

             // STEP 9: PROJECT FINAL RESPONSE STRUCTURE
            {
                $project: {
                    // Wrapper identity
                    _id: 1,
                    __v: 1,
                    content: 1,
                    createdAt: 1,
                    updatedAt: 1,

                    // Repost wrappers carry no media of their own
                    feedShortsBusinessId: { $literal: null },
                    tags: { $literal: [] },
                    contentType: { $literal: "" },
                    numberOfPages: { $literal: [] },
                    files: { $literal: [] },
                    fileIds: { $literal: [] },
                    thumbnail: { $literal: [] },
                    duration: { $literal: [] },
                    fileNames: { $literal: [] },
                    fileTypes: { $literal: [] },
                    fileSizes: { $literal: [] },

                    // Repost flags
                    isReposted: { $literal: true },
                    isRepostWrapper: { $literal: true },
                    repostedByUserId: 1,
                    repostedUsers: ["$repostedByUserId"],

                    // Misc flags
                    isBusinessPost: { $literal: false },
                    isFollowing: { $literal: false },
                    isExpanded: { $literal: false },
                    isLocal: { $literal: false },

                    // Wrapper's own engagement stats
                    comments: { $size: "$repostComments" },

                    likes: { $size: "$repostLikes" },
                    isLiked: { $in: [userId, "$repostLikes.likedBy"] },
                    likedByUserIds: {
                        $map: { input: "$repostLikes", as: "l", in: "$$l.likedBy" },
                    },

                    bookmarkCount: { $size: "$repostBookmarks" },
                    isBookmarked: { $in: [userId, "$repostBookmarks.bookmarkedBy"] },
                    bookmarkedByUserIds: "$repostBookmarks.bookmarkedBy",

                    repostCount: { $size: "$repostReposts" },
                    isRepostedByMe: {
                        $in: [
                            userId,
                            { $map: { input: "$repostReposts", as: "r", in: "$$r.repostedByUserId" } },
                        ],
                    },
                    repostedByUserIds: {
                        $map: { input: "$repostReposts", as: "r", in: "$$r.repostedByUserId" },
                    },

                    shareCount: { $size: "$repostShares" },
                    isShared: { $in: [userId, "$repostShares.sharedBy"] },
                    sharedByUserIds: {
                        $map: { input: "$repostShares", as: "s", in: "$$s.sharedBy" },
                    },

                    // The user who did the reposting
                    repostedUser: {
                        _id: "$_reposterProfile._id",
                        avatar: "$_reposterAccount.avatar",
                        username: "$_reposterAccount.username",
                        email: "$_reposterAccount.email",
                        createdAt: "$_reposterAccount.createdAt",
                        updatedAt: "$_reposterAccount.updatedAt",
                        coverImage: "$_reposterProfile.coverImage",
                        firstName: "$_reposterProfile.firstName",
                        lastName: "$_reposterProfile.lastName",
                        bio: "$_reposterProfile.bio",
                        owner: "$_reposterAccount._id",
                    },

                    // Original post with LIVE global counts
                    originalPost: {
                        $cond: {
                            if: {
                                $and: [
                                    { $ne: ["$originalPostId", null] },
                                    { $ne: ["$_originalPostData", null] },
                                    { $ne: ["$_originalPostData._id", null] },
                                ],
                            },
                            then: [
                                {
                                    _id: "$_originalPostData._id",
                                    __v: "$_originalPostData.__v",
                                    content: "$_originalPostData.content",
                                    duration: "$_originalPostData.duration",
                                    feedShortsBusinessId: "$_originalPostData.feedShortsBusinessId",
                                    tags: "$_originalPostData.tags",
                                    contentType: "$_originalPostData.contentType",
                                    numberOfPages: "$_originalPostData.numberOfPages",
                                    fileNames: "$_originalPostData.fileNames",
                                    fileTypes: "$_originalPostData.fileTypes",
                                    fileSizes: "$_originalPostData.fileSizes",
                                    files: "$_originalPostData.files",
                                    fileIds: "$_originalPostData.fileIds",
                                    thumbnail: "$_originalPostData.thumbnail",
                                    createdAt: "$_originalPostData.createdAt",
                                    updatedAt: "$_originalPostData.updatedAt",

                                    originalPostId: { $literal: null },
                                    isReposted: { $literal: false },
                                    repostedByUserId: { $literal: null },
                                    repostedUsers: { $literal: [] },

                                    author: {
                                        _id: "$_origAuthorProfile._id",
                                        coverImage: "$_origAuthorProfile.coverImage",
                                        firstName: "$_origAuthorProfile.firstName",
                                        lastName: "$_origAuthorProfile.lastName",
                                        bio: "$_origAuthorProfile.bio",
                                        dob: "$_origAuthorProfile.dob",
                                        location: "$_origAuthorProfile.location",
                                        countryCode: "$_origAuthorProfile.countryCode",
                                        phoneNumber: "$_origAuthorProfile.phoneNumber",
                                        owner: "$_origAuthorProfile.owner",
                                        createdAt: "$_origAuthorProfile.createdAt",
                                        updatedAt: "$_origAuthorProfile.updatedAt",
                                        __v: "$_origAuthorProfile.__v",
                                        account: {
                                            _id: "$_origAuthorAccount._id",
                                            avatar: "$_origAuthorAccount.avatar",
                                            username: "$_origAuthorAccount.username",
                                            email: "$_origAuthorAccount.email",
                                            createdAt: "$_origAuthorAccount.createdAt",
                                            updatedAt: "$_origAuthorAccount.updatedAt",
                                        },
                                    },

                                    originalPostReposter: "$_origReposters",
                                    bookmarks: "$_origBookmarks",

                                    // LIVE global counts for the quoted post card
                                    commentCount: { $size: "$_origComments" },
                                    likeCount: { $size: "$_origLikes" },
                                    bookmarkCount: { $size: "$_origBookmarks" },
                                    repostCount: { $size: "$_origReposts" },
                                    shareCount: { $size: "$_origShares" },
                                },
                            ],
                            else: [],
                        },
                    },
                },
            },

            // STEP 10: CLEANUP temp fields
            {
                $project: {
                    _originalPostIdObj: 0,
                    _originalPostData: 0,
                    _origAuthorProfile: 0,
                    _origAuthorAccount: 0,
                    _origLikes: 0,
                    _origBookmarks: 0,
                    _origReposts: 0,
                    _origShares: 0,
                    _origComments: 0,
                    _origReposters: 0,
                    _reposterAccount: 0,
                    _reposterProfile: 0,
                },
            },


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