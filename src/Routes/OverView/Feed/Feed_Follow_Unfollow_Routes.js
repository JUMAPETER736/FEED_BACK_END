import { Router } from "express";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import {
  followUnFollowPost,
  deleteFollowFeed,
  getById,
} from "../../../controllers/apps/feed/followUnfollow.controllers.js"; // Update this path as needed
import { validate } from "../../../validators/validate.js";
import { getFollowedPosts } from "../../../controllers/apps/feed/feed.controllers.js"; // Update this path as needed
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

router.use(verifyJWT);

// Route to get followed posts
router.route("/").get(getFollowedPosts); // getFollowedPosts controller is present in posts controller due to utility function dependency

// Route to follow/unfollow a post
router
  .route("/:postId")
  .post(
    mongoIdPathVariableValidator("postId"),
    validate,
    followUnFollowPost
  );

// Route to delete a follow entry
router.route("/delete/:followId").delete(deleteFollowFeed);

// Route to get follow entry by ID
router.route("/getbyid/:_id").get(getById);

export default router;
