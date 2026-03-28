import { Router } from "express";
import { getBusinessFeedPosts, followBusinessPostOnwer, getProductById, searchByCategory } from "../../../controllers/apps/business/business.post.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();

router.use(verifyJWT);

router.get('/post', getBusinessFeedPosts);

router
    .route("/follow/:userToBeFollowed")
    .post(
        mongoIdPathVariableValidator("userToBeFollowed"),
        validate,
        followBusinessPostOnwer
    );

router
    .route("/product/:productId")
    .get(
        mongoIdPathVariableValidator("productId"),
        validate,
        getProductById
    );

router
    .route("/search/:category")
    .get(searchByCategory);

export default router;