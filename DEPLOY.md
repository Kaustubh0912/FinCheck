# Deploying FinCheck & Operations Runbook

The database (MongoDB Atlas) is already in the cloud. You just need to host the
app. There are two supported topologies — **Option A is recommended.**

> **Atlas first:** in MongoDB Atlas → **Network Access**, allow your host to
> connect. For Render/Vercel the simplest is to add `0.0.0.0/0` (allow from
> anywhere). Make sure your `DATABASE_URL` includes a database name (`/fincheck`).

---

## Option A — One web service on Render (recommended)

The Express server serves **both** the API and the built React app, so there's a
single URL and **no CORS** to configure.

### 1. Initial Setup
1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml` and creates
   the `fincheck` web service with:
   - **Build command:** `npm ci --include=dev && npm run build`
   - **Start command:** `npm run start`
   - **Health check path:** `/api/health`
   - **Auto deploy:** `false` (gated behind passing CI)
3. In the service's **Environment**, set:
   - `DATABASE_URL` → your MongoDB Atlas connection string (with `/fincheck`)
   - `JWT_SECRET` → a long random string (the Blueprint auto-generates one)
   - `NODE_ENV` → `production`

### 2. Gating Deployments with GitHub Actions CI
To ensure Render deploys **only after** linting, typechecks, unit tests, and production builds pass:
1. In the Render Dashboard for your service, go to **Settings → Deploy Hook**.
2. Click **Create Deploy Hook** and copy the resulting webhook URL (e.g. `https://api.render.com/deploy/srv-xxxx?key=yyyy`).
3. In your GitHub repository:
   - Go to **Settings → Environments → New environment**, and name it `production`.
   - Add an environment secret named **`RENDER_DEPLOY_HOOK_URL`** containing the Render deploy hook URL.
4. Configure this secret before merging to `main`. GitHub Actions runs the full verification suite and, when green, triggers Render. The deploy job fails if the secret is missing so a green workflow cannot silently skip production deployment.
5. Render deploys with zero downtime, automatically verifying `/api/health` before routing live traffic.

---

## Option B — Backend on Render, frontend on Vercel

Use this if you specifically want the frontend on Vercel's CDN.

### Backend (Render Web Service)
- **Build command:** `npm ci --include=dev && npm run build -w server`
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

## Android App Release & Signing Runbook

Android builds and releases are managed via `.github/workflows/android.yml`.

### 1. Local Development
- Local builds use standard Android debug signing automatically:
  ```bash
  cd android
  ./gradlew test assembleDebug
  ```
- No release secrets are required on local developer machines.

### 2. Release Signing Configuration (GitHub Actions)
Release signing keys are **never** committed to version control. They are provided at build time via protected GitHub Environment secrets.

1. Generate a release keystore (if not already created):
   ```bash
   keytool -genkeypair -v -keystore fincheck-release.jks -alias fincheck \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Encode the keystore as a base64 string:
   ```bash
   # macOS/Linux:
   base64 -i fincheck-release.jks | tr -d '\n' > keystore_base64.txt
   # Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("fincheck-release.jks")) | Set-Content keystore_base64.txt
   ```
3. In your GitHub repository:
   - Go to **Settings → Environments → New environment**, and name it `android-release`.
   - Configure required reviewers or branch protections if desired.
   - Add the following four secrets to `android-release`:
     - `ANDROID_KEYSTORE_BASE64`: The full base64 string from step 2.
     - `ANDROID_KEYSTORE_PASSWORD`: Keystore password.
     - `ANDROID_KEY_ALIAS`: Keystore alias (e.g. `fincheck`).
     - `ANDROID_KEY_PASSWORD`: Key password.

### 3. Publishing an Official Release
Android releases are published strictly via semantic version tags or manual workflow dispatch:

- **Via Git Tag**:
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```
- **Via GitHub Actions UI**:
  - Go to **Actions → Android CI → Run workflow**.
  - Select the `main` branch as the workflow ref.
  - Enter the semantic version tag (e.g. `v1.0.0`) and trigger.

The workflow:
1. Runs tests and builds a debug APK for verification.
2. Unpacks the keystore into `$RUNNER_TEMP` (cleared immediately after run).
3. Compiles the signed release APK (`app-release.apk`).
4. Creates a GitHub Release tagged `v1.0.0` with release notes and the APK attached.
5. Keeps build artifacts for 7 days.

### 4. Key Rotation / Compromise Recovery
If a signing keystore or credential is ever compromised:
1. Generate a brand-new keystore using `keytool` as shown above.
2. In GitHub **Settings → Environments → android-release**, replace the four secrets with the new keystore values.
3. If publishing to Google Play in the future, follow Google Play App Signing key upgrade procedures.
4. Delete any locally leaked `.jks` files. Note that deleting from Git tree does not wipe Git history; if pushed to a public remote, treat the old key as permanently compromised.

---

## Operations & Rollback Runbook

### Health Verification
- **Endpoint:** `GET /api/health`
- **Expected response:** `200 OK` with JSON `{"ok":true,"service":"fincheck"}`.
- **Verification command:**
  ```bash
  curl -i https://<your-render-url>/api/health
  ```
- If the endpoint returns non-200 or times out, inspect server logs in the Render Dashboard.

### Rollback Procedure
If a production deployment encounters issues:
1. **Instant Render Rollback**:
   - Go to **Render Dashboard → fincheck service → Deploys**.
   - Find the last known good deployment and click **Rollback to this deploy**.
   - Render immediately switches traffic back to the previous healthy build.
2. **Git Rollback**:
   - Revert the problematic commit on `main`:
     ```bash
     git revert HEAD
     git push origin main
     ```
   - CI will run the test suite and trigger the Render deploy hook on green.

---

## Notes & Best Practices

- **Free Render services sleep** after ~15 min idle; the first request then takes a few seconds to wake.
- **No migrations** are needed — Mongoose handles schema implicitly.
- **Secrets:** Never commit `.env` or keystore files. Rotate passwords immediately if exposed.
- **Local production smoke test:**
  ```bash
  npm run build && npm run start
  # Open http://localhost:4000
  ```
