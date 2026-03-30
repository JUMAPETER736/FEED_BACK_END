import { Router } from "express";
import {
  addCommentReply,
  getCommentsReply,
  deleteCommentReply,
  updateCommentReply,
} from "../../../controllers/apps/feed/feed_comment.reply.controllers.js";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../middlewares/auth.middlewares.js";
import { commentContentValidator } from "../../../validators/apps/social-media/comment.validators.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";
import { upload } from "../../../middlewares/feed_commentsmulter.middlewares.js";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../Constants.js";
const router = Router();

router
  .route("/comment/:commentId")
  .get(
    getLoggedInUserOrIgnore,
    mongoIdPathVariableValidator("commentId"),
    validate,
    getCommentsReply
  )
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("commentId"),
    upload.fields([
      { name: "image", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "thumbnail", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "video", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "audio", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      // { name: "gif", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "docs", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
    ]),
    // commentContentValidator(),
    // validate,
    addCommentReply
  );

router
  .route("/:commentReplyId")
  .delete(
    verifyJWT,
    mongoIdPathVariableValidator("commentReplyId"),
    validate,
    deleteCommentReply
  )
  .patch(
    verifyJWT,
    mongoIdPathVariableValidator("commentReplyId"),
    commentContentValidator(),
    validate,
    updateCommentReply
  );

export default router;
