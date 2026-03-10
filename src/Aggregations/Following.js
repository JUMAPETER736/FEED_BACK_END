const FollowingAggregation = (req) => {
    return [
        {
              $lookup: {
                // Lookup for the followees (users which are being followed by the current user)
                from: "users",
                localField: "followeeId",
                foreignField: "_id",
                as: "following",
                pipeline: [
                  {
                    $lookup: {
                      // lookup for the each user's profile
                      from: "socialprofiles",
                      localField: "_id",
                      foreignField: "owner",
                      as: "profile",
                    },
                  },
                  // NOTE: In this logic we want to treat logged in user as a follower
                  // LOGIC TO CHECK IF THE LOGGED IN USER IS FOLLOWING ANY OF THE USERS THAT LOADED PROFILE USER FOLLOWING
                  // Point to be noted: There are chances that the logged in user is seeing someone else's following list. SO if logged in user is seeing his own following list the isFollowing flag will be true
                  {
                    $lookup: {
                      // We want to check if there is a document where follower is current logged in user and followee is the looked up user
                      // If there is a document with above case that means logged in user is following the looked up user
                      from: "socialfollows",
                      localField: "_id",
                      foreignField: "followeeId",
                      as: "isFollowing",
                      pipeline: [
                        {
                          $match: {
                            followerId: new mongoose.Types.ObjectId(req.user?._id), // Only get documents where logged in user is the follower
                          },
                        },
                      ],
                    },
                  },
                  {
                    $addFields: {
                      profile: { $first: "$profile" },
                      isFollowing: {
                        $cond: {
                          if: {
                            $gte: [
                              {
                                $size: "$isFollowing",
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
                  {
                    $project: {
                      // only project necessary fields
                      username: 1,
                      email: 1,
                      avatar: 1,
                      profile: 1,
                      isFollowing: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                following: { $first: "$following" },
              },
            },
            {
              $project: {
                _id: 0,
                following: 1,
              },
            },
            {
              $replaceRoot: {
                newRoot: "$following",
              },
            },

    ];
};


export {
    FollowingAggregation
}