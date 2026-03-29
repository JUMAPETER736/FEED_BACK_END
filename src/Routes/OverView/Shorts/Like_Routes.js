import { Router } from "express";
import {
  likeDislikeComment,
  likeDislikePost,
  likeDislikeCommentReply,
} from "../../../controllers/apps/social-media/like.controllers.js";
import {
  getLikedPosts,
} from "../../../controllers/apps/social-media/post.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getLikedPosts);

router.route("/liked-posts").get(getLikedPosts);

router.route("/post/:postId").post(mongoIdPathVariableValidator("postId"), validate, likeDislikePost);

router.route("/comment/:commentId").post(mongoIdPathVariableValidator("commentId"), validate, likeDislikeComment);

router.route("/comment/reply/:commentReplyId").post(mongoIdPathVariableValidator("commentReplyId"), validate, likeDislikeCommentReply);

export default router;