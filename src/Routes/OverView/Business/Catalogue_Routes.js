import { Router } from "express";
import { upsertBusinessProfile, getBusinessProfileById,getOwnBusinessProfile, updateBusinessBackgroundImage } from "../../../controllers/apps/business/profile.controllers.js";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import { validateBusinessProfile } from "../../../validators/apps/business/profile.validators.js";
import { validate } from "../../../validators/validate.js";
import { upload } from "../../../middlewares/multer.middlewares.js";
import { 
    addProductToCatalogue,
    getMyCatalogue,
    getProductsInCatalogue,
    deleteProductFromCatalogue,
    getCatalogueByUserId, 
    getMycatalogueProducts,
    updateProductInCatalogue 
} from "../../../controllers/apps/business/business.catalogue.controllers.js";

const router = Router();

router.use(verifyJWT);

// Business catalogue routes
router.get('/', getMyCatalogue);
// Get a catalogue by user ID
router.get('/:userId', getCatalogueByUserId);
router.get('/m/products', getMycatalogueProducts);
router.post('/product',upload.array("product",8), addProductToCatalogue);
router.get('/:catalogueId/products', getProductsInCatalogue);
router.delete('/products/:productId', deleteProductFromCatalogue);
router.put('/update/:productId', upload.array("product",8), updateProductInCatalogue);


export default router;
