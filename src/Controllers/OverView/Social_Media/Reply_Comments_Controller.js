


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



  