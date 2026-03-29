import { Router } from "express";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import {
  deleteBookmarkFeed,
  getById,
} from "../../../controllers/apps/feed/feed_bookmark.controllers.js";
import { validate } from "../../../validators/validate.js";
import {
  getBookMarkedPosts,
  clickedBookmark
} from "../../../controllers/apps/feed/feed.controllers.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

router.use(verifyJWT);

// GET all bookmarked posts
router.route("/").get(getBookMarkedPosts);

// POST to bookmark/unbookmark a post
router.route("/:postId").post(
  mongoIdPathVariableValidator("postId"),
  validate,
  clickedBookmark  // ← Use clickedBookmark instead
);

router.route("/delete/:bookmarkId").delete(deleteBookmarkFeed);

router.route("/getbyid/:_id").get(getById);

export default router;