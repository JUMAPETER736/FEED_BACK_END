import { Router } from "express";
import {
    blockUser,
    unblockUser,
    getBlockedUsers,
} from "../../../controllers/apps/social-media/block.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

// Block user - POST
router
    .route("/:userId")
    .post(verifyJWT, mongoIdPathVariableValidator("userId"), validate, blockUser);

// Unblock user - DELETE  
router
    .route("/:userId")
    .delete(verifyJWT, mongoIdPathVariableValidator("userId"), validate, unblockUser);

// Get list of blocked users
router
    .route("/")
    .get(verifyJWT, getBlockedUsers);

export default router;