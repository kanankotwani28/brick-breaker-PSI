@echo off
REM ===================================================================
REM  Brick Breaker - build a SIGNED RELEASE AAB for the Play Store
REM
REM  Double-click this file, or run it from a terminal.
REM
REM  On the first run it creates a keystore (android\brickbreaker.jks) and
REM  asks you to choose its password. KEEP BOTH. Android identifies an app
REM  by its signature, so if you lose that key you can never publish an
REM  update to the same listing again - you would have to ship a brand-new
REM  app and lose every install and review.
REM
REM  The password is typed here, by you, straight into keytool. It is
REM  written only to android\keystore.properties, which is gitignored.
REM ===================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Absolute keystore path, built HERE rather than inside the if-block below.
REM %CD% is substituted while cmd parses the whole parenthesised block, so on a
REM path that contains brackets - "brickbreaker_v2_android (3)" - the ")" closed
REM the block early and the script died with
REM   "/brickbreaker/android/brickbreaker.jks was unexpected at this time."
REM Computed out here the brackets are harmless, and the block below reads it
REM back with !SFPATH!, which is expanded at run time instead.
REM Forward slashes because a .properties file treats \ as an escape.
set "SFPATH=%CD:\=/%/android/brickbreaker.jks"

echo.
echo ==========================================================
echo   Brick Breaker - signed release AAB
echo ==========================================================
echo.

REM ---- 0. Java ---------------------------------------------------------
REM The Gradle 8.7 wrapper cannot COMPILE a build script under JDK 22+: it
REM dies with "Unsupported class file major version 68" (JDK 24) or 69
REM (JDK 25) during semantic analysis. A machine whose default java is 24
REM may still appear to build, but only while Gradle's compiled-script cache
REM is warm - the next edit to any .gradle file breaks it. So pin a verified
REM JDK 17/21 here rather than trusting whatever is on PATH.
REM
REM Candidates are VERIFIED with java -version, never trusted by path. A
REM folder named jdk-17 need not hold one, and - the case that actually bit
REM here - Android Studio's bundled JBR is now JDK 25, which Gradle 8.7
REM rejects. Checking the version lets the scan walk every IDE runtime on the
REM machine and skip the ones too new, rather than take the first that exists.
set "JDK="
call :try_jdk "%USERPROFILE%\.jdks\jbr-17.0.14"
for /d %%D in ("%USERPROFILE%\.jdks\*") do call :try_jdk "%%~fD"
call :try_jdk "%ProgramFiles%\Java\jdk-17"
call :try_jdk "%ProgramFiles%\Java\jdk-21"
call :try_jdk "%ProgramFiles%\Eclipse Adoptium\jdk-17"
call :try_jdk "%ProgramFiles%\Eclipse Adoptium\jdk-21"
for /d %%D in ("%ProgramFiles%\JetBrains\*") do call :try_jdk "%%~fD\jbr"
for /d %%D in ("%LOCALAPPDATA%\Programs\*") do call :try_jdk "%%~fD\jbr"
call :try_jdk "%ProgramFiles%\Android\Android Studio\jbr"

if defined JDK (
    set "JAVA_HOME=%JDK%"
    set "PATH=%JDK%\bin;%PATH%"
    echo [0/6] Using JDK at %JDK%
) else (
    where java >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Java not found on PATH.
        echo        Install JDK 17 from https://adoptium.net
        goto :fail
    )
    echo [0/6] WARNING: no JDK 17/21 found - falling back to the default java.
    echo       If the build dies with "Unsupported class file major version",
    echo       install JDK 17 from https://adoptium.net and re-run.
)

REM ---- 1. Capacitor packages -----------------------------------------
REM android\capacitor.settings.gradle points at
REM ..\node_modules\@capacitor\android\capacitor, so without this Gradle
REM cannot resolve the :capacitor-android project at all.
if not exist "node_modules\@capacitor\android" (
    echo [1/6] Installing Capacitor packages...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed. Is Node.js installed? https://nodejs.org
        goto :fail
    )
) else (
    echo [1/6] Capacitor packages present.
)

REM ---- 2. SDK location ------------------------------------------------
if not exist "android\local.properties" (
    if defined ANDROID_HOME (
        > android\local.properties echo sdk.dir=%ANDROID_HOME:\=\\%
        echo [2/6] Wrote android\local.properties from ANDROID_HOME.
    ) else if defined ANDROID_SDK_ROOT (
        > android\local.properties echo sdk.dir=%ANDROID_SDK_ROOT:\=\\%
        echo [2/6] Wrote android\local.properties from ANDROID_SDK_ROOT.
    ) else if exist "%LOCALAPPDATA%\Android\Sdk" (
        > android\local.properties echo sdk.dir=%LOCALAPPDATA:\=\\%\\Android\\Sdk
        echo [2/6] Found SDK at %LOCALAPPDATA%\Android\Sdk
    ) else (
        echo ERROR: Android SDK not found.
        echo        Install Android Studio, open the "android" folder once,
        echo        then re-run this script.
        goto :fail
    )
) else (
    echo [2/6] android\local.properties present.
)

REM ---- 3. Copy the game into the Android project ----------------------
REM The AAB packages android\app\src\main\assets\public, not www, so a
REM stale copy there silently ships the previous version of the game.
echo [3/6] Syncing www\index.html into the Android assets...
copy /y "www\index.html" "android\app\src\main\assets\public\index.html" >nul
if errorlevel 1 (
    echo ERROR: could not copy www\index.html into the Android assets.
    goto :fail
)
if exist "www\assets" (
    if not exist "android\app\src\main\assets\public\assets" mkdir "android\app\src\main\assets\public\assets"
    xcopy /y /e /i /q "www\assets\*" "android\app\src\main\assets\public\assets\" >nul
)

REM ---- 4. Keystore -----------------------------------------------------
REM 4096-bit RSA and 10000 days: Play requires at least 2048 bits and a
REM certificate that outlives 2033.
REM Written with goto labels, NOT if(...) blocks. cmd substitutes %VAR% while
REM it parses a whole parenthesised block, so any path containing brackets -
REM this project sits in "brickbreaker_v2_android (3)" - closes the block early
REM and the script dies mid-way, after having half-written keystore.properties.
REM Labels keep every command its own statement, so brackets cannot break them.
if exist "android\keystore.properties" goto :have_keystore

echo.
echo [4/6] No keystore yet - creating one.
echo       Choose a password and KEEP IT. Nothing else can sign updates
echo       for this app.
echo.
set "KSPASS="
set /p "KSPASS=Keystore password: "
if "%KSPASS%"=="" goto :nopass
if exist "android\brickbreaker.jks" goto :write_props

keytool -genkeypair -v -keystore "android\brickbreaker.jks" -alias brickbreaker -keyalg RSA -keysize 4096 -validity 10000 -storepass "%KSPASS%" -keypass "%KSPASS%" -dname "CN=Brick Breaker, OU=Games, O=PSI, L=Delhi, S=Delhi, C=IN"
if errorlevel 1 goto :keytoolfail

:write_props
REM SFPATH is absolute: app\build.gradle resolves storeFile with file(), which
REM is relative to android\app, so a bare "brickbreaker.jks" would point at
REM android\app\brickbreaker.jks and signing fails on a missing file.
> android\keystore.properties echo storeFile=!SFPATH!
>> android\keystore.properties echo storePassword=!KSPASS!
>> android\keystore.properties echo keyAlias=brickbreaker
>> android\keystore.properties echo keyPassword=!KSPASS!
set "KSPASS="
echo.
echo   Created android\brickbreaker.jks
echo   BACK IT UP somewhere private. Losing it ends your ability to
echo   update this app.
echo.
goto :keystore_done

:have_keystore
echo [4/6] Keystore present.

:keystore_done

REM ---- 5. Build --------------------------------------------------------
echo [5/6] Building bundle + APK (first run downloads ~1 GB, be patient)...
echo.
cd android
REM Both in one invocation: the AAB is what Play accepts, the APK is what you
REM can actually install on a phone or send to someone. Same signing config.
call gradlew.bat bundleRelease assembleRelease
if errorlevel 1 (
    cd ..
    echo.
    echo ==========================================================
    echo   BUILD FAILED
    echo ==========================================================
    echo.
    echo Most common cause is the JDK version. Check:  java -version
    echo If it reports "Unsupported class file major version", install
    echo JDK 17 or 21 and point JAVA_HOME at it. The Gradle 8.7
    echo wrapper supports 17 to 21 only - JDK 24 and 25 both fail.
    echo.
    goto :fail
)
cd ..

REM ---- 6. Collect and verify the signature ----------------------------
set "AAB=android\app\build\outputs\bundle\release\app-release.aab"
set "APK=android\app\build\outputs\apk\release\app-release.apk"
if not exist "%AAB%" goto :noaab
if not exist "%APK%" goto :noapk
copy /y "%AAB%" "BrickBreaker-v2.0.aab" >nul
copy /y "%APK%" "BrickBreaker-v2.0.apk" >nul

echo.
echo [6/6] Verifying signatures...
jarsigner -verify "BrickBreaker-v2.0.aab" >nul 2>&1
if errorlevel 1 goto :unsigned
jarsigner -verify "BrickBreaker-v2.0.apk" >nul 2>&1
if errorlevel 1 goto :unsigned
echo   Both signed OK.
goto :report

:unsigned
echo.
echo   WARNING: jarsigner did not report these as signed.
echo   Check android\keystore.properties points at a real .jks and that
echo   its passwords are right, then delete it and re-run.
echo.

:report
echo.
echo ==========================================================
echo   DONE
echo ==========================================================
echo.
echo   BrickBreaker-v2.0.aab   upload this to Play Console
echo   BrickBreaker-v2.0.apk   install/share this directly
echo.
echo An AAB cannot be installed on a phone - Play repackages it per device.
echo The APK installs anywhere; the receiver must allow "install from
echo unknown sources".
echo.
echo   adb install -r BrickBreaker-v2.0.apk
echo.
endlocal
pause
exit /b 0

:noaab
echo ERROR: build reported success but no AAB at %AAB%
goto :fail

:noapk
echo ERROR: build reported success but no APK at %APK%
goto :fail

:nopass
echo.
echo ERROR: password cannot be empty. Nothing was created; re-run and
echo        choose a password.
goto :fail

:keytoolfail
echo.
echo ERROR: keytool failed - no keystore was created.
goto :fail

:fail
echo.
pause
exit /b 1


REM ---- helper: accept %~1 as the JDK only if it really is 17 or 21 ---------
REM The leading "if defined JDK" makes every call after the first match a
REM no-op, so the candidate order above is also the preference order.
:try_jdk
if defined JDK goto :eof
if not exist "%~1\bin\java.exe" goto :eof
REM Must be a full JDK, not a JRE/JBR: the Android Gradle Plugin runs a
REM JdkImageTransform over android-35\core-for-system-modules.jar and shells
REM out to jlink to do it. A JetBrains Runtime ships no jlink, so it passes
REM the version check and then dies well into the build with
REM   "jlink executable ...\bin\jlink.exe does not exist".
if not exist "%~1\bin\jlink.exe" goto :eof
"%~1\bin\java.exe" -version 2>&1 | findstr /r /c:"version .1[78]\." /c:"version .21\." >nul
if errorlevel 1 goto :eof
set "JDK=%~1"
goto :eof