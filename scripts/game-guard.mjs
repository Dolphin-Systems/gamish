// Guardrail for game-only work: fails unless a change touches exactly one module game's
// folder (plus the catalogue files generated from it), and the game keeps to the platform's
// rules. Run by CI on every pull request from a `game/...` branch, and by game sessions
// before they push:   node scripts/game-guard.mjs [base-ref]
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const GENERATED = new Set(["games/catalog.json", "lib/games.generated.js"]);
const MAX_FILE = 8 * 1024 * 1024;
const MAX_GAME = 25 * 1024 * 1024;
// Things a sandboxed game can't do anyway; flagged so the mistake is explained, not silent.
const FORBIDDEN = [
  [/\/api\//, "calls the platform API directly (use the Gamish SDK)"],
  [/document\.cookie/, "reads cookies (games are sandboxed and have none)"],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, "uses browser storage (keep state in memory)"],
  [/\bwindow\.(parent|top)\b(?!\s*!==?\s*window)/, "reaches into the app page (use the Gamish SDK)"],
];

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const problems = [];

const base = process.argv[2] || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
// Porcelain lines are "XY path" (or "XY old -> new"); untracked folders are listed file by file.
const uncommitted = git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean)
  .map((line) => line.slice(3).split(" -> ").pop().replace(/^"|"$/g, ""));
const files = [...new Set([...changed, ...uncommitted])];

const gameIds = new Set();
for (const file of files) {
  if (GENERATED.has(file)) continue;
  const match = /^games\/([a-z0-9][a-z0-9-]{1,39})\//.exec(file);
  if (match) gameIds.add(match[1]);
  else problems.push(`${file}: outside the game's folder. Game work may only change games/<id>/.`);
}
if (gameIds.size > 1) problems.push(`changes more than one game (${[...gameIds].join(", ")}): one game per pull request.`);

for (const id of gameIds) {
  const dir = join(ROOT, "games", id);
  const manifest = JSON.parse(await readFile(join(dir, "game.json"), "utf8").catch(() => "{}"));
  if (manifest.runtime !== "module") problems.push(`games/${id}: only module games can be built here (this one is "${manifest.runtime ?? "missing"}").`);
  let total = 0;
  const walk = async (folder) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      const relative = path.slice(ROOT.length);
      const info = await lstat(path);
      if (info.isSymbolicLink()) { problems.push(`${relative}: symbolic links aren't allowed.`); continue; }
      if (entry.isDirectory()) { await walk(path); continue; }
      total += info.size;
      if (info.size > MAX_FILE) problems.push(`${relative}: ${(info.size / 1048576).toFixed(1)} MB, over the 8 MB per-file limit.`);
      if (/\.(m?js|html?)$/i.test(entry.name)) {
        const text = await readFile(path, "utf8");
        for (const [pattern, why] of FORBIDDEN) if (pattern.test(text)) problems.push(`${relative}: ${why}.`);
      }
    }
  };
  await walk(dir).catch(() => problems.push(`games/${id}: folder missing.`));
  if (total > MAX_GAME) problems.push(`games/${id}: ${(total / 1048576).toFixed(1)} MB in all, over the 25 MB limit.`);
}

// The catalogue must be regenerated from the game folders, not edited by hand.
try {
  execFileSync(process.execPath, ["scripts/games.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
} catch (error) {
  problems.push(`catalogue: ${String(error.stderr || error.message).trim()}`);
}

if (problems.length) {
  console.error(`Game guard failed:\n${problems.map((problem) => `  ✗ ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(gameIds.size ? `Game guard passed for games/${[...gameIds][0]}.` : "Game guard: no game changes.");
