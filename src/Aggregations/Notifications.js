const unifiedNotificationCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sender: { $arrayElemAt: ["$sender", 0] }, // Take the first element of the array as sender
      },
    },
  ];
 };

 export {
    unifiedNotificationCommonAggregation
 };
 