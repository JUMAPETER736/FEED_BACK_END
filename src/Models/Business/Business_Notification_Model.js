import mongoose, { Schema } from "mongoose";

const businessNotificationSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: String,
    },
    avatar: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    read: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String, // E.g., "reply", "comment", "like", "follow", "system", etc.
      required: true,
    },
    data: {
      type: Schema.Types.Mixed, // Stores type-specific data
    },
  },
  { timestamps: true }
);

export const BusinessNotification = mongoose.model("BusinessNotification", businessNotificationSchema);
