import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const FeedFollowSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
    },
    followedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);
FeedFollowSchema.plugin(mongooseAggregatePaginate);


export const FeedFollowUnfollow = mongoose.model("FeedFollowUnfollow", FeedFollowSchema);
