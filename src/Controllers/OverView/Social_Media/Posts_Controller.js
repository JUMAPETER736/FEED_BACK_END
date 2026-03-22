import mongoose from "mongoose";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../constants.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { SocialBookmark } from "../../../models/apps/social-media/bookmark.models.js";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { SocialFollow } from "../../../models/apps/social-media/follow.models.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { SocialLike } from "../../../models/apps/social-media/like.models.js";
import { SocialComment } from "../../../models/apps/social-media/comment.models.js";
import { getShotsRecommendations } from "../../../services/recommendation.system.service.js";

import {
  getLocalPath,
  getMongoosePaginationOptions,
  getStaticFilePath,
  getThumbnailLocalPath,
  getStaticThumbnailFilePath,
  removeLocalFile,
} from "../../../utils/helpers.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";

//  Shorts-only match filter
const SHORTS_MATCH = {
  feedShortsBusinessId: { $exists: true, $ne: null, $ne: "" },
};

// Helper to convert IDs to ObjectIds safely 
const toObjectIds = (ids) =>
  ids
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id.toString());
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);



const createPost = asyncHandler(async (req, res) => {
  const { content, tags, fileId, feedShortsBusinessId } = req.body;

  const images =
    req.files.images && req.files.images?.length
      ? req.files.images.map((image) => ({
        url: getStaticFilePath(req, image.filename),
        localPath: getLocalPath(image.filename),
      }))
      : [];

  const thumbnail =
    req.files.thumbnail && req.files.thumbnail?.length
      ? req.files.thumbnail.map((image) => ({
        thumbnailUrl: getStaticThumbnailFilePath(req, image.filename),
        thumbnailLocalPath: getThumbnailLocalPath(image.filename),
      }))
      : [];

  const author = req.user._id;

  const post = await SocialPost.create({
    content,
    tags: tags || [],
    author,
    images,
    thumbnail,
    fileId,
    feedShortsBusinessId,
  });

  if (!post) throw new ApiError(500, "Error while creating a post");

  const createdPost = await SocialPost.aggregate([
    { $match: { _id: post._id } },
    ...postCommonAggregation(req),
  ]);

  return res.status(201).json(new ApiResponse(201, createdPost[0], "Short created successfully"));
});


const postCommonAggregation = (req) => {
  const currentUserId = req.user?._id
    ? new mongoose.Types.ObjectId(req.user._id)
    : null;

  const currentUserIdStr = req.user?._id ? req.user._id.toString() : null;

  return [
    {
      $lookup: {
        from: "businessproducts",
        let: { businessId: "$feedShortsBusinessId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: "$_id" }, "$$businessId"] },
            },
          },
          {
            $lookup: {
              from: "socialprofiles",
              localField: "owner",
              foreignField: "owner",
              as: "author",
              pipeline: [
                {
                  $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "account",
                    pipeline: [
                      { $project: { avatar: 1, username: 1, _id: 1 } },
                    ],
                  },
                },
                {
                  $addFields: {
                    account: {
                      $ifNull: [{ $arrayElemAt: ["$account", 0] }, {}],
                    },
                  },
                },
                { $project: { _id: 1, firstName: 1, lastName: 1, account: 1 } },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ],
        as: "businessDetails",
      },
    },
    {
      $addFields: {
        isBusinessPost: {
          $and: [
            { $ne: ["$feedShortsBusinessId", null] },
            { $ne: ["$feedShortsBusinessId", ""] },
            { $gt: [{ $size: { $ifNull: ["$businessDetails", []] } }, 0] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "businessprofiles",
        let: { ownerId: "$author", isBusinessPost: "$isBusinessPost" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$$isBusinessPost", true] },
                  { $eq: ["$owner", "$$ownerId"] },
                ],
              },
            },
          },
          {
            $project: {
              businessName: 1,
              businessType: 1,
              businessDescription: 1,
              backgroundPhoto: 1,
              contact: 1,
            },
          },
        ],
        as: "businessProfile",
      },
    },
    {
      $addFields: {
        "businessDetails.businessProfile": {
          $ifNull: [{ $arrayElemAt: ["$businessProfile", 0] }, null],
        },
      },
    },
    { $unwind: { path: "$businessDetails", preserveNullAndEmptyArrays: true } },
    { $project: { businessProfile: 0 } },

    // Core lookups 
    {
      $lookup: {
        from: "socialcomments",
        localField: "_id",
        foreignField: "postId",
        as: "commentsData",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "postId",
        as: "likesData",
      },
    },
    {
      $lookup: {
        from: "socialbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "bookmarksData",
      },
    },

    //  Follow status 
    {
      $lookup: {
        from: "socialfollows",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: [{ $toString: "$followerId" }, currentUserIdStr] },
                  {
                    $eq: [
                      { $toString: "$followeeId" },
                      { $toString: "$$authorId" },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "isFollowingArr",
      },
    },

    //  Author lookup
    {
      $lookup: {
        from: "socialprofiles",
        localField: "author",
        foreignField: "owner",
        as: "author",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "account",
              pipeline: [
                {
                  $project: { avatar: 1, email: 1, username: 1, _id: 1 },
                },
              ],
            },
          },
          { $addFields: { account: { $first: "$account" } } },
        ],
      },
    },

    // Computed fields 
    {
      $addFields: {
        author: {
          $mergeObjects: [
            { $first: "$author" },
            { authorId: "$author._id" },
          ],
        },
        likedByIds: { $map: { input: "$likesData", as: "like", in: "$$like.likedBy" } },
        commentedByIds: {
          $filter: {
            input: {
              $map: {
                input: "$commentsData",
                as: "comment",
                in: { $ifNull: ["$$comment.commentedBy", "$$comment.author"] },
              },
            },
            as: "id",
            cond: { $ne: ["$$id", null] },
          },
        },
        bookmarkedByIds: { $map: { input: "$bookmarksData", as: "bookmark", in: "$$bookmark.bookmarkedBy" } },
        likes: { $size: "$likesData" },
        bookmarks: { $size: "$bookmarksData" },
        comments: { $size: "$commentsData" },
        isLiked: {
          $cond: {
            if: { $eq: [currentUserIdStr, null] },
            then: false,
            else: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$likesData",
                          as: "like",
                          cond: { $eq: [{ $toString: "$$like.likedBy" }, currentUserIdStr] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        isBookmarked: {
          $cond: {
            if: { $eq: [currentUserIdStr, null] },
            then: false,
            else: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$bookmarksData",
                          as: "bookmark",
                          cond: { $eq: [{ $toString: "$$bookmark.bookmarkedBy" }, currentUserIdStr] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        isFollowing: { $gt: [{ $size: "$isFollowingArr" }, 0] },
      },
    },

    //  Clean up
    {
      $project: {
        isFollowingArr: 0,
        likesData: 0,
        bookmarksData: 0,
        commentsData: 0,
      },
    },
  ];
};


const updatePost = asyncHandler(async (req, res) => {
  const { content, tags } = req.body;
  const { postId } = req.params;

  const post = await SocialPost.findOne({
    _id: new mongoose.Types.ObjectId(postId),
    author: req.user?._id,
  });

  if (!post) throw new ApiError(404, "Short does not exist");

  let images =
    req.files?.images && req.files.images?.length
      ? req.files.images.map((image) => ({
        url: getStaticFilePath(req, image.filename),
        localPath: getLocalPath(image.filename),
      }))
      : [];

  const existedImages = post.images.length;
  const newImages = images.length;
  const totalImages = existedImages + newImages;

  if (totalImages > MAXIMUM_SOCIAL_POST_IMAGE_COUNT) {
    images?.map((img) => removeLocalFile(img.localPath));
    throw new ApiError(400, `Maximum ${MAXIMUM_SOCIAL_POST_IMAGE_COUNT} images allowed. Already has ${existedImages}.`);
  }

  images = [...post.images, ...images];

  const updatedPost = await SocialPost.findByIdAndUpdate(
    postId,
    { $set: { content, tags, images } },
    { new: true }
  );

  const aggregatedPost = await SocialPost.aggregate([
    { $match: { _id: updatedPost._id } },
    ...postCommonAggregation(req),
  ]);

  return res.status(200).json(new ApiResponse(200, aggregatedPost[0], "Short updated successfully"));
});


const removePostImage = asyncHandler(async (req, res) => {
  const { postId, imageId } = req.params;

  const post = await SocialPost.findOne({
    _id: new mongoose.Types.ObjectId(postId),
    author: req.user?._id,
  });

  if (!post) throw new ApiError(404, "Short does not exist");

  const updatedPost = await SocialPost.findByIdAndUpdate(
    postId,
    { $pull: { images: { _id: new mongoose.Types.ObjectId(imageId) } } },
    { new: true }
  );

  const removedImage = post.images?.find((image) => image._id.toString() === imageId);
  if (removedImage) removeLocalFile(removedImage.localPath);

  const aggregatedPost = await SocialPost.aggregate([
    { $match: { _id: updatedPost._id } },
    ...postCommonAggregation(req),
  ]);

  return res.status(200).json(new ApiResponse(200, aggregatedPost[0], "Short image removed successfully"));
});

const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findOneAndDelete({ _id: postId, author: req.user._id });
  if (!post) throw new ApiError(404, "Short does not exist");

  const postImages = [...(post.images || [])];
  postImages.map((image) => removeLocalFile(image.localPath));

  return res.status(200).json(new ApiResponse(200, {}, "Short deleted successfully"));
});



const getAllPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, session_id } = req.query;

  console.log("[getAllShorts] user:", req.user?._id, "page:", page);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    // ── Step 1: Get ranked shot IDs from Python rec service ───────
    let recommendedIds = [];
    let recSourceMap   = {};
    let rankedOrder    = {};
    let recItems       = [];

    try {
      const recResponse = await getShotsRecommendations(
        userId.toString(),
        parseInt(limit),
        parseInt(page),
        session_id || null
      );

      recItems  = recResponse.items  || [];

      if (recItems.length) {
        recommendedIds = recItems
          .map((r) => r.shot_id)
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        recSourceMap = Object.fromEntries(recItems.map((r) => [r.shot_id, r.rec_source]));
        rankedOrder  = Object.fromEntries(recItems.map((r) => [r.shot_id, r.position]));
      }
    } catch (recErr) {
      console.warn("[getAllShorts] Rec service unavailable, falling back to chronological:", recErr.message);
    }

    // ── Step 2: Build aggregation pipeline ────────────────────────
    // Rec active: $match to recommended IDs, stamp __recPosition, sort at end
    // Rec down:   run on all posts sorted chronologically
    const matchStage = recommendedIds.length
      ? [{ $match: { ...SHORTS_MATCH, _id: { $in: recommendedIds } } }]
      : [{ $match: SHORTS_MATCH }];

    const recPositionStage = recommendedIds.length
      ? [{
          $addFields: {
            __recPosition: { $indexOfArray: [recommendedIds, "$_id"] },
          },
        }]
      : [];

    const postAggregation = SocialPost.aggregate([
      ...matchStage,
      ...recPositionStage,

      ...postCommonAggregation(req),

      // Sort: rec order when active, chronological as fallback
      ...(recommendedIds.length
        ? [{ $sort: { __recPosition: 1 } }]
        : [{ $sort: { createdAt: -1 } }]
      ),

      {
        $project: {
          __recPosition: 0,
        },
      },
    ]);

    // ── Step 3: Execute ───────────────────────────────────────────
    let shorts;

    if (recommendedIds.length) {
      // Rec active — Python already paginated, fetch exactly those shots
      const raw = await postAggregation;

      // JS sort as safety net — source of truth for order
      const shotIdOrder = recItems.map((r) => r.shot_id);
      raw.sort((a, b) => {
        const posA = shotIdOrder.indexOf(a._id.toString());
        const posB = shotIdOrder.indexOf(b._id.toString());
        return posA - posB;
      });

      // Attach rec metadata
      shorts = raw.map((shot) => ({
        ...shot,
        rec_source: recSourceMap[shot._id.toString()] || "unknown",
        position:   rankedOrder[shot._id.toString()]  ?? 0,
      }));
    } else {
      // Rec down — fall back to aggregatePaginate (chronological)
      const data = await SocialPost.aggregatePaginate(
        postAggregation,
        getMongoosePaginationOptions({
          page:  parseInt(page),
          limit: parseInt(limit),
          customLabels: { totalDocs: "totalShorts", docs: "shorts" },
        })
      );
      shorts = data.shorts;
    }

    // ── Step 4: isFollowing — single batch query, not N+1 ─────────
    if (req.user?._id && shorts.length) {
      const authorAccountIds = shorts
        .map((s) => s.author?.account?._id)
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id.toString()));

      const follows = await SocialFollow.find({
        followerId: req.user._id,
        followeeId: { $in: authorAccountIds },
      }).select("followeeId").lean();

      const followedSet = new Set(follows.map((f) => f.followeeId.toString()));

      shorts.forEach((shot) => {
        const aid = shot.author?.account?._id?.toString();
        shot.isFollowing = aid ? followedSet.has(aid) : false;
      });
    } else {
      shorts.forEach((shot) => { shot.isFollowing = false; });
    }

    const posts = { shorts };

    return res.status(200).json(
      new ApiResponse(200, { posts }, "Shorts fetched successfully")
    );

  } catch (e) {
    console.error("[getAllShorts] Error:", e.message);
    return res.status(500).json(
      new ApiResponse(500, {}, `Error fetching shorts: ${e.message}`)
    );
  }
});


const getAllShortsByFeedShortBusinessId = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const { feedShortsBusinessId } = req.params;

  const postAggregation = SocialPost.aggregate([
    { $match: { feedShortsBusinessId } },
    ...postCommonAggregation(req),
  ]);

  const posts = await SocialPost.aggregatePaginate(
    postAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: { totalDocs: "totalShorts", docs: "shorts" },
    })
  );

  return res.status(200).json(new ApiResponse(200, { posts }, "Shorts fetched successfully"));
});

const getPostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(postId) } },
    ...postCommonAggregation(req),
  ]);

  if (!post[0]) throw new ApiError(404, "Short does not exist");

  return res.status(200).json(new ApiResponse(200, post[0], "Short fetched successfully"));
});

const getPostsByUsername = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const { username } = req.params;

  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) throw new ApiError(404, `User with username '${username}' does not exist`);

  const postAggregation = SocialPost.aggregate([
    { $match: { author: new mongoose.Types.ObjectId(user._id), ...SHORTS_MATCH } },
    { $sort: { createdAt: -1 } },
    ...postCommonAggregation(req),
  ]);

  const posts = await SocialPost.aggregatePaginate(
    postAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: { totalDocs: "totalShorts", docs: "shorts" },
    })
  );

  return res.status(200).json(new ApiResponse(200, posts, "User's shorts fetched successfully"));
});


const getMyPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const postAggregation = SocialPost.aggregate([
    { $match: { author: new mongoose.Types.ObjectId(req.user?._id), ...SHORTS_MATCH } },
    { $sort: { createdAt: -1 } },
    ...postCommonAggregation(req),
  ]);

  const posts = await SocialPost.aggregatePaginate(
    postAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: { totalDocs: "totalShorts", docs: "shorts" },
    })
  );

  return res.status(200).json(new ApiResponse(200, posts, "My shorts fetched successfully"));
});

const getPostByFileId = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  try {
    const posts = await SocialPost.aggregate([
      { $match: { fileId } },
      ...postCommonAggregation(req),
    ]);

    if (posts.length === 0) {
      return res.status(404).json({ message: "No shorts found for this fileId" });
    }

    res.status(200).json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred while retrieving shorts" });
  }
});