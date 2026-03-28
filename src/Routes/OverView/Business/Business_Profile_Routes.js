import { Router } from "express";
import {
  upsertBusinessProfile,
  getBusinessProfileById,
  getOwnBusinessProfile,
  updateBusinessBackgroundImage,
  updateBusinessBackgroundVideo,
  businessLocationInfo,
  updateLiveLocationInfo,
} from "../../../controllers/apps/business/profile.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validateBusinessProfile } from "../../../validators/apps/business/profile.validators.js";
import { validate } from "../../../validators/validate.js";
import { upload } from "../../../middlewares/multer.middlewares.js";

const router = Router();

router.use(verifyJWT);

router
  .route("/")
  .get(getOwnBusinessProfile)
  .post(validateBusinessProfile(), validate, upsertBusinessProfile)
  .put(validateBusinessProfile(), validate, upsertBusinessProfile);

router.route("/:id").get(getBusinessProfileById);

router
  .route("/background")
  .patch(verifyJWT, upload.single("background"), updateBusinessBackgroundImage);

router.route("/livelocation").patch(verifyJWT, upload.none(), updateLiveLocationInfo);

router.route("/businesslocation").patch(verifyJWT, upload.none(), businessLocationInfo);

router.route("/v").patch(
  verifyJWT,
  upload.fields([
    { name: "b_vid", maxCount: 1 },
    { name: "b_thumb", maxCount: 1 },
  ]),
  updateBusinessBackgroundVideo
);


export default router;
