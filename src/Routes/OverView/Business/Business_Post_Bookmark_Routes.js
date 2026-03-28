import { Router } from "express";
import { verifyJWT } from "../../../../middlewares/auth.middlewares.js";
import { validate } from "../../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../../validators/common/mongodb.validators.js";
import { bookmarkUnBookmarkBusinessPost, getBookmarks } from "../../../../controllers/apps/business/businesspost/business.post.bookmark.controller.js";


const router = Router();

router.use(verifyJWT);

router
    .route("/:businessPostId")
    .post(
        mongoIdPathVariableValidator("businessPostId"),
        validate,
        bookmarkUnBookmarkBusinessPost
    );

router
    .route("/all")
    .get(getBookmarks);

export default router;