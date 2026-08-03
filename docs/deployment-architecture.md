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
VITE_DEV_TOOLS=1
```

Staging:

```env
VITE_API_BASE_URL=https://heatcalc-api-staging-mp62.onrender.com
VITE_DEV_TOOLS=1
```

`VITE_DEV_TOOLS=1` включает DevPanel (кнопка **Dev**, экспорт/импорт проектов между
окружениями). Переменная попадает в bundle **на этапе сборки** Vite — после добавления
или изменения в Vercel Dashboard нужен **Redeploy**. Без неё на deployed SPA кнопки Dev
не будет, даже если код на `main` совпадает с production. Подробнее —
[`frontend-dev-panel.md`](frontend-dev-panel.md), runbook переноса данных —
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
| `VITE_DEV_TOOLS` | `1` (если нужен DevPanel) | `1` (если нужен DevPanel) |
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
