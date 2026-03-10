import { BusinessProduct } from "../../../../models/apps/business/business.product.model.js";
import { BusinessComment } from "../../../../models/apps/business/businesspost/business.comment.post.model.js";
import { BusinessCommentReply } from "../../../../models/apps/business/businesspost/business.comment.reply.model.js";
import { BusinessFeedLike } from "../../../../models/apps/business/businesspost/business.like.post.model.js";
import { BusinessNotification } from "../../../../models/apps/business/businesspost/notification/business.notification.model.js";
import { asyncHandler } from "../../../../utils/asyncHandler.js";
import { emitSocketEvent } from "../../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../../socket/socket.js";
import { ApiResponse } from "../../../../utils/ApiResponse.js";
import { unifiedNotificationCommonAggregation } from "../../../../aggregations/unifiedNotifications.js";
import mongoose from "mongoose";

export const likeandDislikeBusinessPost = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?._id;
        const { businessPostId } = req.params;
        const productPost = await BusinessProduct.findById(businessPostId);

        // check if products post exists
        if (!productPost) {
            return res.status(400).json({
                success: false,
                message: "Product post not found"
            });
        }

        // check if user has already liked the product
        const isAlreadyLiked = await BusinessFeedLike.findOne({
            postId: productPost._id,
            likedBy: userId
        });

        // remove the like from the post
        if (isAlreadyLiked) {
            await BusinessFeedLike.findOneAndDelete({
                postId: productPost._id,
                likedBy: userId
            });

            const likeCounts = await BusinessFeedLike.countDocuments({
                postId: productPost._id,
                likedBy: userId
            });

            return res.status(200).json(
                {
                    success: true,
                    totalLikes: parseInt(likeCounts)
                }
            );
        } else {
            // create a new like entry for the post
            await BusinessFeedLike.create({
                postId: productPost._id,
                likedBy: userId
            });

            const likeCounts = await BusinessFeedLike.countDocuments({
                postId: productPost._id,
                likedBy: userId
            });

            // check if user is the owner of the post and don't send a notification
            if (String(userId) === String(productPost.owner)) {
                return res.status(200).json(
                    {
                        success: true,
                        totalLikes: parseInt(likeCounts)
                    }
                );
            } else {
                //send notification to the owner of the post
                await BusinessNotification.create({
                    owner: productPost.owner,
                    sender: userId,
                    message: `${req.user?.username} has liked your product.\n${productPost.itemName}\n${productPost.description}.`,
                    avatar: req.user?.avatar,
                    type: "postLiked",
                    data: {
                        postId: productPost._id,
                        for: "business",
                        commentId: null,
                        commentReplyId: null
                    },
                });

                const notifications = await BusinessNotification.aggregate([
                    {
                        $match: {
                            owner: new mongoose.Types.ObjectId(productPost.owner), // Assuming recipient field exists in Notification schema
                        },
                    },
                    ...unifiedNotificationCommonAggregation(),
                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },

                ]);

                const notification = notifications[0];

                //emitsocket added here
                emitSocketEvent(req, productPost.owner.toString(), "postLiked", notification);

                await emitUnreadCountUpdate(req, productPost.owner);

                return res.status(200).json(
                    {
                        success: true,
                        totalLikes: parseInt(likeCounts)
                    }
                );

            }
        }
    } catch (error) {
        console.log("Something went wrong", error);
        return res.status(500).json(new ApiResponse(500), { success: false }, "Something went wrong!");
    }
});

export const likeAndDislikeBusinessComment = asyncHandler(async (req, res) => {

    try {

        const { commentId } = req.params;
        const userId = req.user?._id;

        // check if comment exists
        const comment = await BusinessComment.findById(commentId);
        if (!comment) {
            return res.status(400).json({
                success: false,
                message: "Comment not found"
            });
        }

        //check if the post for this comment exist
        const productPost = await BusinessProduct.findById(comment.postId);
        if (!productPost) {
            return res.status(400).json({
                success: false,
                message: "Product post not found"
            });
        }

        // check if user has already liked the comment
        const isAlreadyLiked = await BusinessFeedLike.findOne({
            commentId: commentId,
            likedBy: userId
        });

        if (isAlreadyLiked) {
            await BusinessFeedLike.findOneAndDelete({
                commentId: commentId,
                likedBy: userId
            });

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        isLiked: false,
                    },
                    "Unliked successfully"
                )
            );
        } else {
            // like the comment 
            await BusinessFeedLike.create({
                commentId: commentId,
                likedBy: userId
            });

            // check if user is the owner of the comment and don't send a notification
            if (String(comment.author) === String(userId)) {
                return res.status(200).json(new ApiResponse(201, { isLiked: true }, "Liked successfully"));
            } else {

                //send notification to the owner of the comment
                await BusinessNotification.create({
                    owner: comment.author,
                    sender: userId,
                    message: `${req.user?.username} has liked your comment.`,
                    avatar: req.user?.avatar,
                    type: "postLiked",
                    data: {
                        postId: productPost._id,
                        for: "business",
                        commentId: comment._id,
                        commentReplyId: null

                    },
                });

                const notifications = await BusinessNotification.aggregate([
                    {
                        $match: {
                            owner: new mongoose.Types.ObjectId(comment.author), // Assuming recipient field exists in Notification schema
                        },
                    },
                    ...unifiedNotificationCommonAggregation(),
                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },

                ]);

                const notification = notifications[0];

                //emitsocket added here
                emitSocketEvent(req, comment.author.toString(), "postLiked", notification);

                await emitUnreadCountUpdate(req, comment.author);

                return res.status(201).json(new ApiResponse(200, { isLiked: true, }, "Liked successfully"));

            }
        }

    } catch (error) {
        console.log("Something went wrong", error);
        return res.status(500).json(new ApiResponse(500), { success: false }, "Something went wrong!");
    }

});

export const likeAndDislikeBusinessCommentReply = asyncHandler(async (req, res) => {
    try {

        const { commentReplyId } = req.params;
        const userId = req.user?._id;

        //check if reply exists
        const commentReply = await BusinessCommentReply.findById(commentReplyId);
        if (!commentReply) {
            return res.status(400).json({
                success: false,
                message: "Comment reply not found"
            });
        }

        // check if comment exists
        const comment = await BusinessComment.findById(commentReply.commentId);
        if (!comment) {
            return res.status(400).json({
                success: false,
                message: "Comment not found"
            });
        }

        //check if is already liked
        const isAlreadyLiked = await BusinessFeedLike.findOne({
            commentReplyId: commentReplyId,
            likedBy: userId
        });

        if (isAlreadyLiked) {
            await BusinessFeedLike.findOneAndDelete({
                commentReplyId: commentReplyId,
                likedBy: userId
            });

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        isLiked: false,
                    },
                    "Unliked successfully"
                )
            );
        } else {
            await BusinessFeedLike.create({
                commentReplyId: commentReplyId,
                likedBy: userId
            });

            if (String(commentReply.author) === String(userId)) {
                return res.status(200).json(new ApiResponse(201, { isLiked: true }, "Liked successfully"));
            } else {
                //send notification to the owner of the reply
                await BusinessNotification.create({
                    owner: commentReply.author,
                    sender: userId,
                    message: `${req.user?.username} has liked your comment reply.`,
                    avatar: req.user?.avatar,
                    type: "postLiked",
                    data: { 
                        postId: comment.postId, 
                        for: "business",
                        commentId: comment._id,
                        commentReplyId: commentReplyId
                    },
                });

                const notifications = await BusinessNotification.aggregate([
                    {
                        $match: {
                            owner: new mongoose.Types.ObjectId(commentReply.author), // Assuming recipient field exists in Notification schema
                        },
                    },
                    ...unifiedNotificationCommonAggregation(),
                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },

                ]);

                const notification = notifications[0];

                //emitsocket added here
                emitSocketEvent(req, commentReply.author.toString(), "postLiked", notification);

                await emitUnreadCountUpdate(req, commentReply.author);

                return res.status(201).json(new ApiResponse(200, { isLiked: true, }, "Liked successfully"));
            }
        }

    } catch (error) {
        console.log("Something went wrong!!", error);
        return res.status(500).json(new ApiResponse(500), { success: false }, "Something went wrong!");
    }
});