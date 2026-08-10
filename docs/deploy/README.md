<!-- Назначение: hub раздела deploy — схема Vercel + Render, навигация и быстрый путь. -->

# Деплой (Vercel + Render)

Единая точка входа по развёртыванию HeatCalc Pro из монорепозитория.

---

## Схема

```text
GitHub: heating-equipment-selection-service
├── Vercel  → frontend/  (React + Vite SPA, CDN)
└── Render  → backend/   (Node.js + Express API)
                ├── MongoDB Atlas
                ├── Clerk JWKS
                ├── Meteostat / Nominatim
                └── Chromium / PDF
```

Frontend обращается к API **напрямую** через `VITE_API_BASE_URL` (без Vercel Rewrite для `/api`).
Длинные операции (calc, PDF, SSE) не проходят через Vercel — см. [`architecture.md`](architecture.md).

---

## Документы раздела

| Документ | Назначение |
|----------|------------|
| [`README.md`](README.md) | Этот hub |
| [`architecture.md`](architecture.md) | Схема, границы Vercel/Render |
| [`environments.md`](environments.md) | URL, Mongo, Clerk, CORS, env |
| [`vercel.md`](vercel.md) | Сборка frontend, `vercel.json`, `VITE_*` |
| [`render.md`](render.md) | Web Service, backend env, seed |
| [`first-deploy.md`](first-deploy.md) | Runbook «с нуля» |
| [`smoke-tests.md`](smoke-tests.md) | Acceptance A1–A7 |

### Связанные domain-доки

| Документ | Назначение |
|----------|------------|
| [`../auth.md`](../auth.md) | JWT, Clerk, platform admin |
| [`../frontend-dev-panel.md`](../frontend-dev-panel.md) | DevPanel (staging) |
| [`../project-export-import.md`](../project-export-import.md) | Перенос prod ↔ staging |
| [`../project-pdf.md`](../project-pdf.md) | PDF на backend |
| [`../../backend/.env.example`](../../backend/.env.example) | Полный список backend env |

---

## Быстрый путь

### Локальная разработка

```bash
npm run dev:full   # API :3001 + Vite :5173
```

- `VITE_API_BASE_URL` **пустой** → относительные `/api/...` и Vite proxy.
- Подробнее: [`vercel.md`](vercel.md) § «Локально».

### Staging / production

| Сервис | Staging | Production |
|--------|---------|------------|
| Frontend | `https://heatcalc-staging-mp62.vercel.app` | `https://heatcalc-mp62.vercel.app` |
| API | `https://heatcalc-api-staging-mp62.onrender.com` | `https://heatcalc-api-mp62.onrender.com` |
| Git-ветка | `staging` | `main` |

После изменения **`VITE_*`** на Vercel — **Redeploy**. После **`PLATFORM_ADMIN_EMAILS`** на Render — **Redeploy** backend.

### Проверка после деплоя

→ [`smoke-tests.md`](smoke-tests.md) (A1–A7, curl, verify-скрипты).
