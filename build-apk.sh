#!/usr/bin/env bash
# Brick Breaker - build a debug APK on macOS / Linux
set -e
cd "$(dirname "$0")"

echo "[1/3] Capacitor packages..."
if [ ! -d "node_modules/@capacitor/android" ]; then
  npm install
else
  echo "      already present - skipping"
fi

echo "[2/3] Android SDK location..."
if [ ! -f android/local.properties ]; then
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  if [ ! -d "$SDK" ]; then SDK="$HOME/Android/Sdk"; fi
  if [ ! -d "$SDK" ]; then
    echo "ERROR: Android SDK not found. Set ANDROID_HOME, or open the"
    echo "       android/ folder in Android Studio once."
    exit 1
  fi
  echo "sdk.dir=$SDK" > android/local.properties
  echo "      wrote android/local.properties -> $SDK"
else
  echo "      already present"
fi

echo "[3/3] Gradle..."
cd android
chmod +x gradlew
./gradlew assembleDebug || {
  echo
  echo "BUILD FAILED. Most common cause is the JDK version:"
  echo "  this project uses the Gradle 8.7 wrapper (supports Java 17-21)."
  echo "  On JDK 24 it fails with 'Unsupported class file major version 68',"
  echo "  on JDK 25 with 69."
  echo "  Check with: java -version"
  echo "  Fix: use JDK 17 or 21 and point JAVA_HOME at it."
  exit 1
}
cd ..
echo
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
echo "Install: adb install -r android/app/build/outputs/apk/debug/app-debug.apk"
