import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middlewares.js";
import { upload } from "../../middlewares/multer.middlewares.js"
import { businesslocationAdvertisement, walkingBillboardAdvertisement } from "../../controllers/apps/location/user.location.controller.js";


const router = Router();

router.use(verifyJWT);

router.route("/businesslocationadvertisement").post(verifyJWT, upload.none(), businesslocationAdvertisement);

router.route("/walkingbillboardadvertisement").post(verifyJWT, upload.none(), walkingBillboardAdvertisement)

export default router;