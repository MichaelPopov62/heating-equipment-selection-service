<!-- Назначение: SSOT backend на Render — Web Service, env, seed, health и PDF/Chromium. -->

# Render (backend API)

Развёртывание Express API из каталога `backend/`.  
Матрица env: [`environments.md`](environments.md).

---

## Web Service

```text
Service Type:     Web Service
Root Directory:   backend
Build Command:    npm ci --omit=dev
Start Command:    npm start
Health Check:     /health
```

Backend — **долгоживущий** Express-процесс. **Не** переносится в Vercel Functions.

Auto-deploy после push — настройка Render Dashboard (ветка `staging` / `main` — см. [`environments.md`](environments.md)).
Файла `render.yaml` в репозитории **нет**.

---

## Обязательные Environment Variables

Отдельно для **каждого** Web Service (staging и production):

| Переменная | Staging | Production | Local `backend/.env` |
|------------|---------|------------|----------------------|
| `MONGODB_URI` | `…/heatcalc_staging` | `…/heatcalc_production` | local: `MONGODB_*` / `.env` |
| `CORS_ORIGIN` | `https://heatcalc-staging-mp62.vercel.app` | `https://heatcalc-mp62.vercel.app` | `http://localhost:5173` |
| `AUTH_JWKS_URI` | Clerk staging JWKS | Clerk production JWKS | dev Clerk |
| `AUTH_ISSUER` | Clerk staging issuer | Clerk production issuer | dev Clerk |
| `AUTH_AUDIENCE` | напр. `heatcalc-api` | то же для prod Clerk | dev |
| `AUTH_PROVIDER` | `clerk` | `clerk` | `clerk` |
| `PLATFORM_ADMIN_EMAILS` | **один список** | **тот же список** | comma-separated |

```env
# Пример — одинаково на staging и production Render:
PLATFORM_ADMIN_EMAILS=popov1ms@i.ua,romantikzizni@gmail.com
```

После изменения **`PLATFORM_ADMIN_EMAILS`** — **Redeploy** backend. На Vercel **не** задавать.  
Подробнее: [`../auth.md`](../auth.md) (Platform admin), [`smoke-tests.md`](smoke-tests.md).

---

## Рекомендуемые переменные

| Переменная | Назначение |
|------------|------------|
| `CATALOG_SOURCE` | `mongo` (production) или `auto` |
| `WATER_NORMS_SOURCE`, `APPLIANCES_SOURCE`, … | `mongo` / `auto` |
| `GEOCODE_USER_AGENT` | Nominatim (contact email) |
| `METEOSTAT_YEARS` | глубина истории климата (default 10) |
| `METEOSTAT_BULK_TIMEOUT_MS` | таймаут HTTP bulk Meteostat (мс); без env — 15000 fetch / 8000 HEAD |
| `LOG_LEVEL` | `info` / `debug` |
| `PDF_BROWSER_EXECUTABLE` | путь к Chromium на Render — [`../project-pdf.md`](../project-pdf.md) |
| `TRUST_PROXY` | `1` за reverse proxy Render |

Полный справочник: [`../../backend/.env.example`](../../backend/.env.example).

---

## Seed MongoDB

### Staging (`heatcalc_staging`)

```bash
cd backend
npm run seed:mongo-db -- heatcalc_staging
npm run verify:mongo-db -- heatcalc_staging
npm run verify:seed-catalog
```

Credentials берутся из `backend/.env`; CLI подменяет только имя БД в URI.
Альтернатива аргументу CLI: `SEED_MONGODB_DB=heatcalc_staging` в `.env` (см. [`../../backend/.env.example`](../../backend/.env.example)).

Ожидаемый результат после seed (ориентир по `test_data.json.example` + `backend/data/`): заполнены `products`, `water_norms`, `appliances`, `recommendations`, `underfloor_heating_presets`. Точные счётчики — `npm run verify:mongo-db -- <dbName>` / `npm run verify:seed-catalog`.

### Production (`heatcalc_production`)

Отдельный runbook после staging smoke — [`first-deploy.md`](first-deploy.md) § Production. Команда seed та же с именем БД `heatcalc_production`.

После seed на production/staging при необходимости:

```http
POST /api/v1/system/invalidate-reference-cache
X-System-Token: <SYSTEM_INTERNAL_TOKEN>
```

Или рестарт сервиса / TTL `REFERENCE_CACHE_TTL_MS`.

---

## PDF на Render

Chromium для серверного PDF — [`../project-pdf.md`](../project-pdf.md).  
Docker-образ для справки: [`../../backend/Dockerfile`](../../backend/Dockerfile).

---

## Health check

```bash
curl -s https://heatcalc-api-staging-mp62.onrender.com/health
curl -s https://heatcalc-api-mp62.onrender.com/health
```

Ожидание: HTTP 200, JSON `{ "ok": true, … }`.

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [`vercel.md`](vercel.md) | Vercel / `VITE_API_BASE_URL` |
| [`first-deploy.md`](first-deploy.md) | Первый деплой |
| [`smoke-tests.md`](smoke-tests.md) | Smoke |
| [`../projects-api.md`](../projects-api.md) | Projects API |

← [Деплой](README.md)
