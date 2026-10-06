# Gamish777 games

Every game is its own folder here, built and versioned on its own, in any style or framework.
A game is connected to the platform at exactly one point, the SDK. The platform owns:

| Owned by the platform | Owned by the game |
| --- | --- |
| Credits and wallet, deposits, cash-outs | Everything the player sees and hears |
| **Randomness and the payout math** (server-side, `lib/game-models.js`) | How an outcome is presented (reels, a wheel, cards…) |
| Recording every round and event | Which events to report (`Gamish.track`) |
| The **back button** to the lobby (top-left) | Layout, animation, sound, rules screen |

A game never decides an outcome. It asks for a round, the server draws it with the crypto RNG
from the game's `math.json`, moves the credits, records the round, and returns the result.
The game's job is to show that result well.

## Start a new game

```bash
npm run game:new -- dragon-dice "Dragon Dice" "Table Games"
# design games/dragon-dice/…, tune games/dragon-dice/math.json, then:
npm run games      # validates every game, prints its RTP, regenerates the catalogue
npm run check      # syntax, catalogue freshness, tests
```

While designing, open `/games/<id>/index.html` directly from any static server run at the
repo root (for example `npx serve .`, then `http://localhost:3000/games/<id>/`). The SDK notices it isn't inside the app and runs a **preview**: 10,000 practice
credits and local randomness from the same `math.json`. Inside the app, the server decides.

The lobby lists a game as soon as it is in `games/catalog.json` (`npm run games` writes it):
a tile with the same title as an existing lobby tile becomes playable, and a new title gets its
own tile in its category, using `cover` art if it has one.

## Folder layout

```
games/<id>/
  game.json     public manifest (lobby listing)
  math.json     the odds — private: compiled into lib/games.generated.js for the server and
                never served by the live site (vercel.json redirects it)
  index.html    entry page; loads /platform/gamish-sdk.js
  …             any scripts, styles, images, sounds the game needs (relative paths)
```

### game.json

```jsonc
{
  "id": "lucky-wheel",              // = folder name: lowercase letters, digits, dashes
  "title": "Lucky Wheel",           // lobby name (matching an existing tile reuses its art)
  "category": "Table Games",        // Slots | Instant | Cards | Table Games | Numbers | Arcade | Quick Games
  "version": "1.0.0",               // bump when you ship changes (busts the player's cache)
  "runtime": "module",              // "module" = its own page; "builtin" = drawn by the main app (Phoenix Ruby)
  "entry": "index.html",
  "cover": "cover.webp",            // optional square lobby art for new titles
  "description": "Spin the wheel for up to 10× your bet.",
  "accent": "#ffc14f"
}
```

### math.json — the two central models

**weighted** — a table of outcomes. Slots, wheels, scratch cards, mystery boxes, pick-a-box…

```json
{
  "model": "weighted",
  "bets": [10, 20, 50, 100],
  "outcomes": [
    { "id": "miss", "weight": 50, "multiplier": 0 },
    { "id": "x2",   "weight": 10, "multiplier": 2 },
    { "id": "x10",  "weight": 2,  "multiplier": 10 }
  ]
}
```

The chance of an outcome is `weight / total weight`; it pays `bet × multiplier` (the bet is
taken first, so `1` returns the stake). The game receives the outcome `id` and shows it however
it likes: which reel symbols, which wheel segment, which card. **Visual frequency is not the
odds** — a wheel may show "10×" twice as often as the weights give it.

**target** — the player picks a target multiplier before the round. Crash, limbo, dice.

```json
{ "model": "target", "bets": [10, 20, 50], "targets": [1.5, 2, 3, 5, 10, 25], "rtp": 0.96 }
```

The server draws a point with `P(point ≥ target) = rtp / target`. The round returns
`outcome: "win" | "lose"`, the `multiplier` (the target, or 0), and `value` (the point,
e.g. where the rocket crashed) to animate.

**Live control.** The admin's Nerd page (Core settings → Nerd) can retune any game at any time
without touching its files: a target RTP, a max single win, a daily payout limit, and pause.
The engine reshapes the table each round to match (weighted games need at least one 0×
outcome for this), so a game must always present the `outcome` the server returns rather than
assume fixed odds. Wins are also paid only up to what the house bank holds.

**Rules enforced on every build and every round** (`lib/game-models.js`):
return to player between 50% and 97%; whole-number weights; multipliers 0–500 in steps of
0.01; bets are whole credits from 1 to 10,000; targets above 1 and at most 100. A game that
breaks a rule is refused by `npm run games` and cannot ship. Add a new model only in
`lib/game-models.js`, with tests — that file is the platform's central math.

## The SDK

```html
<script src="/platform/gamish-sdk.js"></script>
```

```js
const session = await Gamish.connect();
// session.game    { id, title, version }
// session.player  { loginId }
// session.wallet  { totalCredits, regularCredits, bonusCredits }
// session.math    { model, bets, outcomes: [{ id, multiplier }] | targets: [...] }  (no weights, no RTP)
// session.preview true when opened on its own

const round = await Gamish.play({ bet: 10 });            // weighted
const round = await Gamish.play({ bet: 10, target: 2 }); // target
// round: { roundId, gameId, bet, outcome, multiplier, payout, value?, wallet }
// errors: error.code "insufficient_credits" | "busy" | "round_failed"

Gamish.onWallet((wallet) => updateBalance(wallet.totalCredits));
Gamish.track("bonus_seen", { level: 2 });   // name: 1–40 of A-Z a-z 0-9 _ . : -  data: ≤ 2 KB JSON
Gamish.exit();                               // optional: same as the platform's back button
```

One round at a time: wait for `play()` before starting the next.

## Sandbox and layout

* Games run in an `<iframe sandbox="allow-scripts">`: no cookies, no `localStorage`, no access
  to the app page. Keep state in memory. Load your own files with relative paths; fonts and
  scripts from public CDNs are fine.
* **Landscape phones** (about 640–950 × 360–430 CSS px). Respect `env(safe-area-inset-*)`.
* **Keep the top-left 72 × 72 px clear** — the platform's back button lives there.
* Audio may only start after a tap inside the game.
* Never show an outcome before `play()` resolves, and always show the outcome it returned.

## Briefing an AI to make a game

> Build a Gamish777 game in `games/<id>/` following `games/README.md`. Theme: <theme>.
> Use the <weighted|target> model with an RTP of about <90>% and outcomes <…>.
> Landscape phone layout, keep the top-left 72 px clear, no `localStorage`. Use only
> `Gamish.connect`, `Gamish.play`, `Gamish.onWallet` and `Gamish.track`. Show the outcome the
> server returns with satisfying animation and sound. Then run `npm run games` and `npm run check`.

`games/_template/` is the smallest complete game; `games/lucky-wheel/` is a full example.
