import mongoose, { Schema } from "mongoose";
import { User } from "../auth/user.models.js";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Define the schema for an individual duration object
const durationSchema = new Schema(
  {
    duration: String,
    fileId: String,
  },
  {
    _id: false, // Disable automatic _id field for subdocuments
  }
);

const numberOfPagesSchema = new Schema(
  {
    numberOfPage: String,
    fileId: String,
  },
  {
    _id: false, // Disable automatic _id field for subdocuments
  }
);

const fileNameSchema = new Schema(
  {
    fileId: String,
    fileName: String,
  },
  {
    _id: false, // Disable automatic _id field for subdocuments
  }
);

const fileTypeSchema = new Schema(
  {
    fileType: String,
    fileId: String,
  },
  {
    _id: false, // Disable automatic _id field for subdocuments
  }
);

const fileSizeSchema = new Schema(
  {
    fileId: String,
    fileSize: String,
  },
  {
    _id: false, // Disable automatic _id field for subdocuments
  }
);

const FileIdSchema = new Schema(
  {
    type: String,
  },
  {
    _id: false, // Disable automatic _id field for subdocuments
  }
);



const feedSchema = new Schema(
  {
    content: {
      type: String,
      index: true,
    },
    duration: {
      type: [durationSchema], // Use the subdocument schema here
      default: [],
    },
    feedShortsBusinessId: {
      type: String,
      default: null
    },
    tags: {
      type: [String],
      default: [],
    },
    contentType: {
      type: String,
      index: true,
    },
    numberOfPages: {
      type: [numberOfPagesSchema],
      default: [],
    },
    fileNames: {
      type: [fileNameSchema],
      default: [],
    },
    fileTypes: {
      type: [fileTypeSchema],
      default: [],
    },
    fileSizes: {
      type: [fileSizeSchema],
      default: [],
    },
    files: {
      type: [
        {
          fileId: String,
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
    fileIds: {
      type: [], // An array of FileIdSchema objects
      default: [], // Default value is an empty array
    },
    thumbnail: {
      type: [
        {
          fileId: String,
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
    // new code added here
    originalPostId: {
      type: Schema.Types.ObjectId, // Reference to the original post being retweeted
      ref: "FeedPost",
      default: null,
    },


    isReposted: {
      type: Boolean,
      default: false, // Flag indicating whether this post is a retweet
    },

    repostedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    repostedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],



  },

  { timestamps: true }
);



feedSchema.plugin(mongooseAggregatePaginate);



export const FeedPost = mongoose.model("FeedPost", feedSchema);
