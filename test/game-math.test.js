import test from "node:test";
import assert from "node:assert/strict";
import { buildResultMarks, outcomeFromRoll } from "../lib/game-math.js";

test("outcome table has 18 losses, 8 small wins, and 4 large wins", () => {
  const outcomes = Array.from({ length: 30 }, (_, roll) => outcomeFromRoll(roll));
  assert.equal(outcomes.filter((value) => value === 0).length, 18);
  assert.equal(outcomes.filter((value) => value === 1.5).length, 8);
  assert.equal(outcomes.filter((value) => value === 3).length, 4);
  assert.equal(outcomes.reduce((sum, value) => sum + value, 0) / 30, 0.8);
});

test("winning grids match the center payline", () => {
  assert.deepEqual(buildResultMarks(3, () => 4).slice(3, 6), ["7", "7", "7"]);
  assert.deepEqual(buildResultMarks(1.5, () => 4).slice(3, 6), ["◆", "◆", "◆"]);
});

test("loss grids cannot accidentally contain a center match", () => {
  const grid = buildResultMarks(0, () => 0);
  assert.notEqual(grid[4], grid[5]);
});
