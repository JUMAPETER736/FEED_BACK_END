import mongoose, { Schema } from "mongoose";

const businessLikeSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessProduct",
      default: null,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessComment",
      default: null,
    },
    commentReplyId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessCommentReply",
      default: null,
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const BusinessFeedLike = mongoose.model("BusinessFeedLike", businessLikeSchema);