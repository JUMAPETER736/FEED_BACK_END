import mongoose, { Schema } from "mongoose";

const replyNotificationSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post", // Reference to the Post model
      required: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment", // Reference to the Comment model
    },
    replyId: {
      type: Schema.Types.ObjectId,
      ref: "Reply", // Reference to the Reply model
      required: true, // Ensure replyId is required
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
const ReplyNotification = mongoose.model("ReplyNotification", replyNotificationSchema);

export default ReplyNotification;
