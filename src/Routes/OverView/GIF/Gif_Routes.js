import { Router } from "express";
import {
  addGif,
  getGif,
} from "../../../controllers/apps/gif/gif.controllers.js";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../Constants.js";
import { upload } from "../../../middlewares/commentsmulter.middlewares.js";

const router = Router();

router
  .route("/")
  .get(getGif)
  .post(
    upload.fields([{ name: "gif", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT }]),
    addGif
  );

export default router;
