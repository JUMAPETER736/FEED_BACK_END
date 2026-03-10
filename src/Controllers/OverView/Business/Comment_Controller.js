import mongoose from "mongoose";
import { BusinessComment } from "../../../../models/apps/business/businesspost/business.comment.post.model.js";
import { ApiResponse } from "../../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../../utils/asyncHandler.js";
import { emitSocketEvent } from "../../../../socket/index.js";
import { emitUnreadCountUpdate } from "../../../../socket/socket.js";
import { BusinessNotification } from "../../../../models/apps/business/businesspost/notification/business.notification.model.js";
import { BusinessProduct } from "../../../../models/apps/business/business.product.model.js";
import { BusinessCommentReply } from "../../../../models/apps/business/businesspost/business.comment.reply.model.js";
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
  getMongoosePaginationOptions,
} from "../../../../utils/helpers.js";
import { unifiedNotificationCommonAggregation } from "../../../../aggregations/unifiedNotifications.js";


export const addBusinessComment = asyncHandler(async (req, res) => {

  try {
    const { businessPostId } = req.params;

    const {
      content,
      contentType,
      localUpdateId,
      duration,
      fileName,
      fileType,
      fileSize,
      numberOfPages,
      gif
    } = req.body;

    const userId = req.user?._id;

    // check if business post exists
    const businessPost = await BusinessProduct.findById(businessPostId);
    if (!businessPost) {
      return res.status(404).json({
        success: false,
        message: "Business Post not found",
        data: {}
      });
    }



    const businessPostOnwer = businessPost.owner;

    if (req.files) {

      try {

        // audio files for comment
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

        // image files for comment
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

        // video files for comment
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

        // thumbnails for the comment
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

        // docs files for the comments
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


        const comment = await BusinessComment.create({
          content,
          contentType,
          localUpdateId: localUpdateId,
          author: req.user?._id,
          postId: businessPost._id,
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



        if (String(businessPostOnwer) === String(userId)) {
          return res.status(201).json({
            success: true,
            message: "Comment added successfully",
            data: comment
          });
        }

        //comment notification
        await BusinessNotification.create({
          owner: businessPostOnwer,
          sender: userId,
          message: `${req.user.username} has commented on your business post.\n${businessPost.itemName}\n${businessPost.description}`,
          avatar: req.user.avatar,
          type: "onCommentPost",
          data: {
            postId: businessPost._id, 
            for: "business",
            commentId: comment._id,
            commentReplyId: null
          },
        });

        const notifications = await BusinessNotification.aggregate([
          {
            $match: {
              owner: new mongoose.Types.ObjectId(businessPostOnwer), // Assuming recipient field exists in Notification schema
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
        emitSocketEvent(req, businessPostOnwer.toString(), "onCommentPosted", notification);

        await emitUnreadCountUpdate(req, businessPostOnwer);

        return res.status(201).json({
          success: true,
          message: "Comment added successfully",
          data: comment
        });

      } catch (error) {
        console.log("Error", error);
      }
    } else {

      const comment = await BusinessComment.create({
        content,
        contentType,
        localUpdateId: localUpdateId,
        author: userId,
        postId: businessPost._id,
      });

      if (String(businessPostOnwer) === String(userId)) {
        return res.status(201).json({
          success: true,
          message: "Comment added successfully",
          data: comment
        });
      }


      //comment notification
      const notification = await BusinessNotification.create({
        owner: businessPostOnwer,
        sender: userId,
        message: `${req.user.username} has commented on your business post.\n${businessPost.itemName}\n${businessPost.description}`,
        avatar: req.user.avatar,
        type: "onCommentPost",
        data: {
          postId: businessPost._id, 
          for: "business",
          commentId: comment._id,
          commentReplyId: null
        },
      });

      //emitsocket added here
      emitSocketEvent(req, String(businessPostOnwer), "onCommentPosted", notification);

      await emitUnreadCountUpdate(req, req.user._id);

      return res.status(201).json({
        success: true,
        message: "Comment added successfully",
        data: comment
      });
    }
  } catch (error) {
    console.log("Something went wrong", error);
    return res.status(401).json({
      success: false,
      message: "Something went wrong",
      data: {}
    });
  }
});

export const getBusinessPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  try {

    const { page = 1, limit = 10 } = req.query;

    const commentAggregation = BusinessComment.aggregate([
      // matching the post and it comments
      {
        $match: {
          postId: new mongoose.Types.ObjectId(postId),
        }
      },

      //get all likes associted with each comment
      {
        $lookup: {
          from: "businessfeedlikes",
          localField: "_id",
          foreignField: "commentId",
          as: "likes"
        }
      },

      // check if user has already liked the comment
      {
        $lookup: {
          from: "businessfeedlikes",
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

      //get all replies associate with the comment
      {
        $lookup: {
          from: "businesscommentreplies",
          let: { commentId: "$_id" },  // Define variable from parent document
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$commentId", "$$commentId"]  // Match using the variable
                }
              }
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
                            username: 1,
                            email: 1
                          }
                        }
                      ],
                    },
                  },

                  {
                    $project: {
                      firstName: 1,
                      lastName: 1,
                      account: 1,
                    }
                  },

                  {
                    $addFields: {
                      account: { $first: "$account" }
                    }
                  }
                ]
              }
            },
            {
              $unwind: {
                path: "$author",
                preserveNullAndEmptyArrays: true
              }
            },


            {
              $lookup: {
                from: "businessfeedlikes",
                localField: "_id",
                foreignField: "commentReplyId",
                as: "likes"
              }
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
              $addFields: {
                likes: { $size: "$likes" },
                isLiked: {
                  $cond: {
                    if: {
                      $gte: [
                        {
                          $size: "$isLiked"
                        },
                        1,
                      ]
                    },
                    then: true,
                    else: false,
                  }
                },
              }
            },



            {
              $sort: { createdAt: -1 }
            }
          ],

          as: "replies"
        }
      },

      // get the account associated with the comment
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
                      username: 1,
                      email: 1,
                    }
                  }
                ]
              }
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                account: 1,
              }
            },
            {
              $addFields: {
                account: { $first: "$account" }
              }
            }
          ]
        }
      },

      // add the fields to the response
      {
        $addFields: {
          author: { $first: "$author" },
          likes: { $size: "$likes" },
          isLiked: {
            $cond: {
              if: {
                $gte: [
                  {
                    $size: "$isLiked"
                  },
                  1,
                ]
              },
              then: true,
              else: false,
            }
          },
          replyCount: { $size: "$replies" },
          createdAt: "$createdAt",
        },
      },

      {
        $sort: { createdAt: -1 }
      },
    ]);


    const comments = await BusinessComment.aggregatePaginate(
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

    return res.status(200).json(new ApiResponse(200, comments, "Post comments fetched successfully"));
  } catch (error) {
    console.log("Something went wrong", error);
    return res.status(401).json({
      success: false,
      message: "Something went wrong",
      data: {}
    });
  }
});

export const locateComment = asyncHandler(async(req, res) => {

  try {
    const { postId, commentId, limit = 10 } = req.query;

    if (!postId || !commentId) {
      return res.status(400).json({
        success: false,
        message: "postId and commentId are required"
      });
    }

    // First, check if the commentId is a top-level comment or a reply
    const isTopLevelComment = await BusinessComment.findOne({
      _id: new mongoose.Types.ObjectId(commentId),
      postId: new mongoose.Types.ObjectId(postId)
    });

    let pageNumber = 0;
    let positionInPage = 0;
    let parentCommentId = null;
    let parentPageNumber = null;
    let isReply = false;

    if (isTopLevelComment) {
      // It's a top-level comment - find which page it's on
      const commentsBeforeTarget = await BusinessComment.countDocuments({
        postId: new mongoose.Types.ObjectId(postId),
        createdAt: { $gt: isTopLevelComment.createdAt } // Comments are sorted by createdAt descending
      });

      pageNumber = Math.floor(commentsBeforeTarget / limit) + 1;
      positionInPage = commentsBeforeTarget % limit;

    } else {
      // It's a reply - find the parent comment
      const reply = await BusinessCommentReply.findOne({
        _id: new mongoose.Types.ObjectId(commentId)
      });

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Comment or reply not found"
        });
      }

      isReply = true;
      parentCommentId = reply.commentId;

      // Find which page the parent comment is on
      const parentComment = await BusinessComment.findOne({
        _id: parentCommentId
      });

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found"
        });
      }

      const commentsBeforeParent = await BusinessComment.countDocuments({
        postId: new mongoose.Types.ObjectId(postId),
        createdAt: { $gt: parentComment.createdAt }
      });

      parentPageNumber = Math.floor(commentsBeforeParent / limit) + 1;
      
      // Find position of reply within parent's replies
      const repliesBeforeTarget = await BusinessCommentReply.countDocuments({
        commentId: parentCommentId,
        createdAt: { $gt: reply.createdAt }
      });

      positionInPage = repliesBeforeTarget;
    }

    // Now fetch the actual page of comments
    const commentAggregation = BusinessComment.aggregate([
      // matching the post and its comments
      {
        $match: {
          postId: new mongoose.Types.ObjectId(postId),
        }
      },

      //get all likes associated with each comment
      {
        $lookup: {
          from: "businessfeedlikes",
          localField: "_id",
          foreignField: "commentId",
          as: "likes"
        }
      },

      // check if user has already liked the comment
      {
        $lookup: {
          from: "businessfeedlikes",
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

      //get all replies associated with the comment
      {
        $lookup: {
          from: "businesscommentreplies",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$commentId", "$$commentId"]
                }
              }
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
                            username: 1,
                            email: 1
                          }
                        }
                      ],
                    },
                  },

                  {
                    $project: {
                      firstName: 1,
                      lastName: 1,
                      account: 1,
                    }
                  },

                  {
                    $addFields: {
                      account: { $first: "$account" }
                    }
                  }
                ]
              }
            },
            {
              $unwind: {
                path: "$author",
                preserveNullAndEmptyArrays: true
              }
            },

            {
              $lookup: {
                from: "businessfeedlikes",
                localField: "_id",
                foreignField: "commentReplyId",
                as: "likes"
              }
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
              $addFields: {
                likes: { $size: "$likes" },
                isLiked: {
                  $cond: {
                    if: {
                      $gte: [
                        {
                          $size: "$isLiked"
                        },
                        1,
                      ]
                    },
                    then: true,
                    else: false,
                  }
                },
              }
            },

            {
              $sort: { createdAt: -1 }
            }
          ],

          as: "replies"
        }
      },

      // get the account associated with the comment
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
                      username: 1,
                      email: 1,
                    }
                  }
                ]
              }
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                account: 1,
              }
            },
            {
              $addFields: {
                account: { $first: "$account" }
              }
            }
          ]
        }
      },

      // add the fields to the response
      {
        $addFields: {
          author: { $first: "$author" },
          likes: { $size: "$likes" },
          isLiked: {
            $cond: {
              if: {
                $gte: [
                  {
                    $size: "$isLiked"
                  },
                  1,
                ]
              },
              then: true,
              else: false,
            }
          },
          replyCount: { $size: "$replies" },
          createdAt: "$createdAt",
        },
      },

      {
        $sort: { createdAt: -1 }
      },
    ]);

    const targetPage = isReply ? parentPageNumber : pageNumber;

    const comments = await BusinessComment.aggregatePaginate(
      commentAggregation,
      getMongoosePaginationOptions({
        page: targetPage,
        limit,
        customLabels: {
          totalDocs: "totalComments",
          docs: "comments",
        },
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        ...comments,
        location: {
          commentId,
          pageNumber: targetPage,
          positionInPage,
          isReply,
          parentCommentId,
          parentPageNumber: isReply ? parentPageNumber : null,
        }
      },
      message: "Comment located successfully"
    });

    
  } catch (error) {
    console.log("Something went wrong", error);
    return res.status(500).json({
      success: false,
      message: "Failed to locate comment",
      error: error.message
    });
  }
});

