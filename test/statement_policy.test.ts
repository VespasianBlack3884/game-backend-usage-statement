import assert from "node:assert/strict";
import test from "node:test";
import { decideStatement, statementRequestSchema } from "../src/statement_sender.js";

test("sends a statement when a moderation queue has billable activity", () => {
  const input = statementRequestSchema.parse({
    customer: { id: "studio-42", studio: "Red Comet", email: "billing@example.com" },
    month: "2026-09",
    workload: { player_generated_assets: 0, live_events: 0, moderation_queue_items: 9 }
  });

  assert.deepEqual(decideStatement(input), {
    send: true,
    totalActivity: 9,
    reason: "metered game activity present"
  });
});

test("skips a zero-activity statement", () => {
  const input = statementRequestSchema.parse({
    customer: { id: "studio-42", studio: "Red Comet", email: "billing@example.com" },
    month: "2026-09",
    workload: { player_generated_assets: 0, live_events: 0, moderation_queue_items: 0 }
  });
  assert.equal(decideStatement(input).send, false);
});
