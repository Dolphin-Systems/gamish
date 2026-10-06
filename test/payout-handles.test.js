import assert from "node:assert/strict";
import test from "node:test";
import { readPayoutHandles, sanitizePayoutHandles } from "../lib/payout-handles.js";

test("keeps trimmed usernames and drops emptied ones", () => {
  assert.deepEqual(sanitizePayoutHandles({ " Cash App ": "  $ricky ", Venmo: "", PayPal: "   " }), { "Cash App": "$ricky" });
});

test("rejects bad shapes and lengths", () => {
  assert.throws(() => sanitizePayoutHandles(null), /missing/);
  assert.throws(() => sanitizePayoutHandles(["$a"]), /missing/);
  assert.throws(() => sanitizePayoutHandles({ "Cash App": "x" }), /2 to 100/);
  assert.throws(() => sanitizePayoutHandles({ X: "$ricky" }), /2 to 32/);
  const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`App ${i}`, `@user${i}`]));
  assert.throws(() => sanitizePayoutHandles(many), /Too many/);
});

test("reads stored values defensively", () => {
  assert.deepEqual(readPayoutHandles(null), {});
  assert.deepEqual(readPayoutHandles('{"Chime":"$r"}'), { Chime: "$r" });
  assert.deepEqual(readPayoutHandles("not json"), {});
  assert.deepEqual(readPayoutHandles({ Venmo: "@r" }), { Venmo: "@r" });
});
