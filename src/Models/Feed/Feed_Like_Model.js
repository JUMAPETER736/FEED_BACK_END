import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"; // ✅ Add this import

const likeSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "FeedPost",
      default: null,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "FeedComment",
      default: null,
    },
    commentReplyId: {
      type: Schema.Types.ObjectId,
      ref: "FeedCommentReply",
      default: null,
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
likeSchema.index({ postId: 1, likedBy: 1 });
likeSchema.index({ commentId: 1, likedBy: 1 });
likeSchema.index({ commentReplyId: 1, likedBy: 1 });

// Ensure only one of postId, commentId, or commentReplyId is set
likeSchema.pre("save", function (next) {
  const fieldsSet = [this.postId, this.commentId, this.commentReplyId].filter(
    (field) => field !== null
  ).length;

  if (fieldsSet !== 1) {
    next(
      new Error("Exactly one of postId, commentId, or commentReplyId must be set")
    );
  } else {
    next();
  }
});

likeSchema.plugin(mongooseAggregatePaginate);

export const FeedLike = mongoose.model("FeedLike", likeSchema);