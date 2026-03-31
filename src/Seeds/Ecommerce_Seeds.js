


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

// Generate fake coupons
const coupons = new Array(COUPONS_COUNT).fill("_").map(() => {
  const discountValue = faker.number.int({
    max: 1000,
    min: 100,
  });

  return {
    name: faker.lorem.word({
      length: {
        max: 15,
        min: 8,
      },
    }),
    couponCode:
      faker.lorem.word({
        length: {
          max: 8,
          min: 5,
        },
      }) + `${discountValue}`,
    discountValue: discountValue,
    isActive: faker.datatype.boolean(),
    minimumCartValue: discountValue + 300,
    startDate: faker.date.anytime(),
    expiryDate: faker.date.future({
      years: 3,
    }),
  };
});

// Generate fake products
const products = new Array(PRODUCTS_COUNT).fill("_").map(() => {
  return {
    // Add other fields which are connected to other models later
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    mainImage: {
      url: faker.image.urlLoremFlickr({
        category: "product",
      }),
      localPath: "",
    },
    price: +faker.commerce.price({ dec: 0, min: 200, max: 500 }),
    stock: +faker.commerce.price({ dec: 0, min: 10, max: 200 }),
    subImages: new Array(PRODUCTS_SUB_IMAGES_COUNT).fill("_").map(() => ({
      url: faker.image.urlLoremFlickr({
        category: "product",
      }),
      localPath: "",
    })),
  };
});



const orders = new Array(ORDERS_COUNT).fill("_").map(() => {
  const paymentProvider =
    AvailablePaymentProviders[
      getRandomNumber(AvailablePaymentProviders.length)
    ];
  return {
    // Add other fields which are connected to other models later
    status:
      AvailableOrderStatuses[getRandomNumber(AvailableOrderStatuses.length)],
    paymentProvider: paymentProvider === "UNKNOWN" ? "PAYPAL" : paymentProvider, // Avoid setting UNKNOWN payment provider
    paymentId: faker.string.alphanumeric({
      casing: "mixed",
      length: 24,
    }),
    isPaymentDone: true,
  };
});

const seedEcomProfiles = async () => {
  const profiles = await EcomProfile.find();
  const ecomProfileUpdatePromise = profiles.map(async (profile) => {
    await EcomProfile.findByIdAndUpdate(profile._id, {
      $set: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        countryCode: "+91",
        phoneNumber: faker.phone.number("9#########"),
      },
    });
  });
  await Promise.all(ecomProfileUpdatePromise);
};

const seedEcomCategories = async (owner) => {
  await Category.deleteMany({});
  await Category.insertMany(
    categories.map((cat) => ({ ...cat, owner: owner }))
  );
};

const seedEcomAddresses = async () => {
  const users = await User.find();
  await Address.deleteMany({});
  await Address.insertMany(
    addresses.map((add, i) => {
      return {
        ...add,
        owner: users[i] ?? users[getRandomNumber(users.length)], // set address to every user and then set random user as a owner
      };
    })
  );
};