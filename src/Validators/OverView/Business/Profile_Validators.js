import { body } from "express-validator";

export const validateBusinessProfile = () => [
  body("businessName")
    .trim()
    .notEmpty()
    .withMessage("Business name is required"),
  body("businessType")
    .trim()
    .notEmpty()
    .withMessage("Business type is required"),
  body("businessDescription")
    .trim()
    .notEmpty()
    .withMessage("Business description is required"),
  body("contact.email").trim().isEmail().withMessage("Invalid email format"),
  body("contact.phoneNumber")
    .trim()
    .matches(/^\+?[0-9]{7,15}$/)
    .withMessage("Invalid phone number format"),
  body("contact.address").trim().notEmpty().withMessage("Address is required"),
  body("contact.website")
    .trim()
    .isURL()
    .withMessage("Invalid website URL format"),
  body("location.businessLocation.enabled")
    .isBoolean()
    .withMessage("Business location enabled must be a boolean"),
  // body('location.businessLocation.locationInfo').trim().notEmpty().withMessage('Location info is required'),
  body("location.walkingBillboard.enabled")
    .isBoolean()
    .withMessage("Walking billboard enabled must be a boolean"),
  // body("location.walkingBillboard.liveLocationInfo")
  //   .optional()
  //   .trim()
  //   .isString()
  //   .withMessage("Live location info must be a string"),
  body("businessCatalogue")
    .isArray()
    .withMessage("Business catalogue must be an array of items"),
  body("businessCatalogue.*.itemName")
    .trim()
    .notEmpty()
    .withMessage("Catalogue item name is required"),
  body("businessCatalogue.*.description")
    .trim()
    .notEmpty()
    .withMessage("Catalogue item description is required"),
  body("businessCatalogue.*.features")
    .isArray()
    .withMessage("Features must be an array of strings"),
  body("backgroundPhoto.url")
    .trim()
    .isURL()
    .withMessage("Invalid background photo URL format"),
];
