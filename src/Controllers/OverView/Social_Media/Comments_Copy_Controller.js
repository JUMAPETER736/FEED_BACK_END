

import mongoose from "mongoose";
import { SocialComment } from "../../../models/apps/social-media/comment.models.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import { ApiError } from "../../../utils/ApiError.js";
import {User} from "../../../models/apps/auth/user.models.js";

import { emitSocketEvent } from "../../../socket/index.js";
// import CommentNotification from "../../../models/apps/notifications/commentNotification.model.js"
/**
 * @param {string} userId
 * @param {import("express").Request} req
 * @description Utility function which returns the pipeline stages to structure the social post schema with calculations like, likes count, comments count, isLiked, isBookmarked etc
 * @returns {mongoose.PipelineStage[]}
 */
////new code here 
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



const commentNotificationAggregation = () => {
  return [
    ...notificationCommonAggregation(),
    {
      $lookup: {
        from: "posts",
        foreignField: "_id",
        localField: "postId",
        as: "post",
        pipeline: [
          {
            $project: {
              title: 1,
              content: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        post: { $arrayElemAt: ["$post", 0] }, // Take the first element of the array as post
      },
    },
    {
      $lookup: {
        from: "comments",
        foreignField: "_id",
        localField: "commentId",
        as: "comment",
        pipeline: [
          {
            $project: {
              text: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        comment: { $arrayElemAt: ["$comment", 0] }, // Take the first element of the array as comment
      },
    },
  ];
};



const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;

  const comment = await SocialComment.create({
    content,
    author: req.user?._id,
    postId,
  });

  const post = await SocialPost.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(postId),
      },
    },
    ...postCommonAggregation(req),
  ]);


  const receiverId = post[0].author.account._id

  console.log(`post owner: ${receiverId}`)

  const originalPost = await SocialComment.findById(postId);
  if (!originalPost) {
    throw new ApiError(404, "Original post not found");
  }

    // Create a snippet of the original post content
    const originalPostCaption = originalPost.content;


  if (receiverId.toString() !== req.user._id.toString()) {
    const user = await User.findById(receiverId);

    console.log(`Creating notification for user: ${user.username} with ID: ${receiverId}`);
    await CommentNotification.create({
      owner: receiverId,
      sender: req.user._id,
      message: `${req.user.username} commented on your video short.${originalPostCaption.slice(0,10)}`,
      avatar: req.user.avatar,
      type: "comment",
      
    
    });

    const notifications = await CommentNotification.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(receiverId),
        },
      },
      // ...notificationCommonAggregation(),
      ...commentNotificationAggregation(),
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



    // Emit socket event for the new notification
    emitSocketEvent(req, `${user._id}`, 'onCommentPost', newNotification);
  }
  //new code ends here 

  return res
    .status(201)
    .json(new ApiResponse(201, comment, "Comment added successfully"));
});