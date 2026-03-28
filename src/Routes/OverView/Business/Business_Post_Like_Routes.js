import { Router } from "express";
import { 
     likeandDislikeBusinessPost,
     likeAndDislikeBusinessComment, 
     likeAndDislikeBusinessCommentReply,
    } from "../../../../controllers/apps/business/businesspost/business.post.like.controller.js";
import { verifyJWT } from "../../../../middlewares/auth.middlewares.js";
import { validate } from "../../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../../validators/common/mongodb.validators.js";


const router = Router();

router
  .route("/:businessPostId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("businessPostId"),
    validate,
    likeandDislikeBusinessPost
  );

router
  .route("/comment/:commentId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("commentId"),
    validate,
    likeAndDislikeBusinessComment
  );

router
  .route("/comment/reply/:commentReplyId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("commentReplyId"),
    validate,
    likeAndDislikeBusinessCommentReply,
  );

export default router;
