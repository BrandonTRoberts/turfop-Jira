# TurfOps low-cost launch guide

This guide is for the cheapest safe early launch path:

- code in a **private GitHub repo**
- frontend on **Cloudflare Pages**
- backend on a small **Ubuntu VPS**
- PostgreSQL on that same VPS
- custom domains:
  - `turfop.com` → frontend
  - `api.turfop.com` → backend

---

## 1. Prep the repo for a private GitHub push

Before pushing:

- confirm real secrets stay in ignored files only
- keep `backend/.env` out of git
- do not commit database dumps or backups
- do not commit uploaded files from `backend/uploads/`

Current ignore rules already cover:

- `node_modules/`
- `dist/`
- `.env`
- `backend/.env`
- `backend/uploads/`

### Suggested push flow

```bash
cd ~/Desktop/golf-ops-app
git status
git add .
git commit -m "Prepare TurfOps for low-cost launch"
git remote add origin <PRIVATE_GITHUB_REPO_URL>
git push -u origin main
```

If `origin` already exists:

```bash
git remote -v
git remote set-url origin <PRIVATE_GITHUB_REPO_URL>
git push -u origin main
```

---

## 2. Cloudflare Pages for the frontend

Create a new Pages project connected to the private GitHub repo.

### Build settings

- **Framework preset:** Vite
- **Build command:**

```bash
npm run build:production
```

- **Build output directory:**

```bash
dist
```

If using Cloudflare environment-variable settings instead, add the variables in
the Pages dashboard. Keep the build command as a command, not multiline
assignments.

### Custom domain

Attach:

- `turfop.com`
- optional: `www.turfop.com`

---

## 3. VPS sizing and setup

Use a small Ubuntu 24.04 VPS from Hetzner, DigitalOcean, Linode, or Vultr.

A **1 vCPU / 2 GB RAM** box is enough to start.

### Install packages

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### Clone the repo

```bash
cd /opt
sudo git clone <PRIVATE_GITHUB_REPO_URL> turfops
sudo chown -R $USER:$USER /opt/turfops
cd /opt/turfops
```

### Install dependencies

```bash
npm install
cd backend && npm install && cd ..
```

---

## 4. PostgreSQL setup

### Create database

```bash
sudo -u postgres createdb greenkeeper_ops
```

### Fresh install schema

```bash
sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/schema.sql
```

### Apply optimistic concurrency migration

Run this too so the current app behavior matches production:

```bash
sudo -u postgres psql -d greenkeeper_ops -f /opt/turfops/backend/sql/migrations/20260507_add_updated_at_concurrency.sql
```

---

## 5. Backend environment

Create `/opt/turfops/backend/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/greenkeeper_ops
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
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
SMTP_FROM="TurfOps <no-reply@turfop.com>"
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 6. Backend systemd service

Create `/etc/systemd/system/turfops-api.service`:

```ini
[Unit]
Description=TurfOps API
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

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now turfops-api
sudo systemctl status turfops-api --no-pager
```

Quick health check:

```bash
curl http://127.0.0.1:4000/health
```

---

## 7. Nginx for `api.turfop.com`

Create `/etc/nginx/sites-available/turfops-api`:

```nginx
server {
    listen 80;
    server_name api.turfop.com;

    location / {
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
sudo ln -s /etc/nginx/sites-available/turfops-api /etc/nginx/sites-enabled/turfops-api
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. DNS

Set these records:

- `turfop.com` → Cloudflare Pages
- `www.turfop.com` → optional redirect or alias to Pages
- `api.turfop.com` → VPS public IP

If using Cloudflare DNS:

- keep the API record proxied only if you want Cloudflare in front of it
- otherwise DNS-only is fine to start

---

## 9. HTTPS

On the VPS for the API:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.turfop.com
```

Cloudflare Pages handles TLS for the frontend side.

---

## 10. Frontend production build behavior

Cloudflare Pages should build with:

```bash
npm run build:production
```

This matters because the app should never silently fall back to demo mode in production.

---

## 11. Daily backups

Run daily database backups on the VPS.

Example manual run:

```bash
cd /opt/turfops
BACKUP_DIR=/var/backups/turfops ./scripts/backup-db.sh
```

Create the backup directory first:

```bash
sudo mkdir -p /var/backups/turfops
sudo chown -R $USER:$USER /var/backups/turfops
```

Example cron:

```bash
15 2 * * * cd /opt/turfops && BACKUP_DIR=/var/backups/turfops ./scripts/backup-db.sh >> /var/log/turfops-backup.log 2>&1
```

---

## 12. First production smoke test

After deployment, verify:

- `turfop.com` loads
- public pages load:
  - `/`
  - `/pricing`
  - `/security`
  - `/book-demo`
  - `/privacy`
  - `/terms`
  - `/signin`
- sign in works
- `api.turfop.com/health` works
- create/edit work orders works
- create/edit equipment works
- password reset works
- stale edit conflicts return visible errors instead of silent overwrite
- offline queue still syncs correctly when the API comes back

---

## 13. Before real customer launch

Do these before taking money:

- replace placeholder legal text on `/privacy` and `/terms`
- wire `/book-demo` to a real form or scheduling flow
- verify SMTP works in production
- test backup restore at least once
- tighten firewall rules
- review CSP/security headers
- keep the repo private
- document admin access and credentials handling

---

## 14. Suggested launch order

1. push code to private GitHub
2. create VPS
3. deploy Postgres + backend
4. verify `api.turfop.com`
5. deploy Cloudflare Pages frontend
6. attach domains
7. enable HTTPS
8. smoke test everything
9. only then share publicly
