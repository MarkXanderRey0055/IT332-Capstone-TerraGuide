import express from "express";
import { savePreference, getMyPreference, deleteMyPreference } from "../controllers/buyerPreferenceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .post(protect, savePreference)
  .get(protect, getMyPreference)
  .delete(protect, deleteMyPreference);

export default router;