

import mongoose from "mongoose";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { SocialShare } from "../../../models/apps/social-media/share.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";

const notifAggregation = () => [
  {
    $lookup: {
      from: "users",
      foreignField: "_id",
      localField: "sender",
      as: "sender",
      pipeline: [{ $project: { username: 1, avatar: 1, email: 1 } }],
    },
  },
  { $addFields: { sender: { $arrayElemAt: ["$sender", 0] } } },
];

const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);
  if (!post) throw new ApiError(404, "Post does not exist");

  const share = await SocialShare.create({ postId: post._id, sharedBy: req.user._id });

  if (String(post.author) !== String(req.user._id)) {
    const notification = await UnifiedNotification.create({
      owner: post.author,
      sender: req.user._id,
      message: `${req.user.username} shared your short.`,
      avatar: req.user.avatar,
      type: "postShared",
      data: { postId: post._id, for: "social", commentId: null, commentReplyId: null },
    });

    const [enriched] = await UnifiedNotification.aggregate([
      { $match: { _id: notification._id } },
      ...notifAggregation(),
    ]);

    if (enriched) {
      emitSocketEvent(req, String(post.author), "postShared", enriched);
      emitUnreadCountUpdate(req, String(post.author));
    }
  }

  const shareCount = await SocialShare.countDocuments({ postId });

  return res.status(200).json(
    new ApiResponse(200, { shareCount }, "Post shared successfully")
  );
});



const getMySharedShorts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const { postCommonAggregation } = await import("./post.controllers.js");

  // ✅ Get ALL shared postIds from everyone in the system
  const sharedPostIds = await SocialShare.distinct("postId");

  if (!sharedPostIds.length) {
    return res.status(200).json(
      new ApiResponse(200, { totalSharedShorts: 0, sharedShorts: [], page: Number(page), totalPages: 0 }, "No shared shorts found")
    );
  }

  const objectIds = sharedPostIds
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id.toString());
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const postAggregation = SocialPost.aggregate([
    { $match: { _id: { $in: objectIds } } },
    { $sort: { createdAt: -1 } },
    ...postCommonAggregation(req),
  ]);

  const posts = await SocialPost.aggregatePaginate(
    postAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: { totalDocs: "totalSharedShorts", docs: "sharedShorts" },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "Shared shorts fetched successfully"));
});



const getSharesForPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);
  if (!post) throw new ApiError(404, "Post does not exist");

  const shareCount = await SocialShare.countDocuments({ postId });
  const hasShared = !!(await SocialShare.findOne({ postId, sharedBy: req.user._id }));

  return res.status(200).json(
    new ApiResponse(200, { postId, shareCount, hasShared }, "Share data fetched successfully")
  );
});

export { sharePost, getMySharedShorts, getSharesForPost };
