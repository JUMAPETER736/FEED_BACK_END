import mongoose, { Schema } from "mongoose";
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
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "FeedComment", //prev their was SocialComment
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

export const FeedCommentReply = mongoose.model(
  "FeedCommentReply",
  commentSchema
);
