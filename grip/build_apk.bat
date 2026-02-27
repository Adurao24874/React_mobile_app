@echo off
echo =======================================================
echo Building Android Debug APK for Grip App
echo =======================================================

echo Syncing latest web assets with Android project...
call npx cap sync android

echo.
echo Running Gradle Build with required properties...
cd android
call gradlew assembleDebug -Dorg.gradle.java.home="C:\Program Files\Java\jdk-22" -Pandroid.useAndroidX=true -Pandroid.enableJetifier=true
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Gradle build failed! Check the logs above.
    cd ..
    exit /b %errorlevel%
)
cd ..

echo.
echo =======================================================
echo [SUCCESS] APK built successfully!
echo You can find the APK at:
echo android\app\build\outputs\apk\debug\app-debug.apk
echo =======================================================
