# Backend — Heating equipment selection API

Node.js + Express: расчёт теплопотерь, подбор оборудования, гидравлика, проекты, share, PDF.

## Быстрый старт

```bash
cd backend && npm install
cp .env.example .env   # MONGODB_*, AUTH_*, опционально SYSTEM_INTERNAL_TOKEN
npm run start          # http://localhost:3001
```

Seed справочников и каталога:

```bash
npm run seed   # нужен test_data.json (см. test_data.json.example)
```

После seed — invalidate bundle: `AUTO_INVALIDATE_CACHE=true` или `POST /api/v1/system/invalidate-reference-cache` (см. [`docs/calc-runtime-context.md`](../docs/calc-runtime-context.md)).

## Calc-пайплайн

`POST /api/v1/calc` → `runCalculation` → `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput` → `buildReport` → `matchEquipment` → hydraulics pipeline.

## HTTP-маршруты

| Группа | Маршруты |
|--------|----------|
| Public | `GET /health`, `GET /api/v1/catalog`, `GET /api/v1/presets/*`, `POST /api/v1/calc`, `GET /api/v1/public/shares/{token}` (+ `/pdf`) |
| JWT | `/api/v1/projects/*`, `GET /api/v1/me` |
| Admin | `PATCH /api/v1/admin/users/{id}` |
| Feedback | `POST /api/v1/feedback` (JWT опционален) |
| System | `POST /api/v1/system/invalidate-reference-cache` |

Полный контракт — [`openapi.yaml`](../openapi.yaml).

## Переменные окружения

См. [`.env.example`](.env.example). Auth — [`docs/auth.md`](../docs/auth.md).

## Verify

```bash
npm run verify   # lint + typecheck + все verify:*
```

## Документация

- Карта модулей: [`Plan.md`](../Plan.md), [`docs/project-structure.md`](../docs/project-structure.md)
- Auth: [`docs/auth.md`](../docs/auth.md)
- Projects: [`docs/projects-api.md`](../docs/projects-api.md)
- Гидравлика: [`docs/hydraulics-pipeline.md`](../docs/hydraulics-pipeline.md)
- PDF: [`docs/project-pdf.md`](../docs/project-pdf.md)
