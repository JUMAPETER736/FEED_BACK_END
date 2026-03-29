

import mongoose from "mongoose";
import { User } from "../../../models/apps/auth/user.models.js";
import { SocialFollow } from "../../../models/apps/social-media/follow.models.js";
import { SocialProfile } from "../../../models/apps/social-media/profile.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "../../../utils/helpers.js";

/**
 *
 * @param {string} userId
 * @param {import("express").Request} req
 * @description A utility function, which querys the {@link SocialProfile} model and returns the profile with account details
 */
const getUserSocialProfile = async (userId, req) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  let profile = await SocialProfile.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
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
              isEmailVerified: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "socialfollows",
        localField: "owner",
        foreignField: "followerId",
        as: "following", // users that are followed by current user
      },
    },
    {
      $lookup: {
        from: "socialfollows",
        localField: "owner",
        foreignField: "followeeId",
        as: "followedBy", // users that are following the current user
      },
    },
    {
      $addFields: {
        account: { $first: "$account" },
        followersCount: { $size: "$followedBy" },
        followingCount: { $size: "$following" },
      },
    },
    {
      $project: {
        followedBy: 0,
        following: 0,
      },
    },
  ]);

  let isFollowing = false;

  if (req.user?._id && req.user?._id?.toString() !== userId.toString()) {
    // Check if there is a logged in user and logged in user is NOT same as the profile that is being loaded
    // In such case we will check if the logged in user follows the loaded profile user
    const followInstance = await SocialFollow.findOne({
      followerId: req.user?._id, // logged in user. If this is null `isFollowing` will be false
      followeeId: userId,
    });
    isFollowing = followInstance ? true : false;
  }

  const userProfile = profile[0];

  if (!userProfile) {
    throw new ApiError(404, "User profile does not exist");
  }
  return { ...userProfile, isFollowing };
};




// Public route
const getProfileByUserName = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const userProfile = await getUserSocialProfile(user._id, req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, userProfile, "User profile fetched successfully")
    );
});

const getMySocialProfile = asyncHandler(async (req, res) => {
  let profile = await getUserSocialProfile(req.user._id, req);
  return res
    .status(200)
    .json(new ApiResponse(200, profile, "User profile fetched successfully"));
});


const updateSocialProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber, countryCode, bio, dob, location } =
    req.body;

  let profile = await SocialProfile.findOneAndUpdate(
    {
      owner: req.user._id,
    },
    {
      $set: {
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        bio,
        dob,
        location,
      },
    },
    { new: true }
  );

  profile = await getUserSocialProfile(req.user._id, req);

  return res
    .status(200)
    .json(new ApiResponse(200, profile, "User profile updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  // Check if user has uploaded a cover image
  if (!req.file?.filename) {
    throw new ApiError(400, "Cover image is required");
  }
  // get cover image file's system url and local path
  const coverImageUrl = getStaticFilePath(req, req.file?.filename);
  const coverImageLocalPath = getLocalPath(req.file?.filename);

  const profile = await SocialProfile.findOne({
    owner: req.user._id,
  });

  let updatedProfile = await SocialProfile.findOneAndUpdate(
    {
      owner: req.user._id,
    },
    {
      $set: {
        // set the newly uploaded cover image
        coverImage: {
          url: coverImageUrl,
          localPath: coverImageLocalPath,
        },
      },
    },
    { new: true }
  );

  // remove the old cover image
  removeLocalFile(profile.coverImage.localPath);

  updatedProfile = await getUserSocialProfile(req.user._id, req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedProfile, "Cover image updated successfully")
    );
});



const getUserFollowers = async (userId, req) => {

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Get all followers with their complete profile details
  const followers = await SocialFollow.aggregate([
    {
      $match: {
        followeeId: new mongoose.Types.ObjectId(userId), // Find all who follow this user
      },
    },
    {
      $lookup: {
        from: "socialprofiles",
        localField: "followerId",
        foreignField: "owner",
        as: "followerProfile",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "followerId",
        foreignField: "_id",
        as: "followerAccount",
      },
    },
    {
      $addFields: {
        followerProfile: { $first: "$followerProfile" },
        followerAccount: { $first: "$followerAccount" },
      },
    },
    {
      $lookup: {
        from: "socialfollows",
        let: { followerId: "$followerId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$followerId", "$$followerId"] },
                  { $eq: ["$followeeId", new mongoose.Types.ObjectId(req.user?._id)] },
                ],
              },
            },
          },
        ],
        as: "isFollowingBack",
      },
    },
    {
      $project: {
        _id: "$followerAccount._id",
        username: "$followerAccount.username",
        email: "$followerAccount.email",
        avatar: "$followerAccount.avatar",
        isEmailVerified: "$followerAccount.isEmailVerified",
        firstName: "$followerProfile.firstName",
        lastName: "$followerProfile.lastName",
        fullName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$followerProfile.firstName", ""] },
                " ",
                { $ifNull: ["$followerProfile.lastName", ""] }
              ]
            }
          }
        },
        bio: "$followerProfile.bio",
        dob: "$followerProfile.dob",
        location: "$followerProfile.location",
        countryCode: "$followerProfile.countryCode",
        phoneNumber: "$followerProfile.phoneNumber",
        coverImage: "$followerProfile.coverImage",
        isFollowingBack: { $gt: [{ $size: "$isFollowingBack" }, 0] },
        followedAt: "$createdAt",
      },
    },
  ]);

  return followers;
};

const getUserFollowing = async (userId, req) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Get all users that this user is following with their complete profile details
  const following = await SocialFollow.aggregate([
    {
      $match: {
        followerId: new mongoose.Types.ObjectId(userId), // Find all who this user follows
      },
    },
    {
      $lookup: {
        from: "socialprofiles",
        localField: "followeeId",
        foreignField: "owner",
        as: "followingProfile",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "followeeId",
        foreignField: "_id",
        as: "followingAccount",
      },
    },
    {
      $addFields: {
        followingProfile: { $first: "$followingProfile" },
        followingAccount: { $first: "$followingAccount" },
      },
    },
    {
      $lookup: {
        from: "socialfollows",
        let: { followeeId: "$followeeId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$followerId", "$$followeeId"] },
                  { $eq: ["$followeeId", new mongoose.Types.ObjectId(req.user?._id)] },
                ],
              },
            },
          },
        ],
        as: "followsBack",
      },
    },
    {
      $project: {
        _id: "$followingAccount._id",
        username: "$followingAccount.username",
        email: "$followingAccount.email",
        avatar: "$followingAccount.avatar",
        isEmailVerified: "$followingAccount.isEmailVerified",
        firstName: "$followingProfile.firstName",
        lastName: "$followingProfile.lastName",
        fullName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$followingProfile.firstName", ""] },
                " ",
                { $ifNull: ["$followingProfile.lastName", ""] }
              ]
            }
          }
        },
        bio: "$followingProfile.bio",
        dob: "$followingProfile.dob",
        location: "$followingProfile.location",
        countryCode: "$followingProfile.countryCode",
        phoneNumber: "$followingProfile.phoneNumber",
        coverImage: "$followingProfile.coverImage",
        followsBack: { $gt: [{ $size: "$followsBack" }, 0] },
        followedAt: "$createdAt",
      },
    },
  ]);

  return following;
};



// Controller functions to use these utilities
const getFollowersList = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const followers = await getUserFollowers(user._id, req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, followers, "User followers fetched successfully")
    );
});

const getFollowingList = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const following = await getUserFollowing(user._id, req);

  return res
    .status(200)
    .json(
      new ApiResponse(200, following, "User following list fetched successfully")
    );
});

export {
  getMySocialProfile,
  getProfileByUserName,
  updateSocialProfile,
  updateCoverImage,
  getUserFollowers,
  getUserFollowing,
  getFollowersList,
  getFollowingList,
};