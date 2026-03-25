


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
    // const { content } = req.body;
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
    console.log(`inside add comment reply`);
  
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
      });
      // console.log('Comment reply with audio file added successfully:', commentReply);
      console.log("comment has been replied successfully :", commentReply);
  
      const comment = await SocialCommentReply.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(commentId),
          },
        },
        ...postCommonAggregation(req),
      ]);
  
      // const originalCommentContent = originalComment.content;
      const receiverId = comment[0].author._id
      // const authorName = comment[0].author.account.username
      console.log(`post owner: ${receiverId}`)
      console.log(`post owner: ${authorName}`)
      if(!receiverId){
        console.error("Receiver ID is undefined");
        return res.status(400).json({ message: "Receiver ID is missing or undefined" });
      }
      if(!authorName){
        console.error("Author Name is undefined");
        return res.status(400).json({ message: "Author Name is missing or undefined" });
      }else{
        console.error("Comment or comment.author is undefined");
      }
      if (!comment){
        console.error("Comment not found");
        return res.status(404).json({ message: "Comment not found" });
      }
  
      // console.log(`post owner: ${authorName}`)
      if (receiverId.toString() !== req.user._id.toString()) {
        const user = await User.findById(receiverId);
        console.log(`Creating comment reply notification for user: ${user.username} with ID: ${receiverId}`);
              // Follow Notification
              await UnifiedNotification.create({
                owner: receiverId,
                sender: req.user._id,
                message:`${req.user.username} replied to your comment.`,
                avatar: req.user.avatar,
                type: 'comment',
                data: {
                  postId: commentedPost._id,
                  commentId: comment._id,
                  // commentReplyId : commentReply._id
                
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
        emitSocketEvent(req, `${user._id}`, 'commentReply', newNotification);
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


