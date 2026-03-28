import { Router } from "express";
import {
    getLoggedInUserOrIgnore,
    verifyJWT,
} from "../../../../middlewares/auth.middlewares.js";
import { commentContentValidator } from "../../../../validators/apps/social-media/comment.validators.js";
import { validate } from "../../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../../validators/common/mongodb.validators.js";
import { upload } from "../../../../middlewares/feed_commentsmulter.middlewares.js";
import { MAXIMUM_SOCIAL_POST_IMAGE_COUNT } from "../../../../constants.js";
import { addBusinessCommentReply, getBusinessCommentReply } from "../../../../controllers/apps/business/businesspost/business.post.comment.reply.controller.js";
const router = Router();

router
    .route("/:commentId")
    .post(
        verifyJWT,
        mongoIdPathVariableValidator("commentId"),
        upload.fields([
            { name: "image", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
            { name: "thumbnail", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
            { name: "video", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
            { name: "audio", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
            { name: "docs", maxCount: MAXIMUM_SOCIAL_POST_IMAGE_COUNT },
        ]),
        addBusinessCommentReply
    );

router
    .route("/:commentId")
    .get(
        getLoggedInUserOrIgnore,
        mongoIdPathVariableValidator("commentId"),
        validate,
        getBusinessCommentReply
    );    


export default router;    


