# Heating equipment selection service

REST API и фронтенд для подбора теплового оборудования (дом/квартира).

| Документ                                                       | Назначение                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`openapi.yaml`](openapi.yaml)                                 | Контракт REST API                                                   |
| [`.cursorrules`](.cursorrules)                                 | Правила backend/frontend, бизнес-логика, env, модули                |
| [`Plan.md`](Plan.md)                                           | Статус MVP, детальные таблицы модулей, roadmap                      |
| [`docs/project-structure.md`](docs/project-structure.md)       | Карта папок и entrypoints (навигатор по репозиторию)               |
| [`docs/type-safety.md`](docs/type-safety.md)                   | Строгая типобезопасность: tsc/checkJs, ESLint, CI gate              |
| [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md) | Frontend: SurveySession, React Query, calc, справочники             |
| [`docs/survey-draft.md`](docs/survey-draft.md)                 | Черновик анкеты (schema v4), загрузка и миграция                    |
| [`docs/projects-api.md`](docs/projects-api.md)                 | REST API проектов, share, PDF и сохранённых расчётов                |
| [`docs/start-state.md`](docs/start-state.md)                   | Start Screen, bootstrap, localStorage черновика                     |
| [`docs/client-share-and-layers.md`](docs/client-share-and-layers.md) | Клиент vs Dev, публичная ссылка, PDF                          |
| [`docs/project-pdf.md`](docs/project-pdf.md)                   | Серверная генерация PDF (Chromium)                                  |
| [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md) | CalcRuntimeContext: DI справочников в calc-пайплайне                |
| [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md) | Положение помещения: угловое / фасад / внутреннее (стена в коридор) |

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

Calc-пайплайн HTTP: `runCalculation(body)` (`api/runCalculation.js`); внутри — `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })` → `matchEquipment({ …, ctx })`. On-demand сброс кэша: `POST /api/v1/system/invalidate-reference-cache` (см. docs).

Эндпоинты: `GET /health`, `GET /api/v1/catalog`, `GET /api/v1/presets/envelope`, `POST /api/v1/calc`, проекты — `/api/v1/projects/*`, публичная ссылка — `/api/v1/public/shares/{shareToken}` (нужен MongoDB). Контракт — `openapi.yaml`; валидация calc — `docs/calc-input-validation.md`; проекты и share — `docs/projects-api.md`, `docs/client-share-and-layers.md`.

## Frontend

React + Vite + TypeScript + **React Query** (`@tanstack/react-query`, слой `frontend/src/query/`). Запуск: `cd frontend && npm install && npm run dev`.

Документация клиента: [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md), [`docs/start-state.md`](docs/start-state.md). Карта папок: [`docs/project-structure.md`](docs/project-structure.md). Детальные таблицы frontend — [`Plan.md`](Plan.md) § `frontend/`.

Точка входа: `App.tsx` — редактор анкеты или read-only страница `/s/{shareToken}` (`SharePresentationPage`). Bootstrap start/survey — [`docs/start-state.md`](docs/start-state.md).

В анкете для каждого помещения задаётся **положение относительно наружного контура** (`roomExteriorLayout`: угловое, на фасаде, внутреннее со стеной в коридор) — см. [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md).

## Приёмка (production gate)

Полная проверка из корня репозитория:

```bash
npm run verify
```

Эквивалент по шагам:

```bash
node scripts/verifyNoTypeBypass.mjs   # запрет any / @ts-ignore / unsafe eslint-disable
cd shared && npm run typecheck
cd backend && npm run verify          # lint + typecheck (checkJs) + domain verify:*
cd frontend && npm run verify         # lint + typecheck + knip + build + survey-session (нужен dist)
```

Отдельно:

```bash
cd frontend && npm run lint       # явный any + no-unsafe-* + type-aware правила
cd frontend && npm run typecheck  # неявный any: strict + noImplicitAny + EOPT + NUI
cd backend && npm run typecheck   # checkJs на src/ и scripts/
```

Подробности: [`docs/type-safety.md`](docs/type-safety.md). CI: `.github/workflows/verify.yml`.
