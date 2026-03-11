import mongoose from "mongoose";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import { ApiError } from "../../../utils/ApiError.js";
import { FeedCommentReply } from "../../../models/apps/feed/feed_comment.reply.models.js";
import { FeedComment } from "../../../models/apps/feed/feed_comment.model.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import { unifiedNotificationCommonAggregation } from "../../../aggregations/unifiedNotifications.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";

import {
  getFeedCommentImageLocalPath,
  getStaticFeedCommentImageFilePath,
  getFeedCommentAudioLocalPath,
  getStaticFeedCommentAudioFilePath,
  getFeedCommentDocsLocalPath,
  getStaticFeedCommentDocsFilePath,
  getFeedCommentThumbnailLocalPath,
  getStaticFeedCommentThumbnailFilePath,
  getStaticFeedCommentVideoFilePath,
  getFeedCommentVideoLocalPath,
} from "../../../utils/helpers.js";

const addCommentReply = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  // const { content } = req.body;

  const checkForComment = await FeedComment.findById(commentId);

  const commentOwner = checkForComment.author

  console.log("Comment", checkForComment);

  if (!checkForComment) {
    return res.status(404).json(new ApiResponse(404, { found: false }, "Comment not found"))
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


  if (req.files) {
    const audios =
      req.files.audio && req.files.audio.length
        ? req.files.audio.map((aud) => {
          const audioUrl = getStaticFeedCommentAudioFilePath(
            req,
            aud.filename
          );
          const audioLocalPath = getFeedCommentAudioLocalPath(aud.filename);
          return { url: audioUrl, localPath: audioLocalPath };
        })
        : [];

    const images =
      req.files.image && req.files.image.length
        ? req.files.image.map((img) => {
          const imageUrl = getStaticFeedCommentImageFilePath(
            req,
            img.filename
          );
          const imageLocalPath = getFeedCommentImageLocalPath(img.filename);
          return { url: imageUrl, localPath: imageLocalPath };
        })
        : [];
    const videos =
      req.files.video && req.files.video.length
        ? req.files.video.map((vid) => {
          const videoUrl = getStaticFeedCommentVideoFilePath(
            req,
            vid.filename
          );
          const videoLocalPath = getFeedCommentVideoLocalPath(vid.filename);
          return { url: videoUrl, localPath: videoLocalPath };
        })
        : [];

    const thumbnails =
      req.files.thumbnail && req.files.thumbnail.length
        ? req.files.thumbnail.map((tn) => {
          const thumbnailUrl = getStaticFeedCommentThumbnailFilePath(
            req,
            tn.filename
          );
          const thumbnailLocalPath = getFeedCommentThumbnailLocalPath(
            tn.filename
          );
          return { url: thumbnailUrl, localPath: thumbnailLocalPath };
        })
        : [];

    const docs =
      req.files.docs && req.files.docs.length
        ? req.files.docs.map((doc) => {
          const docUrl = getStaticFeedCommentDocsFilePath(req, doc.filename);
          const docLocalPath = getFeedCommentDocsLocalPath(doc.filename);
          return { url: docUrl, localPath: docLocalPath };
        })
        : [];


    const commentReply = await FeedCommentReply.create({
      content,
      contentType,
      author: req.user?._id,
      commentId: checkForComment._id,
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
    });
    

    if (checkForComment.author.toString() === req.user._id) {
      return res.status(201).json(new ApiResponse(201, {}, "Can not create a notification for yourself"))
    }

    // Notification for the user when their comment is replied
    const note = await UnifiedNotification.create({
      owner: commentOwner,
      sender: req.user._id,
      message: `${req.user.username} has replied on your comment`,
      avatar: req.user.avatar,
      type: 'reply',
      data: {
        postId: checkForComment.postId,
        for: "feed",
        commentId: checkForComment._id,
        commentReplyId: commentReply._id
      },
    });

    console.log("Created notification", note);

    const notifications = await UnifiedNotification.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(commentOwner), // Assuming recipient field exists in Notification schema
        },
      },
      ...unifiedNotificationCommonAggregation(),
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    const newNotification = notifications[0];

    if (!newNotification) {
      throw new ApiError(500, 'Internal server error');
    }

    console.log("Aggregated comment", newNotification);


    // Emit socket event for the new notification
    emitSocketEvent(req, `${commentOwner.toString()}`, 'commentReply', newNotification);

    emitUnreadCountUpdate(req, commentOwner);


    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          commentReply,
          "feed Comment reply added successfully"
        )
      );
  } else {
    // console.log(`files not present`);
    // console.log(`postid ${postId}, content ${content}`)

    const commentReply = await FeedCommentReply.create({
      content,
      contentType,
      author: req.user?._id,
      commentId: checkForComment._id,
      gifs: gifs,
    });

    if (checkForComment.author.toString() === req.user._id.toString()) {
      return res.status(201).json(new ApiResponse(201, {}, "Can not create a notification for yourself"))
    }

    // Notification for the user when their comment is replied
    const note = await UnifiedNotification.create({
      owner: commentOwner,
      sender: req.user._id,
      message: `${req.user.username} has replied on your comment`,
      avatar: req.user.avatar,
      type: 'reply',
      data: {
        postId: checkForComment.postId,
        for: "feed",
        commentId: checkForComment._id,
        commentReplyId: commentReply._id
      },
    });

    console.log("Created notification", note);

    const notifications = await UnifiedNotification.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(commentOwner), // Assuming recipient field exists in Notification schema
        },
      },
      ...unifiedNotificationCommonAggregation(),
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    const newNotification = notifications[0];

    if (!newNotification) {
      throw new ApiError(500, 'Internal server error');
    }

    console.log("Aggregated comment", newNotification);


    // Emit socket event for the new notification
    emitSocketEvent(req, `${commentOwner.toString()}`, 'commentReply', newNotification);

    emitUnreadCountUpdate(req, commentOwner);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          commentReply,
          "feed Comment reply added successfully"
        )
      );
  }

});




const getCommentsReply = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 5 } = req.query;
  const commentAggregation = FeedCommentReply.aggregate([
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
        from: "feedlikes",
        localField: "_id",
        foreignField: "commentReplyId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "feedlikes",
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

  const comments = await FeedCommentReply.aggregatePaginate(
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


  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        comments,
        "feed Comment replies fetched successfully"
      )
    );
});


const deleteCommentReply = asyncHandler(async (req, res) => {
  const { commentReplyId } = req.params;
  const deletedComment = await FeedCommentReply.findOneAndDelete({
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

  const updatedComment = await FeedCommentReply.findOneAndUpdate(
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
