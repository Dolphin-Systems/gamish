import assert from "node:assert/strict";
import test from "node:test";
import { depositBonusCents, validateRequestInput } from "../lib/payment-rules.js";

test("deposit bonus follows the advertised reload tiers", () => {
  assert.equal(depositBonusCents(500), 0);
  assert.equal(depositBonusCents(1999), 0);
  assert.equal(depositBonusCents(2000), 500);
  assert.equal(depositBonusCents(5000), 1000);
  assert.equal(depositBonusCents(10_000), 2500);
  assert.equal(depositBonusCents(40_000), 2500);
});

test("validates deposit and cash-out requests", () => {
  const deposit = validateRequestInput({ kind: "deposit", amountCents: 2000, methodName: "  Cash   App ", note: "from $ricky" });
  assert.deepEqual(deposit, { kind: "deposit", amountCents: 2000, methodName: "Cash App", paymentHandle: "", note: "from $ricky" });
  const cashout = validateRequestInput({ kind: "cashout", amountCents: 150, methodName: "Chime", paymentHandle: "ricky-chime" });
  assert.equal(cashout.paymentHandle, "ricky-chime");
});

test("rejects malformed requests", () => {
  const code = (input) => { try { validateRequestInput(input); return "ok"; } catch (error) { return error.code; } };
  assert.equal(code({ kind: "gift", amountCents: 500, methodName: "Cash App" }), "invalid_request_kind");
  assert.equal(code({ kind: "deposit", amountCents: 99, methodName: "Cash App" }), "invalid_request_amount");
  assert.equal(code({ kind: "deposit", amountCents: 100_001, methodName: "Cash App" }), "invalid_request_amount");
  assert.equal(code({ kind: "deposit", amountCents: 10.5, methodName: "Cash App" }), "invalid_request_amount");
  assert.equal(code({ kind: "deposit", amountCents: 500, methodName: "" }), "invalid_request_method");
  assert.equal(code({ kind: "cashout", amountCents: 500, methodName: "Chime", paymentHandle: " " }), "invalid_request_handle");
});
