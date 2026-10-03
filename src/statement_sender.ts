import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiClient } from "./infrai.js";

export const statementRequestSchema = z.object({
  customer: z.object({ id: z.string().min(1), studio: z.string().min(1), email: z.string().email() }),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  workload: z.object({
    player_generated_assets: z.number().int().nonnegative(),
    live_events: z.number().int().nonnegative(),
    moderation_queue_items: z.number().int().nonnegative()
  })
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;
export type StatementDecision = { send: boolean; totalActivity: number; reason: string };

export function decideStatement(input: StatementRequest): StatementDecision {
  const totalActivity = Object.values(input.workload).reduce((sum, value) => sum + value, 0);
  return totalActivity === 0
    ? { send: false, totalActivity, reason: "no metered game activity" }
    : { send: true, totalActivity, reason: "metered game activity present" };
}

function renderStatement(input: StatementRequest, accountUsage: Record<string, unknown>): string {
  return `# ${input.customer.studio} monthly usage statement

**Statement month:** ${input.month}  
**Customer ID:** ${input.customer.id}

| Game backend workload | Count |
| --- | ---: |
| Player-generated assets | ${input.workload.player_generated_assets} |
| Live events | ${input.workload.live_events} |
| Moderation queue items | ${input.workload.moderation_queue_items} |

## Account metering record

\`\`\`json
${JSON.stringify(accountUsage, null, 2)}
\`\`\`
`;
}

function operationKey(input: StatementRequest, operation: string): string {
  return createHash("sha256").update(`${input.customer.id}:${input.month}:${operation}`).digest("hex");
}

export async function sendMonthlyStatement(infrai: InfraiClient, rawInput: unknown) {
  const input = statementRequestSchema.parse(rawInput);
  const decision = decideStatement(input);
  if (!decision.send) return { status: "skipped" as const, decision };

  const accountUsage = await infrai.account.usage();
  const pdf = await infrai.pdf.generate(
    { markdown: renderStatement(input, accountUsage), page_size: "A4", orientation: "portrait", store: true },
    operationKey(input, "pdf")
  );
  const delivery = await infrai.email.send(
    {
      to: input.customer.email,
      subject: `${input.customer.studio} usage statement for ${input.month}`,
      html: `<p>Your ${input.month} usage statement is ready to file.</p><p><a href="${pdf.url}">Download the PDF statement</a></p>`
    },
    operationKey(input, "email")
  );

  return { status: "sent" as const, decision, pdf_url: pdf.url, message_id: delivery.message_id };
}
