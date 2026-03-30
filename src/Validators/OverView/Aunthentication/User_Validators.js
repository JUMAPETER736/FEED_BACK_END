import { body, param } from "express-validator";
import { AvailableUserRoles } from "../../../Constants.js";

const userRegisterValidator = () => {
  return [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
    body("username")
      .trim()
      .notEmpty()
      .withMessage("Username is required")
      .isLowercase()
      .withMessage("Username must be lowercase")
      .isLength({ min: 3 })
      .withMessage("Username must be at lease 3 characters long"),
    body("password").trim().notEmpty().withMessage("Password is required"),
    body("role")
      .optional()
      .isIn(AvailableUserRoles)
      .withMessage("Invalid user role"),
  ];
};

const userLoginValidator = () => {
  return [
    body("email").optional().isEmail().withMessage("Email is invalid"),
    body("username").optional(),
    body("password").notEmpty().withMessage("Password is required"),
  ];
};

const userChangeCurrentPasswordValidator = () => {
  return [
    body("oldPassword").notEmpty().withMessage("Old password is required"),
    body("newPassword").notEmpty().withMessage("New password is required"),
  ];
};

const userForgotPasswordValidator = () => {
  return [
    body("email")
      .optional()
      .isEmail()
      .withMessage("Email must be valid if provided"),
    body("username")
      .optional()
      .isString()
      .withMessage("Username must be a string if provided"),
    body("userId")
      .optional()
      .isString()
      .withMessage("User ID must be a string if provided"),
    // Custom validator to ensure at least one field is provided
    body()
      .custom((value, { req }) => {
        if (!req.body.email && !req.body.username && !req.body.userId) {
          throw new Error("Please provide email, username, or user ID");
        }
        return true;
      }),
  ];
};

const userResetForgottenPasswordValidator = () => {
  return [body("newPassword").notEmpty().withMessage("Password is required")];
};

const userAssignRoleValidator = () => {
  return [
    body("role")
      .optional()
      .isIn(AvailableUserRoles)
      .withMessage("Invalid user role"),
  ];
};

export {
  userChangeCurrentPasswordValidator,
  userForgotPasswordValidator,
  userLoginValidator,
  userRegisterValidator,
  userResetForgottenPasswordValidator,
  userAssignRoleValidator
};