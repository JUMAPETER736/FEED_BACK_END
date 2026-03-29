import { Router } from "express";
import {
  toggleRepost,
  getUserReposts,
  getRepostedPosts,
} from "../../../controllers/apps/feed/feed_repost.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

// Toggle repost (create or delete) - matches like/bookmark pattern
router
  .route("/:postId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("postId"),
    validate,
    toggleRepost
  );

// Get user's reposts (legacy endpoint - simple list)
router
  .route("/user")
  .get(
    verifyJWT,
    getUserReposts
  );

// Get reposted posts with full feed structure (NEW - matches pattern)
router
  .route("/")
  .get(
    verifyJWT,
    getRepostedPosts
  );

export default router;