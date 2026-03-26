import mongoose, { Schema } from 'mongoose';

const BoostCampaignSchema = new Schema({
    // campaignId is auto-generated as MongoDB _id
    userId: {
        type: Schema.Types.ObjectId,
        required: true, ref: 'User',
        index: true
    },

    productId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'BusinessProduct',
        index: true
    },

    campaignName: String,

    objective: {
        type: String,
        enum: ['awareness', 'engagement', 'messages_received'],
        required: true
    },

    status: {
        type: String,
        enum: [
            'draft', 'pending_payment', 'payment_processing', 'payment_failed',
            'pending_review', 'approved', 'active', 'paused', 'completed',
            'rejected', 'cancelled'
        ],
        default: 'draft',
        index: true
    },

    enableMakeCallStatus: {
        type: Boolean,
        default: false
    },

    payment: {
        required: { type: Boolean, default: true },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', index: true },
        paidAmount: { type: Number, default: 0 },
        paidAt: Date,
        paymentStatus: {
            type: String,
            enum: ['not_paid', 'processing', 'paid', 'failed'],
            default: 'not_paid',
            index: true
        },
        refundTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        refundedAmount: Number,
        refundedAt: Date,
        refundReason: String
    },

    schedule: {
        startDate: { type: Date, required: true },      // Auto-calculated from payment completion
        endDate: { type: Date, required: true },        // Auto-calculated: startDate + duration
        timezone: { type: String, default: 'UTC' },
        actualStartDate: Date,                          // When campaign actually started running
        actualEndDate: Date                             // When campaign actually ended
    },

    duration: {
        days: { type: Number, required: true, min: 1, max: 90 },
    },

    budget: {
        totalBudget: { type: Number, required: true, min: 0 },
        dailyBudget: Number,
        currency: { type: String, default: 'MWK' },
        spentAmount: { type: Number, default: 0 },
        remainingBudget: { type: Number, default: 0 }
    },

    workflow: {
        draftCreatedAt: Date,
        paymentInitiatedAt: Date,
        paymentCompletedAt: Date,
        reviewSubmittedAt: Date,
        approvedAt: Date,
        activatedAt: Date,
        pausedAt: Date,
        completedAt: Date
    },

}, { timestamps: true });

export const BoostCampaign = mongoose.model('BoostCampaign', BoostCampaignSchema);