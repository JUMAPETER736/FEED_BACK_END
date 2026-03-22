

import mongoose from "mongoose";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { SocialCommentReply } from "../../../models/apps/social-media/comment.reply.models.js";
import { SocialComment } from "../../../models/apps/social-media/comment.models.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import {
  getMongoosePaginationOptions,
  getStaticThumbnailFilePath,
  getThumbnailLocalPath,
} from "../../../utils/helpers.js";
import { ApiError } from "../../../utils/ApiError.js";

import {
  getCommentImageLocalPath,
  getStaticCommentImageFilePath,
  getCommentAudioLocalPath,
  getStaticCommentAudioFilePath,
  getCommentDocsLocalPath,
  getStaticCommentDocsFilePath,
  getCommentThumbnailLocalPath,
  getStaticCommentThumbnailFilePath,
  getCommentGifLocalPath,
  getStaticCommentGifFilePath,
  getStaticCommentVideoFilePath,
  getCommentVideoLocalPath,
  removeLocalFile,
} from "../../../utils/helpers.js";
import { User } from "../../../models/apps/auth/user.models.js";
import Notification from "../../../models/apps/notifications/notification.model.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
import CommentNotification from "../../../models/apps/notifications/commentNotification.model.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";

/**
 * @param {string} userId
 * @param {import("express").Request} req
 * @description Utility function which returns the pipeline stages to structure the social post schema with calculations like, likes count, comments count, isLiked, isBookmarked etc
 * @returns {mongoose.PipelineStage[]}
 */



const postCommonAggregation = (req) => {
  return [
    {
      $lookup: {
        from: "socialcomments",
        localField: "_id",
        foreignField: "postId",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "postId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "postId",
        as: "isLiked",
        pipeline: [
          {
            $match: {
              likedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
        ],
      },
    },
     {
      $lookup: {
        from: "socialbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "isBookmarked",
        pipeline: [
          {
            $match: {
              bookmarkedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
        ],
      },
    },
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
                  $project: {
                    avatar: 1,
                    email: 1,
                    username: 1,
                    _id: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              account: { $first: "$account" },
            },
          },
        ],
      },
    },

    {
      $addFields: {
        // author: { $first: "$author" },
        author: {
          $mergeObjects: [
            { $first: "$author" },
            { authorId: "$author._id" }, // Assuming the author ID is available in the "author" field
          ],
        },
        likes: { $size: "$likes" },
        comments: { $size: "$comments" },
        isLiked: {
          $cond: {
            if: {
              $gte: [
                {
                  // if the isLiked key has document in it
                  $size: "$isLiked",
                },
                1,
              ],
            },
            then: true,
            else: false,
          },
        },
        isBookmarked: {
          $cond: {
            if: {
              $gte: [
                {
                  // if the isBookmarked key has document in it
                  $size: "$isBookmarked",
                },
                1,
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
  ];
};



const unifiedNotificationCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sender: { $arrayElemAt: ["$sender", 0] }, // Take the first element of the array as sender
      },
    },
  ];
};


onst addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const {
    content,
    contentType,
    localUpdateId,
    duration,
    fileName,
    fileType,
    fileSize,
    numberOfPages,
    gif,
  } = req.body;

  const isPostAvailable = await SocialPost.findById(postId);
  if (!isPostAvailable) {
    return res.status(404).json({
      success: false,
      message: "Social Post not found",
      data: {}
    });
  }


  if (req.files) {
    try {
      const audios =
        req.files.audio && req.files.audio.length
          ? req.files.audio.map((aud) => {
            const audioUrl = getStaticCommentAudioFilePath(req, aud.filename);
            const audioLocalPath = getCommentAudioLocalPath(aud.filename);
            return { url: audioUrl, localPath: audioLocalPath };
          })
          : [];

      const images =
        req.files.image && req.files.image.length
          ? req.files.image.map((img) => {
            const imageUrl = getStaticCommentImageFilePath(req, img.filename);
            const imageLocalPath = getCommentImageLocalPath(img.filename);
            return { url: imageUrl, localPath: imageLocalPath };
          })
          : [];
      const videos =
        req.files.video && req.files.video.length
          ? req.files.video.map((vid) => {
            const videoUrl = getStaticCommentVideoFilePath(req, vid.filename);
            const videoLocalPath = getCommentVideoLocalPath(vid.filename);
            return { url: videoUrl, localPath: videoLocalPath };
          })
          : [];

      const thumbnails =
        req.files.thumbnail && req.files.thumbnail.length
          ? req.files.thumbnail.map((tn) => {
            const thumbnailUrl = getStaticCommentThumbnailFilePath(
              req,
              tn.filename
            );
            const thumbnailLocalPath = getCommentThumbnailLocalPath(
              tn.filename
            );
            return { url: thumbnailUrl, localPath: thumbnailLocalPath };
          })
          : [];

      const docs =
        req.files.docs && req.files.docs.length
          ? req.files.docs.map((doc) => {
            const docUrl = getStaticCommentDocsFilePath(req, doc.filename);
            const docLocalPath = getCommentDocsLocalPath(doc.filename);
            return { url: docUrl, localPath: docLocalPath };
          })
          : [];
 const comment = await SocialComment.create({
        content,
        contentType,
        localUpdateId: localUpdateId,
        author: req.user?._id,
        postId,
        duration: duration,
        audios: audios || [],
        images: images || [],
        videos: videos || [],
        docs: docs,
        gifs: gif,
        thumbnail: thumbnails,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
        numberOfPages: numberOfPages,
      });

      console.log("Comment with images file added successfully:", comment);

      const post = await SocialPost.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(postId),
          },
        },
        ...postCommonAggregation(req),
      ]);

      const commentedPost = post[0];
      if (!commentedPost) {
        throw new ApiError("Post not found");
      }

      const receiverId = post[0].author.account._id;
      const authorName = post[0].author.account.username;

      console.log(`post owner: ${receiverId}`);
      console.log(`post owner: ${authorName}`);

      if (receiverId.toString() !== req.user._id.toString()) {
        const user = await User.findById(receiverId);
        console.log(
          `Creating notification for user: ${user.username} with ID: ${receiverId}`
        );
     // Follow Notification
        await UnifiedNotification.create({
          owner: receiverId,
          sender: req.user._id,
          message: `${req.user.username} commented on your short`,
          avatar: req.user.avatar,
          type: "onCommentPost",
          data: {
            postId: commentedPost._id,
            for: "social",
            commentId: comment._id,
            commentReplyId: null
          },
        });

        // const commentId = new ObjectId(comment._id);
        const notifications = await UnifiedNotification.aggregate([
          {
            $match: {
              owner: new mongoose.Types.ObjectId(receiverId),
            },
          },
          ...unifiedNotificationCommonAggregation(),
          {
            $sort: {
              createdAt: -1,
            },
          },
        ]);


        if (notifications.length === 0) {
          throw new ApiError(500, "Internal server error");
        }

        const newNotification = notifications[0];
        if (!newNotification) {
          throw new ApiError(500, "Internal server error");
        }
        console.log(`new comment notification: ${newNotification}`);

        // Emit socket event for the new notification
        emitSocketEvent(req, `${user._id}`, "onCommentPosted", newNotification);

        emitUnreadCountUpdate(req, String(receiverId));
      }
       return res
        .status(201)
        .json(new ApiResponse(201, comment, "Comment added successfully"));
    } catch (error) {
      console.log(`error ${error}`);
    }
  } else {
    console.log(`files not present`);
    console.log(`postid ${postId}, content ${content}`);

    const comment = await SocialComment.create({
      content,
      contentType,
      localUpdateId: localUpdateId,
      author: req.user?._id,
      postId,
      gifs: gif,
    });


    return res
      .status(201)
      .json(new ApiResponse(201, comment, "Comment added successfully"));
  }
});