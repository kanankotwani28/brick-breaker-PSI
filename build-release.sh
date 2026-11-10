#!/usr/bin/env bash
# Brick Breaker - build a SIGNED RELEASE APK you can share (macOS / Linux)
set -e
cd "$(dirname "$0")"

echo "[1/5] Capacitor packages..."
[ -d node_modules/@capacitor/android ] || npm install

echo "[2/5] Android SDK..."
if [ ! -f android/local.properties ]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [ -z "$SDK" ] && [ -d "$HOME/Library/Android/sdk" ] && SDK="$HOME/Library/Android/sdk"
  [ -z "$SDK" ] && [ -d "$HOME/Android/Sdk" ] && SDK="$HOME/Android/Sdk"
  [ -z "$SDK" ] && { echo "ERROR: Android SDK not found. Set ANDROID_HOME."; exit 1; }
  echo "sdk.dir=$SDK" > android/local.properties
fi

echo "[3/5] Keystore..."
if [ ! -f android/brickbreaker.jks ]; then
  read -rsp "  Choose a keystore password: " KSPASS; echo
  [ -z "$KSPASS" ] && { echo "ERROR: password cannot be empty"; exit 1; }
  keytool -genkeypair -v -keystore android/brickbreaker.jks \
    -alias brickbreaker -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KSPASS" -keypass "$KSPASS" \
    -dname "CN=Brick Breaker, OU=Games, O=PSI, L=Delhi, S=Delhi, C=IN"
  cat > android/keystore.properties <<PROPS
storeFile=brickbreaker.jks
storePassword=$KSPASS
keyAlias=brickbreaker
keyPassword=$KSPASS
PROPS
  echo "  Created android/brickbreaker.jks - BACK IT UP."
fi

echo "[4/5] Building..."
cd android
chmod +x gradlew
./gradlew assembleRelease || {
  echo
  echo "BUILD FAILED. Usual cause: JDK version."
  echo "  The Gradle 8.7 wrapper supports Java 17-21. JDK 24 gives"
  echo "  'Unsupported class file major version 68', JDK 25 gives 69."
  echo "  Use JDK 17 or 21 and point JAVA_HOME at it."
  exit 1
}
cd ..

cp android/app/build/outputs/apk/release/app-release.apk BrickBreaker-v2.0.apk
echo
echo "[5/5] DONE -> BrickBreaker-v2.0.apk"
echo "Share that file directly. Recipients must allow 'unknown sources'."
echo "Install over USB: adb install -r BrickBreaker-v2.0.apk"
