import assert from "node:assert/strict";
import { createLogger } from "../src/index.js";

const calls = [];
const logger = createLogger({
  token: "sample-token",
  fetchClient: async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ logID: "test-log", message: "log created successfully" })
    };
  }
});

const result = await logger.Log("backend", "info", "service", "priority notifications calculated");
assert.equal(result.logID, "test-log");
assert.equal(calls.length, 1);
assert.match(calls[0].options.headers.Authorization, /^Bearer /);

await assert.rejects(
  () => logger.Log("backend", "info", "component", "wrong package"),
  /Invalid package/
);

console.log("logging middleware tests passed");

