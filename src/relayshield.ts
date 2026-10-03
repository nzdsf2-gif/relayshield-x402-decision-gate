/**
 * RelayShield screening client for the decision gate.
 *
 * POSTs the payment target to RelayShield's free, keyless composite-check
 * and returns a normalized verdict. The check never says "safe": the best
 * case is "unknown" (nothing known against it), which the gate treats as
 * approval-worthy but not as proof of safety.
 */

export interface ScreeningVerdict {
  level: "high" | "medium" | "unknown";
  score: number;
  reasons: string[];
  provenance: string | null;
}

const COMPOSITE_CHECK_URL =
  "https://atq6wtkp6k.execute-api.us-east-1.amazonaws.com/prod/v1/composite-check";

export async function screenPaymentTarget(
  url: string,
  timeoutMs: number
): Promise<ScreeningVerdict> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(COMPOSITE_CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      throw new Error(`composite-check HTTP ${resp.status}`);
    }
    const body = (await resp.json()) as any;
    const data = body?.data ?? {};
    const level = data.level;
    const reasons: string[] = [];
    for (const s of data.signals ?? []) {
      for (const r of s.reasons ?? []) {
        reasons.push(`${s.type}: ${r}`);
      }
    }
    const prov = (data.corpus_provenance ?? [])[0];
    return {
      level: level === "high" || level === "medium" ? level : "unknown",
      score: typeof data.score === "number" ? data.score : 15,
      reasons,
      provenance: prov?.summary ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
