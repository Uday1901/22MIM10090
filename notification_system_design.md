# Notification System Design

## Stage 1

The notification platform needs predictable REST contracts that allow a logged-in student client to list, inspect, mark, and filter notifications. Authentication is assumed to be handled by the platform, so these endpoints expect an authorization header from the caller.

### Core Actions

| Action | Method | Endpoint | Purpose |
| --- | --- | --- | --- |
| List notifications | `GET` | `/api/notifications` | Return paginated notifications for the current student |
| Get notification | `GET` | `/api/notifications/{notificationId}` | Return one notification |
| Mark one as read | `PATCH` | `/api/notifications/{notificationId}/read` | Mark a notification as viewed |
| Mark all as read | `PATCH` | `/api/notifications/read-all` | Mark all current student notifications as viewed |
| Delete notification | `DELETE` | `/api/notifications/{notificationId}` | Hide or delete a notification for the current student |
| Count unread | `GET` | `/api/notifications/unread-count` | Return unread count for badges |
| Stream updates | `GET` | `/api/notifications/stream` | Server-sent events endpoint for real-time updates |

### List Notifications

`GET /api/notifications?limit=10&page=1&notification_type=Placement&status=unread`

Request headers:

```http
Authorization: Bearer <token>
Accept: application/json
```

Response:

```json
{
  "page": 1,
  "limit": 10,
  "total": 146,
  "unreadCount": 23,
  "notifications": [
    {
      "id": "noti_101",
      "type": "Placement",
      "title": "Placement drive opened",
      "message": "Applications are open for the campus placement drive.",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30.000Z",
      "readAt": null,
      "metadata": {
        "company": "Example Organization",
        "deadline": "2026-04-28"
      }
    }
  ]
}
```

### Mark as Read

`PATCH /api/notifications/noti_101/read`

Response:

```json
{
  "id": "noti_101",
  "isRead": true,
  "readAt": "2026-04-22T18:03:10.000Z"
}
```

### Error Format

```json
{
  "error": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "Notification was not found"
  }
}
```

The stream endpoint can use Server-Sent Events because notifications are one-way updates from server to browser. WebSockets would also work, but SSE is lighter when the browser only needs to receive updates.

## Stage 2

A relational schema is suitable because students, notifications, and per-student delivery state have clear relationships.

### Tables

```sql
CREATE TABLE students (
  id BIGSERIAL PRIMARY KEY,
  roll_no VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  notification_type VARCHAR(32) NOT NULL CHECK (notification_type IN ('Event', 'Result', 'Placement')),
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_notifications (
  student_id BIGINT NOT NULL REFERENCES students(id),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  PRIMARY KEY (student_id, notification_id)
);

CREATE INDEX idx_student_notifications_unread
  ON student_notifications (student_id, is_read, delivered_at DESC);

CREATE INDEX idx_notifications_type_created
  ON notifications (notification_type, created_at DESC);
```

### Query Examples

Unread notifications:

```sql
SELECT n.id, n.notification_type, n.title, n.message, n.created_at
FROM student_notifications sn
JOIN notifications n ON n.id = sn.notification_id
WHERE sn.student_id = $1
  AND sn.is_read = FALSE
ORDER BY sn.delivered_at DESC
LIMIT $2 OFFSET $3;
```

Mark as read:

```sql
UPDATE student_notifications
SET is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
WHERE student_id = $1
  AND notification_id = $2;
```

At high volume, likely problems are large fan-out writes, growing unread indexes, slow offset pagination, and contention during bulk notification delivery. Improvements include cursor pagination, partitioning by date, queue-based fan-out, read replicas for listing, and archiving old read notifications.

## Stage 3

The slow query is:

```sql
SELECT *
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt ASC;
```

It is not ideal because it uses `SELECT *`, mixes student delivery state into the main notification table, orders oldest first for an inbox, and may scan many rows if there is no composite index. With 50,000 students and 5,000,000 notifications, a per-student unread lookup needs an index that starts with `student_id` and `is_read`.

Better query:

```sql
SELECT n.id, n.notification_type, n.title, n.message, n.created_at
FROM student_notifications sn
JOIN notifications n ON n.id = sn.notification_id
WHERE sn.student_id = 1042
  AND sn.is_read = FALSE
ORDER BY sn.delivered_at DESC
LIMIT 20;
```

Supporting index:

```sql
CREATE INDEX idx_student_unread_delivery
ON student_notifications (student_id, is_read, delivered_at DESC);
```

Likely cost after indexing is `O(log n + k)` where `k` is the number of returned rows. Without the index it can degrade toward `O(n log n)` because the database may scan and sort many matching rows.

Adding indexes everywhere is not safe. Indexes improve selected read paths, but each index consumes storage, slows inserts and updates, and increases maintenance cost. Indexes should match actual query patterns.

Students who received a placement notification in the last seven days:

```sql
SELECT DISTINCT s.id, s.roll_no, s.email, s.name
FROM students s
JOIN student_notifications sn ON sn.student_id = s.id
JOIN notifications n ON n.id = sn.notification_id
WHERE n.notification_type = 'Placement'
  AND sn.delivered_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';
```

## Stage 4

Fetching notifications on every page load can overload the database because many clients repeatedly request the same data. The API should reduce database pressure with layered strategies.

1. Cursor pagination: replace high-offset pagination with `created_at` or `delivered_at` cursors. This keeps page retrieval stable and avoids scanning skipped rows.

2. Client-side caching: keep the latest notification response in memory or local storage with a short freshness window. The tradeoff is that data may be briefly stale.

3. HTTP caching: return `ETag` or `Last-Modified` headers and support conditional requests. This reduces response payload size when nothing changed.

4. Server cache: cache unread counts and first-page inbox results per student for a short TTL. This is useful for repeated dashboard loads but requires invalidation when a new notification is delivered or read status changes.

5. Real-time push: use SSE or WebSockets to update the inbox when new notifications arrive. This avoids polling, but it adds connection management complexity.

6. Read replicas: serve read-heavy notification listing from replicas while writes continue on primary. Replication lag must be acceptable for the product.

The recommended combination is cursor pagination, short server-side cache for the first page, conditional requests, and SSE for new arrivals.

## Stage 5

The initial implementation sends email, writes to the database, and pushes to the app inside one loop:

```text
function notify_all(student_ids, message):
  for student_id in student_ids:
    send_email(student_id, message)
    save_to_db(student_id, message)
    push_to_app(student_id, message)
```

Shortcomings:

- A failure midway leaves earlier students notified and later students skipped.
- Email delivery is slower and less reliable than database writes.
- There is no retry, idempotency key, status tracking, or dead-letter handling.
- The caller waits for all students, so the operation can time out.
- The database and email provider are tightly coupled in one synchronous flow.

The database save should happen before email. The application needs a durable record of intended delivery before external side effects start. Email workers can then retry safely based on delivery status.

Revised pseudocode:

```text
function create_notification(student_ids, message):
  notification_id = insert notification(message, type)
  for each batch of student_ids:
    insert student_notification rows with status = 'pending'
    enqueue delivery_job(notification_id, batch_id)
  return notification_id

worker process_delivery_job(job):
  recipients = load pending rows for job.batch_id
  for recipient in recipients:
    try:
      send_email(recipient.student_id, job.notification_id)
      push_to_app(recipient.student_id, job.notification_id)
      mark delivery status = 'sent'
    catch error:
      increment attempt_count
      if attempt_count < max_attempts:
        requeue with backoff
      else:
        mark delivery status = 'failed'
        send to dead_letter_queue
```

This design is more reliable because the write path is durable, workers are retryable, and failed recipients can be replayed without sending duplicates to everyone.

## Stage 6

Priority is calculated from notification type and recency. Placement has the highest business weight, followed by Result, then Event. Recency is still considered so two notifications of the same type are ordered by newest first.

The implemented backend function is in `notification_app_be/src/priority.js`.

```js
const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function rankNotifications(notifications, limit = 10) {
  return notifications
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
```

To maintain top 10 efficiently as new notifications keep arriving, the service can keep a min-heap of size 10 per student. Each new notification computes a score, compares against the heap minimum, and replaces it only when the new score is higher. This keeps update work at `O(log 10)`, effectively constant for this fixed limit. For persisted data, the same idea can be backed by a cache and rebuilt from the database when cache entries expire.

## Stage 7

The frontend is implemented in `notification_app_fe` as a React application and is configured to run on `http://localhost:3000`.

### Frontend Behavior

- Displays a priority inbox for unread notifications.
- Supports selecting the number of notifications to show: 10, 15, or 20.
- Supports filtering by notification type: All, Placement, Result, or Event.
- Shows a compact summary area with displayed count, top priority type, and data source.
- Uses Material UI components for layout, controls, buttons, chips, and feedback states.
- Handles loading, empty state, and API error state.

### API Flow

The browser calls the local backend:

```text
GET http://localhost:4000/api/notifications?limit=10&notification_type=Placement
```

The backend calls the protected notification API when a token is configured. If no token is present during local development, it returns fallback data with the same response shape so the UI can still be tested.

### Priority Display

Each card displays:

- notification type
- message
- timestamp
- computed priority score

The UI intentionally keeps the first screen focused on the inbox rather than a landing page because the product requirement is an application screen for students.
