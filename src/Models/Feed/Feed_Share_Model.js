import mongoose from 'mongoose';
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const { Schema } = mongoose;

// Schema for Share
const FeedShareSchema = new Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FeedPost',
            required: true,
            index: true,
        },
        sharedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        shareMethod: {
            type: String,
            enum: ['copy_link', 'social_media', 'direct_message', 'other'],
            default: 'other',
        },
        shareNote: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

// Compound index to prevent duplicate shares from same user (optional)
// If you want to allow multiple shares, remove this index
FeedShareSchema.index({ postId: 1, sharedBy: 1 }, { unique: true });

FeedShareSchema.plugin(mongooseAggregatePaginate);

export const FeedShare = mongoose.model('FeedShare', FeedShareSchema);