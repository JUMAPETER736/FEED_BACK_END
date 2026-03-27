import mongoose, { Schema } from 'mongoose';

const businessCatalogueSchema = new Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  businessProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile',
    required: true,
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProduct',
  }],
}, { timestamps: true });

export const BusinessCatalogue = mongoose.model('BusinessCatalogue', businessCatalogueSchema);
