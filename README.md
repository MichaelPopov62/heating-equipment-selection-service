# Heating equipment selection service

REST API и фронтенд для подбора теплового оборудования (дом/квартира).

Правила — [`.cursorrules`](.cursorrules).  
Дерево папок (SSOT) — [`docs/project-structure.md`](docs/project-structure.md).  
Индекс модулей и доменных ссылок — [`Plan.md`](Plan.md).  
Контракт API — [`openapi.yaml`](openapi.yaml).

---

## Документация

| Документ | Назначение |
|----------|------------|
| [`docs/project-structure.md`](docs/project-structure.md) | SSOT: папки, entrypoints, слои |
| [`Plan.md`](Plan.md) | Краткий индекс модулей и ссылок |
| [`docs/type-safety.md`](docs/type-safety.md) | Строгая типобезопасность, CI gate |
| [`backend/README.md`](backend/README.md) | Backend: quick start, verify, маршруты |

---

## Доменные гайды

| Документ | Назначение |
|----------|------------|
| [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md) | SurveySession, React Query, calc |
| [`docs/survey-draft.md`](docs/survey-draft.md) | SurveyDraft v4, localStorage |
| [`docs/start-state.md`](docs/start-state.md) | Start Screen, bootstrap |
| [`docs/language-policy.md`](docs/language-policy.md) | UA user-facing тексты |
| [`docs/projects-api.md`](docs/projects-api.md) | REST проектов, share, PDF |
| [`docs/auth.md`](docs/auth.md) | JWT, Clerk, `/me` |
| [`docs/client-share-and-layers.md`](docs/client-share-and-layers.md) | Клиент vs Dev, share, PDF |
| [`docs/project-pdf.md`](docs/project-pdf.md) | Серверный PDF (Chromium) |
| [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md) | CalcRuntimeContext, bundle |
| [`docs/calc-input-validation.md`](docs/calc-input-validation.md) | Валидация CalcInput |
| [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md) | Положение комнаты (угловое / фасад / internal) |

Полный список — [`Plan.md`](Plan.md) § «Доменная документация».

---

## Деплой

| Документ | Назначение |
|----------|------------|
| [`docs/deploy/README.md`](docs/deploy/README.md) | Hub: Vercel + Render, smoke |

---

## Backend — быстрый старт

```bash
cd backend && npm install
cp .env.example .env   # заполнить MONGODB_* при необходимости
npm run start          # http://localhost:3001
```

- Seed MongoDB / справки: `cd backend && npm run seed` (нужен `test_data.json` — см. `test_data.json.example`). Чтобы API сразу подхватил новые данные без рестарта: задайте **`SYSTEM_INTERNAL_TOKEN`**, включите **`AUTO_INVALIDATE_CACHE=true`** (или `NODE_ENV=production`) — см. [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md).
- Проверка схемы calc: `cd backend && npm run verify:calc-schema`
- Типы (checkJs): `cd backend && npm run typecheck`
- Линт: `cd backend && npm run lint`
- Полный backend gate: `cd backend && npm run verify` (lint + **typecheck** + все `verify:*`)

Calc-пайплайн HTTP: `runCalculation(body)` (`api/runCalculation.js`); внутри — `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })`. On-demand сброс кэша: `POST /api/v1/system/invalidate-reference-cache`.

Подробнее: [`backend/README.md`](backend/README.md), структура — [`docs/project-structure.md`](docs/project-structure.md). Эндпоинты и auth — `openapi.yaml`, [`docs/auth.md`](docs/auth.md), [`docs/projects-api.md`](docs/projects-api.md).

---

## Frontend

React + Vite + TypeScript + **React Query** (`frontend/src/query/`). Запуск: `cd frontend && npm install && npm run dev`.

Документация: [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md), [`docs/start-state.md`](docs/start-state.md). Карта папок: [`docs/project-structure.md`](docs/project-structure.md).

Точка входа SPA: `App.tsx` → `AppRouter`; `/` — анкета, `/projects` — проекты, `/s/:shareToken` — read-only презентация.

---

## Приёмка (production gate)

```bash
npm run verify
```

Эквивалент по шагам:

```bash
node scripts/verifyNoTypeBypass.mjs
cd shared && npm run typecheck
cd backend && npm run verify
cd frontend && npm run verify
```

Подробности: [`docs/type-safety.md`](docs/type-safety.md). CI: `.github/workflows/verify.yml`.
