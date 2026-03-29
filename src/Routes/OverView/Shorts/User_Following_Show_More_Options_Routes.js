import { Router } from "express";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";
import { validate } from "../../../validators/validate.js";

import {
    addToCloseFriends,
    removeFromCloseFriends,
    getCloseFriends,
    checkCloseFriendStatus,
    mutePosts,
    unmutePosts,
    getMutedPostsUsers,
    checkMutedPostsStatus,
    muteStories,
    unmuteStories,
    getMutedStoriesUsers,
    checkMutedStoriesStatus,
    addToFavorites,
    removeFromFavorites,
    getFavorites,
    checkFavoriteStatus,
    restrictUser,
    unrestrictUser,
    getRestrictedUsers,
    checkRestrictedStatus,
} from "../../../controllers/apps/social-media/userFollowingShowMoreOptions.controllers.js";

const router = Router();

/* ==================== CLOSE FRIENDS ==================== */
router.route("/close-friends")
    .get(verifyJWT, getCloseFriends);

router.route("/close-friends/:userId")
    .get(verifyJWT, mongoIdPathVariableValidator("userId"), validate, checkCloseFriendStatus)
    .post(verifyJWT, mongoIdPathVariableValidator("userId"), validate, addToCloseFriends)
    .delete(verifyJWT, mongoIdPathVariableValidator("userId"), validate, removeFromCloseFriends);

/* ==================== MUTE POSTS ==================== */
router.route("/mute/posts")
    .get(verifyJWT, getMutedPostsUsers);

router.route("/mute/posts/:userId")
    .get(verifyJWT, mongoIdPathVariableValidator("userId"), validate, checkMutedPostsStatus)
    .post(verifyJWT, mongoIdPathVariableValidator("userId"), validate, mutePosts)
    .delete(verifyJWT, mongoIdPathVariableValidator("userId"), validate, unmutePosts);

/* ==================== MUTE STORIES ==================== */
router.route("/mute/stories")
    .get(verifyJWT, getMutedStoriesUsers);

router.route("/mute/stories/:userId")
    .get(verifyJWT, mongoIdPathVariableValidator("userId"), validate, checkMutedStoriesStatus)
    .post(verifyJWT, mongoIdPathVariableValidator("userId"), validate, muteStories)
    .delete(verifyJWT, mongoIdPathVariableValidator("userId"), validate, unmuteStories);

/* ==================== FAVORITES ==================== */
router.route("/favorites")
    .get(verifyJWT, getFavorites);

router.route("/favorites/:userId")
    .get(verifyJWT, mongoIdPathVariableValidator("userId"), validate, checkFavoriteStatus)
    .post(verifyJWT, mongoIdPathVariableValidator("userId"), validate, addToFavorites)
    .delete(verifyJWT, mongoIdPathVariableValidator("userId"), validate, removeFromFavorites);

/* ==================== RESTRICT ==================== */
router.route("/restrict")
    .get(verifyJWT, getRestrictedUsers);

router.route("/restrict/:userId")
    .get(verifyJWT, mongoIdPathVariableValidator("userId"), validate, checkRestrictedStatus)
    .post(verifyJWT, mongoIdPathVariableValidator("userId"), validate, restrictUser)
    .delete(verifyJWT, mongoIdPathVariableValidator("userId"), validate, unrestrictUser);

export default router;