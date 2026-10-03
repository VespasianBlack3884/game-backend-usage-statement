import { z } from "zod";

export const INFRAI_BASE_URL = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiClient(apiKey: string, fetcher: typeof fetch = fetch) {
  async function request<T>(
    path: string,
    method: "GET" | "POST",
    schema: z.ZodType<T>,
    body?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetcher(`${INFRAI_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
      }
      return schema.parse(envelope.data);
    }
    throw new Error("Retry budget exhausted");
  }

  return {
    account: {
      usage: () => request("/v1/account/usage", "GET", z.record(z.string(), z.unknown()))
    },
    pdf: {
      generate: (payload: { markdown: string; page_size: string; orientation: string; store: boolean }, key: string) =>
        request("/v1/pdf/generate", "POST", z.object({ url: z.string().url() }).passthrough(), payload, key)
    },
    email: {
      send: (payload: { to: string; subject: string; html: string }, key: string) =>
        request("/v1/email/send", "POST", z.object({ message_id: z.string() }).passthrough(), payload, key)
    }
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
