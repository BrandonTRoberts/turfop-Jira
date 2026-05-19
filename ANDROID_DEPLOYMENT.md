# Android Deployment

This project already includes a Capacitor Android app under [android](/home/btr/Desktop/golf-ops-app/android).

## Prerequisites

- Node 22+
- Android Studio with Android SDK installed
- Java 21 available and `JAVA_HOME` set
- A release keystore for Play Store or direct APK distribution

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

That already matches [.env.production](/home/btr/Desktop/golf-ops-app/.env.production).

## Release Signing

1. Create a keystore:

```bash
cd android
keytool -genkeypair -v -keystore release-keystore.jks -alias release -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `android/keystore.properties` from [android/keystore.properties.example](/home/btr/Desktop/golf-ops-app/android/keystore.properties.example):

```properties
storeFile=release-keystore.jks
storePassword=your-store-password
keyAlias=release
keyPassword=your-key-password
```

3. Keep both files private. They are gitignored.

## Build Commands

Sync native assets:

```bash
npm run android:sync
```

Build a debug APK:

```bash
npm run android:debug
```

Build a signed release APK:

```bash
npm run android:release
```

Build a signed release AAB for Play Store:

```bash
npm run android:bundle
```

## Output Paths

- Debug APK: `android/app/build/outputs/apk/debug/`
- Release APK: `android/app/build/outputs/apk/release/`
- Release AAB: `android/app/build/outputs/bundle/release/`

## Current Status

- Capacitor Android sync passes
- Web production build passes
- Local Gradle build is blocked until `JAVA_HOME` is configured on the build machine
