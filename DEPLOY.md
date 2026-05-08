# Deploy

## Local Development

Install dependencies, then run the Vite dev server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production Build

Create the static production build:

```bash
npm run build
```

The deployable frontend is generated in `dist/`.

Preview the production build locally:

```bash
npm run preview
```

## Vercel Deployment

1. Push this project to a Git provider supported by Vercel.
2. Create a new Vercel project from the repository.
3. Use the default Vite settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. Add environment variables in Vercel:
   - `VITE_APP_NAME`
   - `VITE_BOT_USERNAME`
   - `VITE_PUBLIC_APP_URL`
   - `VITE_API_URL` only when a backend is deployed
5. Deploy.

## BotFather Web App URL

After Vercel deploys, copy the production HTTPS URL, then configure the Telegram bot:

1. Open BotFather in Telegram.
2. Select your bot.
3. Configure the bot menu button or Web App button.
4. Set the Web App URL to your Vercel URL, for example:

```text
https://your-vercel-project.vercel.app
```

The app still works as a static frontend when `VITE_API_URL` is empty. Local save remains localStorage-only in that mode.

## Backend Foundation

A minimal backend now lives in `backend/`.

Run frontend:

```bash
npm install
npm run dev
```

Run backend:

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Set `BOT_TOKEN` in `backend/.env` to the token from BotFather. Telegram auth validation cannot work in production without it.

The backend currently uses in-memory `Map` storage for player profiles and cloud saves. This is temporary: all data is lost when the server restarts. The next backend step is adding a real database and authorization checks for cloud save endpoints.

No real payments or NFT minting are implemented yet.

## Telegram Testing Checklist

- The app opens over HTTPS from Telegram.
- `WebApp.ready()` and `WebApp.expand()` run without errors.
- Safe-area spacing looks correct on mobile.
- Hatch, Collection, Breed, Shop, and Profile tabs render.
- Local save persists after closing and reopening Telegram.
- Referral links use the production origin.
- Mock Telegram Stars purchase modal opens and grants local rewards.
- NFT/Mint remains marked as Coming Soon or mock-only.
- Profile dev panel shows origin, mode, Telegram detection, player id, and referral code.
