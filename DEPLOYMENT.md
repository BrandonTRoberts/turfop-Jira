# TurfOp deployment guide

## Recommended first production shape

- Ubuntu 24.04 LTS VPS or small cloud VM
- PostgreSQL on the same host to start
- Node.js 22 LTS
- Frontend built with Vite and served by Nginx
- Backend API managed by systemd
- TLS terminated at Nginx with Let's Encrypt

## 1. Install base packages

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Clone the app

```bash
cd /opt
sudo git clone <your-repo-url> turfops
sudo chown -R $USER:$USER /opt/turfops
cd /opt/turfops
```

## 3. Install dependencies and build

```bash
npm install
cd backend && npm install && cd ..
VITE_API_BASE_URL=/api VITE_ENABLE_DEMO_MODE=false npm run build
```

## 4. Create or migrate the database

For a brand new database:

```bash
sudo -u postgres createdb greenkeeper_ops
sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/schema.sql
```

For an existing TurfOp database, run the incremental migrations before restarting the API:

```bash
sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/migrations/20260507_add_updated_at_concurrency.sql
sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/migrations/20260515_add_course_area_config.sql
```

These rollouts add `updated_at` to `work_orders` and `equipment`, plus `course_areas_config` on `courses` for course setup, admin editing, and login-safe membership hydration.

## 5. Configure backend environment

Create `/opt/turfops/backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/greenkeeper_ops
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
JWT_ISSUER=turfops-api
JWT_AUDIENCE=turfops-app
JWT_TTL=12h
APP_BASE_URL=https://turfop.com
CORS_ALLOWED_ORIGINS=https://turfop.com
ALLOW_PUBLIC_REGISTRATION=false
ALLOW_MANUAL_TOKEN_PREVIEW=false
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="TurfOp <no-reply@turfop.com>"
```

Use a long random JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 6. Create a systemd service for the API

Create `/etc/systemd/system/turfops-api.service`:

```ini
[Unit]
Description=TurfOp API
After=network.target postgresql.service

[Service]
Type=simple
User=btr
WorkingDirectory=/opt/turfops/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now turfops-api
sudo systemctl status turfops-api
```

## 7. Serve the frontend with Nginx

Copy the built frontend:

```bash
sudo mkdir -p /var/www/turfops
sudo cp -r /opt/turfops/dist/* /var/www/turfops/
```

Create `/etc/nginx/sites-available/turfops`:

```nginx
server {
    listen 80;
    server_name turfop.com;

    root /var/www/turfops;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/turfops /etc/nginx/sites-enabled/turfops
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Add TLS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d turfop.com
```

## 9. Update frontend API base URL

Set the frontend API base URL so it points to `/api` in production, then rebuild:

```bash
cd /opt/turfops
VITE_API_BASE_URL=/api VITE_ENABLE_DEMO_MODE=false npm run build
sudo cp -r dist/* /var/www/turfops/
```

## 10. Recommended deploy order for this release

For the optimistic concurrency rollout, use this order:

1. Back up the database.
2. Pull the new code on the server.
3. Run the database migration:
   ```bash
   sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/migrations/20260507_add_updated_at_concurrency.sql
   sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/migrations/20260515_add_course_area_config.sql
   ```
4. Rebuild the frontend:
   ```bash
   cd /opt/turfops
   VITE_API_BASE_URL=/api VITE_ENABLE_DEMO_MODE=false npm run build
   sudo cp -r dist/* /var/www/turfops/
   ```
5. Restart the API:
   ```bash
   sudo systemctl restart turfops-api
   sudo systemctl status turfops-api --no-pager
   ```
6. Smoke test:
   - open the app and edit a work order
   - edit the same work order in a second session/browser
   - confirm the stale edit returns a visible conflict instead of silently overwriting

## 11. Backups

A simple backup script is included at `scripts/backup-db.sh`.

Example manual run:

```bash
cd /opt/turfops
BACKUP_DIR=/var/backups/turfops ./scripts/backup-db.sh
```

Example daily cron at 2:15 AM:

```bash
15 2 * * * cd /opt/turfops && BACKUP_DIR=/var/backups/turfops ./scripts/backup-db.sh >> /var/log/turfops-backup.log 2>&1
```

Example restore:

```bash
gunzip -c /var/backups/turfops/greenkeeper_ops-YYYYMMDD-HHMMSS.sql.gz | sudo -u postgres psql greenkeeper_ops
```

## 12. Account recovery note

- The app now supports self-service password reset requests.
- In development/non-production, reset requests can return a token/link preview only when `ALLOW_MANUAL_TOKEN_PREVIEW=true` is explicitly enabled.
- In production, self-service reset requests expect SMTP delivery to be configured through the environment above.
- If SMTP is missing in production, the reset endpoint returns a configuration error instead of pretending mail was sent.

## 13. First production checks

- `curl http://127.0.0.1:4000/health`
- open the site in a browser
- log in as admin
- create a test employee and verify invite generation
- accept the invite and set a password
- open the profile page and update contact details and profile picture
- request a password reset and confirm the reset flow works as expected for your environment
- verify audit logs show employee creation, invite creation, invite acceptance, profile updates, password reset requests, and role changes
- confirm login, password change, reset request, and audit routes still work under rate limiting thresholds

## 14. Git push note

If `git push origin main` fails on the server or laptop, configure GitHub auth first with a credential helper, PAT, or SSH remote.

## Good next hardening steps

- move PostgreSQL off-box or into managed backups
- keep daily database backups and test restore monthly
- restrict API with firewall rules
- add fail2ban alongside the new auth rate limiting
- run the API as a dedicated least-privilege service user instead of a personal shell account
- enforce Nginx security headers and a strict CSP review for the frontend
- use a least-privilege PostgreSQL role instead of the `postgres` superuser in app config
- put the app behind Tailscale or Cloudflare if it is not meant to be public
