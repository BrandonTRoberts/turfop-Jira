# TurfOp Apple App Store Readiness

This repo is prepared for the iOS App Store with Capacitor. Final archive/upload still requires macOS, Xcode, and Apple Developer/App Store Connect access.

## Current iOS app settings

- App name: TurfOp
- Bundle ID: com.turfop.app
- Version: 1.0
- Build number: 1
- iOS deployment target: 15.0
- Device family: iPhone and iPad
- Web build for store: production API (`https://api.turfop.com`) with demo mode disabled

## Local prep command

From the repo root:

```bash
npm run ios:appstore:prepare
```

This regenerates iOS assets and syncs a production Vite build into `ios/App/App/public`.

If assets are already current and you only need to resync the production web build:

```bash
npm run ios:sync:production
```

## Required macOS/Xcode steps

1. Open the project on a Mac:

```bash
npx cap open ios
```

2. In Xcode, select the `App` target and confirm:
   - Display Name: `TurfOp`
   - Bundle Identifier: `com.turfop.app`
   - Version: `1.0`
   - Build: `1`
   - Signing & Capabilities uses Brandon's Apple Developer Team
   - Automatically manage signing is enabled, or a valid Distribution profile is selected

3. Select a generic iOS device target:
   - `Any iOS Device (arm64)`

4. Archive:
   - Product → Archive

5. Validate and distribute:
   - Organizer → Validate App
   - Organizer → Distribute App → App Store Connect → Upload

## App Store Connect listing draft

### Name
TurfOp

### Subtitle
Golf course operations, online or offline

### Category
Business or Productivity

### Promotional text
Manage course work orders, inventory, technician activity, and offline field updates from one operations app.

### Short description / description
TurfOp helps golf course operations teams track work orders, inventory, crew activity, and field updates in one place. Superintendents and managers get a visual work order board, live technician status, automatic inventory deductions, and a clear audit trail of operational work.

Technicians can update work orders from the field, attach notes and photos, track parts used, and keep working when signal is weak. Updates sync when coverage returns so the clubhouse and field crew stay aligned.

Built for golf course maintenance teams, TurfOp focuses on practical operations: what needs attention, who is working on it, what parts were used, and what changed.

### Keywords
TurfOp,golf course,maintenance,work orders,inventory,operations,technicians,superintendent,groundskeeping

### Support URL
https://turfop.com/book-demo

### Marketing URL
https://turfop.com/

### Privacy Policy URL
https://turfop.com/privacy

## Privacy notes for App Store Connect

The iOS project includes:

- `NSCameraUsageDescription` for attaching field photos to work/orders/equipment/profile updates.
- `PrivacyInfo.xcprivacy` with the Capacitor Preferences required-reason API declaration for UserDefaults.
- `ITSAppUsesNonExemptEncryption=false` for standard/no custom encryption export compliance.

In App Store Connect privacy nutrition labels, expect to disclose at least:

- User Content: field photos, notes, work order comments/details if enabled for customers.
- Identifiers: account/user identifiers if login is required.
- Contact Info: email/name if accounts collect them.
- Diagnostics: only if crash/error analytics are later added.

Do not claim “data not collected” unless the production backend and app onboarding truly collect none of the above.

## Screenshot checklist

Apple requires screenshots in App Store Connect for selected device sizes. Capture polished screens from a real iPhone simulator/device on macOS:

- Sign in / invite screen
- Dashboard
- Visual work order board
- Work order detail with notes/photos/parts
- Inventory or equipment screen

Recommended first screenshot message:

- “Run course operations from one clear dashboard”
- “Track work orders from the field”
- “Keep inventory accurate as parts are used”
- “Work offline and sync when signal returns”

## Pre-submission QA checklist

- `npm run validate` passes.
- `npm run ios:appstore:prepare` passes.
- App launches on iPhone simulator/device.
- App launches on iPad simulator/device if iPad support stays enabled.
- Sign-in/invite flow works against production API.
- No demo-only data appears in the production mobile build.
- Camera permission prompt text is correct.
- Offline work-order behavior is tested with airplane mode/low signal.
- App icon and splash screen look clean on device.
- Archive validates in Xcode Organizer.
