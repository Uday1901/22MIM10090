const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

const RECENCY_WEIGHT = 0.35;

function parseTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  return parsed.getTime();
}

export function calculatePriority(notification, newestTime) {
  const typeScore = TYPE_WEIGHT[notification.Type] || 0;
  const createdTime = parseTimestamp(notification.Timestamp);
  const ageMinutes = Math.max(0, (newestTime - createdTime) / 60000);
  const recencyScore = Math.max(0, 100 - ageMinutes * RECENCY_WEIGHT);

  return Number((typeScore * 1000 + recencyScore).toFixed(3));
}

export function rankNotifications(notifications, limit = 10) {
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const newestTime = safeNotifications.reduce((latest, item) => {
    return Math.max(latest, parseTimestamp(item.Timestamp));
  }, 0);

  return safeNotifications
    .map((notification) => ({
      ...notification,
      priorityScore: calculatePriority(notification, newestTime)
    }))
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      return parseTimestamp(right.Timestamp) - parseTimestamp(left.Timestamp);
    })
    .slice(0, limit);
}

export function filterNotifications(notifications, type) {
  if (!type) {
    return notifications;
  }
  return notifications.filter((notification) => notification.Type === type);
}

