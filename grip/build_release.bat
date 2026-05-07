@echo off
echo =======================================================
echo Building Android RELEASE APK for Grip App (v1.1.0)
echo =======================================================

echo 1. Running Web Build (Vite)...
call npm run build

echo 2. Syncing assets to Android...
call npx cap sync android

echo 2. Running Gradle Release Build...
cd android
call gradlew.bat assembleRelease -Dorg.gradle.java.home="C:\Program Files\Java\jdk-22" -Pandroid.useAndroidX=true -Pandroid.enableJetifier=true
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Gradle build failed!
    cd ..
    exit /b %errorlevel%
)
cd ..

echo.
echo =======================================================
echo [SUCCESS] Release APK built successfully!
echo You can find the APK at:
echo android\app\build\outputs\apk\release\app-release.apk
echo =======================================================
