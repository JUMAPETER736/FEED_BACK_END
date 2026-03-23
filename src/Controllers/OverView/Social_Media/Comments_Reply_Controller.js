

import mongoose from "mongoose";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import { ApiError } from "../../../utils/ApiError.js";
import { SocialCommentReply } from "../../../models/apps/social-media/comment.reply.models.js";
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
// import { SocialPost } from "../../../models/apps/social-media/post.models.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";

import { SocialComment } from "../../../models/apps/social-media/comment.models.js";// import CommentNotification from "../../../models/apps/notifications/commentNotification.model.js";
import ReplyNotification from "../../../models/apps/notifications/replyNotification.model.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import Notification from "../../../models/apps/notifications/notification.model.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
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


const addCommentReply = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  var isReplyForMainComment = false;
  var mainComment = null;
  var commentAuthor = null;

  const isCommentToReplyToAvailable = await SocialCommentReply.findById(commentId);

  if (isCommentToReplyToAvailable) {
    isReplyForMainComment = false;
    commentAuthor = isCommentToReplyToAvailable.author;
  } else {
    isReplyForMainComment = true;
  }

  const {
    content,
    contentType,
    duration,
    fileName,
    fileType,
    fileSize,
    numberOfPages,
    gifs,
  } = req.body;

  if (isReplyForMainComment) {
    mainComment = await SocialComment.findById(commentId);
    commentAuthor = mainComment.author;
  } else {
    mainComment = await SocialComment.findById(isCommentToReplyToAvailable.commentId);
  }

  const isCommentAvailable = mainComment;

  if (!isCommentAvailable) {
    return res.status(404).json({
      success: false,
      message: "Comment not found"

    });
  }



  if (req.files) {
    console.log(`inside add comment reply file present`);
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

    console.log(`files present`);

    const commentReply = await SocialCommentReply.create({
      content,
      contentType,
      author: req.user?._id,
      commentId,
      duration: duration,
      audios: audios || [],
      images: images || [],
      videos: videos || [],
      thumbnail: thumbnails,
      docs: docs,
      thumbnail: thumbnails,
      fileName: fileName,
      fileSize: fileSize,
      fileType: fileType,
      numberOfPages: numberOfPages,
      gifs: gifs
    });

    console.log("comment has been replied successfully :", commentReply);

    const comment = await SocialCommentReply.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(commentId),
        },
      },
      ...postCommonAggregation(req),
    ]);
    const receiverId = commentAuthor;

    if (receiverId.toString() !== req.user._id.toString()) {
      const user = await User.findById(receiverId);
      console.log(`Creating comment reply notification for user: ${user.username} with ID: ${receiverId}`);
      // Follow Notification
      await UnifiedNotification.create({
        owner: commentAuthor,
        sender: req.user._id,
        message: `${req.user.username} replied to your comment.`,
        avatar: req.user.avatar,
        type: 'onCommentPost',
        data: {
          postId: isCommentAvailable.postId,
          for: "social",
          commentId: isCommentAvailable._id,
          commentReplyId: commentReply._id
        },
      });

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
        throw new ApiError(500, 'Internal server error');
      }

      const newNotification = notifications[0];
      if (!newNotification) {
        throw new ApiError(500, 'Internal server error');
      }
      console.log(`new comment notification: ${newNotification}`)

      // Emit socket event for the new notification
      emitSocketEvent(req, String(receiverId), 'onCommentPosted', newNotification);

      emitUnreadCountUpdate(req, String(receiverId));
    }
    return res
      .status(201)
      .json(
        new ApiResponse(201, commentReply, "Comment reply added successfully")
      );
  } else {
    console.log(`files not present`);
    console.log(`postId ${postId}, content ${content}`)

    const commentReply = await SocialCommentReply.create({
      content,
      contentType,
      author: req.user?._id,
      commentId,
      gifs: gifs,
    });



    return res
      .status(201)
      .json(
        new ApiResponse(201, commentReply, "Comment reply added successfully")
      );
  }

});


const getCommentsReply = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 5 } = req.query;
  const commentAggregation = SocialCommentReply.aggregate([
    {
      $match: {
        commentId: new mongoose.Types.ObjectId(commentId),
      },
    },
    {
      $sort: { createdAt: -1 }, // Sort by createdAt in descending order
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "commentReplyId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "sociallikes",
        localField: "_id",
        foreignField: "commentReplyId",
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
                  },
                },
              ],
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              account: 1,
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
        author: { $first: "$author" },
        likes: { $size: "$likes" },
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
      },
    },
  ]);

  const comments = await SocialCommentReply.aggregatePaginate(
    commentAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalReplyComments",
        docs: "comments",
      },
    })
  );

  // console.log(`comment replies ${comments}`)
  // Log comments or comment replies
  // console.log(`comment replies: ${JSON.stringify(comments, null, 2)}`);
  return res
    .status(200)
    .json(
      new ApiResponse(200, comments, "Comment replies fetched successfully")
    );
});


const deleteCommentReply = asyncHandler(async (req, res) => {
  const { commentReplyId } = req.params;
  const deletedComment = await SocialCommentReply.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(commentReplyId),
    author: req.user?._id,
  });

  if (!deletedComment) {
    throw new ApiError(
      404,
      "Comment is already deleted or you are not authorized for this action."
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { deletedComment }, "Comment deleted successfully")
    );
});



const updateCommentReply = asyncHandler(async (req, res) => {
  const { commentReplyId } = req.params;
  const { content } = req.body;

  const updatedComment = await SocialCommentReply.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(commentReplyId),
      author: req.user?._id,
    },
    {
      $set: { content },
    },
    { new: true }
  );

  if (!updatedComment) {
    throw new ApiError(
      404,
      "Comment does not exist or you are not authorized for this action."
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
});

export {
  addCommentReply,
  getCommentsReply,
  deleteCommentReply,
  updateCommentReply,
};