import { Router } from "express";
import { uploadEvents, uploadBatchedEvents } from "../../../controllers/apps/events/events.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";

const router = Router();

router
    .route("/")
    .post(
        verifyJWT,
        uploadEvents
    );

router
    .route("/batch")
    .post(
        verifyJWT,
        uploadBatchedEvents
    );    

export default router;    