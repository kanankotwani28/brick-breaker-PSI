# Credits & asset licences

## Gameplay art — CC0 (public domain)

**Breakout (Brick Breaker) Game Tile Set — Free**
by ImagineLabs / Jamie Cross — https://imaginelabs.rocks

Released under [Creative Commons Zero (CC0 1.0)](http://creativecommons.org/publicdomain/zero/1.0/).
Quoting the pack's own `License.txt`: *"You may use these assets in personal and
commercial projects."*

CC0 places the work in the public domain: **no attribution is required, no
restrictions on commercial use, no licence to track.** This file exists as good
practice and a record of provenance, not because the licence demands it.

Used for: bricks and their cracked variants, unbreakable stone brick, bonus brick
base, paddle and wide paddle, ball, laser bolt, heart, star, and the power-up
capsules.

## Backgrounds — NEEDS RE-CONFIRMATION BEFORE RELEASE

> **The section below is out of date and its provenance has not been
> re-verified.** What the build actually ships today is **13** level
> paintings, embedded as JPEG data URIs in `www/index.html` under the keys
> `lvbg1`–`lvbg13`, mapped to the 25 levels by the `LVBG` table. The text
> below describes an earlier build that used three GUI Pro demo backgrounds,
> and refers to converter scripts (`kit_background.py`, `make_background.py`)
> that are not in this tree.
>
> A procedural generator (`renderBackground()`) is also still present and is
> the fallback for any level without a painting — so the claim further down
> that nothing is drawn procedurally any more is also wrong.
>
> **Before publishing, confirm where `lvbg1`–`lvbg13` came from and that the
> licence covers commercial redistribution inside a compiled app.** This is
> the one item in this file that a reviewer cannot settle from the code.

### Previously described (retained for history)

## Backgrounds — part of the purchased GUI Pro kit

The level backdrops come from the same purchased **GUI Pro - Casual Game** kit as
the interface (see the next section for the full licence note), specifically its
`PNG/Demo/Demo_Background` scene paintings. Three of the five are used:
`Background_02` (stone circle), `Background_04` (night forest floor) and
`Background_03` (amber clearing). The other two are hero illustrations with the
kit's demo characters composited in and aren't usable as backdrops.

The source art is 2560x1440 landscape; the game is 900x1600 portrait.
`kit_background.py` rebuilds each scene rather than cropping it (scaled and
anchored to the bottom, its own sky extended upward, the join cross-faded), then
darkens, desaturates, vignettes and dithers it. As with everything else from this
kit, the build embeds only flattened, resized, darkened JPEGs — never the source
PNGs.

### Previously: CraftPix (no longer used)

Earlier builds used **Free Horizontal 2D Game Backgrounds** by
[CraftPix](https://craftpix.net) (licence: https://craftpix.net/file-licenses/) for
the level backdrops, converted by `make_background.py`. That art is no longer
referenced by the build. The converter is kept in the tree in case it's ever wanted
back; if you re-enable it, note the CraftPix terms permit commercial use in personal
and client projects with no attribution, but **not** redistributing the raw art
files or shipping them in a form an end user could extract.

## Interface chrome — "GUI Pro - Casual Game" (purchased)

**GUI Pro - Casual Game**, a paid UI kit (purchased by the client; originally
distributed as a `.unitypackage`). Used for essentially every UI surface the
player sees: every CTA button (Play, Resume, Restart, Retry, Next, Replay,
Map, Level Map), the pause/home icon buttons, the level-select nodes
(locked/current/cleared), the star rating, the lives heart icon, the 5
power-up icons, every panel/popup/plate/scroll background (score, lives,
level-progress note, footer bar, pause/complete/game-over popups, the splash
title plate, the map scroll and its progress track), the splash-screen
mascot character and its ground shadow, the pre-game loading spinner, and
(as of this revision) all three level backdrops.

This is a paid, per-purchase-licensed asset, not CC0/permissive like the rest
of this project's art - **keep the original purchase receipt/invoice.** The
usual per-store terms (Unity Asset Store, GameDev Market, itch.io, etc. all
differ slightly) commonly restrict: reselling or redistributing the raw
source files (only the compiled game may be shipped - this build embeds
everything as flattened PNGs inside `index.html`, never the source pack), and
sometimes tie the licence to one purchasing entity/seat, meaning a client who
receives this project folder may need their own licence to use the *source*
kit again for further changes (the finished game itself is unaffected).
`gui_pro_theme.py` documents exactly which kit files feed which sprite, in
case that ever needs auditing.

Every one of those surfaces is REAL kit art - fixed-size icons/nodes used
as-is, CTA buttons rotated and 3-sliced from the kit's own button pill, and
every panel/popup/background 9-sliced from the kit's own navy popup graphic
(`Popup_Slide02_Single_Navy`). Nothing on screen is procedurally drawn by
this project any more except the four photographic level backdrops (CraftPix,
licensed separately above) and the star field behind them. See
`gui_pro_theme.py`'s module docstring for the full reasoning, including two
notable fixes: some kit source files are rotated 90° from their intended
orientation (a side effect of this pack being extracted from a Unity texture
atlas rather than imported through Unity's own pipeline), and the navy popup
graphic is a "slide-in drawer" shape - rounded only on its left edge - so it's
mirrored into a symmetric shape before being 9-sliced, or every panel would
have shown two square corners on the right.

Gameplay art (bricks, paddle, ball, power-up capsule shape) stays the CC0 tile
set above; only the icon each power-up capsule displays, and every other UI
surface around the gameplay, comes from the purchased kit.

## Typeface

See **Fonts** at the foot of this file for the list that actually ships.

> Corrected: this section used to credit **Roboto** and **Roboto Condensed**.
> Neither is embedded any more — the build carries four faces (Baloo 2
> ExtraBold, Luckiest Guy, Fredoka Bold, Fredoka Medium). The only surviving
> trace of Roboto is a `font-family:'RobotoCond'` on `body`, which matches no
> `@font-face` and silently falls back to `system-ui`; every Phaser text
> object names its own family, so nothing renders in it.

## Engine

**Phaser 3.90** — [MIT Licence](https://opensource.org/licenses/MIT), © Phaser Studio Inc.
Inlined directly into `www/index.html` as the first `<script>` block (~1.06 MB
minified). There is no `lib/` directory; this file previously described one.

**Capacitor 6** — MIT Licence, © Ionic. Used only for the Android wrapper.

---

### If you replace the art later

Everything above is either public domain or permissively licensed, so this build is
safe to ship commercially as-is. If you swap in a purchased pack, check its licence
for two things that commonly bite:

1. **Redistribution** — most licences forbid shipping the raw art files. Shipping a
   compiled game is fine; handing a client the source folder may not be.
2. **Per-seat / per-entity limits** — some licences are tied to one legal entity, so
   a client who receives the project may need their own licence.

## UI asset pack

Interface chrome (buttons, panels, frames, resource bar, picto icons) is
from **GUI Pro - Casual Game 2.0**, used under the licence it was
purchased with. Source PNGs are nine-slice masters; they are sliced at
runtime into whatever size each control needs, so nothing is upscaled.

Files used:
  Components/Button/Button01_195_{Green,Yellow,Blue,Gray}.png
  Components/Button/Button_Circle147_White.png
  Components/Popup/Popoup01~03_White_Bg.png
  Components/Frame/BasicFrame_Round20.png
  Components/UI_Etc/ResourceBar_{Bg,Icon_Gold,Btn_Single_Yellow}.png
  Components/Icon_PictoIcons/512/Pictoicon_{Arrow_Prev,Gear,Control_Pause,Lock}.Png

## Fonts

Subset to the Latin glyphs the game renders, embedded as base64 `@font-face`
rules in `www/index.html`. Four faces, ~105 KB of base64 in total:

  Baloo 2 ExtraBold  - OFL 1.1 - display text, titles, level names
  Luckiest Guy       - Apache 2.0 - headline text
  Fredoka Bold       - OFL 1.1 - button labels
  Fredoka Medium     - OFL 1.1 - stats and captions

All are embedded as base64 so the app needs no network access.
