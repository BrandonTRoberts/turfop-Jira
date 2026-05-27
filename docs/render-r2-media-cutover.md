# Render + Cloudflare R2 media cutover (Turfop)

This is a production-safe sequence for moving from local `/uploads/...` media URLs to durable CDN-backed URLs.

## Assumptions
- API backend is hosted on Render.
- Frontend is on Cloudflare Pages.
- Desired media public URL base is `https://cdn.turfop.com/uploads`.
- Existing DB contains legacy `/uploads/...` references.

## 0) Define variables once
```bash
export RENDER_SERVICE="<render-api-service-name>"
export R2_BUCKET="<r2-bucket-name>"
export CDN_BASE="https://cdn.turfop.com/uploads"
export OLD_BASE="/uploads"
```

## 1) Render persistent disk + env wiring
1. In Render dashboard, backend service -> Disks:
   - Add persistent disk, mount path: `/var/data/turfop`
2. Backend env vars:
   - `UPLOADS_DIR=/var/data/turfop/uploads`
   - `MEDIA_PUBLIC_BASE_URL=https://cdn.turfop.com/uploads`
   - Keep `CONFIRM_DESTRUCTIVE_RESET` unset in production.
3. Redeploy backend.

Verification after deploy:
```bash
# Replace with your health endpoint if different
curl -i https://api.turfop.com/health
```

## 2) Cloudflare R2 setup
In Cloudflare dashboard:
1. Create bucket: `${R2_BUCKET}`
2. Enable versioning on bucket
3. Configure lifecycle retention (example: keep noncurrent versions 30-90 days)
4. Add custom domain: `cdn.turfop.com`
5. Configure CORS (GET/HEAD from app + staging origins)

Suggested CORS JSON:
```json
[
  {
    "AllowedOrigins": [
      "https://app.turfop.com",
      "https://staging.turfop.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3) Backfill existing local uploads to R2
Run where legacy files are accessible (host/backup/snapshot containing uploads tree):
```bash
# Expected local legacy layout example:
# /path/to/legacy-uploads/profiles/...
# /path/to/legacy-uploads/work-orders/...
# /path/to/legacy-uploads/equipment/...
# /path/to/legacy-uploads/parts/...

# Install/authorize wrangler first (or use your preferred S3 tool):
# npm i -g wrangler
# wrangler login

wrangler r2 object put "${R2_BUCKET}/uploads/profiles/.keep" --file /dev/null

# Sync via loop (wrangler has no single recursive sync command):
find /path/to/legacy-uploads -type f | while read -r f; do
  rel="${f#/path/to/legacy-uploads/}"
  key="uploads/${rel}"
  echo "Uploading ${rel}"
  wrangler r2 object put "${R2_BUCKET}/${key}" --file "$f"
done
```

Spot-check:
```bash
wrangler r2 object get "${R2_BUCKET}/uploads/profiles/<sample-file>.jpg" --file /tmp/sample.jpg
```

## 4) DB URL rewrite (legacy -> CDN)
1. Backup DB first.
2. Run rewrite script:
```bash
cd /home/qbz77/Documents/Projects/turfop-Jira
psql "$DATABASE_URL" \
  -v OLD_BASE='/uploads' \
  -v NEW_BASE='https://cdn.turfop.com/uploads' \
  -f backend/sql/ops/media-url-rewrite.sql
```

Script path:
- `backend/sql/ops/media-url-rewrite.sql`

## 5) Post-cutover verification
```bash
cd /home/qbz77/Documents/Projects/turfop-Jira/backend
npm run media:audit
```

Expected:
- `missingCount` trends to 0 for legacy local refs.
- Newly uploaded files resolve via `https://cdn.turfop.com/uploads/...`

Manual checks:
- Employee profile image upload + reload
- Work order image + attachment upload + reload
- Equipment and parts image display

## 6) Rollback plan
If anything breaks:
1. Revert backend env:
   - clear `MEDIA_PUBLIC_BASE_URL`
   - keep `UPLOADS_DIR` pointed at known-good persistent local path
2. Restore DB from pre-rewrite snapshot
3. Re-run smoke checks

## 7) Ongoing controls
- Keep daily DB backups + periodic restore drills.
- Keep R2 versioning enabled.
- Run `npm run media:audit` before/after schema changes and during release QA.
- Never run destructive seed/reset in production.
