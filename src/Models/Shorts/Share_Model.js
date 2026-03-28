import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const shareSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "SocialPost",
      required: true,
    },
    sharedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

shareSchema.plugin(mongooseAggregatePaginate);

export const SocialShare = mongoose.model("SocialShare", shareSchema);