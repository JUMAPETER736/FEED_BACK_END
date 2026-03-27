import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
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
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
