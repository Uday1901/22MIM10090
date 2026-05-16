import assert from "node:assert/strict";
import { rankNotifications } from "../src/priority.js";

const ranked = rankNotifications([
  { ID: "1", Type: "Event", Message: "A", Timestamp: "2026-04-22 17:51:30" },
  { ID: "2", Type: "Placement", Message: "B", Timestamp: "2026-04-22 17:49:30" },
  { ID: "3", Type: "Result", Message: "C", Timestamp: "2026-04-22 17:51:20" }
]);

assert.equal(ranked[0].ID, "2");
assert.equal(ranked.length, 3);
assert.ok(ranked[0].priorityScore > ranked[1].priorityScore);

console.log("priority tests passed");

