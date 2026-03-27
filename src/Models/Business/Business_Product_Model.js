import mongoose, { Schema } from 'mongoose';
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { type } from 'os';

const businessProductSchema = new Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  catalogue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCatalogue',
    required: true,
  },
  itemName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  features: [
    {
      type: String,
      trim: true,
    },
  ],
  images: [
    {
      type: String,
      trim: true,
    },
  ],
  price: {
    type: String,
    trim: true,
    default: 'free'
  },
  category: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

businessProductSchema.plugin(mongooseAggregatePaginate);

export const BusinessProduct = mongoose.model('BusinessProduct', businessProductSchema);

