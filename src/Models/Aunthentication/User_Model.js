

import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose, { Schema } from "mongoose";

import {

  AvailableSocialLogins,
  AvailableUserRoles,
  USER_TEMPORARY_TOKEN_EXPIRY,
  UserLoginType,
  UserRolesEnum,

} from "../../../constants.js";

import { Cart } from "../ecommerce/cart.models.js";
import { EcomProfile } from "../ecommerce/profile.models.js";
import { SocialProfile } from "../social-media/profile.models.js";

const userSchema = new Schema(

  {
    avatar: {

      type: {
        url: String,
        localPath: String,
      },

      default: {
        url: `https://via.placeholder.com/200x200.png`,
        localPath: "",
      },

    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    role: {
      type: String,
      enum: AvailableUserRoles,
      default: UserRolesEnum.USER,
      required:
        true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    loginType: {
      type: String,
      enum: AvailableSocialLogins,
      default: UserLoginType.EMAIL_PASSWORD,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    refreshToken: {
      type: String,
    },

    forgotPasswordToken: {
      type: String,
    },

    forgotPasswordExpiry: {
      type: Date,
    },

    emailVerificationToken: {
      type: String,
    },

    emailVerificationExpiry: {
      type: Date,
    },


    // OTP-BASED PASSWORD RESET FIELDS
    resetPasswordToken: {
      type: String,
    },

    resetPasswordExpire: {
      type: Date,
    },

    resetOTP: {
      type: String,
    },

    resetOTPExpire: {
      type: Date,
    },

  },

  { timestamps: true }
);


userSchema.pre("save", async function (next) {
  //Update LastSeen
  this.lastSeen = new Date();

  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.post("save", async function (user, next) {

  // ! Generally, querying data on every user save is not a good idea and not necessary when you are working on a specific application which has concrete models which are tightly coupled
  // ! However, in this application this user model is being referenced in many loosely coupled models so we need to do some initial setups before proceeding to make sure the data consistency and integrity
  const ecomProfile = await EcomProfile.findOne({ owner: user._id });
  const socialProfile = await SocialProfile.findOne({ owner: user._id });
  const cart = await Cart.findOne({ owner: user._id });

  // Setup necessary ecommerce models for the user
  if (!ecomProfile) {
    await EcomProfile.create({
      owner: user._id,
    });
  }
  if (!cart) {
    await Cart.create({
      owner: user._id,
      items: [],
    });
  }

  // Setup necessary social media models for the user
  if (!socialProfile) {
    await SocialProfile.create({
      owner: user._id,
    });
  }
  next();
});