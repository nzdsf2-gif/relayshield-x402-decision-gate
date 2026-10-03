/**
 * Decision-gate agent: RelayShield judgment inside Cloudflare's x402
 * confirmation callback.
 *
 * Cloudflare's Agents SDK fires the confirmation callback passed to
 * x402Client.callTool() BEFORE money moves. The callback receives the
 * payment requirements and returns true (pay) or false (decline).
 * Passing null instead pays automatically with no judgment.
 *
 * This example plugs RelayShield's free composite-check into that socket:
 * every payment target is screened, high-risk counterparties are blocked,
 * everything else is approved. Screening failures fail open: our own
 * outage must never block a legitimate payment.
 *
 * API shape per Cloudflare Agents docs ("Pay from Agents SDK"):
 *   withX402Client(mcpClient, { network, account })
 *   x402Client.callTool(onPaymentRequired, { name, arguments })
 *   onPaymentRequired(paymentRequirements): Promise<boolean>
 */

import { Agent } from "agents";
import { withX402Client } from "agents/x402";
import { privateKeyToAccount } from "viem/accounts";
import { screenPaymentTarget, type ScreeningVerdict } from "./relayshield";

const SCREEN_TIMEOUT_MS = 10_000;

export class DecisionGateAgent extends Agent {
  private x402Client: ReturnType<typeof withX402Client> | null = null;

  async onStart() {
    const { id } = await this.mcp.connect(`${this.env.WORKER_URL}/mcp`);
    const account = privateKeyToAccount(
      this.env.MY_PRIVATE_KEY as `0x${string}`
    );
    this.x402Client = withX402Client(this.mcp.mcpConnections[id].client, {
      // "base" for production, "base-sepolia" for testing
      network: "base",
      account,
    });
  }

  async onPaymentRequired(paymentRequirements: any): Promise<boolean> {
    const target: string = paymentRequirements?.resource ?? "";
    if (!target) {
      console.log("decision-gate: no resource in payment requirements; approving");
      return true;
    }

    let verdict: ScreeningVerdict;
    try {
      verdict = await screenPaymentTarget(target, SCREEN_TIMEOUT_MS);
    } catch (err) {
      console.log(`decision-gate: screening failed (${err}); approving`);
      return true;
    }

    if (verdict.level === "high") {
      console.log(
        `decision-gate: BLOCKED payment to ${target} ` +
          `score=${verdict.score} reasons=${verdict.reasons.join("; ")}` +
          (verdict.provenance ? ` provenance=${verdict.provenance}` : "")
      );
      return false;
    }
    if (verdict.level === "medium") {
      console.log(
        `decision-gate: approved with warning ${target} score=${verdict.score}`
      );
    }
    return true;
  }

  async onToolCall(toolName: string, toolArgs: unknown) {
    if (!this.x402Client) {
      throw new Error("x402 client not initialized");
    }
    return await this.x402Client.callTool(
      this.onPaymentRequired.bind(this),
      { name: toolName, arguments: toolArgs }
    );
  }
}
