const followersAggregation = (req) => {
    return [
         // Now we have all the follow documents where current user is followee (who is being followed)
            {
              $lookup: {
                // Lookup for the followers (users which are following current users)
                from: "users",
                localField: "followerId",
                foreignField: "_id",
                as: "follower",
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
                  {
                    // NOTE: In this logic we want to treat logged in user as a follower
                    // LOGIC TO CHECK IF THE LOGGED IN USER IS FOLLOWING ANY OF THE FOLLOWERS
                    // Point to be noted: There are chances that the logged in user is seeing someone else's follower list
                    $lookup: {
                      // We want to check if there is a document where follower is current logged in user and followee is the looked up user
                      // If there is a document with above case that means logged in user is following the looked up user
                      from: "socialfollows",
                      localField: "_id", // ID of the looked up user
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
        
                  // Now we wither get no document (meaning, logged in user is not following anyone) or have the document where `LOOKED UP USER is the one who is BEING FOLLOWED BY THE CURRENT LOGGED IN USER`
                  // So, if the document exist then the isFollowing flag should be true
                  {
                    $addFields: {
                      profile: { $first: "$profile" },
                      isFollowing: {
                        $cond: {
                          if: {
                            $gte: [
                              {
                                // if the isFollowing key has document in it
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
        follower: { $first: "$follower" },
      },
    },
    {
      $project: {
        _id: 0,
        follower: 1,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$follower",
      },
    },
    ];
};

export {
    followersAggregation
}