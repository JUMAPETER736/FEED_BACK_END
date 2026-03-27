import mongoose from "mongoose";
const { Schema } = mongoose;
import { User } from "../auth/user.models.js";

const businessSchema = new Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      required: true,
      trim: true,
    },
    businessDescription: {
      type: String,
      required: true,
      trim: true,
    },
    contact: {
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      phoneNumber: {
        type: String,
        required: true,
        trim: true,
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      website: {
        type: String,
        required: false,
        trim: true,
      },
    },
    location: {
      businessLocation: {
        enabled: {
          type: Boolean,
          default: true,
        },
        locationInfo: {
          // type: String,
          // required: true,
          // trim: true,
          latitude: {
            type: String,
            trim: true,
          },
          longitude: {
            type: String,
            trim: true,
          },
          accuracy: {
            type: String,
            trim: true,
          },
          range: {
            type: String,
            trim: true,
          },
        },
      },
      walkingBillboard: {
        enabled: {
          type: Boolean,
          default: false,
        },
        liveLocationInfo: {
          // type: String,
          // trim: true,
          latitude: {
            type: String,
            trim: true,
          },
          longitude: {
            type: String,
            trim: true,
          },
          accuracy: {
            type: String,
            trim: true,
          },
          range: {
            type: String,
            trim: true,
          },
        },
      },
    },
    businessCatalogue: [
      {
        itemName: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          required: true,
          trim: true,
        },
        features: [
          {
            type: String,
            trim: true,
          },
        ],
      },
    ],
    backgroundPhoto: {
      url: {
        type: String,
        required: true,
        trim: true,
      },
    },
    backgroundVideo: {
      url: {
        type: String,
        required: false,
        trim: true,
      },
      thumbnail: {
        type: String,
        trim: true,
      },
    },
  },
  { timestamps: true }
);

export const BusinessProfile = mongoose.model(
  "BusinessProfile",
  businessSchema
);
