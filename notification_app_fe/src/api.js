import { createLogger } from "logging_middleware";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const logToken = import.meta.env.VITE_LOG_TOKEN || "";
const evaluationBaseUrl =
  import.meta.env.VITE_EVALUATION_BASE_URL || "http://4.224.186.213/evaluation-service";

const logger = createLogger({
  baseUrl: evaluationBaseUrl,
  token: logToken
});

export async function logFrontend(level, packageName, message) {
  try {
    return await logger.Log("frontend", level, packageName, message);
  } catch {
    return { skipped: true, reason: "remote_logging_failed" };
  }
}

export async function getPriorityNotifications({ limit, type }) {
  const url = new URL(`${API_BASE_URL}/notifications`);
  url.searchParams.set("limit", String(limit));
  if (type !== "All") {
    url.searchParams.set("notification_type", type);
  }

  await logFrontend("info", "api", `requesting notifications limit=${limit} type=${type}`);
  const response = await fetch(url);

  if (!response.ok) {
    await logFrontend("error", "api", `notification request failed with ${response.status}`);
    throw new Error("Unable to load notifications");
  }

  return response.json();
}
