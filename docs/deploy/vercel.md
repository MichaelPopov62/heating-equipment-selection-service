<!-- Назначение: SSOT сборки frontend на Vercel — vercel-build, vercel.json, VITE_* и redeploy. -->

# Vercel (frontend)

Развёртывание React + Vite SPA из монорепозитория.  
Матрица env: [`environments.md`](environments.md). SSOT сборки — [`phase0-audit.md`](phase0-audit.md) §0.3.

---

## SSOT конфигурации сборки

Frontend импортирует [`shared/`](../../shared/) — сборка из **корня репозитория**:

```text
Root Directory:     repository root (не frontend/)
Node.js Version:    22.22+  (engines frontend; CI — 22.22.0)
Install Command:    npm ci --prefix frontend
Build Command:      npm run vercel-build
Output Directory:   build
```

Цепочка [`package.json`](../../package.json):

```json
"vercel-build": "npm run build --prefix frontend && node scripts/vercelPrepareOutput.mjs"
```

Скрипт [`scripts/vercelPrepareOutput.mjs`](../../scripts/vercelPrepareOutput.mjs) копирует `frontend/dist` → **`build/`** (корень репо).

SPA rewrites — корневой [`vercel.json`](../../vercel.json):

```json
{ "source": "/(.*)", "destination": "/index.html" }
```

Корневой `vercel.json` — **только** статический SPA; Node backend на Vercel **не** разворачивается.

SSOT в репозитории — корневой [`vercel.json`](../../vercel.json). Файл `frontend/vercel.json` **удалён**: дублировал конфиг и расходился с `vercel-build`.

---

## Vercel Dashboard (вариант A, обязательно)

Для **каждого** проекта (`heatcalc-staging-mp62`, `heatcalc-mp62`) — **Settings → General**:

| Параметр | Значение |
|----------|----------|
| **Root Directory** | **корень репозитория** (поле пустое или `.`) — **не** `frontend/` |
| **Node.js Version** | **22.x** (≥ 22.22) |

**Settings → Build & Development:** Override **выключить** (берётся [`vercel.json`](../../vercel.json)) **или** вручную те же три команды, что в SSOT выше.

После смены Root Directory — **Redeploy** (лучше без build cache).

### Troubleshooting: `npm ci --prefix frontend` → `EUSAGE` / нет `package-lock.json`

Причина: Root Directory = `frontend/`, а install-команда рассчитана на **корень** монорепо (`frontend/package-lock.json` относительно root).

Fix: Root Directory → **корень репо** → Redeploy. Не менять install на `npm ci` в Dashboard, пока Root = `frontend/` — это другой сценарий (не вариант A).

---

## Environment Variables

Отдельно для **каждого** Vercel-проекта (staging и production **не наследуют** переменные):

| Переменная | Staging | Production |
|------------|---------|------------|
| `VITE_API_BASE_URL` | `https://heatcalc-api-staging-mp62.onrender.com` | `https://heatcalc-api-mp62.onrender.com` |
| `VITE_DEV_TOOLS` | `1` | **не задавать** |
| `VITE_APP_ENV` | `staging` | **не задавать** |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk staging pk | Clerk production pk |
| `VITE_CLERK_JWT_TEMPLATE` | = backend `AUTH_AUDIENCE` | то же |
| `VITE_AUTH_REQUIRED` | `true` | `true` |
| `VITE_SITE_URL` | staging frontend URL | production frontend URL |

Опционально: `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE` — см. [`../../frontend/.env.example`](../../frontend/.env.example).

После изменения любой **`VITE_*`** — **Redeploy** проекта.

---

## Локальная разработка

```bash
npm run dev:full   # backend :3001 + Vite :5173
# или отдельно:
npm run dev --prefix backend
npm run dev --prefix frontend
```

- `VITE_API_BASE_URL` **пустой** → `apiUrl('/api/...')` остаётся относительным, Vite proxy на `localhost:3001`.
- DevPanel в `npm run dev` — без `VITE_DEV_TOOLS` (`import.meta.env.DEV`), только в режиме анкеты — [`../frontend-dev-panel.md`](../frontend-dev-panel.md).

---

## DevPanel на staging

Только при **`VITE_DEV_TOOLS=1`** + **`VITE_APP_ENV=staging`** + **`role=admin`**.  
Runbook export/import: [`../project-export-import.md`](../project-export-import.md).

---

## Проверка сборки локально

```bash
npm run vercel-build
# артефакт: build/index.html (корень репо)
```

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [`environments.md`](environments.md) | CORS на backend |
| [`render.md`](render.md) | Render API |
| [`../auth.md`](../auth.md) | Clerk |
| [`smoke-tests.md`](smoke-tests.md) | Smoke после deploy |

← [Деплой](README.md)
