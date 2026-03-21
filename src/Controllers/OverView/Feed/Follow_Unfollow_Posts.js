

import { FeedPost } from "../../../models/apps/feed/feed.model.js";
import { FeedFollowUnfollow } from "../../../models/apps/feed/feed_followUnfollow.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

const followUnFollowPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const post = await FeedPost.findById(postId);

  // Check for post existence
  if (!post) {
    throw new ApiError(404, "Feed Post does not exist");
  }

  // See if user has already followed the post
  const isAlreadyFollowed = await FeedFollowUnfollow.findOne({
    postId,
    followedBy: req.user?._id,
  });

  if (isAlreadyFollowed) {
    // if already followed, unfollow it by removing the record from the DB
    await FeedFollowUnfollow.findOneAndDelete({
      postId,
      followedBy: req.user?._id,
    });
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isFollowed: false,
        },
        "Follow removed successfully"
      )
    );
  } else {
    // if not followed, follow it by adding the record to the DB
    await FeedFollowUnfollow.create({
      postId,
      followedBy: req.user?._id,
    });
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isFollowed: true,
        },
        "Feed followed successfully"
      )
    );
  }
});

const deleteFollowFeed = asyncHandler(async (req, res) => {
  const { followId } = req.params;

  console.log(`delete follow ${req.params.followId}`);
  try {
    const result = await FeedFollowUnfollow.deleteOne({ postId: followId });
    console.log(result);
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Feed Followed deleted successfully"));
  } catch (error) {
    console.log(`follow delete error ${error.message}`);
    return res
      .status(500)
      .json(
        new ApiResponse(500, {}, `Feed Follow not deleted ${error.message}`)
      );
  }
});

const getById = asyncHandler(async (req, res) => {
  const result = await FeedFollowUnfollow.findById({ _id: req.params._id });
  res.send({ result });
});

export { followUnFollowPost, deleteFollowFeed, getById };
