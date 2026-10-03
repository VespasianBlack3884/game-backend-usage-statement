import { createInfraiClient } from "./infrai.js";
import { sendMonthlyStatement } from "./statement_sender.js";

const apiKey = process.env.INFRAI_API_KEY;
const recipient = process.env.STATEMENT_EMAIL_TO;
if (!apiKey || !recipient) throw new Error("Set INFRAI_API_KEY and STATEMENT_EMAIL_TO");

const result = await sendMonthlyStatement(createInfraiClient(apiKey), {
  customer: { id: "studio-ember-17", studio: "Ember Arcade", email: recipient },
  month: "2026-09",
  workload: { player_generated_assets: 1840, live_events: 12, moderation_queue_items: 327 }
});

console.log(JSON.stringify(result, null, 2));
