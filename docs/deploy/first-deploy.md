<!-- Назначение: пошаговый runbook первого деплоя staging (Mongo → Clerk → Render → Vercel → smoke). -->

# Первый деплой (runbook)

Пошаговое развёртывание **staging** с нуля. Production — те же шаги с production URL, Clerk и MongoDB (см. § Production ниже).

Hub: [`README.md`](README.md). Матрица env: [`environments.md`](environments.md).

---

## Предварительные условия

- [ ] Репозиторий на GitHub, ветки `main` и `staging`
- [ ] MongoDB Atlas cluster доступен
- [ ] Clerk Application для staging (отдельно от production)
- [ ] Аккаунты Vercel и Render
- [ ] Локально: `npm run verify` проходит (см. [`baseline.md`](baseline.md))

---

## Шаг 1. MongoDB Atlas (staging)

1. Создать БД **`heatcalc_staging`** (или использовать существующую).
2. Network Access: разрешить IP Render (или `0.0.0.0/0` на этапе настройки).
3. Получить `MONGODB_URI` с путём `/heatcalc_staging`.

**Seed** (локально, credentials в `backend/.env`):

```bash
cd backend
npm run seed:mongo-db -- heatcalc_staging
npm run verify:mongo-db -- heatcalc_staging
npm run verify:seed-catalog
```

Детали: [`render.md`](render.md) § Seed, [`baseline.md`](baseline.md) §9.

---

## Шаг 2. Clerk (staging)

1. **Clerk Dashboard** → staging Application.
2. **JWT Templates** → template (напр. `heatcalc-api`):
   - `aud` = будущий `AUTH_AUDIENCE` на Render
   - Claims: `email`, `email_verified` — см. [`../auth.md`](../auth.md) § «Настройка Clerk».
3. **Paths / Redirect URLs:** добавить  
   `https://heatcalc-staging-mp62.vercel.app` и `http://localhost:5173` (dev).
4. Записать: `AUTH_JWKS_URI`, `AUTH_ISSUER`, publishable key для Vercel.

---

## Шаг 3. Render (staging API)

1. **New Web Service** → подключить GitHub repo.
2. **Root Directory:** `backend`
3. **Branch:** `staging` (или ваша staging-ветка)
4. **Build:** `npm ci --omit=dev`
5. **Start:** `npm start`
6. **Health Check Path:** `/health`

**Environment** (минимум):

```env
MONGODB_URI=mongodb+srv://…/heatcalc_staging
CORS_ORIGIN=https://heatcalc-staging-mp62.vercel.app
AUTH_JWKS_URI=https://….clerk.accounts.dev/.well-known/jwks.json
AUTH_ISSUER=https://….clerk.accounts.dev
AUTH_AUDIENCE=heatcalc-api
AUTH_PROVIDER=clerk
PLATFORM_ADMIN_EMAILS=your-admin@example.com
CATALOG_SOURCE=mongo
GEOCODE_USER_AGENT=heatcalc/1.0 (your@email.com)
```

Опционально PDF: `PDF_BROWSER_EXECUTABLE` — [`../project-pdf.md`](../project-pdf.md).

7. Deploy → дождаться **Live**.
8. Проверка: `curl …/health` → 200 — [`smoke-tests.md`](smoke-tests.md).

---

## Шаг 4. Vercel (staging frontend)

1. **New Project** → тот же GitHub repo.
2. **Root Directory:** **корень репозитория** (поле **пустое** / `.`) — **не** `frontend/`.  
   Иначе install `npm ci --prefix frontend` падает с `EUSAGE` (см. [`vercel.md`](vercel.md) § Troubleshooting).
3. **Production Branch:** `staging`
4. **Node.js:** 22.x (≥ 22.22)

**Build settings** — Override **off** (из [`vercel.json`](../../vercel.json)) или вручную (SSOT — [`vercel.md`](vercel.md)):

```text
Install Command:    npm ci --prefix frontend
Build Command:      npm run vercel-build
Output Directory:   build
```

5. **Environment Variables:**

```env
VITE_API_BASE_URL=https://heatcalc-api-staging-mp62.onrender.com
VITE_DEV_TOOLS=1
VITE_APP_ENV=staging
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
VITE_CLERK_JWT_TEMPLATE=heatcalc-api
VITE_AUTH_REQUIRED=true
VITE_SITE_URL=https://heatcalc-staging-mp62.vercel.app
```

6. Deploy → открыть staging frontend URL.

> Если Dashboard не даёт задать build settings — см. [`vercel.md`](vercel.md) и [`phase0-audit.md`](phase0-audit.md) §0.2.

---

## Шаг 5. Smoke (staging)

Пройти [`smoke-tests.md`](smoke-tests.md) A1–A7 на staging.

Дополнительно в UI:

- [ ] Стартовый экран загружается
- [ ] «Почати новий розрахунок» → анкета
- [ ] Login → `/api/v1/me` 200
- [ ] Calc (авто или DevPanel) → отчёт
- [ ] Admin: «Звернення», `/admin/feedback`

---

## Шаг 6. Production

Отдельный проход после стабильного staging:

| Ресурс | Production |
|--------|------------|
| Mongo | `heatcalc_production` + seed |
| Render | новый Web Service, branch `main`, production env |
| Vercel | новый проект, branch `main`, **без** `VITE_DEV_TOOLS` |
| Clerk | **отдельный** production Application |

Чеклист env: [`environments.md`](environments.md). Smoke: [`smoke-tests.md`](smoke-tests.md) (A7 — без Dev).

---

## Troubleshooting

| Симптом | Проверить |
|---------|-----------|
| CORS error в браузере | `CORS_ORIGIN` на Render = exact staging/prod Vercel URL |
| 401 на `/me` | Clerk JWT template, `VITE_CLERK_JWT_TEMPLATE` = `AUTH_AUDIENCE` |
| 403 JWT без email | Claims в Clerk template — [`../auth.md`](../auth.md) |
| Catalog empty | `CATALOG_SOURCE=mongo`, seed выполнен, cache invalidate |
| DevPanel нет | staging env + admin role + режим анкеты — [`../frontend-dev-panel.md`](../frontend-dev-panel.md) |

← [Деплой](README.md)
