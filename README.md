# FinCheck

A mobile-first personal finance tracker with **account-aware** transactions.

Every transaction moves money relative to your accounts:

- **Income** → credits an account (e.g. _Salary_ into _Bank ****7512_)
- **Expense** → debits an account (e.g. paying for groceries from your bank)
- **Transfer** → debits one account and credits another (e.g. an ATM withdrawal moves money from _Bank_ to _Cash_)

Account balances are never stored directly — they are computed from an opening
balance plus every inflow minus every outflow, so the books always reconcile.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Client   | React + TypeScript + Vite, React Query, Recharts, light/dark |
| Server   | Node + Express + TypeScript, JWT auth                       |
| Database | MongoDB Atlas via Prisma ORM (mongodb connector)            |

## Getting started

```bash
# 1. Install all workspaces (also runs `prisma generate`)
npm install

# 2. Set DATABASE_URL in server/.env to your MongoDB Atlas connection string,
#    then push the schema + generate the client (run from the server folder):
cd server && npx prisma db push && npx prisma generate && cd ..

# 3. Run the API (:4000) and the web app (:5173) together
npm run dev
```

> Run Prisma commands from `server/` (not the repo root) — the schema lives at
> `server/prisma/schema.prisma`.

Then open **http://localhost:5173**, create an account, and start tracking.
A starter _Cash_ account and a set of income/expense categories are created for you.

## Useful scripts

| Command                       | What it does                                  |
| ----------------------------- | --------------------------------------------- |
| `npm run dev`                 | Run server + client together (hot reload)     |
| `npm run dev:server`          | API only                                      |
| `npm run dev:web`             | Web app only                                  |
| `npm run db:setup`            | Push the Prisma schema to SQLite              |
| `npm run db:studio -w server` | Open Prisma Studio to inspect the database    |
| `npm run build`               | Type-check + build both packages              |

## Project layout

```
FinCheck/
├─ server/                 Express API
│  ├─ prisma/schema.prisma  Data model (User, Account, Category, Transaction)
│  └─ src/
│     ├─ auth/              register / login / JWT middleware
│     ├─ routes/            accounts, categories, transactions, summary
│     └─ lib/               validation, balance computation, seed data
└─ client/                 React app
   └─ src/
      ├─ pages/             Dashboard, Transactions, Accounts, Settings, Login
      ├─ components/        PillNav, Sheet, AddTransactionSheet, ...
      └─ api/               axios client + React Query hooks
```

## Notes

- Money is stored as integer minor units (paise/cents) to avoid float errors.
- The JWT secret lives in `server/.env` — change it before deploying.
- Use **Settings → Export all data** to download a JSON backup.
