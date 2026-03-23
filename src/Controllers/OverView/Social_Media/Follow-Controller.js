

import mongoose from "mongoose";
import { User } from "../../../models/apps/auth/user.models.js";
import { SocialFollow } from "../../../models/apps/social-media/follow.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getMongoosePaginationOptions } from "../../../utils/helpers.js";
import UnifiedNotification from "../../../models/apps/notifications/unified.notification.model.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { unifiedNotificationCommonAggregation } from "../../../aggregations/unifiedNotifications.js";
import { unifiedUserCommonAggregation } from "../../../aggregations/userAggregation.js";
import { followersAggregation } from "../../../aggregations/followerAggregation.js";
import { unifiedFollowingListAggregation } from "../../../aggregations/followingListAggregation.js";
import { unifiedFollowingAggregation } from "../../../aggregations/followingAggregation.js";
import { emitUnreadCountUpdate } from "../../../socket/socket.js";
/** aggregation addded here */



const followUnFollowUser = asyncHandler(async (req, res) => {
  const { toBeFollowedUserId } = req.params;

  // See if user that is being followed exist
  const toBeFollowed = await User.findById(toBeFollowedUserId);

  if (!toBeFollowed) {
    throw new ApiError(404, "User does not exist");
  }

  // Check of the user who is being followed is not the one who is requesting
  if (toBeFollowedUserId.toString() === req.user._id.toString()) {
    throw new ApiError(422, "You cannot follow yourself");
  }

  // Check if logged user is already following the to be followed user
  const isAlreadyFollowing = await SocialFollow.findOne({
    followerId: req.user._id,
    followeeId: toBeFollowed._id,
  });

  if (isAlreadyFollowing) {
    // if yes, then unfollow the user by deleting the follow entry from the DB
    await SocialFollow.findOneAndDelete({
      followerId: req.user._id,
      followeeId: toBeFollowed._id,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          following: false,
        },
        "Un-followed successfully"
      )
    );
  } else {
    // if no, then create a follow entry
    await SocialFollow.create({
      followerId: req.user._id,
      followeeId: toBeFollowed._id,
    });
    // Follow Notification

    if (String(toBeFollowed._id) !== String(req.user._id)) {

      await UnifiedNotification.create({
        owner: toBeFollowedUserId,
        sender: req.user._id,
        message: `${req.user.username} has started following you.`,
        avatar: req.user.avatar,
        type: 'followed',
        data: {
          postId: "",
          for: "feed",
          commentId: null,
          commentReplyId: null
        },
      });

      const notifications = await UnifiedNotification.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(toBeFollowedUserId), // Assuming recipient field exists in Notification schema
          },
        },
        ...unifiedNotificationCommonAggregation(),
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      const followedNotification = notifications[0];

      if (!followedNotification) {
        throw new ApiError(500, "Internal server error");
      }
      //emitsocket added here

      emitSocketEvent(req, toBeFollowedUserId, "followed", followedNotification);

      emitUnreadCountUpdate(req, String(toBeFollowedUserId));

    }


    return res.status(200).json(
      new ApiResponse(
        200,
        {
          following: true,
        },
        "Followed successfully"
      )
    );
  }
});


const getFollowersListByUserName = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const userAggregation = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    ...unifiedUserCommonAggregation(),
  ]);

  const user = userAggregation[0];

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  const userId = user._id;
  const followersAggregate = SocialFollow.aggregate([
    {
      $match: {
        // When we are fetching the followers list we want to match the follow documents with followee as current user
        // Meaning, someone is FOLLOWING current user (followee)
        followeeId: new mongoose.Types.ObjectId(userId),
      },
    },
    // Now we have all the follow documents where current user is followee (who is being followed)
    ...followersAggregation(req),
  ]);

  const followersList = await SocialFollow.aggregatePaginate(
    followersAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalFollowers",
        docs: "followers",
      },
    })
  );
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user, ...followersList },
        "Followers list fetched successfully"
      )
    );
});