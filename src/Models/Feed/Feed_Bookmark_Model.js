import mongoose, { Schema } from "mongoose";
import { User } from "../auth/user.models.js";
import { FeedPost } from "./feed.model.js";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const bookmarkSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "FeedPost",
    },
    bookmarkedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

bookmarkSchema.plugin(mongooseAggregatePaginate);

export const FeedBookmark = mongoose.model("FeedBookmark", bookmarkSchema);
