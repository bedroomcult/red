# Period Tracker — Design Spec (Mode-Aware B)
Date: 2026-09-14
Status: approved in chat, pending file review

## 1. Goal
Multi-user period tracker on Cloudflare Pages + D1 + shadcn. Aware of cycle change, birth-control pills, emergency pills. MVP, no bloat.

## 2. Architecture
- Cloudflare Pages static frontend (shadcn UI, minimal JS, fetch to API)
- Pages Functions `/api/*` for auth + CRUD + prediction
- D1 single DB, UTC dates stored, local render
- Auth: simple D1 auth — `users(id,email,pass_hash,salt,created_at)` + `sessions(token,user_id,expires_at)`. HttpOnly cookie, 30d expiry. WebCrypto scrypt hash. Rate-limit login in Function.
  - ponytail: plain hash+salt, upgrade to Argon2 if abuse seen.

### Tables
- `users`, `sessions`
- `periods(id,user_id,start_date,end_date,flow,type)` type: menstruation|withdrawal|breakthrough|spotting
- `pill_regimens(id,user_id,pill_type,regimen,pack_start_date)` pill_type: combined|mini; regimen: 21/7|24/4|84/7|continuous
- `dose_logs(id,user_id,date,taken)` taken: 0|1
- `ec_events(id,user_id,ec_type,intake_at,upsi_at)` ec_type: LNG|UPA|copper-IUD|unknown
- `symptoms(id,user_id,date,note)` minimal v1 (flow lives in periods)

## 3. Prediction Engine (pure `lib/predict.ts`)
- Input: period start list (type=menstruation only for natural avg; withdrawal/breakthrough excluded)
- avg = mean last 3–6 cycles, drop single outlier (>2xSD). SD computed.
- next_start = last_start + round(avg). window = ±max(SD,2d).
- confidence: SD<2 high, <4 medium, else low. Low → show range only, no single day.
- ovulation = next_start − 14d; fertile = ov −5d..+1d. Suppressed in BC / EC-disrupted.
- irregular if |current−avg|>7d OR (max−min)>9d over last 6–12.
- late only after expected+7d. No avg shift till new bleed logged.
- spotting rule: <2d light, no product → type=spotting, excluded from day1.
- missed period: keep expected, flag `awaiting_input`, widen low confidence.

## 4. BC Mode
- Toggle + regimen pick. Suppresses ovulation/fertile/late/cycle stats.
- 21/7, 24/4: placebo auto-mark expected withdrawal bleed d2–4. Continuous: no prediction, log spotting only.
- Mini-pill: accept amenorrhea + random spotting, no recalc.
- Dose log daily checkbox. Missed rules: 1 combined missed → take ASAP banner; 2+ missed or mini outside window (3h LNG / 12h desogestrel) → backup 7–14d warning + EC hint if sex since missed.
- Bleed types kept distinct.

## 5. EC Disrupted Mode
- Log LNG/UPA/copper + intake + UPSI dates. Flag current cycle disrupted, exclude from avg.
- Research basis: LNG pre-ovulation delays 3–7d; ~80% bleed ±7d, ~15% >7d late; UPA mean +2–3d, often 5–7d late, up to 20d; spotting 1–2wk common; next cycle normalizes. Copper: length same, volume/duration up.
- Tracker: widen next 1–2 predictions ±7–10d, suppress late alarms + ovulation unreliable banner, prompt log next bleed to recalibrate.
- Medical surface (info only, not advice): test if no bleed expected+7d or 21d post UPSI/EC; seek care if >2 pads/hr 2h, severe pain, faintness, positive test, delay >3wk. UPA → wait 5d restart hormonal; LNG → restart now + condoms 7d. Footer disclaimer + consult clinician.

## 6. UX / Data Flow
- Screens: login/signup, dashboard calendar (predicted range shaded + confidence label), log period, BC pack view, EC log, history list.
- Flow: log bleed → POST /api/periods → recalc predict() server-side → return next + window + flags → render.
- States: natural / BC-suppressed / EC-disrupted banner always visible when not natural.

## 7. Security / Errors / Edge
- D1 at-rest encrypted; no cycle data in analytics; logout-all; session rotate.
- Timezone: store UTC date-only, render local.
- Anovulatory long/short → low confidence, no false late.
- Rate limit auth, slow hash, generic login errors.

## 8. Testing
- Unit asserts on `predict()`: avg calc, SD bands, EC widen, BC suppress, outlier drop, late threshold.
- One e2e: signup → log 3 periods → see prediction; log EC → see disrupted banner.
- No framework bloat: asserts + manual e2e v1.

## 9. MVP Cut (ship / skip)
Ship: auth, period log, dashboard + range, BC toggle + dose log, EC log + banner, history.
Skip: cron reminders, BBT/LH/CM charts, sharing, i18n, native apps.
Files: `functions/api/*`, `src/*`, `lib/predict.ts`, `migrations/*.sql`.

## 10. Open Risks
- Simple D1 auth weaker than provider auth — acceptable v1, rate-limit mitigates.
- Calendar method only — no BBT/LH refine till v2.
