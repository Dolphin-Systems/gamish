# Gamish777 — Ember Crown Arcade

## Theme

Ember Crown Arcade is a premium fantasy-casino world built around blackened brass, deep plum, oxblood, molten orange, and small cyan highlights. The visual language combines enchanted palace architecture with modern game-cabinet clarity.

## Experience

- **Landing scene:** a cinematic citadel, animated embers, live-feeling jackpot values, a rotating crown seal, and one focused entry action.
- **Game Zone:** a grand portal hall containing four original game worlds presented as interactive cabinets.
- **Motion:** slow atmospheric drift, ember particles, pulsing brass light, short tactile button responses, and camera fades between scenes.
- **Typography:** Cinzel Decorative for high-value display moments; DM Sans for readable controls and supporting copy.
- **Audio:** lightweight synthesized cues for navigation, reels, wins, losses, payments, and messages. Audio begins only after a user gesture and includes a persistent top-level mute control.

## Original game worlds

1. **Phoenix Ruby** — molten-gold phoenix and ruby jackpot energy.
2. **Dragon Vault** — midnight dragon, cyan crystal, and guarded treasure.
3. **Solar Fortune** — crowned lion and amber wheel of fortune.
4. **Moon Fox** — celestial fox, moon ring, and opal coin rewards.

## Phoenix Ruby game feel

Phoenix Ruby is the first complete playable game and uses virtual credits with no cash value. It is designed phone-first, with one screen and the controls within thumb reach:

- **Balance bar:** balance (tap to refresh) and last win, with count-up animations.
- **Reels:** masked reel strips that blur while spinning and land with a bounce. Swipe down on the reels to spin; tap them (or Stop) to land the reels early.
- **Controls:** a bet stepper (10/20/40), a round Spin button, and a 10-spin Auto mode that ends on a big win, low credits, or a tap.
- **Wins:** the center line glows, coins fly into the balance, and three Golden Sevens open a tap-to-collect Big Win card.
- **Ember Collection:** every Phoenix crest flies a gem into the collection bar; ten gems unlock the next realm theme (Ember → Crimson → Solar → Royal → Ascendant), which recolors the machine glow and win line.
- **Rules:** tapping a payout chip or *Rules & Payouts* opens the rules sheet.
- **Feedback:** synthesized sound cues and light vibration on supported phones.

### Performance and robustness

- **Pre-drawn UI:** static panels, gradients and the Spin ring are drawn once into shared textures. Phaser would otherwise re-tessellate Graphics paths every frame.
- **Frame rate:** capped at 60 fps, and the game loop sleeps while the Wallet or Messages page covers it.
- **Input:** Spin presses closer than 140 ms apart are ignored, press animations always settle back at full size, and overlays stop their child tweens before being destroyed.
- **Network:** spin requests time out after 15 s, and the balance is re-read from the server after any failed spin.
- **Audio:** noise buffers are cached, and the same cue can't retrigger within 40 ms.

## Generated assets

- `assets/gamish777-icon-master.png` — original high-resolution Ember Crown brand mark.
- `icon-192.png` / `icon-512.png` — standard PWA icons.
- `icon-maskable-192.png` / `icon-maskable-512.png` — opaque safe-area PWA icons for adaptive launcher crops.
- `favicon-16.png` / `favicon-32.png` / `apple-touch-icon.png` — browser and iOS home-screen icons.
- `assets/ember-citadel.webp` — landing environment.
- `assets/portal-hall.webp` — Game Zone environment.
- `assets/phoenix-ruby.webp` — Phoenix Ruby cabinet art.
- `assets/dragon-vault.webp` — Dragon Vault cabinet art.
- `assets/lion-fortune.webp` — Solar Fortune cabinet art.
- `assets/moon-fox.webp` — Moon Fox cabinet art.

The imagery was generated as original project artwork and compressed to WebP for mobile delivery.

## Landscape PWA

The player app is landscape-only. The manifest declares `"orientation": "landscape"`, Android installs lock to it, and a phone held upright shows a "Turn your phone sideways" prompt.

- **Stage:** every scene is laid out on a 1536×720 landscape stage. The canvas takes the screen's exact aspect ratio. The camera centres the stage inside the safe area, clear of the notch on either side and of the home bar, and background art fills the rest. Nothing is letterboxed.
- **Sharpness:** on high-density screens the game renders at up to 1.6× (within a 3.4-megapixel budget), and text is rasterised at that scale.
- **Lobby:** a top bar with the balance pill (opens the wallet), chat, sound and profile. Category chips filter the catalogue. A featured Phoenix Ruby card leads a two-row tile strip that scrolls sideways.
- **Scrolling:** drags track the finger 1:1 (no pointer smoothing) and fling with momentum. The strip rubber-bands at the ends. Touching a gliding strip stops it without opening a game, and a drag never counts as a tap.
- **Phoenix Ruby:** balance, last win, the gem collection, payouts and "How to win" on the left. Reels in the centre. Bet, SPIN and AUTO on the right, under the thumb.
- **Intro:** plays once per session, and a tap anywhere enters the lobby.
- **Touch:** the canvas sets `touch-action: none`, so the browser never holds a touch back for scrolling or zooming.
- **Icon bar:** the page's floating icon bar is hidden in-game, because the lobby and game have their own buttons. It shows on the Wallet and Chat pages, which use two-column landscape layouts.

