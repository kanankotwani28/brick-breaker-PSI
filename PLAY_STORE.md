# Publishing Brick Breaker to Google Play

This folder contains a ready-to-build Android project. You need **Android Studio**
(free) to produce the signed file Google Play accepts.

> **Fastest path: run `build-aab.bat`.** It handles the JDK, the SDK path, the
> www→assets sync, the keystore and the build, and drops a signed
> `BrickBreaker-v2.0.aab` and `.apk` in this folder. The Android Studio route
> below is the manual equivalent, kept for when you want to drive it by hand.

---

## 1. Install the tools (once)

1. Download **Android Studio**: https://developer.android.com/studio
2. Install it with the default options (this includes the Android SDK and JDK).

## 2. Open the project

1. Launch Android Studio → **Open**
2. Select the folder `brickbreaker/android`
3. Wait for Gradle to finish syncing (a few minutes the first time — it downloads
   the build tools). If it prompts to upgrade the Gradle plugin, accept.

## 3. Test it on a device

Plug in an Android phone with USB debugging on, or start an emulator, then press
the green ▶ **Run** button. The game installs and launches.

## 4. Create your signing key (once, and never lose it)

Play requires every app to be signed. In Android Studio:

**Build → Generate Signed Bundle / APK → Android App Bundle → Create new…**

Fill in the key store path, a password, an alias, and your details.

> **This keystore file is irreplaceable.** If you lose it you can never update the
> app under the same listing again — you would have to publish a brand-new app and
> lose all installs and reviews. Back it up somewhere safe and private, and do
> **not** commit it to git.

## 5. Build the release bundle

**Build → Generate Signed Bundle / APK → Android App Bundle → release**

The output lands at:

```
brickbreaker/android/app/build/outputs/bundle/release/app-release.aab
```

That `.aab` (Android App Bundle) is what you upload — Play stopped accepting plain
APKs for new apps. An APK is still useful for sideloading to testers: use
**Build → Build Bundle(s)/APK(s) → Build APK(s)** for that.

---

## 6. Play Console setup

1. Create a developer account at https://play.google.com/console — **one-time $25 fee**.
2. **Create app** → name it, pick "Game", "Free".
3. Work through the tasks Play lists. The ones that need real answers:

| Item | What applies to this game |
|---|---|
| **Privacy policy** | Required for every app, even offline ones. You need a public URL. |
| **Data safety** | This game collects **nothing** and has **no internet permission**. Answer "No data collected". |
| **Ads** | Contains **no ads**. Answer "No". |
| **Content rating** | Fill in the questionnaire — a brick breaker with no violence/content rates **Everyone / PEGI 3**. |
| **Target audience** | If you select under-13, extra Families Policy rules apply. Simplest is 13+. |
| **App icon** | `store/play-icon-512.png` (512×512) is ready. |
| **Feature graphic** | `store/play-feature-1024x500.png` is ready. |
| **Screenshots** | Eight are ready in `store/screenshots/` (Play needs at least 2). |

### Testing tracks
New developer accounts generally must run a **closed test with real testers** before
being allowed to publish to production. Plan for that — it is not instant. Start the
closed test early while you prepare the store listing.

---

## Changing the app identity

Set these **before** your first upload — the package name is permanent once published:

- **Package name / appId** — currently `com.psi.brickbreaker`. Change it in
  `capacitor.config.json` **and** in `android/app/build.gradle`
  (`namespace` + `applicationId`), then run `npx cap sync android`.
- **App name** — `capacitor.config.json` (`appName`), and
  `android/app/src/main/res/values/strings.xml`.
- **Version** — `android/app/build.gradle`: bump `versionCode` (an integer, must
  increase every upload) and `versionName` (the string users see).

## Updating the game itself

There is no build step for the game: `www/index.html` **is** the game, edited
directly. (An earlier layout generated it from `src/game.js` via `build.py`;
neither exists here.)

The file has to reach the Android project to ship, because the AAB packages
`android/app/src/main/assets/public/`, not `www/`:

```
www/index.html  ->  android/app/src/main/assets/public/index.html
```

`build-aab.bat` does that copy for you on every run. By hand it is
`npx cap sync android`, or a plain file copy. **A stale copy there silently
ships the previous version of the game** — the two files should always be
byte-identical.

Then bump `versionCode` in `android/app/build.gradle` and rebuild.

## What's already configured

- `targetSdkVersion` 35 / `compileSdk` 35 (`android/variables.gradle`) — the
  floor Play enforces as of 2025. Note this only takes effect when you
  **rebuild**: an .aab already on disk keeps whatever it was compiled with.
- Portrait orientation locked
- Fullscreen (no status or navigation bar), drawing under display cutouts
- Launcher icons at every density, plus adaptive-icon foreground/background
- Splash screens for all portrait densities
- **No INTERNET permission** — the game is fully offline, which keeps the Play
  data-safety declaration trivially simple
- Dark background colour matched to the game so there is no white flash on launch
