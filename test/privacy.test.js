import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// The live site serves the repo's files, so anything server-only must be redirected away in
// vercel.json (Vercel applies redirects before serving files).
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const blocked = (path) => (vercel.redirects || []).some(({ source }) => {
  const pattern = new RegExp(`^${source.replace(/[.]/g, "\\.").replace(/:path\*/g, ".*").replace(/:[a-z]+/g, "[^/]+")}$`);
  return pattern.test(path);
});

test("server-only files are never served", async () => {
  for (const path of [
    "/lib/games.generated.js", "/lib/game-models.js", "/lib/house.js", "/lib/db.js",
    "/scripts/games.mjs", "/test/game-models.test.js", "/package.json", "/BACKEND.md",
    "/games/README.md", "/games/AI_SESSION.md", "/games/_template/math.json", "/games/_template/index.html",
  ]) assert.ok(blocked(path), `${path} is publicly downloadable`);
  const games = (await readdir(new URL("../games", import.meta.url), { withFileTypes: true })).filter((entry) => entry.isDirectory());
  for (const game of games) assert.ok(blocked(`/games/${game.name}/math.json`), `${game.name}'s odds are public`);
});

test("players can still load the app and the games", () => {
  for (const path of ["/", "/index.html", "/app.js", "/game.js", "/games/catalog.json", "/games/lucky-wheel/index.html",
    "/games/lucky-wheel/wheel.js", "/platform/gamish-sdk.js", "/assets/gamish-game-icons.png", "/admin.html"]) {
    assert.ok(!blocked(path), `${path} is blocked`);
  }
});

test("the public catalogue carries no odds", async () => {
  const catalog = JSON.parse(await readFile(new URL("../games/catalog.json", import.meta.url), "utf8"));
  for (const game of catalog.games) {
    assert.ok(!("rtp" in game.math), `${game.id} exposes its RTP`);
    for (const outcome of game.math.outcomes || []) assert.ok(!("weight" in outcome), `${game.id} exposes weights`);
  }
});
