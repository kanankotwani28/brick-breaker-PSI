# Known issues

## Fixed after v2.0.1 — not yet in a released build

The shipped `BrickBreaker-v2.0.1.apk` / `.aab` predate these. Rebuild (and
bump `versionCode`) before uploading. Each fix is commented at its site.

| Issue | Where |
|---|---|
| **Hardware back button** closed the app from every screen, mid-rally included. `MainActivity` now intercepts the key and asks the game via `window.bbBack()`: Home closes the settings popup or exits; Level Select and Shop go to Home; in play, back pauses, back again resumes, and Level Complete / Out of Lives go to the level map. No new dependency — done natively rather than via `@capacitor/app`. JS paths tested in a browser; the Java compiles, but **the physical key itself still needs a device check**. | `MainActivity.java`, `bbBack`, each scene's `onBack()` |
| PLAY could launch a **locked** level. `nextLevel()` fell back to level 25 without checking the lock, so a player short of a star gate (e.g. levels 1–5 on 1 star each) was sent straight to the last level. Now picks the first uncleared level, else the first under 3 stars. `Play.init` also refuses a locked level. | `SAVE.nextLevel`, `Play.init` |
| **STICKY paddle (800 coins) did nothing** — `stickyLeft` was set every life and never read. Now catches the main ball once per life; tap to relaunch. | `Play.onPaddleHit` |
| **EMBER ball (300 coins) did nothing** — it only sped up already-cracked bricks, which have 1 hp anyway. Now two-hit bricks break in one hit; shop text updated to match. | `Play.damageBrick`, `SHOP.ball` |
| Losing the original ball cost a life even with multi-balls still in play. Now a surviving extra ball takes over; a life goes only when the last ball is gone. Extra balls' colliders are also removed with the ball rather than at level end. | `Play.update`, `Play.destroyExtraBall` |
| Settings popup did not block taps — PLAY / LEVELS / SHOP behind it still fired, and leaving that way left the gear dead for the session. RESET PROGRESS erased everything on one tap; it now needs a second tap within 2.5 s. | `Home.create`, `Home.showSettings` |
| Shop: a swipe that started on the BUY button **spent the coins**, because buttons fire on press. The shop button now fires on release, and not after a swipe. The first page-dot tap after a swipe was also ignored. | `pill(..., opts)`, `Shop.buildItem`, `Shop.redraw` |
| **Coins appeared to grow on their own.** Level Complete showed only brick + clear coins; the one-time star coins (15 per new star) were credited silently, so the shop balance was higher than the game had said. It now shows the full amount credited. Pause now says "COINS ON CLEAR", since brick coins are lost if you leave by MAP. | `SAVE.completeLevel`, `Play.showComplete`, `Play.showPause` |
| **Levels 16 (PILLARS OF DUST) and 25 (HEARTWOOD) could not be finished.** Stones touching corner to corner formed a sealed wall the ball (46 px) cannot pass — the gap between bricks is 12 px — leaving 12 and 26 bricks unreachable. Because level 17 needs 16 cleared and tier 5 needs 47 stars (only 45 exist by then), **levels 17–25 were unreachable for every player.** Two stones in each wall are now 2-hit bricks. `tests/check-levels.js` proves every brick in every level is reachable. | `LEVEL_DATA` |
| Tapping a popup button (TRY AGAIN, NEXT, REPLAY, RESUME) also counted as the "tap to launch": the level restarted with the ball already flying, and the paddle jumped to where the button was. Tapping pause likewise dragged the paddle to the far right. The Play screen now ignores taps that land on a button. | `Play.create` pointerdown |
| **Level 18 (EMBERFALL) dragged on.** Winnable, but its last bricks sat in edge pockets reachable only sideways through a one-row gap: the playtest bot needed 4–7 minutes and cleared only 2 of 4 runs inside 7. Four of its ten stones are now 2-hit bricks (row 3 col 2, row 4 col 5, both ends of row 5), opening a lane up each wall — now 6 of 6 runs clear in 70–190 s, in line with the other late levels. | `LEVEL_DATA` |
| The coin "+" looked like a "get more coins" button but did nothing. The whole coin capsule now opens the Shop (inert on the Shop screen and while Settings is open). | `coinBar` |
| **Replay farming** (economy change, not a defect). Brick coins scale with brick count, not difficulty, so replaying level 1 (65 coins) was the best grind — ~72 replays bought the whole 4,700 shop. Replaying a level that *already* had 3 stars now pays half the brick + clear coins (`COIN_MASTERED_MUL`): level 1 drops to 32, level 25 to 56. First clears, and any replay that earns a missing star, still pay in full (a perfect first clear of level 1 is still 110). | `SAVE.completeLevel` |
| Out of Lives announced NEW PERSONAL BEST but never saved it (bests were only saved on a clear); it also fired on a tie. | `SAVE.recordScore`, `Play.showGameOver` |
| Power-up bonuses (+50) skipped `levelScore`, so retrying let them accumulate in the run score. All scoring now goes through `addScore()`. | `Play.addScore` |
| Multi-ball caught while the ball rested on the paddle sent the new balls sideways (one slightly downward). They now fan out upward. | `Play.applyPowerUp` |

## Fixed in v2.0.1 (versionCode 3)

| Issue | Where |
|---|---|
| **Shipped build targeted API 34** while `variables.gradle` already said 35 — the .aab predated the bump, so Play rejected it. Bumping the value is not enough; the artifact has to be **rebuilt**. | `android/variables.gradle` was already correct; `BrickBreaker-v2.0.aab` was stale |
| Shop carousel could not be swiped after the first visit. `setupSwipe()` binds scene-level input once per visit behind a `swipeReady` guard, but Phaser reuses the scene *instance* while destroying its input listeners on shutdown — so the guard skipped the re-bind and the handlers were gone. Page dots still worked, which disguised it. | `Shop.init` |
| Personal best inflated without limit. `RUN.score` is module-level and outlived the scene, so re-entering a level from MAP carried the previous run's score in: clearing level 1 twice banked double one level's score. Same defect `retryLevel()` already guarded, reached by the other door. | `Play.create` |
| The EXTRA LIFE pickup allows up to 5 lives, but the capsule art has 3 heart slots — the 4th and 5th were awarded and shown nowhere, so the pickup read as doing nothing. Now counted in a `+N` in the capsule's right margin. | `Play.buildHUD` / `Play.refreshHUD` |
| `completeLevel`'s comment claimed replaying a level for coins "is not profitable". Star coins are indeed paid once, but brick coins and the clear bonus pay on **every** clear — level 1 yields 65 a clear against a 4,700 shop. Behaviour left as-is (it is the only repeatable income); the comment now says what it does. | `SAVE.completeLevel` — comment only |
| Build scripts and README still described a Gradle 8.2.1 wrapper and warned against JDK 21. The wrapper is 8.7 (AGP 8.6.1), which needs JDK 17–21 — and **fails** on 24/25. Android Studio's bundled JBR is now 25, so it is no longer a safe default. `build-aab.bat` now verifies a candidate JDK with `java -version` instead of trusting the path. | `build-aab.bat`, `build-release.bat`, `build-*.sh`, `README.md` |
| `CREDITS.md` and `PLAY_STORE.md` described an earlier tree (Roboto fonts, `lib/phaser.min.js`, `android-project/`, `src/game.js`, `build.py`). Corrected where verifiable; background provenance flagged for owner confirmation. | `CREDITS.md`, `PLAY_STORE.md` |

## Not yet addressed

### Some late levels end in "last brick" hunts (difficulty, not a defect)
Every level can be finished. Levels 20, 21 and 22 often end with one brick
in a pocket behind stones — level 20 needed four restarts in one playtest
run. Left as designed; a human play-through should decide whether to open
those pockets the way level 18's were (see above).

### A window resize mid-level restarts the level
The app is portrait-locked, so on phones only split-screen / pop-up window
triggers this, but the rally in progress is lost when it does.

### Duplicated web build
`www/index.html` and `android/app/src/main/assets/public/index.html` are
byte-identical, so the 2.1 MB payload is in the repo twice. The second is
generated by `npx cap sync` and could be gitignored.

## Fixed in v2

| Issue | Where |
|---|---|
| `refreshHUD()` destroyed and rebuilt Game Objects every frame | `Play.buildHUD` / `Play.refreshHUD` — meter built once and redrawn only on change; `refit()` early-returns on an unchanged string |
| Brick count recomputed by `.filter()` on every hit and every frame | `Play.buildLevel` — running `bricksLeft` counter |
| Power-up `glow` sprites leaked on every catch | `Play.onDropCaught`, `Play.buildLevel` |
| Multi-ball colliders never removed from the physics world | `Play.destroyExtraBalls`, `Play.applyPowerUp` |
| Infinite alpha tweens outlived destroyed bonus bricks | `Play.damageBrick` |
| Score carried across retries, inflating personal best | `Play.retryLevel` |
| Dead `speed` variable in `launchBall` | removed |
| Redundant world-bounds overshoot | `Play.create` |
| Multi-ball stacked without limit | `Play.applyPowerUp` (capped at 6) |
| 371 KB of background PNGs upscaled ~9.6x on device | replaced by the procedural generator |
