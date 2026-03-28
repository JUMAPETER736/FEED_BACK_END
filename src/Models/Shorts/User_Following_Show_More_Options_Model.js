import mongoose, { Schema } from "mongoose";

/* ==================== CLOSE FRIENDS MODEL ==================== */
const closeFriendsSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        closeFriendId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

closeFriendsSchema.index({ userId: 1, closeFriendId: 1 }, { unique: true });

export const SocialCloseFriends = mongoose.model(
    "SocialCloseFriends",
    closeFriendsSchema
);

/* ==================== MUTED POSTS MODEL ==================== */
const mutedPostsSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        mutedUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

mutedPostsSchema.index({ userId: 1, mutedUserId: 1 }, { unique: true });

export const SocialMutedPosts = mongoose.model(
    "SocialMutedPosts",
    mutedPostsSchema
);

/* ==================== MUTED STORIES MODEL ==================== */
const mutedStoriesSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        mutedUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

mutedStoriesSchema.index({ userId: 1, mutedUserId: 1 }, { unique: true });

export const SocialMutedStories = mongoose.model(
    "SocialMutedStories",
    mutedStoriesSchema
);

/* ==================== FAVORITES MODEL ==================== */
const favoritesSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        favoriteUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

favoritesSchema.index({ userId: 1, favoriteUserId: 1 }, { unique: true });

export const SocialFavorites = mongoose.model(
    "SocialFavorites",
    favoritesSchema
);

/* ==================== RESTRICTED MODEL ==================== */
const restrictedSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        restrictedUserId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

restrictedSchema.index({ userId: 1, restrictedUserId: 1 }, { unique: true });

export const SocialRestricted = mongoose.model(
    "SocialRestricted",
    restrictedSchema
);