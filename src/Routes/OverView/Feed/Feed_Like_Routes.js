import { Router } from "express";

import {
  likeDislikeFeedPost,
  likeDislikeFeedComment,
  likeDislikeFeedCommentReply,
  getLikedPosts,
} from "../../../controllers/apps/feed/feed_like.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

//  Add GET route for fetching liked posts (MUST come before /:postId)
router.route("/").get(verifyJWT, getLikedPosts);

// Existing like/unlike post route
router
  .route("/:postId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("postId"),
    validate,
    likeDislikeFeedPost
  );

// Like/unlike comment
router
  .route("/comment/:commentId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("commentId"),
    validate,
    likeDislikeFeedComment
  );

// Like/unlike comment reply
router
  .route("/comment/reply/:commentReplyId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("commentReplyId"),
    validate,
    likeDislikeFeedCommentReply
  );

export default router;