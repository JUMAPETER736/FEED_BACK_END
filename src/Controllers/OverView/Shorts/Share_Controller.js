
import mongoose from "mongoose";
import { SocialPost }  from "../../../Models/Shorts/Post_Model.js";
import { SocialShare } from "../../../Models/Shorts/Share_Model.js";
import UnifiedNotification from "../../../Models/Notifications/Unified_Notification_Model.js";
import { emitSocketEvent }       from "../../../Sockets/index.js";
import { emitUnreadCountUpdate } from "../../../Sockets/socket.js";
import { ApiError }    from "../../../Utils/API_Errors.js";
import { ApiResponse } from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
import { getMongoosePaginationOptions } from "../../../Utils/Helpers.js";

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
