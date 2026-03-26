

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