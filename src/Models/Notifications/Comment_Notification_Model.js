import mongoose, { Schema } from "mongoose";

const commentNotificationSchema = new Schema(
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

const CommentNotification = mongoose.model("CommentNotification", commentNotificationSchema);

export default CommentNotification;
