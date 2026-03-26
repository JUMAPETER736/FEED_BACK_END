import mongoose, { Schema } from 'mongoose';

const TransactionSchema = new Schema({
    // transactionId is auto-generated as MongoDB _id
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'BoostCampaign', index: true },

    type: {
        type: String,
        enum: ['boost_payment', 'adjustment'],
        required: true
    },

    amount: { type: Number, required: true },
    currency: { type: String, default: 'MWK' },

    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },

    // Mobile payment specific fields
    mobilePayment: {
        provider: {
            type: String,
            enum: ['TNM_Mpamba','airtel_money']
        },
        transactionReference: String,
        phoneNumber: String, // For mobile money
        confirmationCode: String
    },

    paymentMethod: {
        paymentMethodId: String,
        type: {
            type: String,
            enum: ['card', 'mobile_money', 'bank_transfer']
        },
        last4: String,
        brand: String
    },

    paymentProcessor: {
        processor: String,
        processorTransactionId: String,
        processorResponse: Schema.Types.Mixed,
        processorFee: Number
    },

    breakdown: {
        adSpend: Number,
        platformFee: Number,
        processingFee: Number,
        tax: Number,
        discount: Number,
        total: Number
    },

    billing: {
        invoiceId: String,
        invoiceUrl: String,
        receiptUrl: String // For mobile app to display
    },

    refund: {
        refundTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        refundAmount: Number,
        refundReason: String,
        refundType: { type: String, enum: ['full', 'partial'] },
        refundedAt: Date
    },

    metadata: {
        deviceInfo: {
            platform: String, // 'android'
            osVersion: String,
            appVersion: String,
            deviceModel: String
        },
        ipAddress: String,
        userAgent: String
    },

    initiatedAt: { type: Date, default: Date.now },
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
    failureReason: String,
    failureCode: String,

    retryInfo: {
        attemptCount: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 3 },
        nextRetryAt: Date
    },


}, { timestamps: true });


export const Transaction = mongoose.model('Transaction', TransactionSchema);