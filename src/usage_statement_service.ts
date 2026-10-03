import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai.js";
import { sendMonthlyStatement } from "./statement_sender.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = createInfraiClient(apiKey);

function writeJson(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/statements/monthly") {
    writeJson(response, 404, { error: "route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    writeJson(response, 200, await sendMonthlyStatement(infrai, raw));
  } catch (error) {
    if (error instanceof ZodError) writeJson(response, 400, { error: "invalid statement request", issues: error.issues });
    else if (error instanceof InfraiError) writeJson(response, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.code });
    else writeJson(response, 500, { error: "statement delivery failed" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Usage statement service listening on http://localhost:${process.env.PORT ?? 3000}`);
});
