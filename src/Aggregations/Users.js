const UserAggregation = ()=> {
    return [
        {
            
      $lookup: {
        // lookup for the each user's profile
        from: "socialprofiles",
        localField: "_id",
        foreignField: "owner",
        as: "profile",
        pipeline: [
          {
            $project: {
              firstName: 1,
              lastName: 1,
              bio: 1,
              location: 1,
              countryCode: 1,
              phoneNumber: 1,
              coverImage: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: { profile: { $first: "$profile" } },
    },
    {
      $project: {
        username: 1,
        email: 1,
        isEmailVerified: 1,
        avatar: 1,
        profile: 1,
      },
    }
   ];
};

export {
    UserAggregation
}