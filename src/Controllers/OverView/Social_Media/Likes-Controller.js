


import mongoose from "mongoose";
import { SocialComment } from "../../../models/apps/social-media/comment.models.js";
import { SocialCommentReply } from "../../../models/apps/social-media/comment.reply.models.js";
import { SocialLike } from "../../../models/apps/social-media/like.models.js";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { ApiError } from "../../../utils/ApiError.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";

// ── Shared aggregation to enrich a notification with sender details ───────────
const unifiedNotificationCommonAggregation = () => [
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

// ── Helper: create a notification and emit it via socket ──────────────────────
const createAndEmitNotification = async (req, { owner, type, message, avatar, data }) => {
  const notification = await UnifiedNotification.create({
    owner,
    sender: req.user._id,
    message,
    avatar: avatar ?? req.user.avatar,
    type,
    data,
  });

  // Enrich the saved notification rather than re-querying all notifications
  const [enriched] = await UnifiedNotification.aggregate([
    { $match: { _id: notification._id } },
    ...unifiedNotificationCommonAggregation(),
  ]);

  if (!enriched) throw new ApiError(500, "Internal server error");

  emitSocketEvent(req, String(owner), type, enriched);
  emitUnreadCountUpdate(req, String(owner));
};


const likeDislikePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);
  if (!post) throw new ApiError(404, "Post does not exist");

  const existing = await SocialLike.findOne({ postId, likedBy: req.user._id });

  if (existing) {
    await SocialLike.findOneAndDelete({ postId, likedBy: req.user._id });
    return res.status(200).json(new ApiResponse(200, { isLiked: false }, "Unliked successfully"));
  }

  await SocialLike.create({ postId: post._id, likedBy: req.user._id });

  // Only notify if it's not the post author liking their own post
  if (String(post.author) !== String(req.user._id)) {
    await createAndEmitNotification(req, {
      owner: post.author,
      type: "postLiked",
      message: `${req.user.username} liked the short you posted`,
      avatar: req.user.avatar,
      data: { postId: post._id, for: "social", commentId: null, commentReplyId: null },
    });
  }

  return res.status(200).json(new ApiResponse(200, { isLiked: true }, "Liked successfully"));
});


const likeDislikeComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await SocialComment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment does not exist");

  const existing = await SocialLike.findOne({ commentId, likedBy: req.user._id });

  if (existing) {
    await SocialLike.findOneAndDelete({ commentId, likedBy: req.user._id });
    return res.status(200).json(new ApiResponse(200, { isLiked: false }, "Unliked successfully"));
  }

  await SocialLike.create({ commentId, likedBy: req.user._id });

  // Don't notify when liking your own comment
  if (String(comment.author) !== String(req.user._id)) {
    await createAndEmitNotification(req, {
      owner: comment.author,
      type: "commentLiked",                          // ← fixed (was "postLiked")
      message: `${req.user.username} liked your comment.`,
      avatar: req.user.avatar,
      data: { postId: comment.postId, for: "social", commentId: comment._id, commentReplyId: null },
    });
  }

  return res.status(200).json(new ApiResponse(200, { isLiked: true }, "Liked successfully"));
});


