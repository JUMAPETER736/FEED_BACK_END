import { Router } from "express";
import {
  addBusinessComment,
  getBusinessPostComments,
  locateComment
} from "../../../../controllers/apps/business/businesspost/business.post.comment.controller.js";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../../middlewares/auth.middlewares.js";
import { commentContentValidator } from "../../../../validators/apps/social-media/comment.validators.js";
import { validate } from "../../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../../validators/common/mongodb.validators.js";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../../constants.js";
import { upload } from "../../../../middlewares/feed_commentsmulter.middlewares.js";

const router = Router();

router
  .route("/:postId")
  .get(
    verifyJWT,
    mongoIdPathVariableValidator("postId"),
    validate,
    getBusinessPostComments,
  );

router
  .route("/:businessPostId")
  .post(
    verifyJWT,
    mongoIdPathVariableValidator("businessPostId"),
    upload.fields([
      { name: "image", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "video", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "thumbnail", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "audio", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "docs", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
    ]),
    addBusinessComment
  );

router
  .route("/locate/comment/")
  .get(
    verifyJWT,
    locateComment
  );

export default router;

