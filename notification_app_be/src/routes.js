import express from "express";
import { fetchRemoteNotifications } from "./notificationClient.js";
import { filterNotifications, rankNotifications } from "./priority.js";
import { logBackend } from "./logger.js";

export const router = express.Router();

router.get("/health", async (_request, response) => {
  await logBackend("debug", "route", "health check requested");
  response.json({ status: "ok" });
});

router.get("/notifications", async (request, response) => {
  const limit = Number(request.query.limit || 10);
  const page = Number(request.query.page || 1);
  const notificationType = request.query.notification_type || request.query.type || "";

  try {
    const result = await fetchRemoteNotifications({ limit, page, notificationType });
    const filtered = filterNotifications(result.notifications, notificationType);
    const ranked = rankNotifications(filtered, limit);

    await logBackend(
      "info",
      "service",
      `returned ${ranked.length} priority notifications from ${result.source} source`
    );

    response.json({
      source: result.source,
      count: ranked.length,
      notifications: ranked
    });
  } catch (error) {
    await logBackend("error", "handler", `failed to fetch notifications: ${error.message}`);
    response.status(502).json({
      message: "Unable to fetch notifications",
      detail: error.message
    });
  }
});

router.post("/logs", async (request, response) => {
  const { stack = "frontend", level = "info", package: packageName = "utils", message } = request.body || {};

  if (!message || typeof message !== "string") {
    response.status(400).json({ message: "message is required" });
    return;
  }

  const result = await logBackend(level, packageName, message);
  response.json(result);
});

