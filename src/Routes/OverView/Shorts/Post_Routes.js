import { Router } from "express";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../Constants.js";
import {
  createPost,
  deletePost,
  getAllPosts,
  getMyPosts,
  searchAllPosts,
  getPostById,
  getPostsByTag,
  getPostsByUsername,
  removePostImage,
  updatePost,
  getPostByFileId,
  getAllShortsByFeedShortBusinessId,
  getSearchAllPostsByUserId,


} from "../../../controllers/apps/social-media/post.controllers.js";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../middlewares/auth.middlewares.js";
import { upload } from "../../../middlewares/multer.middlewares.js";
import { uploadThumbnail } from "../../../middlewares/shortsmulter.middlewares.js";
import {
  createPostValidator,
  tagPathVariableValidator,
  updatePostValidator,
  usernamePathVariableValidator,
} from "../../../validators/apps/social-media/post.validators.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

router.use(verifyJWT);



router.route("/user/:userId").get(
  getLoggedInUserOrIgnore,
  getSearchAllPostsByUserId
);

// Add this route in your router file
router.route("/search").get(getLoggedInUserOrIgnore, searchAllPosts);

router
  .route("/")
  .get(getLoggedInUserOrIgnore, getAllPosts)
  .post(
    upload.fields([
      { name: "images", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
      { name: "thumbnail", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
    ]),
    validate,
    createPost
  );



router.route("/get/my").get(getMyPosts);

router
  .route("/get/u/:username")
  .get(
    getLoggedInUserOrIgnore,
    usernamePathVariableValidator(),
    validate,
    getPostsByUsername
  );

router
  .route("/get/t/:tag")
  .get(
    getLoggedInUserOrIgnore,
    tagPathVariableValidator(),
    validate,
    getPostsByTag
  );

router
  .route("/:postId")
  .get(
    getLoggedInUserOrIgnore,
    mongoIdPathVariableValidator("postId"),
    validate,
    getPostById
  );

router.route("/getPostByFileId/:fileId").get(
  getLoggedInUserOrIgnore,
  // mongoIdPathVariableValidator("postId"),
  validate,
  getPostByFileId
);
router
  .route("/getAllShortsByFeedShortBusinessId/:feedShortsBusinessId")
  .get(
    getLoggedInUserOrIgnore,
    // mongoIdPathVariableValidator("postId"),
    validate,
    getAllShortsByFeedShortBusinessId
  )
  .patch(
    verifyJWT,
    upload.fields([
      { name: "images", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
    ]),
    mongoIdPathVariableValidator("postId"),
    updatePostValidator(),
    validate,
    updatePost
  )
  .delete(
    mongoIdPathVariableValidator("postId"),
    validate,
    deletePost
  );

router
  .route("/remove/image/:postId/:imageId")
  .patch(
    mongoIdPathVariableValidator("postId"),
    mongoIdPathVariableValidator("imageId"),
    validate,
    removePostImage
  );

export default router;
