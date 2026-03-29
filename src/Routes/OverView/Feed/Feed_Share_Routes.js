import { Router } from "express";
import {
    toggleShare,
    getUserShares,
    getPostShares,
    getSharedPosts,
} from "../../../controllers/apps/feed/feed_share.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

// Toggle share (create or delete) - matches like/bookmark/repost pattern
router
    .route("/:postId")
    .post(
        verifyJWT,
        mongoIdPathVariableValidator("postId"),
        validate,
        toggleShare
    );

// Get user's shares (legacy endpoint - simple list)
router
    .route("/user")
    .get(
        verifyJWT,
        getUserShares
    );

// Get all shares for a specific post
router
    .route("/post/:postId")
    .get(
        verifyJWT,
        mongoIdPathVariableValidator("postId"),
        validate,
        getPostShares
    );

// Get shared posts with full feed structure (NEW - matches pattern)
router
    .route("/")
    .get(
        verifyJWT,
        getSharedPosts
    );

export default router;