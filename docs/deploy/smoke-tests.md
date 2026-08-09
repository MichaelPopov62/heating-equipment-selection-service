<!-- Назначение: проверки после деплоя — HTTP smoke, чеклист A1–A7 и ops platform admin. -->

# Smoke-тесты и acceptance

Проверки после деплоя staging и production.  
Hub: [`README.md`](README.md). Env: [`environments.md`](environments.md).

---

## Preflight Vercel (вариант A)

Перед smoke, если deploy упал на install:

| Проверка | Ожидание |
|----------|----------|
| Root Directory | **корень репо** (не `frontend/`) — [`vercel.md`](vercel.md) |
| Node.js | 22.x |
| Output Directory | `build` |
| Лог install | `npm ci --prefix frontend` без `EUSAGE` |

---

## Быстрые HTTP-проверки

```bash
# Health API
curl -s -o /dev/null -w "staging-api: %{http_code}\n" \
  https://heatcalc-api-staging-mp62.onrender.com/health
curl -s -o /dev/null -w "prod-api: %{http_code}\n" \
  https://heatcalc-api-mp62.onrender.com/health

# Frontend SPA
curl -s -o /dev/null -w "staging-fe: %{http_code}\n" \
  https://heatcalc-staging-mp62.vercel.app/
curl -s -o /dev/null -w "prod-fe: %{http_code}\n" \
  https://heatcalc-mp62.vercel.app/
```

Ожидание: **200** на всех четырёх.

### Calc (без auth)

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://heatcalc-api-staging-mp62.onrender.com/api/v1/calc \
  -H "Content-Type: application/json" \
  -d '{}'
```

Ожидание: **400** (validation), не 502/503 — API жив и принимает запросы.

Минимальный успешный calc — Test Quickstart в [`.cursorrules`](../../.cursorrules).

---

## Acceptance checklist (A1–A7)

Выполнить **на каждом** окружении отдельно (разные Clerk + Mongo):

| # | Проверка | Ожидание |
|---|----------|----------|
| A1 | Login platform admin через Clerk **этого** frontend | 200 |
| A2 | DevTools → Network → `GET /api/v1/me` | `"role": "admin"`, email ∈ `PLATFORM_ADMIN_EMAILS` |
| A3 | UI шапка | ссылка **«Звернення»** |
| A4 | Открыть `/admin/feedback` | 200, список (может быть пуст) |
| A5 | Обычный user (email **не** в allowlist) → `/me` | `"role": "user"` |
| A6 | **Staging only:** кнопка **Dev** | при `VITE_DEV_TOOLS=1` + `VITE_APP_ENV=staging` + admin — **Dev** в режиме анкеты (после «Почати…» или открытия проекта) |
| A7 | **Production** | Dev-кнопки **нет** (by design) |

После первого login platform admin Mongo `users.role` = `admin` (sync). Ручной Atlas / `promote:user-admin` **не нужен** для email из allowlist.

---

## Platform admin — ops runbook

Статус: `PLATFORM_ADMIN_EMAILS` + sync в `resolveUser`. Детали: [`../auth.md`](../auth.md).

### Merge и deploy backend

1. Merge в `main` / push в `staging` (по вашему CI).
2. Render автоматически пересобирает backend после push; если env менялись раньше — см. ниже.

### Environment Variables на Render

Для **каждого** Web Service (staging **и** production):

| Шаг | Действие |
|-----|----------|
| 1 | Render Dashboard → сервис API → **Environment** |
| 2 | Add: `PLATFORM_ADMIN_EMAILS` |
| 3 | Value: `email1@…,email2@…` — **без пробелов** |
| 4 | **Один список** на staging и production |
| 5 | Save → Manual Deploy / Redeploy |

**Не задавать** на Vercel.

Локально (`backend/.env`):

```env
PLATFORM_ADMIN_EMAILS=popov1ms@i.ua,romantikzizni@gmail.com
```

### Rollback admin

- Удалить email из `PLATFORM_ADMIN_EMAILS` на Render → Redeploy.
- v1 **не** demote автоматически: Mongo может остаться `admin` до `PATCH { "role": "user" }` или ручной правки.

---

## Verify в репозитории

Перед/после merge:

```bash
# из корня
npm run verify:auth-docs

# backend auth + platform admin
cd backend && npm run verify:platform-admin && npm run verify:auth-pipeline
```

Полный gate:

```bash
npm run verify
```

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [`../frontend-dev-panel.md`](../frontend-dev-panel.md) | DevPanel staging |
| [`../project-export-import.md`](../project-export-import.md) | Export/import |
| [`../project-pdf.md`](../project-pdf.md) | PDF smoke, `verify:project-pdf` |

← [Деплой](README.md)
