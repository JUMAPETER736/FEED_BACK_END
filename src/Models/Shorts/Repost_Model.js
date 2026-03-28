import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const repostSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "SocialPost",
      required: true,
    },
    repostedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

repostSchema.plugin(mongooseAggregatePaginate);

export const SocialRepost = mongoose.model("SocialRepost", repostSchema);