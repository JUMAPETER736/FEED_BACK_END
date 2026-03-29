import { Router } from "express";
import {
  getMySocialProfile,
  getProfileByUserName,
  updateCoverImage,
  updateSocialProfile,
  getFollowersList,
  getFollowingList,
  getUserFollowers,
  getUserFollowing

} from "../../../controllers/apps/social-media/profile.controllers.js";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../middlewares/auth.middlewares.js";
import { upload } from "../../../middlewares/multer.middlewares.js";
import {
  getProfileByUserNameValidator,
  updateSocialProfileValidator,
} from "../../../validators/apps/social-media/profile.validators.js";
import { validate } from "../../../validators/validate.js";

const router = Router();

// public route
router.route("/u/:username").get(
  getLoggedInUserOrIgnore, // hover over the middleware to know more
  getProfileByUserNameValidator(),
  validate,
  getProfileByUserName
);

router.use(verifyJWT);

router
  .route("/")
  .get(getMySocialProfile)
  .patch(updateSocialProfileValidator(), validate, updateSocialProfile);

router
  .route("/cover-image")
  .patch(upload.single("coverImage"), updateCoverImage);



router.route("/:username/followers").get(getFollowersList);

router.route("/:username/following").get(getFollowingList);



export default router;
