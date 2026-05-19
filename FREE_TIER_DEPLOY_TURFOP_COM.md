# TurfOp free-tier deploy plan for turfop.com

This is the closest thing to a **free launch path** without rewriting the app:

- **Frontend:** Cloudflare Pages free
- **Backend API:** Render free web service
- **Database:** Render free Postgres
- **Domain:** `turfop.com` on Cloudflare Pages, `api.turfop.com` on Render

## Important reality check

This is fine for:

- private preview
- demo customers
- early validation
- showing the product on a real domain

This is **not a durable production setup** for paying customers because free backend/database tiers can sleep, throttle, or be reclaimed.

If you start getting real usage, move only the backend+DB to a VPS and keep the frontend on Cloudflare Pages.

---

## 1. Push the repo to a private GitHub repo

From the project root:

```bash
cd ~/Desktop/golf-ops-app
git status
git add .
git commit -m "Prepare TurfOp for free-tier deployment"
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

## 2. Frontend on Cloudflare Pages

Create a Pages project from the private GitHub repo.

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

If you set environment variables directly in Cloudflare instead, add them under
**Settings -> Environment variables**. Do not put each assignment on its own line
in the build command; Cloudflare will try to execute the second line as a shell
command.

### Custom domains

Attach:

- `turfop.com`
- optional `www.turfop.com`

---

## 3. Backend on Render free web service

Create a new **Web Service** from the same GitHub repo.

### Service settings

- **Name:** `turfop-api`
- **Root directory:** `backend`
- **Runtime:** Node
- **Build command:**

```bash
npm install
```

- **Start command:**

```bash
npm start
```

- **Health check path:**

```bash
/health
```

### Environment variables

Set these in Render:

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=<generate a long random value>
JWT_ISSUER=turfops-api
JWT_AUDIENCE=turfops-app
JWT_TTL=12h
APP_BASE_URL=https://turfop.com
CORS_ALLOWED_ORIGINS=https://turfop.com
ALLOW_PUBLIC_REGISTRATION=false
ALLOW_MANUAL_TOKEN_PREVIEW=false
SMTP_HOST=<your smtp host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your smtp user>
SMTP_PASS=<your smtp password>
SMTP_FROM="TurfOp <no-reply@turfop.com>"
```

Also set:

```env
DATABASE_URL=<Render Postgres internal or external connection string>
```

Generate a strong JWT secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 4. Database on Render free Postgres

Create a free PostgreSQL database.

Recommended DB name:

```text
greenkeeper_ops
```

After it is created, connect using the external connection string and run:

### Fresh database

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
psql "$DATABASE_URL" -f backend/sql/migrations/20260507_add_updated_at_concurrency.sql
psql "$DATABASE_URL" -f backend/sql/migrations/20260507_add_employee_time_entries.sql
psql "$DATABASE_URL" -f backend/sql/migrations/20260507_expand_employee_time_entries.sql
```

### Existing database

Run only the needed migrations that are not already applied.

---

## 5. Custom domains

### Frontend

In Cloudflare Pages:

- connect `turfop.com`
- optionally connect `www.turfop.com`

### API

In Render:

- add custom domain `api.turfop.com`

Then add the DNS records Render gives you.

---

## 6. Cloudflare DNS shape

Use Cloudflare DNS for the domain.

Expected end state:

- `turfop.com` → Cloudflare Pages target
- `www.turfop.com` → optional Pages target or redirect
- `api.turfop.com` → Render target

---

## 7. First smoke test

After both sides are live:

1. Open `https://turfop.com`
2. Confirm the public landing page loads
3. Open sign-in
4. Try a real API-backed login
5. Create/edit a work order
6. Upload a photo
7. Test password reset
8. Test time tracking clock-in/out
9. Export payroll CSV

---

## 8. Known free-tier limitations

### Cloudflare Pages free

Good enough for the frontend.

### Render free web service

Watch for:

- cold starts
- sleeping after idle
- slower first request
- shared resource limits

### Render free Postgres

Watch for:

- low storage ceilings
- backup/retention limits
- not ideal for durable customer data

---

## 9. Recommended upgrade path

When the first real customers show up:

- keep **Cloudflare Pages** for `turfop.com`
- move API + Postgres to a small VPS
- keep `api.turfop.com` unchanged
- no frontend domain change needed

---

## 10. What you still need from Brandon

Before this can go live, we still need:

1. a **private GitHub repo**
2. access to the **Cloudflare account** for `turfop.com`
3. a **Render account**
4. SMTP credentials for password reset delivery

Without those, I can keep preparing locally, but I cannot complete the external deployment.
