


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


