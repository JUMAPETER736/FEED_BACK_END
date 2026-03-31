import mongoose from "mongoose";
import { User }            from "../../../Models/Aunthentication/User_Model.js";
import { BusinessProduct } from "../../../Models/Business/Business_Product_Model.js";
import { SocialFollow }    from "../../../Models/Shorts/Follow_Model.js";
import { BusinessNotification } from "../../../Models/Notifications/Business_Notification_Model.js";
import { unifiedNotificationCommonAggregation } from "../../../Aggregations/Notifications.js";
import { emitSocketEvent }       from "../../../Sockets/index.js";
import { emitUnreadCountUpdate } from "../../../Sockets/socket.js";
import { ApiResponse }  from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
import { getMongoosePaginationOptions } from "../../../Utils/Helpers.js";
import { getMarketplaceRecommendations } from "../../../Services/Recommendation_System_Service.js";

const productPostAggregation = (req) => {
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    return [

        // getting products comments
        {
            $lookup: {
                from: "businesscomments",
                localField: "_id",
                foreignField: "postId",
                as: "comments",
            },
        },

        // Convert comments array to its count
        {
            $addFields: {
                comments: { $size: "$comments" }
            }
        },

        // get like count for the product
        {
            $lookup: {
                from: "businessfeedlikes",
                localField: "_id",
                foreignField: "postId",
                as: "likes"
            },
        },

        {
            $addFields: {
                likes: { $size: "$likes" }
            }
        },

        // check if product is like by current user
        {
            $lookup: {
                from: "businessfeedlikes",
                let: { postId: "$_id" }, //  Fixed: Use "$_id" not "_id"
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$postId", "$$postId"] },     // Each condition in its own object
                                    { $eq: ["$likedBy", userId] }          // Separate object
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1
                        },
                    },
                ],
                as: "isLikedArray"
            }
        },
        {
            $addFields: {
                isLiked: { $gt: [{ $size: "$isLikedArray" }, 0] },
            }
        },

        {
            $project: {
                isLikedArray: 0,
            },
        },

        // Lookup for follow status
        {
            $lookup: {
                from: "socialfollows",
                let: { authorId: "$owner" }, // Define variable from parent document
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$followerId", userId] }, // Current user
                                    { $eq: ["$followeeId", "$$authorId"] }, // Use $$authorId (double $$)
                                ],
                            },
                        },
                    },
                    { $project: { _id: 1 } },
                ],
                as: "isFollowing",
            },
        },

        {
            $addFields: {
                isFollowing: { $gt: [{ $size: "$isFollowing" }, 0] },
            },
        },


        //checking if user has bookmarked the post
        {
            $lookup: {
                from: "businessbookmarks", // Assuming 'bookmarks' is the collection that stores bookmark relationships
                let: { postId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$postId", "$$postId"] },
                                    { $eq: ["$bookmarkedBy", userId] },
                                ],
                            },
                        },
                    },
                    { $project: { _id: 1 } },
                ],
                as: "isBookmarkedArray",
            },
        },
        {
            $addFields: {
                isBookmarked: { $gt: [{ $size: "$isBookmarkedArray" }, 0] }, // If the post is bookmarked by the user
            },
        },

        {
            $project: {
                isFollowingArray: 0, // Remove unnecessary fields
                isBookmarkedArray: 0, // Remove unnecessary fields
            },
        },

        // getting bookmarks counts
        {
            $lookup: {
                from: "businessbookmarks",
                localField: "_id",
                foreignField: "postId",
                as: "bookmarks",
            },
        },
        {
            $addFields: {
                bookmarkCount: { $size: "$bookmarks" },
            },
        },
        {
            $project: {
                bookmarks: 0, // Remove raw bookmarks array
            },
        },

        // Lookup for User details of the products
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "userDetails",
                pipeline: [
                    {
                        $project: {
                            avatar: { $ifNull: ["$avatar.url", null] },
                            _id: 0,
                            username: 1,
                            createdAt: 1,
                            updatedAt: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: "businessprofiles",
                foreignField: "owner",
                localField: "owner",
                as: "businessProfile",
                pipeline: [
                    {
                        $project: {
                            businessName: 1,
                            businessType: 1,
                            businessDescription: 1,
                            _id: 0
                        }
                    }
                ]
            }

        },

        {
            $addFields: {
                businessProfile: { $first: "$businessProfile" }
            }
        },

        {
            $addFields: {
                userDetails: { $first: "$userDetails" }  // Get first element or null
            }
        },

    ];
};



export const getBusinessFeedPosts = asyncHandler(async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;

    console.log("[getBusinessFeedPosts] user:", req.user?._id, "page:", page);

    // ── Step 1: Get ranked product IDs from Python rec service ────
    let recommendedIds = [];
    let recSourceMap   = {};
    let rankedOrder    = {};
    let recItems       = [];

    try {
      const recResponse = await getMarketplaceRecommendations(
        req.user._id.toString(),
        limit,
        page
      );

      recItems = recResponse.items || [];

      if (recItems.length) {
        recommendedIds = recItems
          .map((r) => r.product_id)
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        recSourceMap = Object.fromEntries(recItems.map((r) => [r.product_id, r.rec_source]));
        rankedOrder  = Object.fromEntries(recItems.map((r) => [r.product_id, r.position]));
      }
    } catch (recErr) {
      console.warn("[getBusinessFeedPosts] Rec service unavailable, falling back to chronological:", recErr.message);
    }

    // ── Step 2: Build aggregation pipeline ────────────────────────
    const matchStage = recommendedIds.length
      ? [{ $match: { _id: { $in: recommendedIds } } }]
      : [];

    const recPositionStage = recommendedIds.length
      ? [{
          $addFields: {
            __recPosition: { $indexOfArray: [recommendedIds, "$_id"] },
          },
        }]
      : [];

    const productAggregation = BusinessProduct.aggregate([
      ...matchStage,
      ...recPositionStage,
      ...productPostAggregation(req),
      ...(recommendedIds.length
        ? [{ $sort: { __recPosition: 1 } }]
        : [{ $sort: { createdAt: -1 } }]
      ),
      { $project: { __recPosition: 0 } },
    ]);

    // ── Step 3: Execute ───────────────────────────────────────────
    let allProducts;

    if (recommendedIds.length) {
      // Rec active — Python already paginated, fetch exactly those products
      const raw = await productAggregation;

      // JS sort as safety net — source of truth for order
      const productIdOrder = recItems.map((r) => r.product_id);
      raw.sort((a, b) => {
        const posA = productIdOrder.indexOf(a._id.toString());
        const posB = productIdOrder.indexOf(b._id.toString());
        return posA - posB;
      });

      const posts = raw.map((product) => ({
        ...product,
        rec_source: recSourceMap[product._id.toString()] || "unknown",
        position:   rankedOrder[product._id.toString()]  ?? 0,
      }));

      allProducts = { posts, totalPosts: posts.length };
    } else {
      // Rec down — fall back to aggregatePaginate (chronological)
      allProducts = await BusinessProduct.aggregatePaginate(
        productAggregation,
        getMongoosePaginationOptions({
          page,
          limit,
          customLabels: {
            totalDocs: "totalPosts",
            docs: "posts",
          },
        })
      );
    }

    // ── Step 4: Pagination meta ───────────────────────────────────
    const totalCount = await BusinessProduct.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;

    if (!allProducts) {
      return res.status(400).json({
        success: true,
        message: "Products not available",
        data: allProducts,
      });
    }

    return res.status(200).json({
      data: allProducts,
      currentPage: page,
      totalPages: totalPages,
      hasNextPage: hasNextPage,
    });

  } catch (error) {
    console.log("Something Went wrong!!", error);
    return;
  }
});


export const getProductById = asyncHandler(async (req, res) => {

    try {

        const { productId } = req.params;

        const product = await BusinessProduct.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        const productAggregation = BusinessProduct.aggregate([
            { $match: { _id: product._id } },
            ...productPostAggregation(req),
            { $limit: 1 } // Optional: ensures only one result
        ]);

        // product will be an array with one item, so access with product[0]
        const aggregatedProduct = await productAggregation;

        return res.status(200).json({
            success: true,
            message: "Product available",
            data: aggregatedProduct
        });


    } catch (error) {
        console.log("Something went wrong", error);
        return;

    }

});

export const followBusinessPostOnwer = asyncHandler(async (req, res) => {

    try {

        const { userToBeFollowed } = req.params;

        //check if user exists
        const isUserAvailable = await User.findById(userToBeFollowed);
        if (!isUserAvailable) {
            return res.status(404).json(
                404, {
                isAvailable: false
            },
                "User does not exists"
            );
        }

        // Check if logged user is already following the to be followed user
        const isAlreadyFollowing = await SocialFollow.findOne({
            followerId: req.user._id,
            followeeId: isUserAvailable._id,
        });

        if (isAlreadyFollowing) {
            await SocialFollow.findOneAndDelete({
                followerId: req.user._id,
                followeeId: isUserAvailable._id,
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
            await SocialFollow.create({
                followerId: req.user._id,
                followeeId: isUserAvailable._id,
            });

            //create a notification
            await BusinessNotification.create({
                owner: isUserAvailable._id,
                sender: req.user._id,
                message: `${req.user.username} has started following you.`,
                avatar: req.user.avatar,
                type: 'followed',
                data: {
                    postId: "",
                    for: "business"
                },
            });

            const notifications = await BusinessNotification.aggregate([
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(isUserAvailable._id), // Assuming recipient field exists in Notification schema
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

            emitSocketEvent(req, String(isUserAvailable._id), "followed", followedNotification);

            emitUnreadCountUpdate(req, isUserAvailable._id);

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        following: false,
                    },
                    "Followed successfully"
                )
            );
        }

    } catch (error) {
        console.log("Something went wrong", error);
        return
    }

});

export const searchByCategory = asyncHandler(async (req, res) => {

    try {
        const { category } = req.params;
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query;

        if (!category || !category.trim()) {
            throw new ApiError(400, 'Category is required');
        }

        const pipeline = [
            {
                $match: {
                    category: new RegExp(`^${category.trim()}$`, 'i'),
                },
            },
            ...productPostAggregation(req), // Add the product post aggregation
            {
                $sort: {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1,
                },
            },
        ];

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            customLabels: {
                docs: 'posts',
                totalDocs: 'totalPosts',
            },
        };

        const result = await BusinessProduct.aggregatePaginate(
            BusinessProduct.aggregate(pipeline),
            options
        );

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    posts: result.posts,
                    currentPage: result.page,
                    totalPages: result.totalPages,
                    totalPosts: result.totalPosts,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage,
                },
                `Products in category '${category}' retrieved successfully`
            )
        );

    } catch (error) {
        console.log("Something went wrong", error);
        return;
    }
});

