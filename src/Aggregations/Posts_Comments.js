const unifiedGetPostCommentAggregation = (req) => {
    return [
      {
            $lookup: {
              from: "feedlikes",
              localField: "_id",
              foreignField: "commentId",
              as: "likes",
            },
          },
        {
      $lookup: {
        from: "feedlikes",
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
    {
      $lookup: {
        from: "feedcommentreplies",
        localField: "_id",
        foreignField: "commentId",
        as: "replies",
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
                  },
                },
              ],
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              account: 1,
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
        author: { $first: "$author" },
        likes: { $size: "$likes" },
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
        replyCount: { $size: "$replies" },
      },
      // $addFields: {
      //   replyCount: { $size: "$replies" },
      // },
    },
    ];

};


export {
    unifiedGetPostCommentAggregation
}