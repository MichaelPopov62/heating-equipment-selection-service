# Карта модулей проекта

Правила backend/frontend — [`.cursorrules`](.cursorrules). HTTP-контракт — [`openapi.yaml`](openapi.yaml).
Навигатор по репозиторию — [`docs/project-structure.md`](docs/project-structure.md). Backend quick start — [`backend/README.md`](backend/README.md).

---

## Корень репозитория

| Путь | Назначение |
|------|------------|
| `openapi.yaml` | Контракт REST API |
| `components/schemas/` | Фрагменты OpenAPI (`CalcInput`, projects, share, …) |
| `shared/` | Общие константы backend и frontend |
| `backend/` | Node.js + Express: calc, matching, Mongo, seed, verify, PDF |
| `frontend/` | React + Vite + TypeScript + React Query |
| `docs/` | Доменная документация |
| `scripts/` | Корневые verify-скрипты |
| `Plan.md` / `README.md` / `.cursorrules` | Карта модулей, quick start, правила |

---

## `backend/` — REST API

Quick start: [`backend/README.md`](backend/README.md). Детальный навигатор: [`docs/project-structure.md`](docs/project-structure.md) § `backend/`.

### Корень `backend/`

| Путь | Назначение |
|------|------------|
| `src/index.js` | Express, CORS, Helmet, requestId, warmup bundle |
| `README.md` | Quick start, маршруты, verify |
| `package.json` | Зависимости, `npm run verify`, `npm run seed` |
| `eslint.config.js` / `tsconfig.json` | Lint, checkJs/typecheck |
| `.env.example` | Шаблон env (PORT, Mongo, CORS, auth, cache) |
| `Dockerfile` / `docker-compose.pdf.yml` | Образ API + Chromium для PDF |
| `data/` | JSON-эталоны справочников (seed → Mongo) |
| `scripts/` | `seed.js`, `verify*.js`, `migrateProjectOwnerIds.js`, `fixtures/`, `utils/` |
| `test_data.json.example` | Эталон каталога `products` (в git) |
| `test_data.json` | Локальная копия каталога (gitignore) |

### `backend/src/` — домены

Barrels **`*/public.js`** (cross-domain imports): `api`, `catalog`, `hydraulics`, `matching`, `models`, `reference`, `report`.

| Папка | Назначение |
|-------|------------|
| `api/` | HTTP `/api/v1/*`, AJV, `runCalculation`, rate limiters — см. таблицу ниже |
| `auth/` | JWT pipeline, Clerk/JWKS, `requireAuth`, `requireRole`, tier — [`docs/auth.md`](docs/auth.md) |
| `catalog/` | `loadCatalog` / `validateCatalog` (Mongo \| file \| auto) |
| `climate/` | Nominatim geocode + Meteostat bulk (`geocode.js`, `snipClimate.js`) |
| `data/` | Static UI-пресеты ТП: `warmFloorAssemblyPresets.js`, `flooringFinishMaterials.js` |
| `dhw/` | `loadWaterNorms`, `loadAppliances`, `waterCalc`, валидация reference JSON |
| `feedback/` | `validateFeedbackBody` для `POST /api/v1/feedback` |
| `hydraulics/` | Pure Pipeline: граф → трубы → насосы → proposal |
| `logic/` | Теплопотери, стены, ГВС, ТП (`warmFloorCalc`, `hotWater`, `ufh*`) |
| `matching/` | Котёл, радиаторы, ВН, БКН, manifolds, uniboxes; `internal/` — sizing/helpers |
| `models/` | Mongoose: runtime `public.js` → Product, Project, Calculation, User; discriminators — seed only |
| `projects/` | CRUD, calc input, share snapshot, PDF, `projectAccess` |
| `recommendations/` | Загрузка/валидация текстов `REC_*` / `WARN_*` |
| `reference/` | TTL bundle + `toCalcRuntimeContext` (catalog, norms, appliances, recommendations, ufhPresets) |
| `report/` | `buildReport`, `buildFinancialBom` → `commercial`, `automationHints` |
| `types/` | `shared-types.d.ts`, `boiler-types.d.ts`, `auth.d.ts`, Express augment |
| `ufh/` | Загрузка/валидация Mongo `underfloor_heating_presets` |
| `utils/` | logger, Mongo URI, `createAppError`, boiler mounting, pump curve, apartment matching |

### `backend/src/api/` — HTTP-слой

| Файл | Назначение |
|------|------------|
| `routes.js` | Сборка роутеров, presets envelope/UFH, `POST /api/v1/calc` |
| `runCalculation.js` | Composition root calc-пайплайна |
| `validate.js` | AJV + cross-validation CalcInput |
| `public.js` | Barrel: `createRoutes`, `validateAndNormalizeInput`, projects router |
| `projectsRoutes.js` | CRUD проектов, calc, share, PDF |
| `publicSharesRoutes.js` | Публичный GET share + PDF |
| `meRoutes.js` | `GET /api/v1/me` |
| `adminRoutes.js` | `PATCH /api/v1/admin/users/:id` |
| `feedbackRoutes.js` | `POST /api/v1/feedback` |
| `systemRoutes.js` | `POST /api/v1/system/invalidate-reference-cache` |
| `middleware/rateLimiters.js` | Rate limit calc / projects / public shares |

### Verify (`cd backend && npm run verify`)

SSOT — `backend/package.json` → скрипт `verify`.

| Группа | Скрипты (`npm run verify:…`) |
|--------|------------------------------|
| Calc / schema | `calc-schema`, `calc-input-validation`, `calc-runtime-context`, `reference-cache-invalidate` |
| Auth / identity | `user-model`, `auth-pipeline`, `auth-middleware`, `authorization-policy`, `authorization-middleware`, `me-endpoint`, `feedback`, `projects-auth`, `migrate-project-owner-ids` |
| Projects / share / PDF | `project-calc-input`, `document-size-limits`, `extract-calculation-summary`, `project-share`, `project-pdf` |
| Catalog / seed / language | `seed-catalog`, `catalog-language`, `pipe-catalog`, `pipe-catalog-pool-filter`, `financial-bom` |
| Hydraulics / pumps | `hydraulics-pipeline`, `pick-pipe`, `circulation-flows`, `flow-delta-tk`, `builtin-boiler-pump`, `fit-pump-curve`, `pump-duty` |
| Radiators | `radiator-sections`, `radiator-emitters`, `radiator-connection`, `radiator-emitter-kind`, `mixed-radiator-ufh`, `micro-load-radiator`, `radiator-wiring-graph` |
| UFH | `ufh-presets`, `ufh-loop-hydraulics`, `ufh-active-area` |
| Matching extras | `manifold-matching`, `unibox-matching`, `room-design-air-temp` |
| Frontend-adjacent | `survey-draft-migration`, `water-heater-form` |
| Вне `npm run verify` | `node scripts/verifyRoomExteriorLayoutHeatLoss.js` |

---

## `frontend/` — клиент

Документация: [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md), [`docs/survey-draft.md`](docs/survey-draft.md), [`docs/start-state.md`](docs/start-state.md).

| Путь | Назначение |
|------|------------|
| `src/main.tsx` | `QueryProvider` → `App` |
| `src/App.tsx` | `BrowserRouter`, auth/providers и `AppRouter` |
| `src/routing/` | `AppRouter`, канонические `paths`, `SurveyAppShell`; маршруты SPA и подключение сессии |
| `src/AppRoot.tsx` | Оркестратор bootstrap: `useSurveyBootstrap` → `StartAppRoot` \| lazy `SurveyAppRoot` |
| `src/StartAppRoot.tsx` | Лёгкий bootstrap: start / resolving / error |
| `src/SurveyAppRoot.tsx` | Тяжёлый survey-chunk: projects, DevPanel, lazy `AppSurveyContent` |
| `src/AppSurveyContent.tsx` | Шаги анкеты и результаты, все изменения через `dispatch` |
| `src/surveySession/` | `dispatch` → pipeline → calc |
| `src/seo/` | JSON-LD для SEO по маршруту |
| `src/types/` | DTO / view-модели UI |
| `src/data/` | Offline-fallback справочников |
| `src/styles/` | Глобальные CSS-переменные и form styles |
| `public/` | Статика Vite: `favicon.svg`, `robots.txt`, `sitemap.xml`, `llms.txt` |
| `src/query/` | React Query: справочники, calc, проекты |
| `src/services/` | HTTP-клиенты API |
| `src/hooks/` | Bootstrap, persistence, проекты, оркестрация помещений и отчёта |
| `src/pages/` | Login, SignUp, Projects, Docs, FAQ и legal-страницы |
| `src/auth/` | Clerk/AuthProvider, guards и синхронизация `/me` |
| `src/shell/` | Общая оболочка и действия Header/Footer |
| `src/i18n/` | Украинские тексты UI и локализация Clerk |
| `src/components/` | Формы, отчёты, StartScreen, SharePresentationPage и shell-компоненты |
| `src/constants/surveySteps.ts` | SSOT всех шагов, включая `dataReference` и `financialResult` |
| `src/utils/parsers/` | Парсеры отчёта calc, SurveyDraft, share URL, import bundle |
| `scripts/` / `knip.json` | Verify-скрипты и проверка неиспользуемого кода |

---

## Поток calc

**HTTP:** `runCalculation(body)` в `api/runCalculation.js` → `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })`.

**Bundle:** `catalog`, `waterNorms`, `appliances`, `recommendations`, `ufhPresets`. Invalidate: `POST /api/v1/system/invalidate-reference-cache`.

**Пресеты UI (вне bundle):** `GET /api/v1/presets/envelope`; `GET /api/v1/presets/underfloor-heating` (+ `/bases`, `/flooring-finishes`, `/modes`).

Подробнее: [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md), [`docs/hydraulics-pipeline.md`](docs/hydraulics-pipeline.md).

---

## Доменная документация

| Документ | Тема |
|----------|------|
| [`docs/auth.md`](docs/auth.md) | JWT, Clerk, tier, `/me` |
| [`docs/projects-api.md`](docs/projects-api.md) | CRUD, share, PDF |
| [`docs/calc-input-validation.md`](docs/calc-input-validation.md) | Валидация CalcInput |
| [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md) | CalcRuntimeContext, bundle |
| [`docs/language-policy.md`](docs/language-policy.md) | UA user-facing тексты |
| [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md) | SurveySession, React Query, calc |
| [`docs/survey-draft.md`](docs/survey-draft.md) | SurveyDraft v4, localStorage |
| [`docs/start-state.md`](docs/start-state.md) | Start Screen, bootstrap |
| [`docs/hydraulics-pipeline.md`](docs/hydraulics-pipeline.md) | Гидравлика |
| [`docs/ufh-presets-mongo.md`](docs/ufh-presets-mongo.md) | Режимы ТП |
| [`docs/ufh-test-checklist.md`](docs/ufh-test-checklist.md) | Ручной чеклист ТП |
| [`docs/manifold-matching.md`](docs/manifold-matching.md) | Коллекторы |
| [`docs/unibox-matching.md`](docs/unibox-matching.md) | Унибоксы |
| [`docs/financial-summary.md`](docs/financial-summary.md) | `report.commercial` |
| [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md) | Положение комнаты |

---

## Тестирование

```bash
npm run verify                    # из корня
cd backend && npm run verify      # backend gate
cd frontend && npm run verify     # frontend gate
```

Smoke calc — Test Quickstart в [`.cursorrules`](.cursorrules). Auth — [`docs/auth.md`](docs/auth.md) § Verify.
