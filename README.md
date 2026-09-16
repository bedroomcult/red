# Red

Multi-user period tracker MVP: mode-aware predictions + calendar UI. Vite + React frontend, Cloudflare Pages Functions `/api/*`, D1 storage, pure `lib/predict.ts` shared client/server.

## Dev

```bash
npm install
npm test            # vitest, predict lib
npm run dev         # vite
npx wrangler pages dev --d1 DB=period-db   # Functions + D1 locally
```

Apply schema: `migrations/0001_init.sql` (wrangler applies via `migrations_dir` in `wrangler.toml`).

## Deploy

```bash
npm run build
wrangler d1 create period-db   # copy id into wrangler.toml
npx wrangler pages deploy dist
```

Set `database_id` in `wrangler.toml` before deploy.

## Notes

- Dates stored UTC `YYYY-MM-DD`, rendered local.
- Red hollow = predicted period window, green hollow = predicted ovulation, solid + ✓ = logged.
- No log = prediction stays hollow; predictions persist past expected date until confirmed.
- BC regimen active → predictions suppressed (amber banner). EC within 60d → widened window, ovulation hidden (yellow banner + test guidance).
- General info only, not medical advice. Predictions are estimates, not contraception guidance.
