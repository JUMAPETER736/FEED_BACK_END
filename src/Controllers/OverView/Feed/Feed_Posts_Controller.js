

import mongoose from "mongoose";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../constants.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { FeedBookmark } from "../../../models/apps/feed/feed_bookmark.models.js";
import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import { FeedFollowUnfollow } from "../../../models/apps/feed/feed_followUnfollow.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { SocialFollow } from "../../../models/apps/social-media/follow.models.js";
import { FeedFollow } from "../../../models/apps/feed/feed_follow.models.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getFeedRecommendations } from "../../../services/recommendation.system.service.js";




async function processPost(post) {
  // Handle reposted posts
  if (post.isReposted && post.originalPostId) {
    const originalPost = await FeedPost.findById(post.originalPostId);

    if (originalPost) {
      const author = await SocialProfile.findById(originalPost.author)
        .populate('owner');

      if (author) {
        post.author = {
          _id: author._id,
          coverImage: author.coverImage,
          firstName: author.firstName,
          lastName: author.lastName,
          bio: author.bio,
          dob: author.dob,
          location: author.location,
          countryCode: author.countryCode,
          phoneNumber: author.phoneNumber,
          owner: author.owner,
          createdAt: author.createdAt,
          updatedAt: author.updatedAt,
          __v: author.__v,
        };

        if (author.owner && author.owner.account) {
          post.author.account = author.owner.account;
        } else if (author.account) {
          post.author.account = author.account;
        }

        post.content = originalPost.content || post.content;
        post.tags = originalPost.tags || post.tags;
        post.fileIds = originalPost.fileIds || post.fileIds;
        post.files = originalPost.files || post.files;
        post.contentType = originalPost.contentType || post.contentType;

        if (!post.originalPost) {
          post.originalPost = [];
        }

        if (post.originalPost.length === 0) {
          post.originalPost.push({
            _id: originalPost._id,
            author: author,
            content: originalPost.content,
            contentType: originalPost.contentType,
            files: originalPost.files,
            fileIds: originalPost.fileIds,
            tags: originalPost.tags,
            createdAt: originalPost.createdAt,
          });
        }

        post.comments = originalPost.comments || post.comments;
        post.likes = originalPost.likes || post.likes;
        post.reposts = originalPost.reposts || post.reposts;
        post.repostedUsersCount = originalPost.repostedUsersCount || post.repostedUsersCount;
      }

      // Handle repostedByUserId
      if (post.repostedByUserId) {
        const repostedByUser = await User.findById(post.repostedByUserId);

        if (repostedByUser) {
          const repostedUserProfile = await SocialProfile.findOne({
            owner: repostedByUser._id
          });

          const safeUser = {
            _id: repostedUserProfile?._id || repostedByUser._id,
            username: repostedByUser.username,
            email: repostedByUser.email,
            createdAt: repostedByUser.createdAt,
            updatedAt: repostedByUser.updatedAt,
          };

          if (repostedByUser.avatar) {
            safeUser.avatar = {
              url: repostedByUser.avatar.url,
              localPath: repostedByUser.avatar.localPath,
              _id: repostedByUser.avatar._id,
            };
          }

          if (repostedUserProfile) {
            safeUser.coverImage = repostedUserProfile.coverImage;
            safeUser.firstName = repostedUserProfile.firstName;
            safeUser.lastName = repostedUserProfile.lastName;
            safeUser.bio = repostedUserProfile.bio;
            safeUser.owner = repostedByUser._id;
          }

          post.repostedUser = safeUser;
        }
      }
    }
  }

  // Set contentType if not set
  if (!post.contentType) {
    if (post.files && post.files.length > 0) {
      const fileTypes = post.files.map(f => f.fileType || "").filter(Boolean);
      const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
      const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
      const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

      if (hasVideo && hasImage) {
        post.contentType = "mixed_files";
      } else if (hasVideo) {
        post.contentType = "videos";
      } else if (hasAudio) {
        post.contentType = "vn";
      } else if (hasImage) {
        post.contentType = "mixed_files";
      } else {
        post.contentType = "text";
      }
    } else {
      post.contentType = "text";
    }
  }
}


function isNotNullOrEmpty(obj) {
  return obj !== null && obj !== undefined && Object.keys(obj).length > 0;
}

function processStringToArray(str) {
  // Check if the string is neither null nor empty
  if (str && str.trim() !== "") {
    // Remove square brackets
    const cleanedStr = str.replace(/[\[\]]/g, "");

    // Split the string by commas and trim each item
    const arr = cleanedStr.split(",").map(
      (item) => item.trim().replace(/^"|"$/g, "") // Remove leading and trailing double quotes
    );

    return arr;
  } else {
    // Return an empty array if the string is null, undefined, or empty
    return [];
  }
}



const createFeed = asyncHandler(async (req, res) => {
  console.log("creating feed");

  const {
    content,
    tags,
    contentType,
    duration,
    numberOfPages,
    fileNames,
    fileTypes,
    fileSizes,
    feedShortsBusinessId,
    // fileIds,
  } = req.body;

  const { fileIds } = req.body;

  const author = req.user._id;

  if (req.files) {
    /**
     * @type {{ url: string; localPath: string; }[]}
     */
    // console.log(req.files);
    let files = {};
    let durationData = {};
    let fileTypesData = {};
    let fileNamesData = {};
    let fileSizeData = {};
    let numberOfPagesData = {};
    let fileIdsData = [];
    console.log("step 1");
    if (!isNotNullOrEmpty(duration)) {
      console.log("duration is null or empty");
    } else {
      // console.log("You can map the duration object " + duration);
      try {
        console.log("duration insidetry type of duration " + typeof duration);
        if (typeof duration === "string") {
          const jsonData = JSON.parse(duration);
          durationData = {
            fileId: jsonData.fileId,
            duration: jsonData.duration,
          };
        } else {
          durationData = duration.map((durationObject) => {
            const jsonData = JSON.parse(durationObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, duration: jsonData.duration };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }

    if (!isNotNullOrEmpty(fileTypes)) {
      console.log("fileTypes is null or empty");
    } else {
      console.log("You can map the duration object " + fileTypes);
      try {
        console.log(
          "fileTypes insidetry type of fileTypes " + typeof fileTypes
        );
        if (typeof fileTypes === "string") {
          const jsonData = JSON.parse(fileTypes);
          fileTypesData = {
            fileId: jsonData.fileId,
            fileType: jsonData.fileType,
          };
        } else {
          fileTypesData = fileTypes.map((fileTypesObject) => {
            const jsonData = JSON.parse(fileTypesObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, fileType: jsonData.fileType };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }

    if (!isNotNullOrEmpty(numberOfPages)) {
      console.log("numberOfPages is null or empty");
    } else {
      console.log("You can map the numberOfPages object " + numberOfPages);
      try {
        console.log(
          "numberOfPages insidetry type of numberOfPages " +
          typeof numberOfPages
        );
        if (typeof numberOfPages === "string") {
          const jsonData = JSON.parse(numberOfPages);
          numberOfPagesData = {
            fileId: jsonData.fileId,
            numberOfPage: jsonData.numberOfPages,
          };
        } else {
          numberOfPagesData = numberOfPages.map((numberOfPagesObject) => {
            const jsonData = JSON.parse(numberOfPagesObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return {
              fileId: jsonData.fileId,
              numberOfPage: jsonData.numberOfPages,
            };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }

    if (!isNotNullOrEmpty(fileNames)) {
      console.log("fileNames is null or empty");
    } else {
      console.log("You can map the fileNames object " + fileNames);
      try {
        // console.log(
        //   "fileNames insidetry type of fileNames " + typeof fileNames
        // );
        if (typeof fileNames === "string") {
          const jsonData = JSON.parse(fileNames);
          fileNamesData = {
            fileId: jsonData.fileId,
            fileName: jsonData.fileName,
          };
        } else {
          fileNamesData = fileNames.map((fileNameObject) => {
            const jsonData = JSON.parse(fileNameObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, fileName: jsonData.fileName };
          });
        }

        // durationData = processDurationData(duration);
        // console.log(processDurationData(duration));
      } catch (error) {
        console.log(`errror ${error}`);
      }

      // console.log(durationData);
      // console.log("After mapping durationData type of:" + typeof durationData);
    }

    if (!isNotNullOrEmpty(fileSizes)) {
      console.log("fileSizes is null or empty");
    } else {
      console.log("You can map the fileSizes object " + fileSizes);
      try {
        if (typeof fileSizes === "string") {
          const jsonData = JSON.parse(fileSizes);
          fileSizeData = {
            fileId: jsonData.fileId,
            fileSize: jsonData.fileSize,
          };
        } else {
          fileSizeData = fileTypes.map((fileSizeObject) => {
            const jsonData = JSON.parse(fileSizeObject);
            // console.log(`durationObject ${jsonData.fileId}`);
            return { fileId: jsonData.fileId, fileSize: jsonData.fileSize };
          });
        }

      } catch (error) {
        console.log(`errror ${error}`);
      }
    }

    fileIdsData = processStringToArray(fileIds);


    let position = -1;
    if (contentType == "mixed_files") {
      console.log("content type mixed files ");
      console.log(req.files.files);
      console.log("after loggging req.file");
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file, index) => {
            // const fileId = file.originalname;

            const originalNameWithoutExt = path.parse(file.originalname).name;
            // const fileId = fileIdsData[index] || null;
            // console.log(`file index ${index} `);
            // console.log(
            //   `File type: ${fileTypesData[index].fileType} fileId: ${fileId}`
            // );
            position = index;
            const fileUrl = getStaticMixedFilesFeedPath(req, file.filename);
            console.log(`FILE URL ${fileUrl}`);
            const fileLocalPath = getMixedFilesFeedImageLocalPath(
              file.filename
            );
            return {
              fileId: originalNameWithoutExt,
              url: fileUrl,
              localPath: fileLocalPath,
            };
          })
          : [];
      // console.log("content type mixed files");
      // console.log(typeof files);
    } else if (contentType == "image") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedImagePath(req, file.filename);
            const fileLocalPath = getFeedImageLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
      // console.log(typeof files);
    } else if (contentType == "audio") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedAudioPath(req, file.filename);
            const fileLocalPath = getFeedAudioLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    } else if (contentType == "video") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedVideoPath(req, file.filename);
            const fileLocalPath = getFeedVideoLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    } else if (contentType == "docs") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedDocsPath(req, file.filename);
            const fileLocalPath = getFeedDocsLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    }

    else if (contentType == "vn") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedVnPath(req, file.filename);
            const fileLocalPath = getFeedVnLocalPath(file.filename);
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    }




    else if (contentType == "multiple_images") {
      files =
        req.files.files && req.files.files?.length
          ? req.files.files.map((file) => {
            const fileUrl = getStaticFeedMultipleImagePath(
              req,
              file.filename
            );
            const fileLocalPath = getFeedMultipleImageLocalPath(
              file.filename
            );
            return { url: fileUrl, localPath: fileLocalPath };
          })
          : [];
    }

    /**
     * @type {{ thumbnailUrl: string; thumbnailLocalPath: string; }[]}
     */
 
    const thumbnail =
      req.files.feed_thumbnail && req.files.feed_thumbnail?.length
        ? req.files.feed_thumbnail.map((image, index) => {
          // const fileId = fileIdsData[index] || null;
          const originalNameWithoutExt = path.parse(image.originalname).name;

          // console.log(
          //   `index ${index} position ${position} file ids ${fileIdsData}`
          // );
          // console.log("Getting some thumbnails fileId " + fileId);
          const imageUrl = getStaticFeedThumbnailPath(req, image.filename);
          const imageLocalPath = getFeedThumbnailLocalPath(image.filename);

          // console.log("Getting some thumbnails image url " + imageUrl);
          return {
            fileId: originalNameWithoutExt,
            thumbnailUrl: imageUrl,
            thumbnailLocalPath: imageLocalPath,
          };
        })
        : [];

    // console.log("Ready to create feed thumbnail" + thumbnail);
    // console.log(thumbnail);
    console.log("feedShortsBusinessId", feedShortsBusinessId);


    const post = await FeedPost.create({
      content: content,
      duration: durationData,
      tags: tags || [],
      author: author,
      files: files,
      thumbnail: thumbnail,
      contentType: contentType,
      numberOfPages: numberOfPagesData,
      fileNames: fileNamesData,
      fileTypes: fileTypesData,
      fileIds: fileIdsData,
      fileSizes: fileSizeData,
      feedShortsBusinessId: feedShortsBusinessId,
      // fileIds: fileIds,
    });
    if (!post) {
      throw new ApiError(500, "Error while creating feed");
    }

    const createdPost = await FeedPost.aggregate([
      {
        $match: {
          _id: post._id,
        },
      },
      ...feedCommonAggregation(req),
    ]);

    console.log("Feed created");
    return res
      .status(201)
      .json(new ApiResponse(201, createdPost[0], "Feed created successfully"));
  } else {
    const post = await FeedPost.create({
      content: content,
      tags: tags || [],
      author: author,
      contentType: contentType,
    });

    if (!post) {
      throw new ApiError(500, "Error while creating feed");
    }

    const createdPost = await FeedPost.aggregate([
      {
        $match: {
          _id: post._id,
        },
      },
      ...feedCommonAggregation(req),
    ]);

    return res
      .status(201)
      .json(new ApiResponse(201, createdPost[0], "Feed created successfully"));
  }
});

const getPostById = asyncHandler(async (req, res) => {
  try {

    const { postId } = req.params;
    const isPostAvailable = await FeedPost.findById(postId);

    if (!isPostAvailable) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Common feed aggregation
    const postAggregation = FeedPost.aggregate([
      { $match: { _id: isPostAvailable._id } },
      ...feedAggregation(req),
      { $limit: 1 },


      //  Check if current user bookmarked this post
      {
        $lookup: {
          from: "feedbookmarks",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    { $eq: ["$bookmarkedBy", new mongoose.Types.ObjectId(req.user?._id)] }
                  ]
                }
              }
            }
          ],
          as: "userBookmark"
        }
      },

      // Get all users who bookmarked this post
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",
          foreignField: "postId",
          as: "allBookmarks"
        }
      },

      //  ADD FIELDS: Set bookmark-related fields
      {
        $addFields: {
          isBookmarked: {
            $cond: {
              if: { $gt: [{ $size: "$userBookmark" }, 0] },
              then: true,
              else: false
            }
          },
          bookmarkCount: { $size: "$allBookmarks" },
          bookmarkedByUserIds: "$allBookmarks.bookmarkedBy"
        }
      },

      //  Remove temporary fields
      {
        $project: {
          userBookmark: 0,
          allBookmarks: 0
        }
      },

    ]);

    const posts = await postAggregation;
    if (posts.isReposted) {
      posts[0].originalPostId = posts[0].originalPost[0]._id;
    }



    if (posts[0].isReposted && posts[0].originalPostId) {
      // Fetch the original post using originalPostId
      const originalPost = await FeedPost.findById(posts[0].originalPostId).populate("author");
      posts[0].originalPost[0] = originalPost;

      console.log("Post: ", posts[0]);

      if (originalPost) {
        // Fetch the original post's author
        const author = await SocialProfile.findById(originalPost.author)
          .populate("owner");

        if (author) {
          // Set the author field at the root level
          posts[0].author = {
            _id: author._id,
            coverImage: author.coverImage,
            firstName: author.firstName,
            lastName: author.lastName,
            bio: author.bio,
            dob: author.dob,
            location: author.location,
            countryCode: author.countryCode,
            phoneNumber: author.phoneNumber,
            owner: author.owner,
            createdAt: author.createdAt,
            updatedAt: author.updatedAt,
            __v: author.__v,
          };

          // Add account info to author
          if (author.owner) {
            posts[0].author.account = {
              _id: author.owner._id,
              avatar: author.owner.avatar,
              username: author.owner.username,
              email: author.owner.email,
              createdAt: author.owner.createdAt,
              updatedAt: author.owner.updatedAt
            };
          }

          // Populate the reposted post with attributes from the original post
          posts[0].content = originalPost.content || posts[0].content;
          posts[0].tags = originalPost.tags || posts[0].tags;
          posts[0].fileIds = originalPost.fileIds || posts[0].fileIds;
          posts[0].files = originalPost.files || posts.files;
          posts[0].contentType = originalPost.contentType || posts[0].contentType;

          // Ensure contentType is set
          if (!posts[0].contentType) {
            posts[0].contentType = "text";
          }

          // Ensure originalPost array exists
          if (!posts[0].originalPost) {
            posts[0].originalPost = [];
          }

          // Add original post data if not already there
          if (posts[0].originalPost.length === 0) {
            posts[0].originalPost.push({
              _id: originalPost._id,
              author: post.author,
              content: originalPost.content,
              contentType: originalPost.contentType,
              files: originalPost.files,
              fileIds: originalPost.fileIds,
              tags: originalPost.tags,
              createdAt: originalPost.createdAt,
            });
          }

          posts[0].comments = originalPost.comments || posts[0].comments;
          posts[0].likes = originalPost.likes || posts[0].likes;
          posts[0].reposts = originalPost.reposts || posts[0].reposts;
          posts[0].repostedUsersCount =
            originalPost.repostedUsersCount || posts[0].repostedUsersCount;
        }

        // Fetch the user who reposted
        if (posts[0].repostedByUserId) {
          const repostedByUser = await User.findById(posts[0].repostedByUserId);

          if (repostedByUser) {
            // Fetch the social profile for the user who reposted
            const repostedUserProfile = await SocialProfile.findOne({
              owner: repostedByUser._id
            });

            // Create a safe user object
            const safeUser = {
              _id: repostedUserProfile?._id || repostedByUser._id,
              username: repostedByUser.username,
              email: repostedByUser.email,
              createdAt: repostedByUser.createdAt,
              updatedAt: repostedByUser.updatedAt,
            };

            // Add avatar if exists
            if (repostedByUser.avatar) {
              safeUser.avatar = {
                url: repostedByUser.avatar.url,
                localPath: repostedByUser.avatar.localPath,
                _id: repostedByUser.avatar._id,
              };
            }

            // Add profile info if exists
            if (repostedUserProfile) {
              safeUser.coverImage = repostedUserProfile.coverImage;
              safeUser.firstName = repostedUserProfile.firstName;
              safeUser.lastName = repostedUserProfile.lastName;
              safeUser.bio = repostedUserProfile.bio;
              safeUser.owner = repostedByUser._id;
            }

            posts[0].repostedUser = safeUser;
          }
        }
      }
    }

    // Set contentType for non-reposted posts if not set
    if (!posts[0].contentType) {
      if (posts[0].files && posts[0].files.length > 0) {
        const fileTypes = posts[0].files.map(f => f.fileType || "").filter(Boolean);
        const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
        const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
        const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

        if (hasVideo && hasImage) {
          posts[0].contentType = "mixed_files";
        } else if (hasVideo) {
          posts[0].contentType = "videos";
        } else if (hasAudio) {
          posts[0].contentType = "vn";
        } else if (hasImage) {
          posts[0].contentType = "mixed_files";
        } else {
          posts[0].contentType = "text";
        }
      } else {
        posts[0].contentType = "text";
      }
    }


    // Prepare response data
    const responseData = {
      data: {
        posts: posts
      }
    };

    // Send the response with fetched post
    return res
      .status(200)
      .json(new ApiResponse(200, responseData, "Post fetched successfully"));

  } catch (error) {
    console.log("Something went wrong", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Error fetching posts"));
  }

});


const getAllFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const postAggregation = FeedPost.aggregate([
    ...feedCommonAggregation(req),
    { $sort: { createdAt: -1 } },

    {
      $lookup: {
        from: "feedbookmarks",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postId", "$$postId"] },
                  { $eq: ["$bookmarkedBy", new mongoose.Types.ObjectId(req.user?._id)] }
                ]
              }
            }
          }
        ],
        as: "userBookmark"
      }
    },
    {
      $lookup: {
        from: "feedbookmarks",
        localField: "_id",
        foreignField: "postId",
        as: "allBookmarks"
      }
    },
    {
      $addFields: {
        isBookmarked: {
          $cond: {
            if: { $gt: [{ $size: "$userBookmark" }, 0] },
            then: true,
            else: false
          }
        },
        bookmarkCount: { $size: "$allBookmarks" },
        bookmarkedByUserIds: "$allBookmarks.bookmarkedBy"
      }
    },
    {
      $project: {
        userBookmark: 0,
        allBookmarks: 0
      }
    }
  ]);

  try {
    const posts = await FeedPost.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page,
        limit,
        customLabels: {
          totalDocs: "totalPosts",
          docs: "posts",
        },
      })
    );

    // ✅ FIX: This loop now actually runs because originalPostId
    //         is preserved in the aggregation output above
    for (let post of posts.posts) {
      if (post.isReposted && post.originalPostId) {

        // Only fix posts where originalPost is still empty
        // (the aggregation may have already populated it correctly)
        if (!post.originalPost || post.originalPost.length === 0) {

          const originalPost = await FeedPost.findById(post.originalPostId);

          if (originalPost) {
            // ✅ FIX: Use findOne({ owner: ... }) not findById
            // because author field is a User ObjectId, not profile ObjectId
            const authorProfile = await SocialProfile.findOne({
              owner: originalPost.author
            }).populate({
              path: 'owner',
              select: 'avatar username email createdAt updatedAt _id'
            });

            if (authorProfile) {
              const builtAuthor = {
                _id: authorProfile._id,
                coverImage: authorProfile.coverImage,
                firstName: authorProfile.firstName,
                lastName: authorProfile.lastName,
                bio: authorProfile.bio,
                dob: authorProfile.dob,
                location: authorProfile.location,
                countryCode: authorProfile.countryCode,
                phoneNumber: authorProfile.phoneNumber,
                owner: authorProfile.owner?._id || authorProfile.owner,
                createdAt: authorProfile.createdAt,
                updatedAt: authorProfile.updatedAt,
                __v: authorProfile.__v,
              };

              if (authorProfile.owner) {
                builtAuthor.account = {
                  _id: authorProfile.owner._id,
                  avatar: authorProfile.owner.avatar,
                  username: authorProfile.owner.username,
                  email: authorProfile.owner.email,
                  createdAt: authorProfile.owner.createdAt,
                  updatedAt: authorProfile.owner.updatedAt
                };
              }

              post.originalPost = [{
                _id: originalPost._id,
                author: builtAuthor,
                content: originalPost.content || "",
                contentType: originalPost.contentType || "text",
                files: originalPost.files || [],
                fileIds: originalPost.fileIds || [],
                fileTypes: originalPost.fileTypes || [],
                fileNames: originalPost.fileNames || [],
                fileSizes: originalPost.fileSizes || [],
                duration: originalPost.duration || [],
                thumbnail: originalPost.thumbnail || [],
                numberOfPages: originalPost.numberOfPages || [],
                tags: originalPost.tags || [],
                feedShortsBusinessId: originalPost.feedShortsBusinessId || null,
                createdAt: originalPost.createdAt,
                updatedAt: originalPost.updatedAt,
                originalPostId: null,
                isReposted: false,
                repostedByUserId: null,
                repostedUsers: [],
                originalPostReposter: [],
                bookmarks: [],
                commentCount: 0,
                likeCount: 0,
                bookmarkCount: 0,
                repostCount: 0,
                shareCount: 0,
              }];
            }
          }
        }

        // Fix the repostedUser if missing
        if (!post.repostedUser && post.repostedByUserId) {
          const repostedByUser = await User.findById(post.repostedByUserId);

          if (repostedByUser) {
            const repostedUserProfile = await SocialProfile.findOne({
              owner: repostedByUser._id
            });

            const safeUser = {
              _id: repostedUserProfile?._id || repostedByUser._id,
              username: repostedByUser.username,
              email: repostedByUser.email,
              createdAt: repostedByUser.createdAt,
              updatedAt: repostedByUser.updatedAt,
            };

            if (repostedByUser.avatar) {
              safeUser.avatar = {
                url: repostedByUser.avatar.url,
                localPath: repostedByUser.avatar.localPath,
                _id: repostedByUser.avatar._id,
              };
            }

            if (repostedUserProfile) {
              safeUser.coverImage = repostedUserProfile.coverImage;
              safeUser.firstName = repostedUserProfile.firstName;
              safeUser.lastName = repostedUserProfile.lastName;
              safeUser.bio = repostedUserProfile.bio;
              safeUser.owner = repostedByUser._id;
            }

            post.repostedUser = safeUser;
          }
        }
      }

      // Fix missing contentType
      if (!post.contentType) {
        if (post.files && post.files.length > 0) {
          const fileTypes = post.fileTypes?.map(f => f.fileType || "").filter(Boolean) || [];
          const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
          const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
          const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

          if (hasVideo && hasImage) {
            post.contentType = "mixed_files";
          } else if (hasVideo) {
            post.contentType = "video";
          } else if (hasAudio) {
            post.contentType = "vn";
          } else if (hasImage) {
            post.contentType = "mixed_files";
          } else {
            post.contentType = "text";
          }
        } else {
          post.contentType = "text";
        }
      }

      // ✅ Remove originalPostId from final response
      // (it was only needed for the post-processing loop above)
      delete post.originalPostId;
    }

    return res
      .status(200)
      .json(new ApiResponse(200, { data: posts }, "Get All Feed fetched successfully"));
  } catch (e) {
    console.log("Error fetching posts: ", e);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Error fetching posts"));
  }
});

const getLikedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  console.log("Starting getLikedPosts for user:", req.user?._id);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    // ✅ Start from FeedPost, NOT FeedLike
    const postAggregation = FeedPost.aggregate([
      // First, lookup likes to filter only posts liked by current user
      {
        $lookup: {
          from: "feedlikes",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$postId"] },
                    { $eq: ["$likedBy", userId] }
                  ]
                }
              }
            }
          ],
          as: "userLike"
        }
      },

      // ✅ Filter to only include posts that the user has liked
      {
        $match: {
          userLike: { $ne: [] }
        }
      },

      // ✅ Add like metadata
      {
        $addFields: {
          likeId: { $arrayElemAt: ["$userLike._id", 0] },
          likedAt: { $arrayElemAt: ["$userLike.createdAt", 0] }
        }
      },

      // ✅ Sort by when they liked it (most recent first)
      {
        $sort: { likedAt: -1 }
      },

      // ✅ Remove the temporary userLike array
      {
        $project: {
          userLike: 0
        }
      },

      // Apply feedCommonAggregation (it expects post at root level)
      ...feedCommonAggregation(req),

      // ============================================
      // LIKES AGGREGATION - SEPARATE FOR EACH POST
      // ============================================
      {
        $lookup: {
          from: "feedlikes",
          localField: "_id",  // ← Match exact post ID (wrapper or original)
          foreignField: "postId",
          as: "postLikes"
        }
      },
      {
        $addFields: {
          likedByUserIds: {
            $map: {
              input: "$postLikes",
              as: "like",
              in: "$$like.likedBy"
            }
          },
          likes: { $size: "$postLikes" },
          isLiked: true // Always true since we're fetching liked posts
        }
      },
      {
        $project: {
          postLikes: 0
        }
      },

      // ============================================
      // BOOKMARKS AGGREGATION - SEPARATE FOR EACH POST
      // ============================================
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",  // ← Match exact post ID (wrapper or original)
          foreignField: "postId",
          as: "bookmarks"
        }
      },
      {
        $addFields: {
          bookmarkedByUserIds: "$bookmarks.bookmarkedBy",
          bookmarkCount: { $size: "$bookmarks" },
          isBookmarked: {
            $in: [userId, "$bookmarks.bookmarkedBy"]
          }
        }
      },
      {
        $project: {
          bookmarks: 0
        }
      }
    ]);

    console.log("Executing aggregation with pagination");

    // ✅ IMPORTANT: Use FeedPost.aggregatePaginate, NOT FeedLike
    const posts = await FeedPost.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
          totalDocs: "totalLikedPosts",
          docs: "likedPosts",
        },
      })
    );

    // Post-processing for reposted posts (same as getAllFeed)
    for (let post of posts.likedPosts) {
      if (post.isReposted && post.originalPostId) {
        const originalPost = await FeedPost.findById(post.originalPostId);

        if (originalPost) {
          const author = await SocialProfile.findById(originalPost.author)
            .populate('owner');

          if (author) {
            post.author = {
              _id: author._id,
              coverImage: author.coverImage,
              firstName: author.firstName,
              lastName: author.lastName,
              bio: author.bio,
              dob: author.dob,
              location: author.location,
              countryCode: author.countryCode,
              phoneNumber: author.phoneNumber,
              owner: author.owner,
              createdAt: author.createdAt,
              updatedAt: author.updatedAt,
              __v: author.__v,
            };

            if (author.owner) {
              post.author.account = {
                _id: author.owner._id,
                avatar: author.owner.avatar,
                username: author.owner.username,
                email: author.owner.email,
                createdAt: author.owner.createdAt,
                updatedAt: author.owner.updatedAt
              };
            }

            post.content = originalPost.content || post.content;
            post.tags = originalPost.tags || post.tags;
            post.fileIds = originalPost.fileIds || post.fileIds;
            post.files = originalPost.files || post.files;
            post.contentType = originalPost.contentType || post.contentType;

            if (!post.contentType) {
              post.contentType = "text";
            }

            if (!post.originalPost) {
              post.originalPost = [];
            }

            if (post.originalPost.length === 0) {
              post.originalPost.push({
                _id: originalPost._id,
                author: post.author,
                content: originalPost.content,
                contentType: originalPost.contentType,
                files: originalPost.files,
                fileIds: originalPost.fileIds,
                tags: originalPost.tags,
                createdAt: originalPost.createdAt,
              });
            }

            post.comments = originalPost.comments || post.comments;
            post.likes = originalPost.likes || post.likes;
            post.reposts = originalPost.reposts || post.reposts;
            post.repostedUsersCount = originalPost.repostedUsersCount || post.repostedUsersCount;
          }

          if (post.repostedByUserId) {
            const repostedByUser = await User.findById(post.repostedByUserId);

            if (repostedByUser) {
              const repostedUserProfile = await SocialProfile.findOne({
                owner: repostedByUser._id
              });

              const safeUser = {
                _id: repostedUserProfile?._id || repostedByUser._id,
                username: repostedByUser.username,
                email: repostedByUser.email,
                createdAt: repostedByUser.createdAt,
                updatedAt: repostedByUser.updatedAt,
              };

              if (repostedByUser.avatar) {
                safeUser.avatar = {
                  url: repostedByUser.avatar.url,
                  localPath: repostedByUser.avatar.localPath,
                  _id: repostedByUser.avatar._id,
                };
              }

              if (repostedUserProfile) {
                safeUser.coverImage = repostedUserProfile.coverImage;
                safeUser.firstName = repostedUserProfile.firstName;
                safeUser.lastName = repostedUserProfile.lastName;
                safeUser.bio = repostedUserProfile.bio;
                safeUser.owner = repostedByUser._id;
              }

              post.repostedUser = safeUser;
            }
          }
        }
      }

      // Set contentType if not set
      if (!post.contentType) {
        if (post.files && post.files.length > 0) {
          const fileTypes = post.files.map(f => f.fileType || "").filter(Boolean);
          const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
          const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
          const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

          if (hasVideo && hasImage) {
            post.contentType = "mixed_files";
          } else if (hasVideo) {
            post.contentType = "videos";
          } else if (hasAudio) {
            post.contentType = "vn";
          } else if (hasImage) {
            post.contentType = "mixed_files";
          } else {
            post.contentType = "text";
          }
        } else {
          post.contentType = "text";
        }
      }
    }

    console.log("All Liked Posts fetched successfully:", posts.totalLikedPosts);

    // Return posts directly (matching getFeed pattern)
    return res
      .status(200)
      .json(
        new ApiResponse(200, posts, "All Liked Posts fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching liked posts:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Error: ${error.message}`));
  }
});


const getBookMarkedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  console.log("Starting getBookMarkedPosts for user:", req.user?._id);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    const postAggregation = FeedBookmark.aggregate([
      {
        $match: {
          bookmarkedBy: userId,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: "feedposts",
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      {
        $unwind: {
          path: "$post",
          preserveNullAndEmptyArrays: false,
        },
      },

      // Store bookmark metadata before replacing root
      {
        $addFields: {
          "post.bookmarkId": "$_id",
          "post.bookmarkedBy": "$bookmarkedBy",
          "post.bookmarkedAt": "$createdAt"
        }
      },

      // Replace root with post so feedCommonAggregation works
      {
        $replaceRoot: {
          newRoot: "$post"
        }
      },

      //  Now apply feedCommonAggregation (it expects post at root level)
      ...feedCommonAggregation(req),

      //  Get all user IDs who bookmarked this post
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",
          foreignField: "postId",
          as: "bookmarkedByUserIds"
        }
      },

      // Override isBookmarked and add user IDs
      {
        $addFields: {
          isBookmarked: true,
          bookmarkedByUserIds: "$bookmarkedByUserIds.bookmarkedBy",
          bookmarkCount: { $size: "$bookmarkedByUserIds" }
        }
      }
    ]);

    console.log("Executing aggregation with pagination");

    const posts = await FeedBookmark.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
          totalDocs: "totalBookmarkedPosts",
          docs: "bookmarkedPosts",
        },
      })
    );

    // Post-processing for reposted posts (same as getAllFeed)
    for (let post of posts.bookmarkedPosts) {
      if (post.isReposted && post.originalPostId) {
        const originalPost = await FeedPost.findById(post.originalPostId);

        if (originalPost) {
          const author = await SocialProfile.findById(originalPost.author)
            .populate('owner');

          if (author) {
            post.author = {
              _id: author._id,
              coverImage: author.coverImage,
              firstName: author.firstName,
              lastName: author.lastName,
              bio: author.bio,
              dob: author.dob,
              location: author.location,
              countryCode: author.countryCode,
              phoneNumber: author.phoneNumber,
              owner: author.owner,
              createdAt: author.createdAt,
              updatedAt: author.updatedAt,
              __v: author.__v,
            };

            if (author.owner) {
              post.author.account = {
                _id: author.owner._id,
                avatar: author.owner.avatar,
                username: author.owner.username,
                email: author.owner.email,
                createdAt: author.owner.createdAt,
                updatedAt: author.owner.updatedAt
              };
            }

            post.content = originalPost.content || post.content;
            post.tags = originalPost.tags || post.tags;
            post.fileIds = originalPost.fileIds || post.fileIds;
            post.files = originalPost.files || post.files;
            post.contentType = originalPost.contentType || post.contentType;

            if (!post.contentType) {
              post.contentType = "text";
            }

            if (!post.originalPost) {
              post.originalPost = [];
            }

            if (post.originalPost.length === 0) {
              post.originalPost.push({
                _id: originalPost._id,
                author: post.author,
                content: originalPost.content,
                contentType: originalPost.contentType,
                files: originalPost.files,
                fileIds: originalPost.fileIds,
                tags: originalPost.tags,
                createdAt: originalPost.createdAt,
              });
            }

            post.comments = originalPost.comments || post.comments;
            post.likes = originalPost.likes || post.likes;
            post.reposts = originalPost.reposts || post.reposts;
            post.repostedUsersCount = originalPost.repostedUsersCount || post.repostedUsersCount;
          }

          if (post.repostedByUserId) {
            const repostedByUser = await User.findById(post.repostedByUserId);

            if (repostedByUser) {
              const repostedUserProfile = await SocialProfile.findOne({
                owner: repostedByUser._id
              });

              const safeUser = {
                _id: repostedUserProfile?._id || repostedByUser._id,
                username: repostedByUser.username,
                email: repostedByUser.email,
                createdAt: repostedByUser.createdAt,
                updatedAt: repostedByUser.updatedAt,
              };

              if (repostedByUser.avatar) {
                safeUser.avatar = {
                  url: repostedByUser.avatar.url,
                  localPath: repostedByUser.avatar.localPath,
                  _id: repostedByUser.avatar._id,
                };
              }

              if (repostedUserProfile) {
                safeUser.coverImage = repostedUserProfile.coverImage;
                safeUser.firstName = repostedUserProfile.firstName;
                safeUser.lastName = repostedUserProfile.lastName;
                safeUser.bio = repostedUserProfile.bio;
                safeUser.owner = repostedByUser._id;
              }

              post.repostedUser = safeUser;
            }
          }
        }
      }

      // Set contentType if not set
      if (!post.contentType) {
        if (post.files && post.files.length > 0) {
          const fileTypes = post.files.map(f => f.fileType || "").filter(Boolean);
          const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
          const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
          const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

          if (hasVideo && hasImage) {
            post.contentType = "mixed_files";
          } else if (hasVideo) {
            post.contentType = "videos";
          } else if (hasAudio) {
            post.contentType = "vn";
          } else if (hasImage) {
            post.contentType = "mixed_files";
          } else {
            post.contentType = "text";
          }
        } else {
          post.contentType = "text";
        }
      }
    }

    console.log("All Bookmarked Feed Posts fetched successfully:", posts.totalBookmarkedPosts);

    //  Match getFeed pattern - return posts directly
    return res
      .status(200)
      .json(
        new ApiResponse(200, posts, "All Bookmarked Feed Posts fetched successfully")
        //                     ↑↑↑↑↑ Return posts directly, not { data: posts }
      );
  } catch (error) {
    console.error("Error All fetching bookmarked posts:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Error: ${error.message}`));
  }
});

const clickedBookmark = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { isBookmarked } = req.body;

  console.log(`clicked bookmark - Post: ${postId}, User: ${req.user?._id}, Action: ${isBookmarked ? 'BOOKMARK' : 'UNBOOKMARK'}`);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    const postObjectId = new mongoose.Types.ObjectId(postId);

    // Verify post exists
    const post = await FeedPost.findById(postObjectId);
    if (!post) {
      console.log(`Post not found: ${postId}`);
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Post not found"));
    }

    // Check if bookmark exists
    const existingBookmark = await FeedBookmark.findOne({
      postId: postObjectId,
      bookmarkedBy: userId
    });

    console.log(`Existing bookmark: ${existingBookmark ? 'YES' : 'NO'}`);

    let message;
    let bookmarked;

    if (isBookmarked && !existingBookmark) {
      // Create bookmark
      const newBookmark = await FeedBookmark.create({
        postId: postObjectId,
        bookmarkedBy: userId
      });
      message = "Post bookmarked successfully";
      bookmarked = true;
      console.log(`Bookmark created: ${newBookmark._id}`);
    } else if (!isBookmarked && existingBookmark) {
      // Remove bookmark
      await FeedBookmark.findByIdAndDelete(existingBookmark._id);
      message = "Bookmark removed successfully";
      bookmarked = false;
      console.log(`Bookmark deleted: ${existingBookmark._id}`);
    } else {
      // State already matches - no change needed
      message = existingBookmark ? "Post already bookmarked" : "Bookmark already removed";
      bookmarked = !!existingBookmark;
      console.log(`No change needed - already ${bookmarked ? 'bookmarked' : 'not bookmarked'}`);
    }

    // Get updated bookmark count
    const bookmarkCount = await FeedBookmark.countDocuments({
      postId: postObjectId
    });

    console.log(`Total bookmarks for post ${postId}: ${bookmarkCount}`);

    return res.status(200).json(
      new ApiResponse(200, {
        isBookmarked: bookmarked,
        bookmarkCount: bookmarkCount,
        postId: postId
      }, message)
    );

  } catch (error) {
    console.error(" Error toggling bookmark:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Error: ${error.message}`));
  }
});

const getRepostedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  console.log("Starting getRepostedPosts for user:", req.user?._id);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    const postAggregation = FeedPost.aggregate([

      // STEP 1: Only repost wrappers created by this user
      {
        $match: {
          repostedByUserId: userId,
          originalPostId: { $exists: true, $ne: null },
        },
      },

      // STEP 2: Newest repost first
      { $sort: { createdAt: -1 } },

      // STEP 3: REPOST WRAPPER'S OWN STATS
      {
        $lookup: {
          from: "feedlikes",
          localField: "_id",
          foreignField: "postId",
          as: "repostLikes",
        },
      },
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",
          foreignField: "postId",
          as: "repostBookmarks",
        },
      },
      {
        $lookup: {
          from: "feedposts",
          let: { wrapperId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$originalPostId", "$$wrapperId"] },
                    { $ne: ["$repostedByUserId", null] }
                  ]
                }
              }
            }
          ],
          as: "repostReposts",
        },
      },
      {
        $lookup: {
          from: "feedshares",
          localField: "_id",
          foreignField: "postId",
          as: "repostShares",
        },
      },
      {
        $lookup: {
          from: "feedcomments",
          localField: "_id",
          foreignField: "postId",
          as: "repostComments",
        },
      },

      // STEP 4: LOOKUP ORIGINAL POST DATA
      {
        $addFields: {
          _originalPostIdObj: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$originalPostId", null] },
                  { $ne: ["$originalPostId", ""] },
                ],
              },
              then: { $toObjectId: "$originalPostId" },
              else: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: "feedposts",
          localField: "_originalPostIdObj",
          foreignField: "_id",
          as: "_originalPostData",
        },
      },
      { $unwind: { path: "$_originalPostData", preserveNullAndEmptyArrays: true } },

      // STEP 5: ORIGINAL POST AUTHOR
      // ✅ FIXED: foreignField changed from "_id" to "owner"
      {
        $lookup: {
          from: "socialprofiles",
          localField: "_originalPostData.author",  // User ObjectId
          foreignField: "owner",                    // ✅ was "_id"
          as: "_origAuthorProfile",
        },
      },
      { $unwind: { path: "$_origAuthorProfile", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "_origAuthorProfile.owner",
          foreignField: "_id",
          as: "_origAuthorAccount",
        },
      },
      { $unwind: { path: "$_origAuthorAccount", preserveNullAndEmptyArrays: true } },

      // STEP 6: REPOSTER USER INFO
      // ✅ FIXED: localField changed from "repostedByUser._id" to "repostedByUserId"
      {
        $lookup: {
          from: "users",
          localField: "repostedByUserId",
          foreignField: "_id",
          as: "_reposterAccount",
        },
      },
      { $unwind: { path: "$_reposterAccount", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "socialprofiles",
          localField: "repostedByUserId",          // ✅ was "repostedByUser._id"
          foreignField: "owner",
          as: "_reposterProfile",
        },
      },
      { $unwind: { path: "$_reposterProfile", preserveNullAndEmptyArrays: true } },

      // STEP 7: ORIGINAL POST LIVE STATS
      {
        $lookup: {
          from: "feedlikes",
          localField: "_originalPostData._id",
          foreignField: "postId",
          as: "_origLikes",
        },
      },
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_originalPostData._id",
          foreignField: "postId",
          as: "_origBookmarks",
        },
      },

      // ✅ FIXED: Only count real repost wrappers for _origReposts
      {
        $lookup: {
          from: "feedposts",
          let: { origId: "$_originalPostData._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$originalPostId", "$$origId"] },
                    { $ne: ["$repostedByUserId", null] }  // ✅ only real repost wrappers
                  ]
                }
              }
            }
          ],
          as: "_origReposts",
        },
      },
      {
        $lookup: {
          from: "feedshares",
          localField: "_originalPostData._id",
          foreignField: "postId",
          as: "_origShares",
        },
      },
      {
        $lookup: {
          from: "feedcomments",
          localField: "_originalPostData._id",
          foreignField: "postId",
          as: "_origComments",
        },
      },

      // STEP 8: ORIGINAL POST REPOSTER PROFILES
      {
        $lookup: {
          from: "users",
          let: { reposterIds: "$_origReposts.repostedByUserId" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$reposterIds"] } } },
            {
              $lookup: {
                from: "socialprofiles",
                localField: "_id",
                foreignField: "owner",
                as: "profile",
              },
            },
            { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                avatar: 1,
                username: 1,
                email: 1,
                createdAt: 1,
                updatedAt: 1,
                coverImage: "$profile.coverImage",
                firstName: "$profile.firstName",
                lastName: "$profile.lastName",
                bio: "$profile.bio",
                owner: "$_id",
              },
            },
          ],
          as: "_origReposters",
        },
      },

      // STEP 9: PROJECT FINAL RESPONSE STRUCTURE
      {
        $project: {
          // Wrapper identity
          _id: 1,
          __v: 1,
          content: 1,
          createdAt: 1,
          updatedAt: 1,

          // Repost wrappers carry no media of their own
          feedShortsBusinessId: { $literal: null },
          tags: { $literal: [] },
          contentType: { $literal: "" },
          numberOfPages: { $literal: [] },
          files: { $literal: [] },
          fileIds: { $literal: [] },
          thumbnail: { $literal: [] },
          duration: { $literal: [] },
          fileNames: { $literal: [] },
          fileTypes: { $literal: [] },
          fileSizes: { $literal: [] },

          // Repost flags
          isReposted: { $literal: true },
          isRepostWrapper: { $literal: true },
          repostedByUserId: 1,
          repostedUsers: ["$repostedByUserId"],

          // Misc flags
          isBusinessPost: { $literal: false },
          isFollowing: { $literal: false },
          isExpanded: { $literal: false },
          isLocal: { $literal: false },

          // Wrapper's own engagement stats
          comments: { $size: "$repostComments" },

          likes: { $size: "$repostLikes" },
          isLiked: { $in: [userId, "$repostLikes.likedBy"] },
          likedByUserIds: {
            $map: { input: "$repostLikes", as: "l", in: "$$l.likedBy" },
          },

          bookmarkCount: { $size: "$repostBookmarks" },
          isBookmarked: { $in: [userId, "$repostBookmarks.bookmarkedBy"] },
          bookmarkedByUserIds: "$repostBookmarks.bookmarkedBy",

          repostCount: { $size: "$repostReposts" },
          isRepostedByMe: {
            $in: [
              userId,
              { $map: { input: "$repostReposts", as: "r", in: "$$r.repostedByUserId" } },
            ],
          },
          repostedByUserIds: {
            $map: { input: "$repostReposts", as: "r", in: "$$r.repostedByUserId" },
          },

          shareCount: { $size: "$repostShares" },
          isShared: { $in: [userId, "$repostShares.sharedBy"] },
          sharedByUserIds: {
            $map: { input: "$repostShares", as: "s", in: "$$s.sharedBy" },
          },

          // The user who did the reposting
          repostedUser: {
            _id: "$_reposterProfile._id",
            avatar: "$_reposterAccount.avatar",
            username: "$_reposterAccount.username",
            email: "$_reposterAccount.email",
            createdAt: "$_reposterAccount.createdAt",
            updatedAt: "$_reposterAccount.updatedAt",
            coverImage: "$_reposterProfile.coverImage",
            firstName: "$_reposterProfile.firstName",
            lastName: "$_reposterProfile.lastName",
            bio: "$_reposterProfile.bio",
            owner: "$_reposterAccount._id",
          },

          // Original post with LIVE global counts
          originalPost: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$originalPostId", null] },
                  { $ne: ["$_originalPostData", null] },
                  { $ne: ["$_originalPostData._id", null] },
                ],
              },
              then: [
                {
                  _id: "$_originalPostData._id",
                  __v: "$_originalPostData.__v",
                  content: "$_originalPostData.content",
                  duration: "$_originalPostData.duration",
                  feedShortsBusinessId: "$_originalPostData.feedShortsBusinessId",
                  tags: "$_originalPostData.tags",
                  contentType: "$_originalPostData.contentType",
                  numberOfPages: "$_originalPostData.numberOfPages",
                  fileNames: "$_originalPostData.fileNames",
                  fileTypes: "$_originalPostData.fileTypes",
                  fileSizes: "$_originalPostData.fileSizes",
                  files: "$_originalPostData.files",
                  fileIds: "$_originalPostData.fileIds",
                  thumbnail: "$_originalPostData.thumbnail",
                  createdAt: "$_originalPostData.createdAt",
                  updatedAt: "$_originalPostData.updatedAt",

                  originalPostId: { $literal: null },
                  isReposted: { $literal: false },
                  repostedByUserId: { $literal: null },
                  repostedUsers: { $literal: [] },

                  author: {
                    _id: "$_origAuthorProfile._id",
                    coverImage: "$_origAuthorProfile.coverImage",
                    firstName: "$_origAuthorProfile.firstName",
                    lastName: "$_origAuthorProfile.lastName",
                    bio: "$_origAuthorProfile.bio",
                    dob: "$_origAuthorProfile.dob",
                    location: "$_origAuthorProfile.location",
                    countryCode: "$_origAuthorProfile.countryCode",
                    phoneNumber: "$_origAuthorProfile.phoneNumber",
                    owner: "$_origAuthorProfile.owner",
                    createdAt: "$_origAuthorProfile.createdAt",
                    updatedAt: "$_origAuthorProfile.updatedAt",
                    __v: "$_origAuthorProfile.__v",
                    account: {
                      _id: "$_origAuthorAccount._id",
                      avatar: "$_origAuthorAccount.avatar",
                      username: "$_origAuthorAccount.username",
                      email: "$_origAuthorAccount.email",
                      createdAt: "$_origAuthorAccount.createdAt",
                      updatedAt: "$_origAuthorAccount.updatedAt",
                    },
                  },

                  originalPostReposter: "$_origReposters",
                  bookmarks: "$_origBookmarks",

                  // LIVE global counts for the quoted post card
                  commentCount: { $size: "$_origComments" },
                  likeCount: { $size: "$_origLikes" },
                  bookmarkCount: { $size: "$_origBookmarks" },
                  repostCount: { $size: "$_origReposts" },
                  shareCount: { $size: "$_origShares" },
                },
              ],
              else: [],
            },
          },
        },
      },

      // STEP 10: CLEANUP temp fields
      {
        $project: {
          _originalPostIdObj: 0,
          _originalPostData: 0,
          _origAuthorProfile: 0,
          _origAuthorAccount: 0,
          _origLikes: 0,
          _origBookmarks: 0,
          _origReposts: 0,
          _origShares: 0,
          _origComments: 0,
          _origReposters: 0,
          _reposterAccount: 0,
          _reposterProfile: 0,
        },
      },
    ]);

    const posts = await FeedPost.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
          totalDocs: "totalRepostedPosts",
          docs: "repostedPosts",
        },
      })
    );

    console.log("All Reposted Posts fetched successfully:", posts.totalRepostedPosts);

    return res
      .status(200)
      .json(new ApiResponse(200, posts, "All Reposted Posts fetched successfully"));

  } catch (error) {
    console.error("Error fetching reposted posts:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Error: ${error.message}`));
  }
});


const getSharedPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  console.log("Starting getSharedPosts for user:", req.user?._id);

  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    // Start aggregation from FeedShare
    const postAggregation = FeedShare.aggregate([
      // Match only shares by current user
      {
        $match: {
          sharedBy: userId,
        },
      },
      // Sort by when they shared (most recent first)
      {
        $sort: { createdAt: -1 },
      },
      // Lookup the post
      {
        $lookup: {
          from: "feedposts",
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      // Unwind the post
      {
        $unwind: {
          path: "$post",
          preserveNullAndEmptyArrays: false,
        },
      },
      // Store share metadata before replacing root
      {
        $addFields: {
          "post.shareId": "$_id",
          "post.sharedBy": "$sharedBy",
          "post.sharedAt": "$createdAt",
          "post.shareMethod": "$shareMethod",
          "post.shareNote": "$shareNote"
        }
      },
      // Replace root with post
      {
        $replaceRoot: {
          newRoot: "$post"
        }
      },

      // Apply feedCommonAggregation if available
      ...feedCommonAggregation(req),

      // ============================================
      // LIKES AGGREGATION
      // ============================================
      {
        $lookup: {
          from: "feedlikes",
          localField: "_id",
          foreignField: "postId",
          as: "postLikes"
        }
      },
      {
        $addFields: {
          likedByUserIds: {
            $map: {
              input: "$postLikes",
              as: "like",
              in: "$$like.likedBy"
            }
          },
          likes: { $size: "$postLikes" },
          isLiked: {
            $in: [userId, "$postLikes.likedBy"]
          }
        }
      },
      {
        $project: {
          postLikes: 0
        }
      },

      // ============================================
      // BOOKMARKS AGGREGATION
      // ============================================
      {
        $lookup: {
          from: "feedbookmarks",
          localField: "_id",
          foreignField: "postId",
          as: "bookmarks"
        }
      },
      {
        $addFields: {
          bookmarkedByUserIds: "$bookmarks.bookmarkedBy",
          bookmarkCount: { $size: "$bookmarks" },
          isBookmarked: {
            $in: [userId, "$bookmarks.bookmarkedBy"]
          }
        }
      },
      {
        $project: {
          bookmarks: 0
        }
      },

      // ============================================
      // REPOSTS AGGREGATION - FIXED
      // ============================================
      {
        $lookup: {
          from: "feedposts",  // ✅ FIXED: Changed from "feedretweets" to "feedposts"
          localField: "_id",
          foreignField: "originalPostId",
          as: "postReposts"
        }
      },
      {
        $addFields: {
          repostedByUserIds: {
            $map: {
              input: "$postReposts",
              as: "repost",
              in: "$$repost.repostedByUserId"
            }
          },
          repostCount: { $size: "$postReposts" },
          isRepostedByMe: {
            $in: [userId, {
              $map: {
                input: "$postReposts",
                as: "repost",
                in: "$$repost.repostedByUserId"
              }
            }]
          }
        }
      },
      {
        $project: {
          postReposts: 0
        }
      },

      // ============================================
      // SHARES AGGREGATION
      // ============================================
      {
        $lookup: {
          from: "feedshares",
          localField: "_id",
          foreignField: "postId",
          as: "postShares"
        }
      },
      {
        $addFields: {
          sharedByUserIds: {
            $map: {
              input: "$postShares",
              as: "share",
              in: "$$share.sharedBy"
            }
          },
          shareCount: { $size: "$postShares" },
          isShared: true // Always true since we're fetching shared posts
        }
      },
      {
        $project: {
          postShares: 0
        }
      }
    ]);

    console.log("Executing aggregation with pagination");

    const posts = await FeedShare.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page: parseInt(page),
        limit: parseInt(limit),
        customLabels: {
          totalDocs: "totalSharedPosts",
          docs: "sharedPosts",
        },
      })
    );

    // Post-processing for reposted posts (same as getAllFeed)
    for (let post of posts.sharedPosts) {
      if (post.isReposted && post.originalPostId) {
        const originalPost = await FeedPost.findById(post.originalPostId);

        if (originalPost) {
          const author = await SocialProfile.findById(originalPost.author)
            .populate('owner');

          if (author) {
            post.author = {
              _id: author._id,
              coverImage: author.coverImage,
              firstName: author.firstName,
              lastName: author.lastName,
              bio: author.bio,
              dob: author.dob,
              location: author.location,
              countryCode: author.countryCode,
              phoneNumber: author.phoneNumber,
              owner: author.owner,
              createdAt: author.createdAt,
              updatedAt: author.updatedAt,
              __v: author.__v,
            };

            if (author.owner) {
              post.author.account = {
                _id: author.owner._id,
                avatar: author.owner.avatar,
                username: author.owner.username,
                email: author.owner.email,
                createdAt: author.owner.createdAt,
                updatedAt: author.owner.updatedAt
              };
            }

            post.content = originalPost.content || post.content;
            post.tags = originalPost.tags || post.tags;
            post.fileIds = originalPost.fileIds || post.fileIds;
            post.files = originalPost.files || post.files;
            post.contentType = originalPost.contentType || post.contentType;

            if (!post.contentType) {
              post.contentType = "text";
            }

            if (!post.originalPost) {
              post.originalPost = [];
            }

            if (post.originalPost.length === 0) {
              post.originalPost.push({
                _id: originalPost._id,
                author: post.author,
                content: originalPost.content,
                contentType: originalPost.contentType,
                files: originalPost.files,
                fileIds: originalPost.fileIds,
                tags: originalPost.tags,
                createdAt: originalPost.createdAt,
              });
            }

            post.comments = originalPost.comments || post.comments;
            post.likes = originalPost.likes || post.likes;
            post.reposts = originalPost.reposts || post.reposts;
            post.repostedUsersCount = originalPost.repostedUsersCount || post.repostedUsersCount;
          }

          if (post.repostedByUserId) {
            const repostedByUser = await User.findById(post.repostedByUserId);

            if (repostedByUser) {
              const repostedUserProfile = await SocialProfile.findOne({
                owner: repostedByUser._id
              });

              const safeUser = {
                _id: repostedUserProfile?._id || repostedByUser._id,
                username: repostedByUser.username,
                email: repostedByUser.email,
                createdAt: repostedByUser.createdAt,
                updatedAt: repostedByUser.updatedAt,
              };

              if (repostedByUser.avatar) {
                safeUser.avatar = {
                  url: repostedByUser.avatar.url,
                  localPath: repostedByUser.avatar.localPath,
                  _id: repostedByUser.avatar._id,
                };
              }

              if (repostedUserProfile) {
                safeUser.coverImage = repostedUserProfile.coverImage;
                safeUser.firstName = repostedUserProfile.firstName;
                safeUser.lastName = repostedUserProfile.lastName;
                safeUser.bio = repostedUserProfile.bio;
                safeUser.owner = repostedByUser._id;
              }

              post.repostedUser = safeUser;
            }
          }
        }
      }

      // Set contentType if not set
      if (!post.contentType) {
        if (post.files && post.files.length > 0) {
          const fileTypes = post.files.map(f => f.fileType || "").filter(Boolean);
          const hasVideo = fileTypes.some(type => type.toLowerCase().includes("video"));
          const hasImage = fileTypes.some(type => type.toLowerCase().includes("image"));
          const hasAudio = fileTypes.some(type => type.toLowerCase().includes("audio"));

          if (hasVideo && hasImage) {
            post.contentType = "mixed_files";
          } else if (hasVideo) {
            post.contentType = "videos";
          } else if (hasAudio) {
            post.contentType = "vn";
          } else if (hasImage) {
            post.contentType = "mixed_files";
          } else {
            post.contentType = "text";
          }
        } else {
          post.contentType = "text";
        }
      }
    }

    console.log("All Shared Posts fetched successfully:", posts.totalSharedPosts);

    return res
      .status(200)
      .json(
        new ApiResponse(200, posts, "All Shared Posts fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching shared posts:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Error: ${error.message}`));
  }
});


const getSearchAllFeed = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, filter = "all" } = req.query;

  console.log("\n=== GENERAL SEARCH ===");
  console.log("Query:", query);
  console.log("Filter:", filter);

  if (!query || query.trim() === "") {
    return res.status(400).json(
      new ApiResponse(400, {}, "Search query is required")
    );
  }

  try {
    // Helper: Improved name query parser
    const parseNameQuery = (q) => {
      const trimmed = q.trim();
      const lowerQuery = trimmed.toLowerCase();

      const results = {
        original: lowerQuery,
        hasSpace: trimmed.includes(' '),
        parts: []
      };

      if (results.hasSpace) {
        results.parts = trimmed.split(/\s+/).filter(p => p.length > 0);
      } else {
        // Better camelCase detection and split
        const camelSplit = trimmed.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
        if (camelSplit.length > 1) {
          results.parts = camelSplit;
        } else if (trimmed.length >= 4) {
          const mid = Math.floor(trimmed.length / 2);
          results.parts = [trimmed.slice(0, mid), trimmed.slice(mid)];
        }
      }

      results.parts = results.parts.map(p => p.toLowerCase());
      return results;
    };

    const nameQuery = parseNameQuery(query);
    console.log("Parsed name query:", nameQuery);

    let socialProfileIds = [];
    let userSearchResults = [];

    if (filter === "all" || filter === "people") {
      console.log("Searching for users...");

      // Search User by username or email
      const matchingUsers = await User.find({
        $or: [
          { username: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } }
        ]
      }).limit(20);

      console.log(`Found ${matchingUsers.length} users`);

      if (matchingUsers.length > 0) {
        const userIds = matchingUsers.map(u => u._id);
        userSearchResults = matchingUsers.map(u => ({
          _id: u._id,
          username: u.username,
          email: u.email
        }));

        const socialProfiles = await SocialProfile.find({
          owner: { $in: userIds }
        });
        socialProfileIds = socialProfiles.map(p => p._id);
      }

      // Direct search in SocialProfile for names
      const profileSearchConditions = [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } }
      ];

      if (nameQuery.parts.length >= 2) {
        const [part1, part2] = nameQuery.parts;
        profileSearchConditions.push(
          { $and: [{ firstName: { $regex: part1, $options: "i" } }, { lastName: { $regex: part2, $options: "i" } }] },
          { $and: [{ lastName: { $regex: part1, $options: "i" } }, { firstName: { $regex: part2, $options: "i" } }] }
        );
      }

      const matchingProfiles = await SocialProfile.find({
        $or: profileSearchConditions
      }).limit(50);

      console.log(`Found ${matchingProfiles.length} social profiles by name`);

      // Merge unique SocialProfile IDs
      const newProfileIds = matchingProfiles.map(p => p._id.toString());
      const existingIds = socialProfileIds.map(id => id.toString());
      const allIds = [...new Set([...existingIds, ...newProfileIds])];
      socialProfileIds = allIds.map(id => new mongoose.Types.ObjectId(id));
    }

    // Build search conditions
    const searchConditions = [];

    if (filter === "all" || filter === "posts") {
      searchConditions.push(
        { content: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } }
      );
    }

    if (filter === "all" || filter === "people") {
      if (socialProfileIds.length > 0) {
        searchConditions.push({ author: { $in: socialProfileIds } });
      }
      // Populated fields (ensure feedAggregation includes lookups)
      searchConditions.push(
        { "author.account.username": { $regex: query, $options: "i" } },
        { "author.firstName": { $regex: query, $options: "i" } },
        { "author.lastName": { $regex: query, $options: "i" } }
      );

      if (nameQuery.parts.length >= 2) {
        const [part1, part2] = nameQuery.parts;
        searchConditions.push(
          { $and: [{ "author.firstName": { $regex: part1, $options: "i" } }, { "author.lastName": { $regex: part2, $options: "i" } }] },
          { $and: [{ "author.lastName": { $regex: part1, $options: "i" } }, { "author.firstName": { $regex: part2, $options: "i" } }] }
        );
      }
    }

    // Aggregation pipeline
    const postAggregation = FeedPost.aggregate([
      // Your base feed aggregation (must include author population)
      ...feedAggregation(req),

      // Search filter
      {
        $match: {
          $or: searchConditions
        }
      },

      // Add concatenated name fields for scoring
      {
        $addFields: {
          fullNameForward: {
            $toLower: {
              $concat: [
                { $ifNull: ["$author.firstName", ""] },
                { $ifNull: ["$author.lastName", ""] }
              ]
            }
          },
          fullNameReverse: {
            $toLower: {
              $concat: [
                { $ifNull: ["$author.lastName", ""] },
                { $ifNull: ["$author.firstName", ""] }
              ]
            }
          },
          fullNameWithSpace: {
            $toLower: {
              $concat: [
                { $ifNull: ["$author.firstName", ""] },
                " ",
                { $ifNull: ["$author.lastName", ""] }
              ]
            }
          },
          fullNameReverseWithSpace: {
            $toLower: {
              $concat: [
                { $ifNull: ["$author.lastName", ""] },
                " ",
                { $ifNull: ["$author.firstName", ""] }
              ]
            }
          }
        }
      },

      // Relevance scoring
      {
        $addFields: {
          relevanceScore: {
            $sum: [
              // Exact username match
              {
                $cond: [
                  { $eq: [{ $toLower: { $ifNull: ["$author.account.username", ""] } }, query.toLowerCase()] },
                  100, 0
                ]
              },
              // Exact concatenated name matches
              { $cond: [{ $eq: ["$fullNameForward", nameQuery.original] }, 95, 0] },
              { $cond: [{ $eq: ["$fullNameReverse", nameQuery.original] }, 95, 0] },
              { $cond: [{ $eq: ["$fullNameWithSpace", nameQuery.original] }, 95, 0] },
              { $cond: [{ $eq: ["$fullNameReverseWithSpace", nameQuery.original] }, 95, 0] },
              // Partial concatenated
              { $cond: [{ $regexMatch: { input: "$fullNameForward", regex: nameQuery.original, options: "i" } }, 85, 0] },
              { $cond: [{ $regexMatch: { input: "$fullNameReverse", regex: nameQuery.original, options: "i" } }, 85, 0] },
              // Username starts with
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$author.account.username", ""] }, regex: `^${query}`, options: "i" } }, 80, 0] },
              // First/Last name
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$author.firstName", ""] }, regex: nameQuery.parts[0] || query, options: "i" } }, 70, 0] },
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$author.lastName", ""] }, regex: nameQuery.parts[1] || query, options: "i" } }, 70, 0] },
              // Username contains
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$author.account.username", ""] }, regex: query, options: "i" } }, 40, 0] },
              // Content contains
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$content", ""] }, regex: query, options: "i" } }, 30, 0] },
              // Tag exact
              { $cond: [{ $in: [query.toLowerCase(), { $map: { input: { $ifNull: ["$tags", []] }, as: "tag", in: { $toLower: "$$tag" } } }] }, 50, 0] }
            ]
          }
        }
      },

      // Clean up temp fields
      {
        $project: {
          fullNameForward: 0,
          fullNameReverse: 0,
          fullNameWithSpace: 0,
          fullNameReverseWithSpace: 0
        }
      },

      // Sort
      { $sort: { relevanceScore: -1, createdAt: -1 } }
    ]);

    console.log("Executing search query...");

    // Paginate
    const posts = await FeedPost.aggregatePaginate(
      postAggregation,
      getMongoosePaginationOptions({
        page,
        limit,
        customLabels: { totalDocs: "totalPosts", docs: "posts" }
      })
    );

    console.log(`Found ${posts.posts.length} posts (${posts.totalPosts} total)`);

    // Process posts
    for (let post of posts.posts) {
      await processPost(post);
    }

    const responseData = {
      data: posts,
      searchQuery: query,
      filter: filter,
      matchingUsers: userSearchResults,
      totalResults: posts.totalPosts
    };

    console.log("=== SEARCH COMPLETE ===\n");

    return res.status(200).json(
      new ApiResponse(200, responseData, `Found ${posts.totalPosts} results for "${query}"`)
    );

  } catch (e) {
    console.error("Search error:", e.message, e.stack);
    return res.status(500).json(
      new ApiResponse(500, { error: e.message }, "Error searching feed")
    );
  }
});