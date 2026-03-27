import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const businessCommentSchema = new Schema(
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
      ref: "BusinessProduct",
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

businessCommentSchema.plugin(mongooseAggregatePaginate);

export const BusinessComment = mongoose.model("BusinessComment", businessCommentSchema);