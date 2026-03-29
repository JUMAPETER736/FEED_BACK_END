import { Router } from "express";
import {
  sharePost,
  getMySharedShorts,
  getSharesForPost,
}  from "../../../controllers/apps/social-media/share.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT);

// GET   /api/v1/social-media/shares               → my shared shorts
router.get("/", getMySharedShorts);

// POST  /api/v1/social-media/shares/post/:postId  → record a share
router.post("/post/:postId", sharePost);

// GET   /api/v1/social-media/shares/post/:postId  → share count & status
router.get("/post/:postId", getSharesForPost);

export default router;