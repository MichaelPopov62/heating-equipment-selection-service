# Heating equipment selection service

REST API и фронтенд для подбора теплового оборудования (дом/квартира).

| Документ | Назначение |
|----------|------------|
| [`openapi.yaml`](openapi.yaml) | Контракт REST API |
| | Правила backend/frontend, бизнес-логика, env, модули |
| [`Plan.md`](Plan.md) | Статус MVP, схема потока данных |
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

Calc-пайплайн: `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })` → `matchEquipment({ …, ctx })`. On-demand сброс кэша: `POST /api/v1/system/invalidate-reference-cache` (см. docs).

Эндпоинты: `GET /health`, `GET /api/v1/catalog`, `GET /api/v1/presets/envelope`, `POST /api/v1/calc`, проекты — `/api/v1/projects/*` (нужен MongoDB). Детали — `openapi.yaml`.

## Frontend

React + Vite + TypeScript (`frontend/`). Запуск: `cd frontend && npm install && npm run dev`.

В анкете для каждого помещения задаётся **положение относительно наружного контура** (`roomExteriorLayout`: угловое, на фасаде, внутреннее со стеной в коридор) — см. [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md).
