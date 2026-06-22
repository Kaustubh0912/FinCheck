# Deploying FinCheck

The database (MongoDB Atlas) is already in the cloud. You just need to host the
app. There are two supported topologies — **Option A is recommended.**

> **Atlas first:** in MongoDB Atlas → **Network Access**, allow your host to
> connect. For Render/Vercel the simplest is to add `0.0.0.0/0` (allow from
> anywhere). Make sure your `DATABASE_URL` includes a database name (`/fincheck`).

---

## Option A — One web service on Render (recommended)

The Express server serves **both** the API and the built React app, so there's a
single URL and **no CORS** to configure.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml` and creates
   the `fincheck` web service. (Or **New → Web Service** and set the commands below.)
   - **Build command:** `npm install --include=dev && npm run build`
   - **Start command:** `npm run start`
   - **Health check path:** `/api/health`
3. In the service's **Environment**, set:
   - `DATABASE_URL` → your MongoDB Atlas connection string (with `/fincheck`)
   - `JWT_SECRET` → a long random string (the Blueprint auto-generates one)
   - `NODE_ENV` → `production`
4. Deploy. Open the Render URL — the frontend loads and talks to `/api` on the
   same origin.

---

## Option B — Backend on Render, frontend on Vercel

Use this if you specifically want the frontend on Vercel's CDN.

### Backend (Render Web Service)
- **Build command:** `npm install --include=dev && npm run build -w server`
- **Start command:** `npm run start`
- **Health check path:** `/api/health`
- **Env:** `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, and
  `CLIENT_ORIGIN=https://<your-vercel-domain>` (locks CORS to your frontend).
- Note the resulting URL, e.g. `https://fincheck-api.onrender.com`.

### Frontend (Vercel)
- **New Project → import the repo**, set **Root Directory = `client`**.
- Framework preset **Vite** is auto-detected (Build: `npm run build`, Output: `dist`).
- Add env var **`VITE_API_URL`** = `https://fincheck-api.onrender.com/api`.
- Deploy.

---

## Notes

- **Free Render services sleep** after ~15 min idle; the first request then takes a
  few seconds to wake.
- **No migrations** are needed — Mongoose handles schema implicitly.
- **Secrets:** never commit `.env`. Rotate the Atlas DB password if it was ever
  exposed, then update `DATABASE_URL` in your host's dashboard.
- Local production smoke test: `npm run build && npm run start`, then open
  `http://localhost:4000`.
