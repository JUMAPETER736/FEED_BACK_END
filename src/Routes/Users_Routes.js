import express from "express";
import { authUser } from "../controllers/userController.js";
import {
  registerUser,
  forgotPasswordRequest,
  verifyResetOTP,
  resetForgottenPassword,
  resendEmailVerification,
} from "../controllers/userController.js";

const router = express.Router();

//  EXISTING ROUTES
router.post("/register", registerUser);
router.post("/login", authUser);

//  PASSWORD RESET ROUTES - OTP BASED (used by Android app)
router.post("/forgot-password", forgotPasswordRequest);  // This already exists and works
router.post("/verify-otp", verifyResetOTP);
router.post("/reset-password", resetForgottenPassword);

// EMAIL VERIFICATION ROUTE
router.post("/resend-email-verification", resendEmailVerification);

export default router;