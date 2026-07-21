import express from "express";

import {
  savePreference,
  getMyPreference,
} from "../controllers/buyerPreferenceController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, savePreference);

router.get("/me", protect, getMyPreference);

export default router;