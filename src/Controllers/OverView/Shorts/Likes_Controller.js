


import mongoose from "mongoose";
import { SocialComment }      from "../../../Models/Shorts/Comment_Model.js";
import { SocialCommentReply } from "../../../Models/Shorts/Comment_Reply_Model.js";
import { SocialLike }         from "../../../Models/Shorts/Like_Model.js";
import { SocialPost }         from "../../../Models/Shorts/Post_Model.js";
import UnifiedNotification from "../../../Models/Notifications/Unified_Notification_Model.js";
import { emitSocketEvent }       from "../../../Sockets/index.js";
import { emitUnreadCountUpdate } from "../../../Sockets/socket.js";
import { ApiError }    from "../../../Utils/API_Errors.js";
import { ApiResponse } from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";


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

const likeDislikeCommentReply = asyncHandler(async (req, res) => {
  const { commentReplyId } = req.params;

  const commentReply = await SocialCommentReply.findById(commentReplyId);
  if (!commentReply) throw new ApiError(404, "Comment reply does not exist");

  const comment = await SocialComment.findById(commentReply.commentId);
  if (!comment) throw new ApiError(404, "Parent comment does not exist");

  const existing = await SocialLike.findOne({ commentReplyId, likedBy: req.user._id });

  if (existing) {
    await SocialLike.findOneAndDelete({ commentReplyId, likedBy: req.user._id });
    return res.status(200).json(new ApiResponse(200, { isLiked: false }, "Unliked successfully"));
  }

  await SocialLike.create({ commentReplyId, likedBy: req.user._id });

  // Don't notify when liking your own reply
  if (String(commentReply.author) !== String(req.user._id)) {
    await createAndEmitNotification(req, {
      owner: commentReply.author,
      type: "commentReplyLiked",                     // ← fixed (was "postLiked")
      message: `${req.user.username} liked your reply.`,
      avatar: req.user.avatar,
      data: {
        postId: comment.postId,
        for: "social",
        commentId: comment._id,
        commentReplyId: commentReply._id,
      },
    });
  }

  return res.status(200).json(new ApiResponse(200, { isLiked: true }, "Liked successfully"));
});

export { likeDislikePost, likeDislikeComment, likeDislikeCommentReply };
