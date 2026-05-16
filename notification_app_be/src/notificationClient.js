import { config } from "./config.js";

const fallbackNotifications = [
  {
    ID: "local-placement-1",
    Type: "Placement",
    Message: "Campus placement drive opens",
    Timestamp: "2026-04-22 17:51:18"
  },
  {
    ID: "local-result-1",
    Type: "Result",
    Message: "Mid semester result published",
    Timestamp: "2026-04-22 17:51:30"
  },
  {
    ID: "local-event-1",
    Type: "Event",
    Message: "Technical fest registration",
    Timestamp: "2026-04-22 17:51:06"
  },
  {
    ID: "local-placement-2",
    Type: "Placement",
    Message: "Software internship hiring",
    Timestamp: "2026-04-22 17:49:42"
  },
  {
    ID: "local-result-2",
    Type: "Result",
    Message: "Project review marks released",
    Timestamp: "2026-04-22 17:50:18"
  }
];

export async function fetchRemoteNotifications({ limit, page, notificationType } = {}) {
  if (!config.evaluationToken) {
    return {
      source: "fallback",
      notifications: fallbackNotifications
    };
  }

  const url = new URL(`${config.evaluationBaseUrl}/notifications`);
  if (limit) {
    url.searchParams.set("limit", String(limit));
  }
  if (page) {
    url.searchParams.set("page", String(page));
  }
  if (notificationType) {
    url.searchParams.set("notification_type", notificationType);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.evaluationToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Notification API failed with ${response.status}`);
  }

  const body = await response.json();
  return {
    source: "remote",
    notifications: body.notifications || []
  };
}

