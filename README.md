# RelayShield x402 Decision Gate

Pre-payment judgment for AI agents that pay over x402, built on Cloudflare's
Agents SDK.

## The pattern

Cloudflare's Agents SDK fires a confirmation callback **before money moves**.
`x402Client.callTool(onPaymentRequired, { name, arguments })` hands your
callback the payment requirements; return `true` to pay, `false` to decline.
Passing `null` instead pays automatically with no judgment at all.

This example plugs RelayShield's free, keyless composite-check into that
socket. Every payment target is screened before the agent authorizes payment:

- `high` verdict (score 90+): payment **declined**, reasons logged
- `medium`: approved, warning logged
- `unknown`: approved (nothing known against it, which is not proof of safety)
- screening error or timeout: **fail open**, approved with the failure logged

Our own outage must never block a legitimate payment.

## Files

- `src/relayshield.ts`: composite-check client, returns a normalized verdict
- `src/decision-gate.ts`: the agent. `onPaymentRequired` is the judgment
  socket; it screens `paymentRequirements.resource` and approves or declines
- `test/screening.test.mjs`: contract tests against the live endpoint
  (`node --test test/`)

## Setup

```bash
npm install
```

```bash
MY_PRIVATE_KEY="0x..."   # .dev.vars locally; wrangler secret put MY_PRIVATE_KEY in prod
```

Use `base-sepolia` for testing (Circle faucet for test USDC), `base` for
production. The network is set in `src/decision-gate.ts`.

```bash
npm run check   # typecheck
npm test        # live contract tests against the production endpoint
```

## API shape (per Cloudflare Agents docs, "Pay from Agents SDK")

```ts
import { withX402Client } from "agents/x402";
const client = withX402Client(mcpClient, { network: "base", account });
await client.callTool(onPaymentRequired, { name: toolName, arguments: toolArgs });
```

`onPaymentRequired(paymentRequirements): Promise<boolean>` receives the x402
payment requirements (scheme, network, asset, payTo, amount, resource, ...).
This example screens `resource`, the URL being paid for.

## Notes

- The check is free and keyless: `POST /v1/composite-check` with
  `{"url": "..."}`. It never says "safe"; the best case is "unknown".
- Screening is best-effort and usually answers in about a second; the gate
  uses a 10s timeout and fails open.
- Cloudflare's buyer-side guardrails (allowances, allow lists, max
  transaction size) were still described as planned at the time of writing.
  This gate is the judgment layer until they ship.
- RelayShield's paid endpoints use the same x402 wire shape (exact scheme,
  eip155:8453, USDC), so a wallet that pays a Cloudflare-metered resource
  can pay RelayShield's without new plumbing.

## Publishing

This example is not yet in a public repo. To publish:

```bash
cd ~/workspace/goals/relayshield-strategic-projects/files/cloudflare-decision-gate
git init
git add .
git commit -m "RelayShield x402 decision gate: pre-payment judgment for agents"
gh repo create nzdsf2-gif/relayshield-x402-decision-gate --public --source=. --push
```

If `gh` is not logged in: create the public repo
`nzdsf2-gif/relayshield-x402-decision-gate` on github.com, then push.
