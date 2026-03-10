import mongoose from "mongoose";
import { BusinessComment } from "../../../../models/apps/business/businesspost/business.comment.post.model.js";
import { BusinessCommentReply } from "../../../../models/apps/business/businesspost/business.comment.reply.model.js";
import { asyncHandler } from "../../../../utils/asyncHandler.js";
import { emitSocketEvent } from "../../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../../socket/socket.js";
import { BusinessNotification } from "../../../../models/apps/business/businesspost/notification/business.notification.model.js";
import { unifiedNotificationCommonAggregation } from "../../../../aggregations/unifiedNotifications.js";
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
    getMongoosePaginationOptions,
} from "../../../../utils/helpers.js";
import { ApiResponse } from "../../../../utils/ApiResponse.js";

export const addBusinessCommentReply = asyncHandler(async (req, res) => {

    try {
        const { commentId } = req.params;
        const userId = req.user?._id;
        var isReplyForMainComment = false;
        var mainComment = null;
        var commentAuthor = null;

        const isCommentToReplyToAvailable = await BusinessCommentReply.findById(commentId);

        if(isCommentToReplyToAvailable) {
           isReplyForMainComment = false;
           commentAuthor = isCommentToReplyToAvailable.author;
        } else {
            isReplyForMainComment = true;
        }

        if(isReplyForMainComment) {
            mainComment = await BusinessComment.findById(commentId);
            commentAuthor = mainComment.author;
        } else {
            mainComment = await BusinessComment.findById(isCommentToReplyToAvailable.commentId);
        }

        const comment = mainComment
        // check if comment exists
        if (!comment) {
            return res.status(400).json({
                success: false,
                message: "Comment not found"
            });
        }

        const {
            content,
            contentType,
            duration,
            fileName,
            fileType,
            fileSize,
            numberOfPages,
            gif,
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

            const commentReply = await BusinessCommentReply.create({
                content,
                contentType,
                author: userId,
                commentId: comment._id,
                duration: duration,
                audios: audios || [],
                images: images || [],
                videos: videos || [],
                thumbnail: thumbnails,
                docs: docs,
                gifs: gif,
                thumbnail: thumbnails,
                fileName: fileName,
                fileSize: fileSize,
                fileType: fileType,
                numberOfPages: numberOfPages,
            });

            if (String(userId) === String(commentAuthor)) {
                return res.status(200).json({
                    success: true,
                    message: "Comment reply added successfully",
                    data: commentReply
                });
            }

            //comment notification
            await BusinessNotification.create({
                owner: commentAuthor,
                sender: userId,
                message: `${req.user.username} has replied on your comment.`,
                avatar: req.user.avatar,
                type: "onCommentPost",
                data: {
                    postId: comment.postId, 
                    for: "business",
                    commentId: comment._id,
                    commentReplyId: commentReply._id
                },
            });

            const notifications = await BusinessNotification.aggregate([
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(commentAuthor), // Assuming recipient field exists in Notification schema
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
            emitSocketEvent(req, String(commentAuthor), "onCommentPosted", notification);

            await emitUnreadCountUpdate(req, String(commentAuthor));

            return res.status(200).json({
                success: true,
                message: "Comment reply added successfully",
                data: commentReply
            });
        }
    } catch (error) {
        console.log("Something went wrong", error);
        return;
    }
});

export const getBusinessCommentReply = asyncHandler(async (req, res) => {
    try {

        const { commentId } = req.params;
        const { page = 1, limit = 5 } = req.query;

        const commentAggregation = BusinessCommentReply.aggregate([
            {
                $match: {
                    commentId: new mongoose.Types.ObjectId(commentId)
                },
            },

            {
                $sort: { createdAt: -1 },
            },

            {
                $lookup: {
                    from: "businessfeedlikes",
                    localField: "_id",
                    foreignField: "commentReplyId",
                    as: "likes",
                },
            },

            {
                $lookup: {
                    from: "businessfeedlikes",
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


        const comments = await BusinessCommentReply.aggregatePaginate(
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

        console.log("Replies", comments);


        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    comments,
                    "feed Comment replies fetched successfully"
                )
            );

    } catch (error) {
        console.log("Something went wrong", error);
        return;
    }

});