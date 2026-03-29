import { Router } from "express";
import {
  followUnFollowUser,
  followUnFollowUserFeed,
  getFollowersListByUserName,
  getFollowingListByUserName,
} from "../../../controllers/apps/social-media/follow.controllers.js";
import {
  getLoggedInUserOrIgnore,
  verifyJWT,
} from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

// Follow/Unfollow in Shorts
router
  .route("/shorts/:toBeFollowedUserId")
  .post(verifyJWT, mongoIdPathVariableValidator("toBeFollowedUserId"), validate, followUnFollowUser);

// Follow/Unfollow in Feed (ensuring sync with Shorts)
router
  .route("/feed/:toBeFollowedUserId")
  .post(verifyJWT, mongoIdPathVariableValidator("toBeFollowedUserId"), validate, followUnFollowUserFeed);

router
  .route("/list/followers/:username")
  .get(getLoggedInUserOrIgnore, getFollowersListByUserName);

router
  .route("/list/following/:username")
  .get(getLoggedInUserOrIgnore, getFollowingListByUserName);

export default router;
