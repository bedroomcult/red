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

- Dates are stored as UTC `YYYY-MM-DD` and rendered in the local date.
- Red hollow is the predicted period window, green hollow is predicted ovulation, solid with a check is logged.
- A day with no log keeps the prediction hollow. Predictions persist past the expected date until the user confirms.
- While a BC regimen is active, predictions are suppressed and an amber banner explains why.
- An EC event within 60 days widens the prediction window and hides ovulation. A yellow banner shows the test guidance.
- General information only, not medical advice. Predictions are estimates and are not contraception guidance.
