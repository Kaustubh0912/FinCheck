# FinCheck

FinCheck is a mobile-first personal finance tracker for managing accounts,
transactions, budgets, goals, and spending insights in one place.

It is built around account-aware bookkeeping: every income, expense, transfer,
or split transaction changes an account balance. Balances are calculated from
the opening balance and transaction history rather than stored as editable
totals.

## Features

- Dashboard with balances, spending summaries, budgets, and goals
- Multiple accounts with opening balances and account-specific transactions
- Income, expense, transfer, and split transactions
- Categories, notes, dates, and transaction filtering
- Budget tracking and progress indicators
- Savings goals with contribution actions
- Account and category management
- Authentication with password validation and JWT sessions
- Responsive mobile-first interface with light and dark themes
- Data export from Settings
- Progressive Web App support with installable web experience
- Native Android client with widgets and GitHub Release APK builds

## Tech stack

| Area | Technology |
| --- | --- |
| Web client | React, TypeScript, Vite, React Query, React Router |
| UI | CSS, Font Awesome, responsive mobile-first components |
| PWA | `vite-plugin-pwa`, Workbox service worker |
| API | Node.js, Express, TypeScript |
| Authentication | JWT and bcryptjs |
| Database | MongoDB Atlas with Mongoose |
| Android | Kotlin, Jetpack Compose, Gradle |
| Hosting | Render, Vercel, and GitHub Actions |

## Project structure

```text
FinCheck/
├── client/                 React web application
│   └── src/
│       ├── api/             Axios client and API helpers
│       ├── components/      Shared UI components and sheets
│       ├── pages/           Dashboard, accounts, budget, splits, settings...
│       └── utils/            Client-side helpers and calculations
├── server/                 Express API
│   └── src/
│       ├── auth/             Registration, login, and JWT middleware
│       ├── lib/              Validation, balances, and shared utilities
│       ├── routes/           Accounts, categories, transactions, summary...
│       └── test/             Test setup and helpers
├── android/                Native Android application
├── scripts/                Local development and cleanup scripts
├── render.yaml             Render Blueprint deployment configuration
└── DEPLOY.md               Deployment instructions and environment details
```

## Requirements

- Node.js 22.11.0 or newer
- npm 10 or newer
- MongoDB Atlas, or another MongoDB instance
- JDK 17 for Android builds
- Android SDK for local Android development

## Quick start

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure the API

Create `server/.env`:

```env
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>/<database>
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
NODE_ENV=development
```

`DATABASE_URL` is required. `PORT` defaults to `4000`; `NODE_ENV` defaults to
`development`.

### 3. Start the application

```bash
npm run dev
```

This starts the API on `http://localhost:4000` and the Vite client on
`http://localhost:5173`. The Vite development server proxies `/api` requests
to the API.

Open [http://localhost:5173](http://localhost:5173) and create an account.

## Useful commands

Run commands from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API and web client together |
| `npm run dev:server` | Start only the API |
| `npm run dev:web` | Start only the web client |
| `npm run build` | Build the API and production web client |
| `npm run start` | Serve the production API and built web client |
| `npm run clean` | Remove generated build artifacts |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check client and server |
| `npm test` | Run client and server test suites |
| `npm run test:coverage` | Generate client test coverage |

Production smoke test:

```bash
npm run build
npm run start
```

The single-service production server listens on `http://localhost:4000` and
serves the built client when `client/dist` exists.

## API

The API is served under `/api`:

- `/api/health`
- `/api/auth`
- `/api/accounts`
- `/api/categories`
- `/api/transactions`
- `/api/summary`
- `/api/splits`

The health endpoint returns a small JSON response and is used by Render for
service health checks.

## Separate frontend deployment

For local development and the recommended single-service Render deployment,
the client uses `/api` automatically. If the client is hosted separately, such
as on Vercel, create `client/.env`:

```env
VITE_API_URL=https://your-api-host.example.com/api
```

Set `CLIENT_ORIGIN` on the API to the frontend origin when restricting CORS:

```env
CLIENT_ORIGIN=https://your-frontend.example.com
```

See [DEPLOY.md](DEPLOY.md) for the Render Blueprint and split Render/Vercel
deployment instructions.

## Android

The Android project is located in `android/` and uses Gradle with JDK 17.

```bash
cd android
./gradlew test
./gradlew assembleRelease
```

On Windows, use `gradlew.bat` instead of `./gradlew`.

GitHub Actions builds the release APK and publishes builds from `main` to
GitHub Releases. The web client links to the latest published APK from the
release page.

## CI and deployment

GitHub Actions runs linting, type-checking, tests, and production builds for
the web application and API. The Android workflow runs unit tests and builds
the release APK for pushes and pull requests. Release publication is limited
to pushes on `main`.

Render can deploy the complete application as a single service using
`render.yaml`. Vercel can host the client separately when `VITE_API_URL` is
configured. Both deployment options are documented in [DEPLOY.md](DEPLOY.md).

## Security notes

- Never commit `.env` files or production secrets.
- Use a unique, long `JWT_SECRET` in production.
- Restrict `CLIENT_ORIGIN` to the deployed frontend origin for split deployments.
- MongoDB Atlas network access must allow the deployed API to connect.
- Money is represented in integer minor units, such as paise or cents, to avoid
  floating-point rounding errors.

## License

This project is private and does not currently specify an open-source license.
