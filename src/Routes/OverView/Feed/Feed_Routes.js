import { Router } from "express";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../constants.js";
import {
  createFeed,
  getAllFeed,
  getFeed,
  getMyFeed,
  deleteFeedPost,
  getFeedPostsByUsername,
  getRepostedPosts,
  getSearchAllFeedByUserId,
  getSearchAllFeed,
  clickedBookmark,
  getBookMarkedPosts,
  getPostById,
} from "../../../controllers/apps/feed/feed.controllers.js";

//  Import toggleRepost from its own controller file
import {
  toggleRepost,
  getUserReposts,
} from "../../../controllers/apps/feed/feed_repost.controllers.js";

import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../middlewares/auth.middlewares.js";
import { upload } from "../../../middlewares/multer.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();


// SEARCH
router.route("/search").get(verifyJWT, getSearchAllFeed);
router.route("/user/:username").get(verifyJWT, getSearchAllFeedByUserId);


// MAIN FEED  (GET = paginated feed, POST = create post)

router
  .route("/")
  .get(getLoggedInUserOrIgnore, getAllFeed)
  .post(
    verifyJWT,
    upload.fields([
      { name: "files", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "feed_thumbnail", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
    ]),
    validate,
    createFeed
  );


// AUTHENTICATED FEED  (the getFeed pipeline with full repost counts)

router.route("/test").get(verifyJWT, getFeed);


// MY FEED

router.route("/get/my").get(verifyJWT, getMyFeed);


// POSTS BY USERNAME

router.route("/get/u/:username").get(
  getLoggedInUserOrIgnore,
  validate,
  getFeedPostsByUsername
);


// BOOKMARKS

router.route("/bookmark/:postId").post(verifyJWT, clickedBookmark);
router.route("/bookmarks").get(verifyJWT, getBookMarkedPosts);


// REPOSTS

router
  .route("/repost/:postId")
  .post(verifyJWT, toggleRepost);   

router
  .route("/repost")
  .get(verifyJWT, getRepostedPosts);   

router
  .route("/repost/user")
  .get(verifyJWT, getUserReposts);       


// SINGLE POST BY ID

router
  .route("/one/:postId")
  .get(
    verifyJWT,
    mongoIdPathVariableValidator("postId"),
    getPostById
  );


// DELETE POST

router
  .route("/:postId")
  .delete(
    verifyJWT,
    mongoIdPathVariableValidator("postId"),
    validate,
    deleteFeedPost
  );

export default router;