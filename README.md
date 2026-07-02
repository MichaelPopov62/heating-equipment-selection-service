# Heating equipment selection service

REST API и фронтенд для подбора теплового оборудования (дом/квартира).

| Документ | Назначение |
|----------|------------|
| [`openapi.yaml`](openapi.yaml) | Контракт REST API |
| [`.cursorrules`](.cursorrules) | Правила backend/frontend, бизнес-логика, env, модули |
| [`Plan.md`](Plan.md) | Статус MVP, структура сервиса по папкам |
| [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md) | Frontend: SurveySession, React Query, calc, справочники |
| [`docs/survey-draft.md`](docs/survey-draft.md) | Черновик анкеты (schema v4), загрузка и миграция |
| [`docs/projects-api.md`](docs/projects-api.md) | REST API проектов и сохранённых расчётов |
| [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md) | CalcRuntimeContext: DI справочников в calc-пайплайне |
| [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md) | Положение помещения: угловое / фасад / внутреннее (стена в коридор) |

## Backend — быстрый старт

```bash
cd backend && npm install
cp .env.example .env   # заполнить MONGODB_* при необходимости
npm run start          # http://localhost:3001
```

- Seed MongoDB: `cd backend && npm run seed` (нужен `test_data.json` — см. `test_data.json.example`). Чтобы API сразу подхватил новые данные без рестарта: задайте **`SYSTEM_INTERNAL_TOKEN`**, включите **`AUTO_INVALIDATE_CACHE=true`** (или `NODE_ENV=production`) — см. [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md).
- Проверка схемы calc: `cd backend && npm run verify:calc-schema`
- Проверка invalidate кэша: `cd backend && npm run verify:reference-cache-invalidate`
- Линт: `cd backend && npm run lint`

Calc-пайплайн HTTP: `runCalculation(body)` (`api/runCalculation.js`); внутри — `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })` → `matchEquipment({ …, ctx })`. On-demand сброс кэша: `POST /api/v1/system/invalidate-reference-cache` (см. docs).

Эндпоинты: `GET /health`, `GET /api/v1/catalog`, `GET /api/v1/presets/envelope`, `POST /api/v1/calc`, проекты — `/api/v1/projects/*` (нужен MongoDB). Контракт — `openapi.yaml`; валидация calc — `docs/calc-input-validation.md`; проекты — `docs/projects-api.md`.

## Frontend

React + Vite + TypeScript + **React Query** (`@tanstack/react-query`, слой `frontend/src/query/`). Запуск: `cd frontend && npm install && npm run dev`.

Документация клиента: [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md). Структура папок: [`Plan.md`](Plan.md) § `frontend/`.

В анкете для каждого помещения задаётся **положение относительно наружного контура** (`roomExteriorLayout`: угловое, на фасаде, внутреннее со стеной в коридор) — см. [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md).
