import { Router } from "express";
import {
  toggleRepost,
  getMyRepostedShorts,
  getRepostsForPost,
} from "../../../controllers/apps/social-media/repost.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";

const router = Router();

router.use(verifyJWT);

// GET   /api/v1/social-media/reposts               → my reposted shorts
router.get("/", getMyRepostedShorts);

// POST  /api/v1/social-media/reposts/post/:postId  → toggle repost
router.post("/post/:postId", toggleRepost);

// GET   /api/v1/social-media/reposts/post/:postId  → repost count & status
router.get("/post/:postId", getRepostsForPost);

export default router;