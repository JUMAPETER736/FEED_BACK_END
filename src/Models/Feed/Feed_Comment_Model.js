import mongoose, { Schema } from "mongoose";
import { User } from "../auth/user.models.js";
import { FeedPost } from "./feed.model.js";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      // required: true,
    },
    contentType: {
      type: String,
      // required: true,
    },
    localUpdateId: {
      type: String,
      // required: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "FeedPost",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    duration: {
      type: String,
    },
    fileType: {
      type: String,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: String,
    },
    numberOfPages: {
      type: String,
    },
    audios: {
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
          url: String,
          localPath: String,
        },
      ],
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
    videos: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
    docs: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
    gifs: {
      type: String,
    },
  },
  { timestamps: true }
);

commentSchema.plugin(mongooseAggregatePaginate);

export const FeedComment = mongoose.model("FeedComment", commentSchema);
