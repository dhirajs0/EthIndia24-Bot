import express from "express";
import {
  verifyWebhook,
  handleWebhookPost,
} from "../controllers/webhookController.js";

const router = express.Router();

router.get("/", verifyWebhook);
router.post("/", handleWebhookPost);

export default router;
