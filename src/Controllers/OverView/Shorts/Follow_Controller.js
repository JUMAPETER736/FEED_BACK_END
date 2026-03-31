

import mongoose from "mongoose";
import { User }         from "../../../Models/Aunthentication/User_Model.js";
import { SocialFollow } from "../../../Models/Shorts/Follow_Model.js";
import UnifiedNotification from "../../../Models/Notifications/Unified_Notification_Model.js";
import { followersAggregation }          from "../../../Aggregations/Followers.js";
import { unifiedFollowingAggregation }   from "../../../Aggregations/Following.js";
import { unifiedFollowingListAggregation } from "../../../Aggregations/Following_List.js";
import { unifiedNotificationCommonAggregation } from "../../../Aggregations/Notifications.js";
import { unifiedUserCommonAggregation }  from "../../../Aggregations/Users.js";
import { emitSocketEvent }       from "../../../Sockets/index.js";
import { emitUnreadCountUpdate } from "../../../Sockets/socket.js";
import { ApiError }    from "../../../Utils/API_Errors.js";
import { ApiResponse } from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
import { getMongoosePaginationOptions } from "../../../Utils/Helpers.js";

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


const getFollowingListByUserName = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const userAggregation = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    ...unifiedFollowingListAggregation(),
  ]);

  const user = userAggregation[0];

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const userId = user._id;
  const followingAggregate = SocialFollow.aggregate([
    {
      $match: {
        // When we are fetching the following list we want to match the follow documents with follower as current user
        // Meaning, current user is FOLLOWING someone
        followerId: new mongoose.Types.ObjectId(userId),
      },
    },
    // Now we have all the follow documents where current user is a follower (who is following someone)
    ...unifiedFollowingAggregation(req),
  ]);

  const followingList = await SocialFollow.aggregatePaginate(
    followingAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalFollowing",
        docs: "following",
      },
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user, ...followingList },
        "Following list fetched successfully"
      )
    );
});

export {
  followUnFollowUser,
  getFollowersListByUserName,
  getFollowingListByUserName,
};
