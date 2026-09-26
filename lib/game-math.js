import { randomInt } from "node:crypto";

export const BET_OPTIONS = [10, 20, 40];
export const SYMBOL_MARKS = ["7", "◆", "♛", "✦", "R"];
export const THEORETICAL_RTP = 0.8;
export const THEORETICAL_HIT_RATE = 0.4;

export function outcomeFromRoll(roll) {
  if (!Number.isInteger(roll) || roll < 0 || roll > 29) throw new RangeError("Roll must be an integer from 0 to 29");
  if (roll < 18) return 0;
  if (roll < 26) return 1.5;
  return 3;
}

export function drawOutcome() {
  return outcomeFromRoll(randomInt(30));
}

export function buildResultMarks(multiplier, pick = () => randomInt(SYMBOL_MARKS.length)) {
  const marks = Array.from({ length: 9 }, () => SYMBOL_MARKS[pick()]);
  if (multiplier === 3) {
    marks[3] = "7";
    marks[4] = "7";
    marks[5] = "7";
  } else if (multiplier === 1.5) {
    marks[3] = "◆";
    marks[4] = "◆";
    marks[5] = "◆";
  } else if (marks[3] === marks[4] && marks[4] === marks[5]) {
    const replacement = SYMBOL_MARKS.find((mark) => mark !== marks[4]);
    marks[5] = replacement;
  }
  return marks;
}
