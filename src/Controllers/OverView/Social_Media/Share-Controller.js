

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
