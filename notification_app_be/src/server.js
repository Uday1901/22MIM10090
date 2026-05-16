import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { router } from "./routes.js";
import { logBackend } from "./logger.js";

const app = express();

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.CLIENT_ORIGIN
].filter(Boolean));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    }
  })
);
app.use(express.json());
app.use("/api", router);

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found" });
});

app.listen(config.port, async () => {
  await logBackend("info", "config", `backend running on port ${config.port}`);
  console.log(`Backend API running on http://localhost:${config.port}`);
});
