# Backend — Heating equipment selection API

Node.js + Express: расчёт теплопотерь, подбор оборудования, гидравлика, проекты, share, PDF.

**Структура папок и файлов** — только в [`docs/project-structure.md`](../docs/project-structure.md) § `backend/` (SSOT).

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

Каталог путей (код: `src/api/`). Схемы тел/ответов — [`openapi.yaml`](../openapi.yaml). Политика auth и нюансы JWT в dev — [`docs/auth.md`](../docs/auth.md). Projects — [`docs/projects-api.md`](../docs/projects-api.md).

| Метод | Эндпоинт | Описание | Доступ |
|-------|----------|----------|--------|
| GET | `/health` | Health-check | Публичный |
| GET | `/api/health` | Legacy alias health | Публичный |
| GET | `/` | Корень API (service info) | Публичный |
| GET | `/api` | Корень `/api` (version info) | Публичный |
| GET | `/api/v1/catalog` | Каталог оборудования | Публичный |
| GET | `/api/v1/presets/envelope` | Пресеты ограждений | Публичный |
| GET | `/api/v1/presets/underfloor-heating` | Пресеты ТП (bases + finishes) | Публичный |
| GET | `/api/v1/presets/underfloor-heating/bases` | Базы сборки ТП | Публичный |
| GET | `/api/v1/presets/underfloor-heating/modes` | Режимы ТП | Публичный |
| GET | `/api/v1/presets/flooring-finishes` | Финиши пола | Публичный |
| POST | `/api/v1/calc` | Полный расчёт (теплопотери, ГВС, matching, гидравлика) | Публичный |
| GET | `/api/v1/public/shares/{shareToken}` | Публичная презентация сметы | Публичный |
| GET | `/api/v1/public/shares/{shareToken}/pdf` | PDF публичной сметы | Публичный |
| POST | `/api/v1/feedback` | Обращение пользователя | JWT опционален |
| GET | `/api/v1/me` | Профиль (`role`, `subscription`) | JWT |
| GET | `/api/v1/projects` | Список проектов | JWT |
| POST | `/api/v1/projects` | Создать проект | JWT |
| POST | `/api/v1/projects/import` | Импорт ProjectExportBundle | JWT + admin |
| GET | `/api/v1/projects/{id}` | Получить проект | JWT |
| PUT | `/api/v1/projects/{id}` | Обновить проект | JWT |
| DELETE | `/api/v1/projects/{id}` | Удалить проект | JWT |
| POST | `/api/v1/projects/{id}/calc` | Расчёт + запись в `calculations` | JWT |
| GET | `/api/v1/projects/{id}/calculations` | Список расчётов проекта | JWT |
| GET | `/api/v1/projects/{projectId}/calculations/{calcId}` | Один расчёт | JWT |
| GET | `/api/v1/projects/{id}/pdf` | PDF сметы владельца | JWT |
| POST | `/api/v1/projects/{id}/share` | Опубликовать share | JWT |
| DELETE | `/api/v1/projects/{id}/share` | Отозвать share | JWT |
| PATCH | `/api/v1/admin/users/{id}` | Смена `role` / `subscription` | JWT + admin |
| GET | `/api/v1/admin/feedback` | Список обращений | JWT + admin |
| GET | `/api/v1/admin/feedback/stream` | SSE новых обращений | JWT + admin |
| PATCH | `/api/v1/admin/feedback/{id}` | Статус обращения | JWT + admin |
| POST | `/api/v1/system/invalidate-reference-cache` | Сброс reference-cache | System token (`X-System-Token`) |

## Переменные окружения

См. [`.env.example`](.env.example). Auth — [`docs/auth.md`](../docs/auth.md).

## Verify

```bash
npm run verify   # lint + typecheck + все verify:*
```

Группы скриптов — [`docs/project-structure.md`](../docs/project-structure.md) § Verify.

## Документация

- Структура: [`docs/project-structure.md`](../docs/project-structure.md)
- Индекс ссылок: [`Plan.md`](../Plan.md)
- Auth: [`docs/auth.md`](../docs/auth.md)
- Admin feedback: [`docs/feedback-admin.md`](../docs/feedback-admin.md)
- Projects: [`docs/projects-api.md`](../docs/projects-api.md)
- Гидравлика: [`docs/hydraulics-pipeline.md`](../docs/hydraulics-pipeline.md)
- PDF: [`docs/project-pdf.md`](../docs/project-pdf.md)
