import { HttpError } from "./http.js";

// Pure rules for deposit and cash-out requests (no database access, so they unit-test directly).
export const MIN_REQUEST_CENTS = 100;
export const MAX_DEPOSIT_CENTS = 100_000;
export const MAX_PENDING_PER_KIND = 3;

// Mirrors the reload chips on the player Payments page.
const DEPOSIT_BONUS_TIERS = [
  [10_000, 2_500],
  [5_000, 1_000],
  [2_000, 500],
];

export function depositBonusCents(amountCents) {
  const tier = DEPOSIT_BONUS_TIERS.find(([minimum]) => amountCents >= minimum);
  return tier ? tier[1] : 0;
}

export const cleanText = (value, max) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

export function validateRequestInput(input) {
  const kind = input.kind === "cashout" ? "cashout" : input.kind === "deposit" ? "deposit" : null;
  if (!kind) throw new HttpError(400, "Choose deposit or cash out", "invalid_request_kind");
  const amountCents = Number(input.amountCents);
  const maximum = kind === "deposit" ? MAX_DEPOSIT_CENTS : Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(amountCents) || amountCents < MIN_REQUEST_CENTS || amountCents > maximum) {
    throw new HttpError(400, kind === "deposit" ? "Deposits must be from $1 to $1,000" : "Cash outs must be at least $1", "invalid_request_amount");
  }
  const methodName = cleanText(input.methodName, 32);
  if (methodName.length < 2) throw new HttpError(400, "Choose a payment method", "invalid_request_method");
  const paymentHandle = cleanText(input.paymentHandle, 100);
  if (kind === "cashout" && paymentHandle.length < 2) {
    throw new HttpError(400, "Enter where you want to receive the cash out", "invalid_request_handle");
  }
  return { kind, amountCents, methodName, paymentHandle, note: cleanText(input.note, 140) };
}
