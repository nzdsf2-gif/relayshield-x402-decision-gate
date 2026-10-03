import test from "node:test";
import assert from "node:assert/strict";

const URL =
  "https://atq6wtkp6k.execute-api.us-east-1.amazonaws.com/prod/v1/composite-check";

async function check(body) {
  const resp = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(resp.status, 200);
  const parsed = await resp.json();
  assert.equal(parsed.ok, true);
  return parsed.data;
}

test("known-bad URL returns high with reasons and provenance", async () => {
  const data = await check({ url: "http://sandboxle.com.cn/" });
  assert.equal(data.level, "high");
  assert.ok(data.score >= 90);
  const reasons = (data.signals ?? []).flatMap((s) =>
    (s.reasons ?? []).map((r) => `${s.type}: ${r}`)
  );
  assert.ok(reasons.length > 0);
  assert.ok((data.corpus_provenance ?? [])[0]?.summary);
});

test("clean URL returns unknown without crashing", async () => {
  const data = await check({ url: "https://example.com/" });
  assert.equal(data.level, "unknown");
});

test("wallet check returns a verdict shape", async () => {
  const data = await check({
    wallet: "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
  });
  assert.ok(["high", "medium", "unknown"].includes(data.level));
  assert.ok(typeof data.score === "number");
});
