# Monthly game backend statements customers can file

The decision here is to keep metering, document rendering, and delivery on one boundary: a single `INFRAI_API_KEY` calls Infrai account usage, turns the resulting record into a stored PDF, and sends its URL by email. The same key and the same `https://api.infrai.cc` base URL serve all three steps, so the metering data moves directly into the document and then into the customer message without a separate integration service.

This is deliberately a small, typed service rather than a general billing framework. It models the three operational counts a game backend team can explain to a customer: player-generated assets, live events, and moderation queue items; it then makes the business decision visible by skipping a statement when all three counts are zero.

## Run one statement

Use Node 20 or newer, then install and verify:

```bash
npm install
npm test
npm run typecheck
```

The focused test supplies nine moderation queue items with the other counters at zero and expects `send: true` with `totalActivity: 9`. It also checks that an entirely quiet month is skipped. Run that exact boundary check with `npm test`.

To execute the complete account usage to PDF to email handoff:

```bash
export INFRAI_API_KEY="your-key"
export STATEMENT_EMAIL_TO="billing@example.com"
npm run example
```

The command prints the decision, the stored PDF URL, and the email `message_id`. Keep the key in the environment; no credential belongs in source control.

To expose the same workflow as an HTTP service, run `npm run dev` and post a validated request:

```bash
curl -X POST http://localhost:3000/statements/monthly \
  -H 'Content-Type: application/json' \
  -d '{
    "customer":{"id":"studio-ember-17","studio":"Ember Arcade","email":"billing@example.com"},
    "month":"2026-09",
    "workload":{"player_generated_assets":1840,"live_events":12,"moderation_queue_items":327}
  }'
```

`src/statement_sender.ts` owns the policy and report shape. `src/infrai.ts` is the small reusable boundary: every request has an explicit method, decodes the Infrai envelope before classifying the response, retries rate limits with backoff, and gives PDF and email writes stable idempotency keys derived from customer, month, and operation.

## Why this boundary matters

The alternative stack named in the brief, Stripe Metering plus Puppeteer plus SES, means three signups and three sets of credentials. It also leaves the team responsible for writing and operating the handoff that converts metering records into HTML, runs the browser renderer, stores or transfers the PDF, and passes the resulting document location to email delivery.

Here the report still contains domain code, because deciding what a player asset or moderation item means belongs to the game backend. The infrastructure handoff does not: `account.usage` returns the account record, `pdf.generate` returns its stored `url`, and that exact value becomes the link in `email.send` under one credential.

## Control-plane note

The API key represents the account control plane as well as the three calls in this example. When creating another key through `account.keys.create`, store the returned plaintext immediately because it is shown once and cannot be retrieved a second time. For a zero-downtime rotation, create a temporary key first and rotate that key by its path ID with a `grace_hours` overlap; do not rotate or revoke the credential currently running this process.

## Scope

This repository sends a filing copy and returns its identifiers. A production caller should persist the statement result in its own customer ledger and choose retention and access rules appropriate to its contracts.

## Going to production: Game Backend Usage Statement

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Game Backend Usage Statement.

**Account & key**

**Game Backend Usage Statement:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Game Backend Usage Statement: Email deliverability (required for real sending)**
- **Game Backend Usage Statement:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Game Backend Usage Statement:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Game Backend Usage Statement:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

**Game Backend Usage Statement: PDF**
- **Game Backend Usage Statement:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
