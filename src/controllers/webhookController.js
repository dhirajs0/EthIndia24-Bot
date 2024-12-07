import { processMessage, markAsRead } from "../services/messagingService.js";

export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export const handleWebhookPost = async (req, res) => {
  console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  if (message?.type === "text") {
    await markAsRead(req);
    await processMessage(req);
  }

  res.sendStatus(200);
};
