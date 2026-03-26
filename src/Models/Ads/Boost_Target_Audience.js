import mongoose, { Schema } from 'mongoose';

const BoostAudienceTargetSchema = new Schema({
    campaignId: { type: String, required: true, ref: 'BoostCampaign', index: true },

    // Geographic Targeting
    locations: {
        included: [{
            type: { type: String, enum: ['country', 'region', 'city', 'geo_market'] },
            key: String, // country code, city id, etc.
            name: String,
            radius: Number, // for radius targeting in km
            radiusUnit: { type: String, enum: ['km', 'mi'] }
        }],
        excluded: [{
            type: String,
            key: String,
            name: String
        }]
    },

    // Demographic Targeting
    demographics: {
        ageMin: { type: Number, min: 18, max: 65 },
        ageMax: { type: Number, min: 18, max: 65 },
        genders: [{ type: String, enum: ['male', 'female', 'all'] }]
    },

    // Interest Targeting
    interests: [{
        interestId: String,
        name: String,
        category: String
    }],

    // Estimated Audience
    estimatedReach: {
        min: Number,
        max: Number,
        lastUpdated: Date
    },

}, { timestamps: true });


export const TargetAudience = mongoose.model("TargetAudience", BoostAudienceTargetSchema);