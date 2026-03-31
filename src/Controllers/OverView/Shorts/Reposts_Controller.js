

import mongoose from "mongoose";
import { SocialPost }   from "../../../Models/Shorts/Post_Model.js";
import { SocialRepost } from "../../../Models/Shorts/Repost_Model.js";
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

const toggleRepost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);
  if (!post) throw new ApiError(404, "Post does not exist");

  const existing = await SocialRepost.findOne({ postId, repostedBy: req.user._id });

  if (existing) {
    await SocialRepost.findOneAndDelete({ postId, repostedBy: req.user._id });
    return res
      .status(200)
      .json(new ApiResponse(200, { isReposted: false }, "Repost removed successfully"));
  }

  await SocialRepost.create({ postId: post._id, repostedBy: req.user._id });

  if (String(post.author) !== String(req.user._id)) {
    const notification = await UnifiedNotification.create({
      owner: post.author,
      sender: req.user._id,
      message: `${req.user.username} reposted your short.`,
      avatar: req.user.avatar,
      type: "postReposted",
      data: { postId: post._id, for: "social", commentId: null, commentReplyId: null },
    });

    const [enriched] = await UnifiedNotification.aggregate([
      { $match: { _id: notification._id } },
      ...notifAggregation(),
    ]);

    if (enriched) {
      emitSocketEvent(req, String(post.author), "postReposted", enriched);
      emitUnreadCountUpdate(req, String(post.author));
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isReposted: true }, "Post reposted successfully"));
});



const getMyRepostedShorts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const { postCommonAggregation } = await import("./post.controllers.js");

  // ✅ Get ALL reposted postIds from everyone in the system
  const repostedPostIds = await SocialRepost.distinct("postId");

  if (!repostedPostIds.length) {
    return res.status(200).json(
      new ApiResponse(200, { totalRepostedShorts: 0, repostedShorts: [], page: Number(page), totalPages: 0 }, "No reposted shorts found")
    );
  }

  const objectIds = repostedPostIds
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
      customLabels: { totalDocs: "totalRepostedShorts", docs: "repostedShorts" },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, posts, "Reposted shorts fetched successfully"));
});


const getRepostsForPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);
  if (!post) throw new ApiError(404, "Post does not exist");

  const repostCount = await SocialRepost.countDocuments({ postId });
  const isReposted = !!(await SocialRepost.findOne({ postId, repostedBy: req.user._id }));

  return res.status(200).json(
    new ApiResponse(200, { postId, repostCount, isReposted }, "Repost data fetched successfully")
  );
});

export { toggleRepost, getMyRepostedShorts, getRepostsForPost };