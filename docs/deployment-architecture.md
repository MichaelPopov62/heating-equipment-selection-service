# Архитектура деплоя

Статус: этап 0 завершён; платформы, сетевая схема и технические домены утверждены.

## 1. Принятая схема

Проект разворачивается из одного GitHub-монорепозитория:

```text
GitHub: MichaelPopov62/heating-equipment-selection-service
├── Vercel
│   └── frontend/ — React + Vite SPA
└── Render
    └── backend/ — Node.js + Express API
        ├── MongoDB Atlas
        ├── Clerk JWKS
        ├── Meteostat / Nominatim
        └── Chromium / PDF
```

Frontend обращается к backend напрямую через `VITE_API_BASE_URL`. API-запросы, расчёты,
PDF и SSE не проксируются через Vercel. Это исключает лимит внешнего Vercel Rewrite
в 120 секунд из пути выполнения длительных операций.

Vercel Rewrite используется только для SPA fallback на `index.html`.

## 2. Окружения

Принято два полностью раздельных окружения:

| Ресурс | Staging | Production |
|---|---|---|
| Vercel project | отдельный | отдельный |
| Render Web Service | отдельный | отдельный |
| MongoDB | отдельная база или кластер | отдельная база или кластер |
| Clerk | отдельный instance/application | отдельный instance/application |
| Переменные окружения | отдельный набор | отдельный набор |

Использование production MongoDB или production Clerk в staging запрещено.

## 3. Технические домены

До покупки собственного домена используются бесплатные технические домены платформ:

| Назначение | URL |
|---|---|
| Production frontend | `https://heatcalc-mp62.vercel.app` |
| Production API | `https://heatcalc-api-mp62.onrender.com` |
| Staging frontend | `https://heatcalc-staging-mp62.vercel.app` |
| Staging API | `https://heatcalc-api-staging-mp62.onrender.com` |

На момент утверждения все четыре адреса возвращали `404`, то есть активные сервисы
по ним не обнаружены. Окончательная доступность имени подтверждается платформой
при создании проекта. Если платформа отклонит имя как занятое, этап 0 пересматривается
до продолжения production-настройки.

## 4. Маршрутизация frontend

Production:

```env
VITE_API_BASE_URL=https://heatcalc-api-mp62.onrender.com
# VITE_DEV_TOOLS — не задавать (DevPanel на master отключён)
```

Staging:

```env
VITE_API_BASE_URL=https://heatcalc-api-staging-mp62.onrender.com
VITE_DEV_TOOLS=1
VITE_APP_ENV=staging
```

DevPanel (кнопка **Dev**, экспорт/импорт) — **только staging Vercel** при `VITE_DEV_TOOLS=1`
и `VITE_APP_ENV=staging`, и только для пользователя с **`role=admin`** (`GET /api/v1/me`).
На **production master** DevPanel **не монтируется**, даже если ошибочно задать `VITE_DEV_TOOLS`.
Переменные попадают в bundle **на этапе сборки** — после изменения в Vercel Dashboard нужен
**Redeploy**. Подробнее — [`frontend-dev-panel.md`](frontend-dev-panel.md), runbook —
[`project-export-import.md`](project-export-import.md).

Локальная разработка без `VITE_API_BASE_URL` сохраняет относительные `/api/...`
и существующий Vite proxy на `http://localhost:3001`. DevPanel в `npm run dev` доступен
без `VITE_DEV_TOOLS` (`import.meta.env.DEV`).

## 5. CORS backend

Production API разрешает только production frontend:

```env
CORS_ORIGIN=https://heatcalc-mp62.vercel.app
```

Staging API разрешает только staging frontend:

```env
CORS_ORIGIN=https://heatcalc-staging-mp62.vercel.app
```

Wildcard `*` и общий whitelist staging/production не используются. Для скачивания
PDF backend должен открыть клиенту заголовок `Content-Disposition`.

## 6. Настройка Vercel в монорепозитории

Frontend использует модули из корневого `shared/`, поэтому Vercel собирает проект
из корня репозитория:

```text
Root Directory: repository root
Install Command: npm ci --prefix frontend
Build Command: npm run build --prefix frontend
Output Directory: frontend/dist
```

Корневой `vercel.json` должен содержать только конфигурацию статического Vite SPA.
Существующая конфигурация Node backend должна быть заменена на этапе настройки Vercel.

**Чеклист Environment Variables** (отдельно для каждого Vercel-проекта — staging и
production не наследуют переменные друг от друга):

| Переменная | Staging | Production |
|---|---|---|
| `VITE_API_BASE_URL` | Render staging API | Render production API |
| `VITE_DEV_TOOLS` | `1` | **не задавать** |
| `VITE_APP_ENV` | `staging` | **не задавать** (или `production`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk staging | Clerk production |
| `VITE_CLERK_JWT_TEMPLATE` | как в backend `AUTH_AUDIENCE` | то же для prod Clerk |

После изменения любой `VITE_*` — **Redeploy** соответствующего проекта.

## 7. Настройка Render в монорепозитории

```text
Service Type: Web Service
Root Directory: backend
Build Command: npm ci --omit=dev
Start Command: npm start
Health Check Path: /health
```

Backend остаётся отдельным долгоживущим Express-процессом. Он не переносится в
Vercel Functions.

**Чеклист Environment Variables** (отдельно для каждого Render Web Service — staging и
production не наследуют переменные друг от друга):

| Переменная | Staging | Production | Local `backend/.env` |
|---|---|---|---|
| `MONGODB_URI` | `.../heatcalc_staging` | `.../heatcalc_production` | credentials к кластеру; dev-БД см. [`deployment-baseline.md`](deployment-baseline.md) |
| `PLATFORM_ADMIN_EMAILS` | **один список** | **тот же список** | тот же список (comma-separated) |
| `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_PROVIDER` | Clerk staging | Clerk production | dev / staging Clerk |
| `CORS_ORIGIN` | staging Vercel URL | production Vercel URL | `http://localhost:5173` (dev) |

```env
# Пример — одинаково на staging и production Render:
PLATFORM_ADMIN_EMAILS=popov1ms@i.ua,romantikzizni@gmail.com
```

После изменения `PLATFORM_ADMIN_EMAILS` — **Redeploy** backend (restart Render). На Vercel переменную **не** задавать. Подробнее — [`auth.md`](auth.md) (Platform admin).

## 8. Границы ответственности

- Vercel отвечает за статические файлы SPA, CDN и frontend-домены.
- Render отвечает за REST API, длительные расчёты, SSE и PDF.
- MongoDB хранит каталог, справочники, пользователей, проекты и расчёты.
- Clerk выпускает JWT; backend проверяет JWT через JWKS.
- Секреты backend не передаются в `VITE_*` и не попадают в браузерный bundle.

## 9. Условия завершения этапа 0

- [x] Выбраны платформы Vercel + Render.
- [x] Принят прямой вызов Render из frontend без API Rewrite.
- [x] Приняты отдельные staging и production окружения.
- [x] Зафиксировано соглашение об именах доменов.
- [x] Утверждены четыре технических URL Vercel/Render.
- [x] Проверено отсутствие активных сервисов по выбранным URL.

Этап 0 завершён. Фактическое резервирование имён выполняется при создании проектов
Vercel и Render на соответствующих этапах деплоя.

## 10. Platform admin — ops runbook (после merge)

Статус: внедрён `PLATFORM_ADMIN_EMAILS` + sync в `resolveUser`. Подробности — [`auth.md`](auth.md).

### 10.1. Merge и deploy backend

1. Merge ветки с изменениями в `master` (или deploy staging branch — по вашему CI).
2. **Render** автоматически пересобирает backend **после push**; если env менялись до merge — см. п. 10.2.

### 10.2. Environment Variables на Render

Для **каждого** Web Service (staging **и** production):

| Шаг | Действие |
|-----|----------|
| 1 | Render Dashboard → сервис API → **Environment** |
| 2 | Add variable: `PLATFORM_ADMIN_EMAILS` |
| 3 | Value (пример): `popov1ms@i.ua,romantikzizni@gmail.com` — **без пробелов**, lowercase не обязателен (runtime нормализует) |
| 4 | **Один и тот же список** на staging и production |
| 5 | **Save** → **Manual Deploy** / Redeploy (или Clear build cache + deploy, если env добавили до последнего билда) |

**Не задавать** на Vercel — frontend role не читает env, только `GET /api/v1/me`.

**Локально** (`backend/.env`, не коммитить):

```env
PLATFORM_ADMIN_EMAILS=popov1ms@i.ua,romantikzizni@gmail.com
```

### 10.3. Acceptance checklist (staging, затем production)

Выполнить **на каждом** окружении отдельно (разные Clerk + Mongo):

| # | Проверка | Ожидание |
|---|----------|----------|
| A1 | Login platform admin через Clerk **этого** frontend | 200 |
| A2 | DevTools → Network → `GET /api/v1/me` | `"role": "admin"`, email ∈ allowlist |
| A3 | UI шапка | ссылка **«Звернення»** |
| A4 | Открыть `/admin/feedback` | 200, список (может быть пуст) |
| A5 | Обычный user (email **не** в allowlist) → `/me` | `"role": "user"` |
| A6 | Staging only: Dev-кнопка | при `VITE_DEV_TOOLS=1` + `VITE_APP_ENV=staging` + admin — справа внизу **Dev** |
| A7 | Production | Dev-кнопки **нет** (by design) |

После первого login platform admin Mongo `users.role` для его документа = `admin` (sync). Ручной Atlas / `promote:user-admin` **не нужен** для email из allowlist.

### 10.4. Rollback

- Удалить email из `PLATFORM_ADMIN_EMAILS` на Render → Redeploy.
- v1 **не** demote автоматически: Mongo может остаться `admin` до `PATCH` `{ "role": "user" }` другим admin или ручной правки.

### 10.5. Verify перед/после merge

```bash
# из корня репозитория
npm run verify:auth-docs

# backend auth + platform admin
cd backend && npm run verify:platform-admin && npm run verify:auth-pipeline
```
