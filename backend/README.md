# Neon Mutant Hatchery Backend

Minimal backend foundation for the Telegram Mini App.

## Stack

- Node.js
- Express
- TypeScript
- cors
- dotenv
- crypto
- SQLite via `better-sqlite3`

## Setup

```bash
cd backend
npm install
copy .env.example .env
```

Set `BOT_TOKEN` to the token from BotFather.

```env
NODE_ENV=development
PORT=8080
BOT_TOKEN=123456:replace_with_your_telegram_bot_token
FRONTEND_URL=http://127.0.0.1:5174
SQLITE_PATH=./data/neon-hatch.db
```

## Run

```bash
npm run dev
```

Build:

```bash
npm run build
```

Start compiled server:

```bash
npm start
```

The server listens on `0.0.0.0` and uses `process.env.PORT || 8080`, which is required by Render and works locally.

## Render Deploy

Create a new Render Web Service from this repository.

Recommended settings:

- Root directory: `backend`
- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`

Environment variables:

```env
NODE_ENV=production
BOT_TOKEN=123456:replace_with_your_telegram_bot_token
FRONTEND_URL=https://your-vercel-project.vercel.app
SQLITE_PATH=./data/neon-hatch.db
```

Render sets `PORT` automatically. Do not hardcode it.

After deploy:

- Open `https://your-render-service.onrender.com/health` and confirm `{ "ok": true }`.
- Set frontend `VITE_API_URL` to the Render backend URL.
- Redeploy the Vercel frontend.
- In Telegram, launch the Mini App and confirm auth, cloud save, referrals, and mock payments reach the backend.

SQLite note: this database is useful for development and an early hosted prototype, but it is not ideal for production scaling on Render. Render instances can restart and local disk behavior depends on the selected plan. Before launch, move to a managed database such as Postgres with migrations and backups.

## Endpoints

## Database

The backend uses SQLite for development persistence. By default the database file is:

```text
backend/data/neon-hatch.db
```

You can override it with `SQLITE_PATH`. The server creates the database directory, file, and tables on startup. The default path uses `process.cwd()` so it resolves safely inside `backend` locally and on Render when `backend` is the service root.

Tables:

- `players`: Telegram player identity, referral code, optional referrer, timestamps.
- `saves`: one cloud save JSON payload per player.
- `referrals`: one referral attribution row per invited player.
- `referral_milestone_claims`: claimed invite milestone rewards per inviter.
- `purchases`: Telegram Stars invoice placeholders and dev mock purchase completions.

SQLite is a good development step because it survives server restarts and keeps the schema real. It is still not the final production database plan: before launch, move to a managed database, add migrations/backups, add request authorization on save routes, and harden referral reward attribution.

## Endpoints

### `POST /api/auth/telegram`

Validates Telegram WebApp `initData` using `BOT_TOKEN`.

Request:

```json
{
  "initData": "query-string-from-window.Telegram.WebApp.initData"
}
```

Response:

```json
{
  "playerId": "tg_123",
  "telegramUser": {},
  "isNewPlayer": true,
  "player": {
    "id": "tg_123",
    "telegramId": "123",
    "username": "player",
    "firstName": "Player",
    "lastName": null,
    "referralCode": "ABC123DEF0",
    "referredBy": null,
    "createdAt": "2026-05-08T00:00:00.000Z",
    "updatedAt": "2026-05-08T00:00:00.000Z"
  }
}
```

In non-production only, an empty `initData` creates or reuses a stable dev player in SQLite. This is dev-only and must not be used as production auth.

### `GET /api/player/:playerId/save`

Returns the SQLite-backed cloud save:

```json
{
  "gameState": {},
  "updatedAt": "2026-05-08T00:00:00.000Z"
}
```

If no save exists:

```json
{
  "gameState": null,
  "updatedAt": null
}
```

### `POST /api/player/:playerId/save`

Stores:

```json
{
  "gameState": {}
}
```

The save is stored in the `saves` table as JSON. This keeps the current frontend save format intact while backend systems mature.

### `POST /api/referral/register`

Stores first-touch referral attribution in SQLite.

```json
{
  "playerId": "tg_123",
  "referralCode": "ABC123"
}
```

Rules enforced:

- Reject unknown referral codes.
- Reject self-referrals.
- Reject duplicate referral attribution.
- Prevent changing a player's referrer after it is set.

### `GET /api/referral/:playerId`

Returns backend-authoritative referral progress.

```json
{
  "playerId": "tg_123",
  "referralCode": "ABC123DEF0",
  "referredBy": null,
  "inviteCount": 3,
  "claimedMilestones": [1],
  "milestones": [
    {
      "invites": 3,
      "label": "5 gems + 2 capsules",
      "reward": { "gems": 5, "eggs": 2 },
      "claimed": false,
      "claimable": true
    }
  ]
}
```

### `POST /api/referral/claim`

Claims a backend-validated invite milestone.

```json
{
  "playerId": "tg_123",
  "milestone": 3
}
```

The backend checks invite count, prevents duplicate claims, stores the claim, and returns the reward payload for the frontend to apply to the player's game save.

### `POST /api/referral/simulate`

Development-only endpoint. Creates a fake referred player and attaches it to the current inviter so the referral UI can be tested locally.

```json
{
  "playerId": "tg_123"
}
```

### `GET /api/products`

Returns the backend-owned Telegram Stars product catalog.

Product ids:

- `premium_capsules_3`
- `premium_capsules_10`
- `gems_100`
- `gems_500`
- `double_income_24h`
- `lucky_hatch_1h`
- `mutation_storm_ticket`

### `POST /api/payments/create-invoice`

Creates a purchase record and returns an invoice placeholder.

```json
{
  "playerId": "tg_123",
  "productId": "premium_capsules_3"
}
```

TODO before real Stars launch:

- Use Telegram `createInvoiceLink` or `sendInvoice`.
- Validate `pre_checkout_query`.
- Grant rewards only after a verified `successful_payment`.
- Reconcile failed/expired pending purchases.

### `POST /api/payments/mock-complete`

Development-only endpoint. Completes a product purchase without real Telegram Stars and returns the reward payload for the frontend to apply to the current game save.

```json
{
  "playerId": "tg_123",
  "productId": "premium_capsules_3"
}
```

TODO before production:

- Add authorization checks to save endpoints.
- Add migrations and database backups.
- Move from local SQLite to a managed production database.
- Add rate limits and request logging.
- Complete real Telegram Stars payment confirmation.
- Add real NFT services separately when ready.
