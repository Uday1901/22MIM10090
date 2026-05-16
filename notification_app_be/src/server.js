import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { router } from "./routes.js";
import { logBackend } from "./logger.js";

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/api", router);

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found" });
});

app.listen(config.port, async () => {
  await logBackend("info", "config", `backend running on port ${config.port}`);
  console.log(`Backend API running on http://localhost:${config.port}`);
});

