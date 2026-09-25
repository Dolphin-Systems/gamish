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

## Phoenix Ruby game model

Phoenix Ruby is the first complete playable game and uses virtual credits with no cash value. Each bet level has its own cryptographically shuffled 30-spin outcome bag:

- 18 outcomes pay `0×`.
- 8 outcomes pay `1.5×`.
- 4 outcomes pay `3×`.

That produces 12 winning outcomes per 30 spins (`40%` hit rate) and returns 24 stakes across each completed same-bet cycle (`80%` RTP). Short sequences can return more or less because the outcomes are shuffled; the configured return is measured across the complete cycle for a given bet level.

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
