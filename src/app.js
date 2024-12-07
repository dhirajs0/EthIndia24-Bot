import express from "express";
import dotenv from "dotenv";
import webhookRoutes from "./routes/webhook.js";
import { connectRedis } from "./services/redisClient.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Redis Connection
connectRedis();

// Routes
app.use("/webhook", webhookRoutes);

// Default Route
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
