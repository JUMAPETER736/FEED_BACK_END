import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const gifSchema = new Schema(
  {
    fileType: {
      type: String,
    },
    gifs: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

gifSchema.plugin(mongooseAggregatePaginate);

export const Gif = mongoose.model("Gif", gifSchema);
