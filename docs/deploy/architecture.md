<!-- Назначение: схема деплоя, границы ответственности Vercel/Render и сетевая модель. -->

# Архитектура деплоя

Hub раздела: [`README.md`](README.md).

---

## Принятая схема

Проект разворачивается из одного GitHub-монорепозитория:

```text
GitHub: MichaelPopov62/heating-equipment-selection-service
├── Vercel
│   └── frontend/ — React + Vite SPA (+ импорт shared/)
└── Render
    └── backend/ — Node.js + Express API
        ├── MongoDB Atlas
        ├── Clerk JWKS
        ├── Meteostat / Nominatim
        └── Chromium / PDF
```

Frontend обращается к backend **напрямую** через `VITE_API_BASE_URL`. API-запросы, расчёты,
PDF и SSE **не проксируются** через Vercel. Это исключает лимит внешнего Vercel Rewrite
(~120 с) из пути длительных операций.

**Vercel Rewrite** используется только для SPA fallback на `index.html` — см. [`vercel.md`](vercel.md).

---

## Окружения

Принято **два полностью раздельных** окружения:

| Ресурс | Staging | Production |
|--------|---------|------------|
| Vercel project | отдельный | отдельный |
| Render Web Service | отдельный | отдельный |
| MongoDB | `heatcalc_staging` | `heatcalc_production` |
| Clerk | отдельный instance/application | отдельный instance/application |
| Переменные окружения | отдельный набор | отдельный набор |

Использование production MongoDB или production Clerk в staging **запрещено**.

Матрица URL, CORS и env: [`environments.md`](environments.md).

---

## Технические домены

До покупки собственного домена — бесплатные домены платформ:

| Сервис | URL |
|--------|-----|
| Production frontend | `https://heatcalc-mp62.vercel.app` |
| Production API | `https://heatcalc-api-mp62.onrender.com` |
| Staging frontend | `https://heatcalc-staging-mp62.vercel.app` |
| Staging API | `https://heatcalc-api-staging-mp62.onrender.com` |

**Актуальность (2026-08-09):** все четыре URL отвечают HTTP 200 (`/` frontend, `/health` API).
Подробнее — [`phase0-audit.md`](phase0-audit.md) §0.1.

Предполагаемое соответствие Git-веток: `staging` → staging, `main` → production (подтвердить в Dashboard).

---

## Границы ответственности

| Компонент | Ответственность |
|-----------|----------------|
| **Vercel** | Статика SPA, CDN, frontend-домены |
| **Render** | REST API, длительные calc, SSE, PDF |
| **MongoDB Atlas** | Каталог, справочники, users, projects, calculations |
| **Clerk** | JWT; backend проверяет через JWKS |
| **Браузер** | Только `VITE_*`; секреты backend **не** попадают в bundle |

Детали платформ: [`vercel.md`](vercel.md), [`render.md`](render.md).

---

## Этап 0 (архитектурные решения)

- [x] Выбраны платформы Vercel + Render
- [x] Прямой вызов Render из frontend без API Rewrite
- [x] Отдельные staging и production окружения
- [x] Соглашение об именах доменов
- [x] Четыре технических URL зафиксированы
- [x] Сервисы развёрнуты и доступны (2026-08-09)

---

## Связанные документы

| Документ | Назначение |
|----------|------------|
| [`environments.md`](environments.md) | Матрица окружений |
| [`first-deploy.md`](first-deploy.md) | Первый деплой |
| [`smoke-tests.md`](smoke-tests.md) | Smoke / acceptance |
| [`baseline.md`](baseline.md) | Pre-deploy baseline |
| [`../auth.md`](../auth.md) | Auth / Clerk |

← [Деплой](README.md)
