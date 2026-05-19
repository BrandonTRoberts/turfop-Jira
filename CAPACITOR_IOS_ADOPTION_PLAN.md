# TurfOps Capacitor / iOS adoption plan

_Last updated: 2026-05-07_

## Current bootstrap status
- Capacitor packages installed
- `capacitor.config.json` created with `appId=com.turfops.app` and `webDir=dist`
- `ios/` project scaffold created
- repo scripts added for `cap:copy`, `cap:sync`, `cap:sync:ios`, and `cap:open:ios`
- first native layer added:
  - Camera plugin wired for work-order, equipment, and profile photos
  - Preferences-backed auth token storage on native builds
  - technician-first mobile nav + bottom tab bar
  - client-side photo compression before queueing/uploading images
  - offline queue coalescing and a 60-item queue cap
- Remaining requirement: open and sign/build in Xcode on macOS

## Recommendation
Adopt Capacitor for TurfOps in phases instead of building a separate native iOS app first.

Why:
- TurfOps already has a React + Vite frontend.
- The app is form-heavy, camera-friendly, and offline-sensitive — a good Capacitor fit.
- The existing Node API can stay shared across web, iOS, and later Android.

## Target outcome
One shared frontend codebase with:
- Web for supervisors/admin workflows
- Capacitor iOS shell for crew, field logging, photos, and offline-first updates

## Phase 0 — readiness hardening
Before adding Capacitor:
- Stabilize web auth/reset flows
- Finish a deployed smoke test pass
- Identify mobile-critical screens:
  - My Work
  - Work Orders
  - Equipment
  - Profile
- Decide whether mobile v1 excludes admin-heavy flows

## Phase 1 — create the Capacitor shell
1. Add Capacitor packages
2. Set Vite build output as Capacitor web assets
3. Initialize iOS project
4. Verify the existing app boots inside a WebView

Suggested package set:
- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/ios`
- likely `@capacitor/camera`
- likely `@capacitor/preferences`
- optional later: filesystem, network, splash-screen, status-bar

## Phase 2 — mobile-safe runtime decisions
Adapt browser-only assumptions behind small adapters:
- storage
  - current token/offline queue/settings use `localStorage`
  - keep web on `localStorage`
  - consider Capacitor Preferences for auth/settings on mobile
- file/image capture
  - current UI uses `<input type="file">` + data URLs
  - add a shared image service that can use Camera on iOS
- network awareness
  - current app depends on browser online/offline events
  - add a small connectivity wrapper so Capacitor Network can be used later if needed

## Phase 3 — iOS-first UX pass
Prioritize technician workflows, not full desktop parity.

### Mobile v1 screens
- My Work
- Work order detail / completion
- Equipment detail / status update
- Inventory lookup
- Profile

### Defer to later if needed
- employee admin workflows
- audit log browsing
- integration configuration
- broad dashboard/admin reporting

## Phase 4 — offline improvements for field use
Current app already has an offline queue. For iOS adoption, harden it:
- verify queue survives app backgrounding and restart
- verify queued creates/updates/deletes replay cleanly
- evaluate moving queue/cache from `localStorage` to SQLite or Filesystem if size grows
- add conflict handling rules for stale edits

## Phase 5 — native capabilities
Add only what materially improves field work:
- Camera for before/after photos
- optional photo compression/resizing before upload
- share/export attachments if needed
- optional push notifications for assigned work
- optional barcode/QR later for equipment or parts

## Phase 6 — iOS release work
- Apple Developer account + bundle id
- app icons / splash / privacy strings
- ATS and API domain review
- TestFlight distribution
- field pilot with a superintendent + 1–2 technicians

## Key technical decisions

### 1. Auth storage
Recommendation: keep JWT flow, but abstract token storage now.
- Web: `localStorage`
- iOS: Capacitor Preferences or secure storage plugin if risk tolerance requires it

### 2. API topology
Recommendation: keep the existing Node API.
- web and iOS should hit the same HTTPS API
- avoid embedding business logic natively

### 3. Mobile scope
Recommendation: launch iOS around technician execution first.
That gets the highest value with the lowest UI complexity.

## Risks
- desktop-sized forms may feel cramped on iPhone
- large data-URL images may bloat storage/memory on mobile
- `localStorage` may become weak for larger offline/photo workflows
- background sync expectations on iOS are stricter than on desktop web

## Concrete next steps
1. Merge the reset-flow hardening and finish web launch smoke testing
2. Add a thin storage adapter and image adapter in the frontend
3. Initialize Capacitor and boot the app in iOS simulator
4. Trim mobile v1 nav to technician-first flows
5. Test offline queue + photo capture on-device
6. Pilot through TestFlight
