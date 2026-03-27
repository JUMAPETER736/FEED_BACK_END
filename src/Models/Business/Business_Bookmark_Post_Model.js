import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const bookmarkSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessProduct",
    },
    bookmarkedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

bookmarkSchema.plugin(mongooseAggregatePaginate);

export const BusinessBookmark = mongoose.model("BusinessBookmark", bookmarkSchema);
