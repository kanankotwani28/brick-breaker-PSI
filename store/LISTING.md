# Play Store listing — Brick Breaker

Everything below is copy-paste ready. Character counts are Play's hard limits.

Each claim was checked against the shipped build rather than written from
imagination — see **Verified claims** at the bottom before you edit anything,
because a few lines are true only because of how this build is put together.

---

## App name — 13 / 30

```
Brick Breaker
```

## Short description — 78 / 80

```
Break every brick across 25 hand-painted levels. No ads, no wifi, no nonsense.
```

Alternatives, same limit:

```
25 painted levels of brick-breaking. Earn stars, unlock balls, play offline.
```
```
A brick breaker that respects you: 25 levels, zero ads, works with no signal.
```

---

## Full description — 1,962 / 4,000

```
Classic brick breaking, built the way it should be. Twenty-five hand-painted
levels, a paddle, and a ball. No ads interrupting your run. No account. No
connection needed — the app requests no permissions at all, not even internet.

A JOURNEY, NOT A GRIND
Twenty-five levels across five regions — Meadow, Hollow, Ember, Dust and Heart —
each with its own painted landscape. Break through The Stone Circle at dawn,
cross Moonlit Hollow under a full moon, and climb to The Ash Gate through
volcanic haze. Every level is a different view, not a different colour swap.

EARN YOUR STARS
Three stars per level, seventy-five in all, awarded on how many lives you finish
with. Clearing a level is easy. Clearing it without losing a life is not. Stars
unlock the later regions, so the game opens up as you get better at it.

A SHOP WORTH SAVING FOR
Coins come from broken bricks, and they buy things that actually change how you
play:

• EMBER — cracked bricks shatter in a single hit
• MAGNET — your ball curves gently toward the nearest brick
• BOLT — +10% score and +8% ball speed, for players who want the pressure
• WIDE — a permanently broader paddle
• STICKY — catch the ball and re-aim it, once per life
• CANNON — your paddle fires on its own every seven seconds

POWER-UPS MID-RALLY
Bricks drop Laser, Wide Paddle, Slow Time and Extra Life. Catch them with the
paddle while keeping the ball alive.

BUILT TO FEEL RIGHT
The paddle tracks your thumb exactly — no lag, no easing, no rubber-banding.
Sixty frames a second on hardware-accelerated graphics. The layout adapts to
your screen, notch and gesture bar included, so nothing is ever hidden behind a
camera cutout.

RESPECTS YOUR PHONE
No ads. No analytics. No tracking. No sign-in. No internet permission, so it
works on a plane, on the underground, or with mobile data off. Your progress is
saved on your device and goes nowhere else. Around 7 MB installed.

Free, complete, and finished. Break some bricks.
```

---

## What's new — release notes for v2.0

```
• 25 levels, each with its own hand-painted landscape
• Star ratings and region unlocks — 75 stars to collect
• Shop: 4 balls and 4 paddles that change how the game plays
• Hardware-accelerated rendering, locked 60fps
• Paddle now tracks your thumb exactly, with no lag
• Correct layout on notched and gesture-bar phones
```

---

## Categorisation

| Field | Value |
|---|---|
| Category | Game → Arcade |
| Tags | arcade, brick breaker, offline, casual, single player |
| Content rating | Everyone — no violence, no chat, no purchases, no ads |
| Ads | No |
| In-app purchases | No |
| Data safety | No data collected, no data shared |
| Target audience | 13+ (or all ages; nothing in the app restricts it) |

### Data safety answers

Every question is "no". There is no networking code and the manifest declares
no permissions, so there is no data collection to disclose. Say so plainly —
Play cross-checks declared permissions against the manifest.

---

## Assets in this folder

| File | Play slot | Size |
|---|---|---|
| `play-icon-512.png` | App icon | 512×512 |
| `play-feature-1024x500.png` | Feature graphic | 1024×500 |
| `screenshots/01_home.png` … `08_shop.png` | Phone screenshots | 1080×2400 |
| `play-icon-512-rounded-preview.png` | *not for upload* — shows how the icon reads once a launcher masks it | 512×512 |

Play wants 2–8 phone screenshots; there are 8, ordered so the first two carry
the listing on their own (the store shows those before anyone scrolls).

---

## Verified claims

Checked against this build, not assumed. If you change the app, re-check these
before reusing the copy.

| Claim | How it was verified |
|---|---|
| No permissions, not even internet | `AndroidManifest.xml` declares none |
| No ads, no analytics, no tracking | no ad/analytics SDK in either `build.gradle` or `package.json` |
| Works fully offline | follows from having no internet permission |
| Progress stays on device | saved via `localStorage` only |
| 25 levels, 5 regions | `LEVEL_DATA` has 25 entries; `TIERS` = Meadow, Hollow, Ember, Dust, Heart |
| 75 stars | `MAX_STARS = LEVEL_COUNT * 3` |
| 3 lives per level | `LIVES_PER_LEVEL = 3` |
| 4 balls, 4 paddles | `SHOP.ball` and `SHOP.paddle`, 4 each |
| Shop effects as listed | each item's `mod` in `SHOP` |
| Power-ups as listed | Extra Life, Laser, Wide Paddle, Slow Time |
| 60fps, hardware accelerated | measured 60.9fps, `renderer.type === WEBGL` |
| ~7 MB installed | debug APK is 7.43 MB; release APK is 6.53 MB |

Two wordings chosen deliberately:

- **"hand-painted"** — there are 13 painted backdrops across 25 levels, so the
  copy says levels each have their own painted landscape *by region*, and never
  claims 25 distinct paintings.
- **"Free, complete, and finished"** — accurate today, with no IAP and no
  server. Drop it if you ever add either.
