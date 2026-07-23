# REST API проектов

CRUD клиентских проектов и сохранённых расчётов в MongoDB. Реализация: `backend/src/api/projectsRoutes.js`, модели `Project` / `Calculation`.

Публичные ссылки на смету: [`client-share-and-layers.md`](client-share-and-layers.md).

| Метод | Путь | Auth |
|-------|------|------|
| POST | `/api/v1/projects/{id}/share` | JWT (owner) |
| DELETE | `/api/v1/projects/{id}/share` | JWT (owner) |
| GET | `/api/v1/projects/{id}/pdf` | JWT (owner) — скачать PDF сметы |
| GET | `/api/v1/public/shares/{shareToken}` | нет (read-only whitelist) |
| GET | `/api/v1/public/shares/{shareToken}/pdf` | нет — скачать PDF |

Поля `Project`: `shareToken`, `sharePublishedAt`, `shareSnapshot`. Verify: `npm run verify:project-share`, `npm run verify:project-pdf`.

PDF: серверный Chromium, см. [`client-share-and-layers.md`](client-share-and-layers.md). Query `includeTechnical=1` добавляет техблок.

## Безопасность (production)

Полная документация auth (Clerk, env, pipeline, verify): **[`auth.md`](auth.md)**.

Кратко:

- **JWT обязателен** при `NODE_ENV=production` на `/api/v1/projects/*`.
- Цепочка: `JWT.sub` → `users.providerUserId` → `users._id` → `projects.ownerId` (ObjectId).
- **IDOR:** фильтр по `req.user.id`; чужой id → `404 PROJECT_NOT_FOUND`.
- **Rate limit** и **квоты:** см. `backend/.env.example`.

### Лимиты размера payload и MongoDB

Защита от переполнения BSON-документа MongoDB (лимит **16 MB** на документ) и от слишком больших HTTP-тел.

| Что | Лимит | Где проверяется | Код ошибки |
|-----|-------|-----------------|------------|
| `survey` (create/update проекта, опционально в POST …/calc) | **512 KB** JSON (`JSON.stringify`) | `validateProjectBody.js` | **413** `PAYLOAD_TOO_LARGE` |
| `calcInput` / корневой CalcInput / `lastCalcInput` | **512 KB** JSON | `resolveProjectCalcInput.js` → `documentSizeLimits.js` | **413** `CALC_INPUT_TOO_LARGE` |
| HTTP body (все маршруты) | **1 MB** | `express.json({ limit: '1mb' })` в `index.js` | **413** `PAYLOAD_TOO_LARGE` |
| Документ `calculations` (`calcInput` + `report` + `summary`) | **14 MB** BSON (запас до 16 MB) | pre-save перед `Calculation.create` | **413** `CALCULATION_DOCUMENT_TOO_LARGE` |

**Порядок проверок при POST …/calc:**

1. Парсинг JSON (лимит Express 1 MB).
2. Опционально `survey` → `validateProjectUpdateBody` (512 KB).
3. Выбор входа → `assertCalcInputJsonSize` (512 KB) — в т.ч. для `lastCalcInput` из БД.
4. `runCalculation` (расчёт может раздуть `report` относительно входа).
5. `assertCalculationDocumentSize` — оценка BSON через `bson.calculateObjectSize` до записи.
6. При сбое MongoDB с кодом **10334** (`BSONObjectTooLarge`) error handler отдаёт тот же **413** `CALCULATION_DOCUMENT_TOO_LARGE`.

Константы и функции: `backend/src/projects/documentSizeLimits.js`.  
В логе `project.calc.done` — поле `estimatedBsonBytes` (оценка BSON сохраняемого документа).

Verify:

```bash
cd backend && npm run verify:document-size-limits
```

**Замечание:** `report` содержит копию входа в `report.input`, а в `calculations` дополнительно хранится поле `calcInput` — дублирование учитывается при оценке BSON.

### Локальная разработка и Clerk

См. [`auth.md` § Режимы локальной разработки](auth.md#режимы-локальной-разработки) и [`auth.md` § Настройка Clerk](auth.md#настройка-clerk-production).

`POST /api/v1/calc` — без auth. Verify auth: `npm run verify:auth-docs` (корень), `verify:projects-auth`, `verify:frontend-auth`.

### Миграция legacy ownerId

После деплоя PR-5 (`ownerId` = ObjectId ref User) старые проекты с `ownerId = JWT sub` (string) или `dev-local` нужно мигрировать:

```bash
cd backend
# dry-run (по умолчанию, без записи)
npm run migrate:project-owner-ids
# запись в MongoDB
npm run migrate:project-owner-ids -- --apply
```

Правила миграции:

| Legacy `ownerId` | Действие |
|------------------|----------|
| уже ObjectId | skip |
| отсутствует / `null` / `dev-local` | → dev ObjectId (`000000000000000000000001` или `PROJECTS_DEV_OWNER_ID`) |
| JWT `sub` (string) | → `users._id` по `users.providerUserId` (при нескольких IdP — приоритет `AUTH_PROVIDER`, затем `clerk`) |
| 24-char hex string | → ObjectId, если совпадает с `users._id` |
| sub без User в БД | skip (orphaned), требует ручного разбора |

Verify логики: `npm run verify:migrate-project-owner-ids`

---

## POST `/api/v1/projects/{id}/calc`

Расчёт + запись в коллекцию `calculations`, обновление `project.lastCalcInput`.

После выбора входа (`resolveProjectCalcInput`) backend вызывает **`runCalculation(calcPayload)`** (`backend/src/api/runCalculation.js`) — тот же пайплайн, что и `POST /api/v1/calc`.

### Выбор входа CalcInput

Модуль `backend/src/projects/resolveProjectCalcInput.js`:

| Приоритет | Условие | Источник (`calcInputSource` в логе) |
|-----------|---------|-------------------------------------|
| 1 | `body.calcInput` задан и не `null` | `calcInput` |
| 2 | `body.building` — объект | `body` (поля `survey`, `calcInput` отбрасываются) |
| 3 | иначе, если у проекта есть `lastCalcInput` с `building` | `lastCalcInput` (клон) |
| — | ни одно не подошло | **400** `CALC_INPUT_REQUIRED` |

### Типичные сценарии

**Первый расчёт** — нужен явный CalcInput:

```json
{ "calcInput": { "building": { ... } }, "survey": { ... } }
```

или корневой CalcInput:

```json
{ "building": { ... }, "survey": { ... } }
```

**Повторный расчёт** (тот же вход после обновления каталога / справочников):

```http
POST /api/v1/projects/{id}/calc
Content-Type: application/json

{}
```

или сохранение черновика без повторной отправки анкеты:

```json
{ "survey": { "currentStep": 3, ... } }
```

В обоих случаях используется `project.lastCalcInput`, если он был сохранён предыдущим успешным расчётом.

### Поле `survey`

- Произвольный JSON черновика UI (`project.survey`).
- **Не** конвертируется в CalcInput на backend.
- При наличии в теле запроса обновляет проект до расчёта.
- Лимит **512 KB** JSON — см. [Лимиты размера](#лимиты-размера-payload-и-mongodb).

### Ошибки

| Код | HTTP | Когда |
|-----|------|--------|
| `CALC_INPUT_REQUIRED` | 400 | Нет calcInput/building в теле и нет `lastCalcInput` у проекта |
| `CALC_INPUT_TOO_LARGE` | 413 | CalcInput превышает лимит JSON (512 KB) |
| `CALCULATION_DOCUMENT_TOO_LARGE` | 413 | `calcInput` + `report` + `summary` не помещаются в документ MongoDB (~14 MB BSON) |
| `PAYLOAD_TOO_LARGE` | 413 | Слишком большой `survey` или HTTP body (> 1 MB Express) |
| `VALIDATION_ERROR` | 400 | Вход выбран, но не проходит AJV / cross-validation |
| `PROJECT_NOT_FOUND` | 404 | Неверный id |

### Verify

```bash
cd backend && npm run verify:project-calc-input
cd backend && npm run verify:document-size-limits
```

---

## Коллекция `calculations`

Модель `Calculation` (`backend/src/models/Calculation.js`), коллекция MongoDB **`calculations`**.

| Поле | Описание |
|------|----------|
| `calcInput` | Нормализованный вход расчёта (Mixed) |
| `report` | Полный JSON-отчёт (Mixed), включает `input`, `calculations`, `matching`, … |
| `summary` | KPI для списка (без полного report) |

Перед записью проверяется суммарный размер BSON документа (см. [Лимиты размера](#лимиты-размера-payload-и-mongodb)).

### Поле `summary`

KPI для списка расчётов формирует `backend/src/projects/extractCalculationSummary.js` перед `Calculation.create`.

| Поле | Источник | Нормализация |
|------|----------|--------------|
| `objectType` | `calculations.hotWater.objectType`, иначе `input.building.objectMeta` | всегда `house` \| `apartment` (enum Mongoose) |

При чтении API (`serializeProject.js`) legacy-документы с битым `summary.objectType` санитизируются через `sanitizeCalculationSummary`.

Verify:

```bash
cd backend && npm run verify:extract-calculation-summary
```

---

## Связанные файлы

- `backend/src/api/projectsRoutes.js` — CRUD, share publish/revoke, owner PDF
- `backend/src/api/publicSharesRoutes.js` — public GET share + PDF
- `backend/src/api/middleware/rateLimiters.js` — rate limit
- `backend/src/projects/documentSizeLimits.js` — лимиты survey/calcInput/BSON
- `backend/src/projects/buildShareSnapshot.js`, `shareToken.js`, `serializeShare.js` — share snapshot
- `backend/src/projects/renderEstimatePdf.js` — PDF (см. [`project-pdf.md`](project-pdf.md))
- `backend/src/api/runCalculation.js` — общий calc-пайплайн с `POST /api/v1/calc`
- `components/schemas/ProjectCalcBody.yaml` — OpenAPI
- `components/schemas/ProjectDetail.yaml` — `lastCalcInput` в ответе GET project
- `frontend/src/hooks/useSurveyProject.ts` — UI: проекты, share, PDF, Dev JSON/hash
- `frontend/src/services/projectsApi.ts`, `publicShareApi.ts`, `projectsAuthHeaders.ts`
- `frontend/src/query/mutations/useProjectMutations.ts` — React Query: save/load проекта и расчётов
- `frontend/src/query/queries/useProjectsListQuery.ts` — список проектов при открытии диалога
- `frontend/src/query/queries/useProjectCalculationsQuery.ts` — список расчётов выбранного проекта
