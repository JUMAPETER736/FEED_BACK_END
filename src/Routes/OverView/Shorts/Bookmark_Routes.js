import { Router } from "express";
import {
  toggleBookmark,
  getMyBookmarkedPosts,
} from "../../../controllers/apps/social-media/bookmark.controllers.js";
//  ^^^  three levels up, not one
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
//                        ^^^  same fix here

const router = Router();

router.use(verifyJWT);

router.get("/", getMyBookmarkedPosts);
router.post("/post/:postId", toggleBookmark);

export default router;