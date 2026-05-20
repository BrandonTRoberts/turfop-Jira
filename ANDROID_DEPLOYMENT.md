# Android / Google Play Deployment

This project includes a Capacitor Android app under [android](/home/btr/Desktop/Turfop.com/android).

## Prerequisites

- Node 22+
- Android Studio with Android SDK installed
- Java 21 available and `JAVA_HOME` set
- A release keystore for Google Play App Bundles

Example:

```bash
export JAVA_HOME=/path/to/android-studio/jbr
export PATH="$JAVA_HOME/bin:$PATH"
```

## Production API

Production mobile builds should use:

```
VITE_API_BASE_URL=https://api.turfop.com
VITE_ENABLE_DEMO_MODE=false
```

That already matches the local `.env.production` file.
Use the production Android scripts below so the bundled WebView points at `https://api.turfop.com`.

## App Identity

Current Android package id:

```text
com.turfops.app
```

Confirm this package id before the first Play Console upload. Google Play treats the package id as permanent after the first release.

Current Play version fields are in [android/app/build.gradle](/home/btr/Desktop/Turfop.com/android/app/build.gradle):

```gradle
versionCode 1
versionName "1.0"
```

Increment `versionCode` for every uploaded release.

## Release Signing

1. Create a keystore:

```bash
cd android
keytool -genkeypair -v -keystore release-keystore.jks -alias release -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `android/keystore.properties` from [android/keystore.properties.example](/home/btr/Desktop/Turfop.com/android/keystore.properties.example):

```properties
storeFile=release-keystore.jks
storePassword=your-store-password
keyAlias=release
keyPassword=your-key-password
```

3. Keep both files private. They are gitignored.

## Build Commands

Regenerate Android launcher and splash assets from `resources/icon.png` and `resources/splash.png`:

```bash
npm run android:assets
```

Sync native assets for local/dev testing:

```bash
npm run android:sync
```

Sync native assets with production API settings:

```bash
npm run android:sync:production
```

Build a debug APK:

```bash
npm run android:debug
```

Build a production signed release APK:

```bash
npm run android:release:production
```

Build a production release AAB for Google Play:

```bash
npm run android:playstore
```

`android:playstore` verifies release signing, regenerates Android assets, builds the web app with production API settings, syncs Capacitor, and runs Gradle `bundleRelease`.

## Output Paths

- Debug APK: `android/app/build/outputs/apk/debug/`
- Release APK: `android/app/build/outputs/apk/release/`
- Release AAB: `android/app/build/outputs/bundle/release/`

## Play Console Checklist

- App name: `TurfOp`
- Package id confirmed before first upload
- Release AAB built from `npm run android:playstore`
- Release keystore created and stored privately
- Privacy policy URL ready
- Data safety answers ready for login/account data, work orders, photos/files, inventory, push notifications, and diagnostics
- App access instructions ready for Play review, including a test employee login
- Screenshots captured for phone layouts
- Backend production URL live: `https://api.turfop.com`

## Current Status

- Capacitor Android sync passes
- Web production build passes
- Local Java/Gradle tooling is available on this machine
- Unsigned release bundle generation has been verified locally
- Release keystore exists locally at `android/release-keystore.jks`
- Release signing properties exist locally at `android/keystore.properties`
- Both signing files are gitignored and set to owner-only permissions
- `npm run android:playstore` builds successfully
- Signed release AAB: `android/app/build/outputs/bundle/release/app-release.aab`
