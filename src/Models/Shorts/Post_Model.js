import mongoose, { Schema } from "mongoose";
import { User } from "../auth/user.models.js";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const postSchema = new Schema(
  {
    content: {
      type: String,
      // required: true,
      index: true,
    },
    fileId: {
      type: String,
    },
    feedShortsBusinessId: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
    },
    images: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
    thumbnail: {
      type: [
        {
          thumbnailUrl: String,
          thumbnailLocalPath: String,
        },
      ],
      default: [],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },

  { timestamps: true }
);

postSchema.plugin(mongooseAggregatePaginate);

export const SocialPost = mongoose.model("SocialPost", postSchema);
