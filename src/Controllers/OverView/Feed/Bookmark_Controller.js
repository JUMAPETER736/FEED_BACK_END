import { FeedBookmark } from "../../../Models/Feed/Feed_Bookmark_Model.js";
import { FeedPost }     from "../../../Models/Feed/Feed_Model.js";
import { ApiError }     from "../../../Utils/API_Errors.js";
import { ApiResponse }  from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
const bookmarkUnBookmarkPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await SocialPost.findById(postId);

  if (!post) {
    throw new ApiError(404, "Post does not exist");
  }

  const isAlreadyBookmarked = await SocialBookmark.findOne({
    postId,
    bookmarkedBy: req.user?._id,
  });

  if (isAlreadyBookmarked) {
    await SocialBookmark.findOneAndDelete({
      postId,
      bookmarkedBy: req.user?._id,
    });

    // Get all user IDs who bookmarked
    const bookmarks = await SocialBookmark.find({ postId }).select('bookmarkedBy');
    const bookmarkedByUserIds = bookmarks.map(b => b.bookmarkedBy);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isBookmarked: false,
          bookmarkCount: bookmarkedByUserIds.length,
          bookmarkedByUserIds: bookmarkedByUserIds
        },
        "Bookmark removed successfully"
      )
    );

  } else {
    await SocialBookmark.create({
      postId,
      bookmarkedBy: req.user?._id,
    });

    const bookmarked = await SocialPost.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(postId),
        },
      },
      ...postCommonAggregation(req),
    ]);

    const receiverId = bookmarked[0].author.account._id;
    const user = await User.findById(receiverId);

    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    console.log(`liked post owner: ${user.username}`);

    if (receiverId.toString() !== req.user._id.toString()) {
      await UnifiedNotification.create({
        owner: receiverId,
        sender: req.user._id,
        message: `${req.user.username} has made your short favorite`,
        avatar: req.user.avatar,
        type: 'favorite',
        data: {
          postId: post._id,
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

      const newNotification = notifications[0];

      if (!newNotification) {
        throw new ApiError(500, 'Internal server error');
      }

      emitSocketEvent(req, `${user._id}`, 'bookMarked', newNotification);
    }

    // Get all user IDs who bookmarked
    const bookmarks = await SocialBookmark.find({ postId }).select('bookmarkedBy');
    const bookmarkedByUserIds = bookmarks.map(b => b.bookmarkedBy);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isBookmarked: true,
          bookmarkCount: bookmarkedByUserIds.length,
          bookmarkedByUserIds: bookmarkedByUserIds
        },
        "Bookmarked successfully"
      )
    );
  }
});

const deleteBookmarkFeed = asyncHandler(async (req, res) => {
  const { bookmarkId } = req.params;

  console.log(`delete bookmark ${req.params.bookmarkId}`);
  try {
    const result = await FeedBookmark.deleteOne({ postId: bookmarkId });
    console.log(result);
    // return res
    //   .status(200)
    //   .send({ message: "Feed bookmarked deleted successfully" });
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Feed Bookmarked deleted successfully"));
  } catch (error) {
    console.log(`bookmark delete error ${error.message}`);
    return res
      .status(200)
      .json(
        new ApiResponse(200, {}, `Feed Bookmarked not deleted ${error.message}`)
      );
  }
});

const getById = asyncHandler(async (req, res) => {
  const result = await FeedBookmark.findById({ _id: req.params._id });
  res.send({ result });
});

export { bookmarkUnBookmarkPost, deleteBookmarkFeed, getById };
