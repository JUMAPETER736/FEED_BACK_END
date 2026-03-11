import mongoose from "mongoose";

import { FeedComment } from "../../../models/apps/feed/feed_comment.model.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { unifiedNotificationCommonAggregation } from "../../../aggregations/unifiedNotifications.js";
import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import {
  getMongoosePaginationOptions,
  getStaticThumbnailFilePath,
  getThumbnailLocalPath,
} from "../../../utils/helpers.js";
import { ApiError } from "../../../utils/ApiError.js";
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
  getFeedCommentGifLocalPath,
  getStaticFeedCommentGifFilePath,
  getStaticFeedCommentVideoFilePath,
  getFeedCommentVideoLocalPath,
  removeLocalFile,
} from "../../../utils/helpers.js";

const addComment = asyncHandler(async (req, res) => {
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
    gifs,
  } = req.body;

  console.log(
    `Add files content type ${contentType}, duration ${duration} ${gifs}`
  );

  console.log(`post id ${postId}`);

  const getPost = await FeedPost.findOne({ _id: postId });

  if (!getPost) {
    return res
      .status(404)
      .json(new ApiResponse(404, {}, "Post was not found!"));
  }

  const postOwner = getPost.author;

  // console.log(`req files ${req.files}`)
  if (req.files) {
    try {
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
            const docUrl = getStaticFeedCommentDocsFilePath(
              req,
              doc.filename
            );
            const docLocalPath = getFeedCommentDocsLocalPath(doc.filename);
            return { url: docUrl, localPath: docLocalPath };
          })
          : [];

   
      console.log(`files present`);

      const comment = await FeedComment.create({
        content,
        contentType,
        localUpdateId: localUpdateId,
        author: req.user?._id,
        postId: getPost._id,
        duration: duration,
        audios: audios || [],
        images: images || [],
        videos: videos || [],
        docs: docs,
        // gifs: gifs,
        thumbnail: thumbnails,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
        numberOfPages: numberOfPages,
      });

      if (postOwner.toString() === req.user._id.toString()) {
        return res.status(201).json(new ApiResponse(200, comment, "Comment added successfully"));
      }

      //comment notification
      await UnifiedNotification.create({
        owner: postOwner,
        sender: req.user._id,
        message: `${req.user.username} has commented on your post.`,
        avatar: req.user.avatar,
        type: "onCommentPost",
        data: {
          postId: getPost._id,
          for: "feed",
          commentId: comment._id,
          commentReplyId: null
        },
      });

      const notifications = await UnifiedNotification.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(postOwner), // Assuming recipient field exists in Notification schema
          },
        },
        ...unifiedNotificationCommonAggregation(),
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      const commentNotification = notifications[0];

      if (!commentNotification) {
        throw new ApiError(500, "Internal server error");
      }
      //emitsocket added here
      emitSocketEvent(req, postOwner.toString(), "onCommentPosted", commentNotification);

      emitUnreadCountUpdate(req, postOwner);

      return res
        .status(201)
        .json(new ApiResponse(201, comment, "Comment added successfully"));
    } catch (error) {
      console.log(`error ${error}`);
    }
  } else {
    // console.log(`files not present`)
    // console.log(`postid ${postId}, content ${content}`)

    const comment = await FeedComment.create({
      content,
      contentType,
      localUpdateId: localUpdateId,
      author: req.user?._id,
      postId: getPost._id,
      gifs: gifs,
    });



    if (postOwner.toString() === req.user._id.toString()) {
      return res.status(200).json(new ApiResponse(200, comment, "Comment added successfully"));
    }

    //comment notification
    await UnifiedNotification.create({
      owner: postOwner,
      sender: req.user._id,
      message: `${req.user.username} has commented on your post.`,
      avatar: req.user.avatar,
      type: "onCommentPost",
      data: {
        postId: getPost._id,
        for: "feed",
        commentId: comment._id,
        commentReplyId: null
      },
    });

    const notifications = await UnifiedNotification.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(postOwner), // Assuming recipient field exists in Notification schema
        },
      },
      ...unifiedNotificationCommonAggregation(),
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    const commentNotification = notifications[0];
    if (!commentNotification) {
      throw new ApiError(500, "Internal server error");
    }
    //emitsocket added here
    emitSocketEvent(req, postOwner.toString(), "onCommentPosted", commentNotification);

    emitUnreadCountUpdate(req, postOwner);

    return res
      .status(201)
      .json(new ApiResponse(201, comment, "Comment added successfully"));
  }
});

const getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const commentAggregation = FeedComment.aggregate([
    {
      $match: {
        postId: new mongoose.Types.ObjectId(postId),
      },
    },
    {
      $lookup: {
        from: "feedlikes",
        localField: "_id",
        foreignField: "commentId",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "feedlikes",
        localField: "_id",
        foreignField: "commentId",
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
        from: "feedcommentreplies",
        localField: "_id",
        foreignField: "commentId",
        as: "replies",
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
        replyCount: { $size: "$replies" },
      },
      // $addFields: {
      //   replyCount: { $size: "$replies" },
      // },
    },
  ]);


  const comments = await FeedComment.aggregatePaginate(
    commentAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalComments",
        docs: "comments",
      },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Post comments fetched successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const deletedComment = await FeedComment.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(commentId),
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

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  const updatedComment = await FeedComment.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(commentId),
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

export { addComment, getPostComments, deleteComment, updateComment };






































