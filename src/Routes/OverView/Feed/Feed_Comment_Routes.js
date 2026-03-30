import { Router } from "express";
import {
  addComment,
  deleteComment,
  getPostComments,
  updateComment,
} from "../../../controllers/apps/feed/feed_comment.controllers.js";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../middlewares/auth.middlewares.js";
import { commentContentValidator } from "../../../validators/apps/social-media/comment.validators.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../Constants.js";
import { upload } from "../../../middlewares/feed_commentsmulter.middlewares.js";
const router = Router();

router
  .route("/:postId")
  .get(
    getLoggedInUserOrIgnore,
    mongoIdPathVariableValidator("postId"),
    validate,
    getPostComments
  )
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("postId"),
    upload.fields([
      { name: "image", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "video", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "thumbnail", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "audio", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      // { name: "gif", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "docs", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
    ]),
    // commentContentValidator(),
    // validate,
    addComment
  );

router
  .route("/:commentId")
  .delete(
    verifyJWT,
    mongoIdPathVariableValidator("commentId"),
    validate,
    deleteComment
  )
  .patch(
    verifyJWT,
    mongoIdPathVariableValidator("commentId"),
    commentContentValidator(),
    validate,
    updateComment
  );

export default router;
