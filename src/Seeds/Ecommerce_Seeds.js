


import { faker } from "@faker-js/faker";
import {
  AvailableOrderStatuses,
  AvailablePaymentProviders,
  UserRolesEnum,
} from "../Constants.js";
import { User } from "../Models/apps/auth/user.models.js";
import { Address } from "../models/apps/ecommerce/address.models.js";
import { Category } from "../models/apps/ecommerce/category.models.js";
import { Coupon } from "../models/apps/ecommerce/coupon.models.js";
import { EcomOrder } from "../models/apps/ecommerce/order.models.js";
import { Product } from "../models/apps/ecommerce/product.models.js";
import { EcomProfile } from "../models/apps/ecommerce/profile.models.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { getRandomNumber } from "../Utils/Helpers.js";
import {
  ADDRESSES_COUNT,
  CATEGORIES_COUNT,
  COUPONS_COUNT,
  ORDERS_COUNT,
  ORDERS_RANDOM_ITEMS_COUNT,
  PRODUCTS_COUNT,
  PRODUCTS_SUB_IMAGES_COUNT,
} from "./_constants.js";



// Generate fake categories
const categories = new Array(CATEGORIES_COUNT).fill("_").map(() => ({
  name: faker.commerce.productAdjective().toLowerCase(),
}));

// Generate fake addresses
const addresses = new Array(ADDRESSES_COUNT).fill("_").map(() => ({
  addressLine1: faker.location.streetAddress(),
  addressLine2: faker.location.street(),
  city: faker.location.city(),
  country: faker.location.country(),
  pincode: faker.location.zipCode("######"),
  state: faker.location.state(),
}));