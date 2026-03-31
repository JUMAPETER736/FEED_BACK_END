
import { EcomOrder }   from "../../../Models/Ecommerce/Order_Model.js";
import { EcomProfile } from "../../../Models/Ecommerce/Profile_Model.js";
import { ApiResponse }  from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
import { getMongoosePaginationOptions } from "../../../Utils/Helpers.js";


const getMyEcomProfile = asyncHandler(async (req, res) => {
  let profile = await EcomProfile.findOne({
    owner: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, profile, "User profile fetched successfully"));
});

const updateEcomProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phoneNumber, countryCode } = req.body;
  const profile = await EcomProfile.findOneAndUpdate(
    {
      owner: req.user._id,
    },
    {
      $set: {
        firstName,
        lastName,
        phoneNumber,
        countryCode,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, profile, "User profile updated successfully"));
});

const getMyOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const orderAggregate = EcomOrder.aggregate([
    {
      // Get orders associated with the user
      $match: {
        customer: req.user._id,
      },
    },
    {
      $lookup: {
        from: "addresses",
        localField: "address",
        foreignField: "_id",
        as: "address",
      },
    },
    // lookup for a customer associated with the order
    {
      $lookup: {
        from: "users",
        localField: "customer",
        foreignField: "_id",
        as: "customer",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              email: 1,
            },
          },
        ],
      },
    },
    // lookup for a coupon applied while placing the order
    {
      $lookup: {
        from: "coupons",
        foreignField: "_id",
        localField: "coupon",
        as: "coupon",
        pipeline: [
          {
            $project: {
              name: 1,
              couponCode: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        customer: { $first: "$customer" },
        address: { $first: "$address" },
        coupon: { $ifNull: [{ $first: "$coupon" }, null] },
        totalOrderItems: { $size: "$items" },
      },
    },
    {
      $project: {
        items: 0,
      },
    },
  ]);

  const orders = await EcomOrder.aggregatePaginate(
    orderAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalOrders",
        docs: "orders",
      },
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

export { getMyEcomProfile, updateEcomProfile, getMyOrders };
