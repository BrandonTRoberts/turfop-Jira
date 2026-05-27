# Media Durability + Safe DB Rebuild Playbook

## Problem this solves
Profile photos and record images disappear when:
1) media files are stored on ephemeral local disk, or
2) DB reset/rebuild truncates rows that contain media URLs.

## Root-cause summary
- Current app stores media references in Postgres (`profile_image_url`, `image_urls`, attachments JSON).
- Historically, uploaded files are written to local `backend/uploads`.
- DB rebuild/reset can remove URL references.
- Deploy platform restarts/rebuilds can remove local upload files if disk is ephemeral.

## Non-negotiable production rules
1. Never store production media only on ephemeral local disk.
2. Never run destructive DB reset in production.
3. Always use migrations (expand/contract), not drop+recreate.
4. Run automatic DB backups and test restore monthly.

## Immediate hardening shipped
- `UPLOADS_DIR` env var added:
  - lets you mount a persistent disk path outside repo/deploy working dir.
- `MEDIA_PUBLIC_BASE_URL` env var added:
  - new uploads can be persisted with absolute CDN/object-storage style URLs.
- `seed.js` destructive guard added:
  - requires `CONFIRM_DESTRUCTIVE_RESET=YES` or it aborts.
- `npm run media:audit` added in `backend/`:
  - checks DB media refs and reports missing local files.

## Recommended production architecture (durable)
1. Object storage bucket (Cloudflare R2, S3, Backblaze B2, etc.).
2. Public read via CDN domain (example `cdn.turfop.com`).
3. DB stores immutable object URLs/keys only.
4. Lifecycle/retention policy for deleted/replaced media.
5. Daily DB backup + object-storage versioning.

## Operational runbook

### A) Before any DB maintenance
1. Confirm this is migration-based, not destructive reset.
2. Take DB snapshot backup.
3. Run media audit:
   ```bash
   cd backend
   npm run media:audit
   ```
4. Resolve missing-file report before proceeding.

### B) If local storage is still used
1. Set persistent upload path:
   ```bash
   UPLOADS_DIR=/var/lib/turfop/uploads
   ```
2. Ensure path is on persistent volume and included in server backup policy.
3. Keep strict file permissions and no execute bits.

### C) If moving to object storage
1. Configure CDN/public base:
   ```bash
   MEDIA_PUBLIC_BASE_URL=https://cdn.turfop.com/uploads
   ```
2. Backfill old `/uploads/...` files into object storage.
3. Rewrite existing DB URLs to CDN base once verified.
4. Keep temporary fallback serving for legacy paths during migration window.

## Verification checklist
- [ ] `npm run media:audit` returns `missingCount: 0` for local refs.
- [ ] New uploads persist across app restart/redeploy.
- [ ] Existing images still render after migrations.
- [ ] DB restore drill confirms media references remain valid.

## Related
- [[Projects/Turfop.com]]
- `docs/multi-tenant-deployment-strategy.md`
