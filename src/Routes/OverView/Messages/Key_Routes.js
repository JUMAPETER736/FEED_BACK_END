

import { Router } from "express";
import {
  uploadPublicKeys,
  getRecipientKeys,
  getBulkRecipientKeys,
  checkE2EESupport,
} from "../../../controllers/apps/chat-app/key.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";
import { validate } from "../../../validators/validate.js";

const router = Router();
router.use(verifyJWT);

router.route("/").post(uploadPublicKeys);
router.route("/bulk").post(getBulkRecipientKeys);
router
  .route("/:userId")
  .get(mongoIdPathVariableValidator("userId"), validate, getRecipientKeys);
router
  .route("/:userId/support")
  .get(mongoIdPathVariableValidator("userId"), validate, checkE2EESupport);

export default router;
