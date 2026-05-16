import { createLogger } from "logging_middleware";
import { config } from "./config.js";

const logger = createLogger({
  baseUrl: config.evaluationBaseUrl,
  tokenProvider: () => config.evaluationToken
});

export async function logBackend(level, packageName, message) {
  try {
    return await logger.Log("backend", level, packageName, message);
  } catch {
    return { skipped: true, reason: "remote_logging_failed" };
  }
}
