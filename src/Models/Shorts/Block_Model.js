import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const blockSchema = new Schema(
    {
        blockerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        blockedId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    { timestamps: true }
);

// Compound index to prevent duplicate blocks and optimize queries
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

blockSchema.plugin(mongooseAggregatePaginate);

export const SocialBlock = mongoose.model("SocialBlock", blockSchema);