@echo off
REM ===================================================================
REM  Brick Breaker - build a debug APK on Windows
REM
REM  Run this by double-clicking it, or from a terminal:
REM      build-apk.bat
REM
REM  First run downloads Gradle and the AndroidX dependencies, which is
REM  roughly 1 GB and can take 10-20 minutes. Later runs take seconds.
REM ===================================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   Brick Breaker - debug APK build
echo ============================================
echo.

REM ---- 1. Node dependencies -----------------------------------------
REM android\capacitor.settings.gradle points at
REM ..\node_modules\@capacitor\android\capacitor
REM so the Gradle build cannot resolve :capacitor-android without this.
if not exist "node_modules\@capacitor\android" (
    echo [1/3] Installing Capacitor packages...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed. Is Node.js installed?
        echo        Download it from https://nodejs.org
        exit /b 1
    )
) else (
    echo [1/3] Capacitor packages already present - skipping npm install.
)

REM ---- 2. SDK location ----------------------------------------------
if not exist "android\local.properties" (
    if defined ANDROID_HOME (
        echo [2/3] Writing android\local.properties from ANDROID_HOME...
        > android\local.properties echo sdk.dir=%ANDROID_HOME:\=\\%
    ) else if defined ANDROID_SDK_ROOT (
        echo [2/3] Writing android\local.properties from ANDROID_SDK_ROOT...
        > android\local.properties echo sdk.dir=%ANDROID_SDK_ROOT:\=\\%
    ) else (
        echo.
        echo ERROR: Android SDK not found.
        echo.
        echo Either install Android Studio and open the "android" folder once,
        echo which creates local.properties for you, or create
        echo android\local.properties by hand containing:
        echo.
        echo     sdk.dir=C:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk
        echo.
        exit /b 1
    )
) else (
    echo [2/3] android\local.properties already present.
)

REM ---- 3. Build ------------------------------------------------------
echo [3/3] Running Gradle...
echo.
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo ============================================
    echo   BUILD FAILED
    echo ============================================
    echo.
    echo Most common cause: wrong JDK.
    echo This project uses the Gradle 8.2.1 wrapper, which supports
    echo Java 8-20. On JDK 21 it fails with
    echo "Unsupported class file major version 65".
    echo.
    echo Check your version with:  java -version
    echo If it says 21, either install JDK 17 and point JAVA_HOME at it,
    echo or edit android\gradle\wrapper\gradle-wrapper.properties and
    echo change gradle-8.2.1-all.zip to gradle-8.7-all.zip
    echo.
    exit /b 1
)

cd ..
echo.
echo ============================================
echo   BUILD SUCCEEDED
echo ============================================
echo.
echo APK: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Install it on a connected phone with:
echo     adb install -r android\app\build\outputs\apk\debug\app-debug.apk
echo.
endlocal
