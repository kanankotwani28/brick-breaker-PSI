# Building the APK

The web build is already in place. `www/index.html` and
`android/app/src/main/assets/public/index.html` are identical copies of the
finished game — no `npm run build` step is needed, and no `npx cap sync` is
needed unless you edit `www/` afterwards.

## Prerequisites

- **JDK 21** (`java -version`)
- **Android Studio**, or the command-line SDK tools with platform 34 and
  build-tools installed
- `ANDROID_HOME` pointing at the SDK

## Debug APK (for testing on a device)

```bash
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Install it with `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

## Release build (for Play)

Google Play takes an **AAB**, not an APK:

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

If you want a signed APK instead:

```bash
./gradlew assembleRelease
```

### Signing

Create a keystore once and keep it somewhere safe — losing it means you can
never update the listing:

```bash
keytool -genkey -v -keystore brickbreaker.keystore \
  -alias brickbreaker -keyalg RSA -keysize 2048 -validity 10000
```

Then add to `android/keystore.properties` (and gitignore it):

```properties
storeFile=../brickbreaker.keystore
storePassword=YOUR_PASSWORD
keyAlias=brickbreaker
keyPassword=YOUR_PASSWORD
```

and wire it into `android/app/build.gradle` inside `android { }`:

```groovy
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

## Before you submit

1. **Check the current target API requirement.** `targetSdkVersion` is set
   from `android/variables.gradle` (currently 34). Google raises the minimum
   for new submissions every year around August, and a stale target is a hard
   rejection rather than a warning. Confirm the current figure before building
   the release bundle.
2. `versionCode` is at **2** and `versionName` at **2.0**. Increment
   `versionCode` on every upload.
3. The app declares **no INTERNET permission** — keep it that way, it makes
   the Play data-safety form trivial.
4. There is still **no hardware back-button handling** (see KNOWN_ISSUES.md).
