<!-- Назначение: SSOT матрицы staging/production — URL, Mongo, Clerk, CORS, VITE_* и backend env. -->

# Окружения (staging / production)

SSOT матрицы URL, пар CORS и переменных окружения.  
Архитектура: [`architecture.md`](architecture.md). Hub: [`README.md`](README.md).

---

## URL

| Сервис | Staging | Production |
|--------|---------|------------|
| Frontend | `https://heatcalc-staging-mp62.vercel.app` | `https://heatcalc-mp62.vercel.app` |
| API | `https://heatcalc-api-staging-mp62.onrender.com` | `https://heatcalc-api-mp62.onrender.com` |
| Health | `…/health` | `…/health` |

---

## Git-ветки (предположительно)

| Ветка | Окружение |
|-------|-----------|
| `staging` | Staging (Vercel + Render) |
| `main` | Production (Vercel + Render) |

> Подтвердить Production Branch / Auto-Deploy в Vercel и Render Dashboard.

---

## MongoDB Atlas

| Окружение | Имя БД | Seed |
|-----------|--------|------|
| Local dev | `heating-selection-service` (или из `MONGODB_DB`) | `npm run seed` в `backend/` |
| Staging | **`heatcalc_staging`** | [`render.md`](render.md) § Seed |
| Production | **`heatcalc_production`** | [`first-deploy.md`](first-deploy.md) § Production |

Seed: [`render.md`](render.md) § Seed.

---

## Clerk

Отдельный Clerk Application на каждое окружение. Backend env (`AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_PROVIDER`) и frontend (`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_JWT_TEMPLATE`) **не смешивать**.

Настройка JWT template и allowed origins: [`../auth.md`](../auth.md) § «Настройка Clerk».

---

## Пары CORS (backend → frontend)

Wildcard `*` и общий whitelist staging/production **не используются**.

| Render service | `CORS_ORIGIN` |
|----------------|---------------|
| Staging | `https://heatcalc-staging-mp62.vercel.app` |
| Production | `https://heatcalc-mp62.vercel.app` |
| Local dev | `http://localhost:5173` (и при необходимости `http://127.0.0.1:5173`) |

Для скачивания PDF backend отдаёт `Content-Disposition` — см. [`../project-pdf.md`](../project-pdf.md).

---

## Frontend: `VITE_API_BASE_URL`

Переменные попадают в bundle **на этапе сборки** — после изменения на Vercel нужен **Redeploy**.

### Production

```env
VITE_API_BASE_URL=https://heatcalc-api-mp62.onrender.com
# VITE_DEV_TOOLS — не задавать
# VITE_APP_ENV — не задавать (или production)
```

### Staging

```env
VITE_API_BASE_URL=https://heatcalc-api-staging-mp62.onrender.com
VITE_DEV_TOOLS=1
VITE_APP_ENV=staging
```

### DevPanel (только staging)

Кнопка **Dev** — при `VITE_DEV_TOOLS=1` + `VITE_APP_ENV=staging` + `role=admin` (`GET /api/v1/me`).
На production DevPanel **не монтируется**. Подробнее: [`../frontend-dev-panel.md`](../frontend-dev-panel.md).

### Локально

`VITE_API_BASE_URL` **пустой** → относительные `/api/...` и Vite proxy на `http://localhost:3001`.

---

## Сводная таблица env

### Vercel (`VITE_*`)

| Переменная | Staging | Production |
|------------|---------|------------|
| `VITE_API_BASE_URL` | staging API URL | production API URL |
| `VITE_DEV_TOOLS` | `1` | **не задавать** |
| `VITE_APP_ENV` | `staging` | **не задавать** |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk staging | Clerk production |
| `VITE_CLERK_JWT_TEMPLATE` | = `AUTH_AUDIENCE` backend | то же |
| `VITE_AUTH_REQUIRED` | `true` (typ.) | `true` |

Полный список примеров: [`../../frontend/.env.example`](../../frontend/.env.example). Детали сборки: [`vercel.md`](vercel.md).

### Render (backend)

| Переменная | Staging | Production | Local |
|------------|---------|------------|-------|
| `MONGODB_URI` | `…/heatcalc_staging` | `…/heatcalc_production` | dev cluster |
| `CORS_ORIGIN` | staging Vercel URL | production Vercel URL | `http://localhost:5173` |
| `AUTH_*` | Clerk staging | Clerk production | dev Clerk |
| `PLATFORM_ADMIN_EMAILS` | **один список** | **тот же список** | тот же в `.env` |

Детали: [`render.md`](render.md). Полный справочник: [`../../backend/.env.example`](../../backend/.env.example).

---

## Запреты

- Production Mongo / Clerk в staging
- `PLATFORM_ADMIN_EMAILS` на Vercel (только Render)
- Backend secrets в `VITE_*`
- API Rewrite через Vercel для calc/PDF/SSE

← [Деплой](README.md)
