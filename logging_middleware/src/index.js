const DEFAULT_BASE_URL = "http://4.224.186.213/evaluation-service";

const STACKS = new Set(["backend", "frontend"]);
const LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);
const BACKEND_PACKAGES = new Set([
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service"
]);
const FRONTEND_PACKAGES = new Set(["api", "component", "hook", "page", "state", "style"]);
const COMMON_PACKAGES = new Set(["auth", "config", "middleware", "utils"]);

function isValidPackage(stack, packageName) {
  if (COMMON_PACKAGES.has(packageName)) {
    return true;
  }
  if (stack === "backend") {
    return BACKEND_PACKAGES.has(packageName);
  }
  if (stack === "frontend") {
    return FRONTEND_PACKAGES.has(packageName);
  }
  return false;
}

function validateLogInput(stack, level, packageName, message) {
  if (!STACKS.has(stack)) {
    throw new Error(`Invalid stack: ${stack}`);
  }
  if (!LEVELS.has(level)) {
    throw new Error(`Invalid level: ${level}`);
  }
  if (!isValidPackage(stack, packageName)) {
    throw new Error(`Invalid package "${packageName}" for ${stack}`);
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    throw new Error("Log message must be a non-empty string");
  }
}

export function createLogger(options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const tokenProvider = options.tokenProvider || (() => options.token);
  const fetchClient = options.fetchClient || globalThis.fetch;

  async function Log(stack, level, packageName, message) {
    validateLogInput(stack, level, packageName, message);

    const token = await tokenProvider();
    if (!token) {
      return {
        skipped: true,
        reason: "missing_token"
      };
    }
    if (typeof fetchClient !== "function") {
      return {
        skipped: true,
        reason: "missing_fetch"
      };
    }

    const response = await fetchClient(`${baseUrl}/logs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        stack,
        level,
        package: packageName,
        message
      })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = body.message || `Log API failed with ${response.status}`;
      throw new Error(detail);
    }
    return body;
  }

  return { Log };
}

export async function Log(stack, level, packageName, message, options = {}) {
  const logger = createLogger(options);
  return logger.Log(stack, level, packageName, message);
}

export const allowedLogValues = {
  stacks: [...STACKS],
  levels: [...LEVELS],
  backendPackages: [...BACKEND_PACKAGES],
  frontendPackages: [...FRONTEND_PACKAGES],
  commonPackages: [...COMMON_PACKAGES]
};

