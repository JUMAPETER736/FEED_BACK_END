import mongoose from 'mongoose';
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const { Schema } = mongoose;

// Schema for Repost
const FeedRepostSchema = new Schema(
  {
    originalPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedPost',
      required: true,
      index: true,
    },
    repostedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    repostComment: {
      type: String,
      default: '',
    },
    originalContent: {
      type: String,
      default: '',
    },
    originalTags: {
      type: [String],
      default: [],
    },
    originalComments: {
      type: Number,
      default: 0,
    },
    originalAuthorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalLikes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);


FeedRepostSchema.index({ originalPostId: 1, repostedByUserId: 1 });

FeedRepostSchema.plugin(mongooseAggregatePaginate);

export const FeedRepost = mongoose.model('FeedRepost', FeedRepostSchema);