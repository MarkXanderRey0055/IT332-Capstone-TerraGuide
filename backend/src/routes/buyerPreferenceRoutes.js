import express from "express";
import { savePreference, getMyPreference } from "../controllers/buyerPreferenceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .post(protect, savePreference)
  .get(protect, getMyPreference);

export default router;