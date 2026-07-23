# Карта структуры проекта

Навигатор по папкам и ключевым entrypoints. **Не** дублирует статус MVP и подробные таблицы из [`Plan.md`](../Plan.md) — там статус задач и развёрнутые списки модулей; здесь — «куда смотреть».

Правила кода и бизнес-контекст: [`.cursorrules`](../.cursorrules).  
Контракт API: [`openapi.yaml`](../openapi.yaml).  
Типобезопасность / verify gate: [`type-safety.md`](type-safety.md).

В заголовке большинства исходников есть блок «Назначение / Описание».

---

## Дерево верхнего уровня

```text
.
├── openapi.yaml / components/schemas/   # REST-контракт
├── shared/                              # общие константы BE↔FE
├── backend/                             # Express API + calc (+ Dockerfile PDF)
├── frontend/                            # React + Vite UI
├── docs/                                # документация доменов
├── scripts/                             # root verify helpers
├── .github/workflows/                   # CI
├── tsconfig.strict-base.json            # общий strict TS
├── package.json                         # обёртки npm run …
└── Plan.md / .cursorrules / README.md
```

| Путь | Назначение |
|------|------------|
| `openapi.yaml` | Источник правды REST (пути, схемы тел/ответов) |
| `components/schemas/` | Фрагменты OpenAPI (`CalcInput`, отчёт, share, …) — `$ref` из yaml |
| `shared/` | Контракты, общие для backend и frontend (схемы ГВС, режимы, типы комнат) |
| `backend/` | Node.js + Express: calc, matching, Mongo, seed, verify, PDF (Chromium) |
| `backend/Dockerfile` | Образ node:20 + apt Chromium для серверного PDF |
| `backend/docker-compose.pdf.yml` | Пример запуска API с PDF-рендером |
| `frontend/` | React + TS + React Query: анкета, start screen, публичная ссылка |
| `docs/` | Тематические гайды (не код) |
| `scripts/verifyNoTypeBypass.mjs` | Gate: запрет `any` / `@ts-ignore` / unsafe eslint-disable |
| `.github/workflows/verify.yml` | CI: bypass → shared → backend → frontend → build |
| `tsconfig.strict-base.json` | Общий strict-профиль для shared / backend / frontend |
| `package.json` (корень) | `npm run verify`, `dev:full`, prefix-скрипты |
| `Plan.md` | Статус MVP + детальная структура + roadmap |
| `.cursorrules` | Политика модулей, бизнес-правила, стек |

---

## `shared/` — общие контракты

Парные `.js` + `.d.ts` (или `.ts`). Проверка: `cd shared && npm run typecheck`.

| Модуль | Назначение |
|--------|------------|
| `heatingMatchingSchemes.*` | Enum схем котла↔ГВС |
| `heatingThermalRegimePresets.*` | 75/65, 55/45, … |
| `heatingThermalRegimeRecommendations.*` | Тексты рекомендаций по тепловым режимам |
| `roomTypeNormalization.*` | Канонические типы комнат + synonym/legacy |
| `roomDesignAirTemp.*` | Расчётная T воздуха (санузел и др.) |
| `radiatorConnection.*` / `radiatorEmitterPreference.*` | Подводка / preference излучателя |
| `ufhCircuitPresets.*` / `ufhDistributionPresets.*` / `ufhModePresetIds.*` / `ufhTerminalControl.*` | Пресеты и режимы ТП |
| `waterHeaterFormContract.*` | Контракт формы ГВС |
| `surveyMutationKinds.ts` | Виды мутаций анкеты (общие имена) |

---

## `backend/` — API и расчётное ядро

Точка входа: `src/index.js`. Публичные barrels: `*/public.js` (импорты между доменами только через них).

### `backend/src/`

| Папка / файл | Назначение |
|--------------|------------|
| `index.js` | Express, CORS, Helmet, requestId, error handler |
| `api/` | Роуты `/api/v1/*`, AJV, `runCalculation`, projects/system |
| `api/publicSharesRoutes.js` | Публичный GET `/api/v1/public/shares/{shareToken}` (+ PDF) |
| `api/middleware/rateLimiters.js` | Rate limit для calc, projects, public shares |
| `auth/` | JWT pipeline, `requireAuth`, конфиг Clerk/JWKS — см. [`auth.md`](auth.md) |
| `logic/` | Теплопотери, стены, ГВС MVP, ТП (`warmFloorCalc`, `ufh*`) |
| `hydraulics/` | Pure Pipeline: граф → трубы → насосы → proposal |
| `matching/` | Котёл, радиаторы, ВН, БКН, manifolds, uniboxes |
| `catalog/` | `loadCatalog` / `validateCatalog` (Mongo \| file \| auto) |
| `dhw/` | water_norms, appliances, формулы водоснабжения |
| `ufh/` | Загрузка/валидация Mongo-пресетов ТП modes |
| `reference/` | TTL bundle справочников + `toCalcRuntimeContext` |
| `recommendations/` | Тексты `REC_*` / `WARN_*` |
| `report/` | `buildReport` — сборка JSON-отчёта |
| `climate/` | Nominatim + Meteostat bulk |
| `models/` | Mongoose (runtime: `public.js` → Product/Project/…) |
| `projects/` | CRUD, calc input, summary, **share**, **PDF** (см. ниже) |
| `data/` | Локальные пресеты ТП (base assembly, finishes) — не Mongo |
| `utils/` | Логер, Mongo URI, монтаж котла, `createAppError`, … |
| `types/` | `shared-types.d.ts`, `boiler-types.d.ts`, Express augment |

#### `backend/src/projects/` — подмодули

| Группа | Ключевые файлы |
|--------|----------------|
| CRUD / calc | `resolveProjectCalcInput.js`, `extractCalculationSummary.js`, `serializeProject.js`, `documentSizeLimits.js`, `projectAccess.js` |
| Share | `buildShareSnapshot.js`, `shareToken.js`, `serializeShare.js` |
| PDF | `buildEstimatePdfHtml.js`, `buildTechnicalPdfHtml.js`, `renderPdfFromHtml.js`, `renderEstimatePdf.js`, `pdfFilename.js`, `pdfRenderSemaphore.js` |

Детальные строки по ключевым файлам logic/matching/hydraulics — в [`Plan.md`](../Plan.md) § `backend/`.

Домены в отдельных доках: [`hydraulics-pipeline.md`](hydraulics-pipeline.md), [`manifold-matching.md`](manifold-matching.md), [`unibox-matching.md`](unibox-matching.md), [`calc-runtime-context.md`](calc-runtime-context.md), [`client-share-and-layers.md`](client-share-and-layers.md), [`project-pdf.md`](project-pdf.md).

### `backend/data/` и каталог

| Путь | Назначение |
|------|------------|
| `data/water_norms.json` | Нормы ГВС (seed → Mongo `water_norms`) |
| `data/appliances.json` | Правила техники (не номенклатура) |
| `data/recommendations.json` | Тексты рекомендаций |
| `test_data.json.example` | Эталон каталога products (в git) |
| `test_data.json` | Локальная копия каталога (gitignore; для seed / file mode) |

### `backend/scripts/`

| Группа | Назначение |
|--------|------------|
| `seed.js` + `seedReferenceData.js` | Запись products + reference в Mongo |
| `verify*.js` | Domain-гейты (`npm run verify:*`); входят в `npm run verify` |
| `fuzz-calc.ts` | Ручной fuzz POST `/api/v1/calc` (`npm run test:fuzz`; нужен поднятый API) |
| `fixtures/` | Хелперы assert/фикстур для verify-скриптов |
| `utils/` | Пути каталога, seed-normalize, invalidate cache |

Полный список `verify:*` — в `backend/package.json` (сгруппирован в [`Plan.md`](../Plan.md) § verify).

---

## `frontend/` — UI анкеты

Точка входа:

```text
main.tsx → QueryProvider → App.tsx
  ├─ pathname /s/{shareToken} → SharePresentationPage (read-only презентация)
  └─ SurveyApp → SurveySessionProvider → AppRoot
       ├─ resolving → AppBootstrapSkeleton
       ├─ error     → BootstrapErrorScreen
       ├─ start     → StartScreen + Header (variant=start)
       └─ survey    → AppSurveyContent (шаги анкеты + отчёт)
```

Подробнее bootstrap: [`start-state.md`](start-state.md). Клиент vs Dev: [`client-share-and-layers.md`](client-share-and-layers.md).

| Путь | Назначение |
|------|------------|
| `src/App.tsx` | Маршрутизация share vs редактор; справочники RQ |
| `src/AppRoot.tsx` | Bootstrap, Header, DevPanel, ProjectsDialog, `useSurveyProject` |
| `src/AppSurveyContent.tsx` | Шаги анкеты, формы, отчёт |
| `src/surveySession/` | State анкеты: `dispatch` → pipeline → calc; bootstrap |
| `src/surveySession/resolveAppBootstrap.ts` | Hash / localStorage → start \| survey |
| `src/surveySession/createEmptySurveySessionState.ts`, `createDefaultSurveyDraft.ts` | SSOT пустого и дефолтного черновика |
| `src/query/` | React Query: справочники, calc, проекты |
| `src/services/` | HTTP-клиенты; `projectsApi`, `publicShareApi`, `surveyDraftStorage` |
| `src/hooks/` | `useSurveyBootstrap`, `useSurveyDraftPersistence`, `useSurveyProject`, … |
| `src/components/StartScreen/` | Стартовый экран (cold open) |
| `src/components/SharePresentationPage/` | Публичная страница `/s/{token}` |
| `src/components/DevPanel/` | Панель разработчика (DEV / `VITE_DEV_TOOLS=1`) |
| `src/auth/` | Clerk SDK, `AuthProvider`, `ProtectedRoute`, login — см. [`auth.md`](auth.md) |
| `src/components/Header/` | Клиент: ссылка, PDF, выход; Dev — отдельно |
| `src/components/` | Формы, отчёты, `ProjectsDialog/`, … |
| `src/constants/` | SSOT шагов (`SURVEY_STEPS`), типы комнат, compat-id |
| `src/types/` | DTO/view-модели UI |
| `src/utils/` | Парсеры отчёта, миграции, `parseSharePath`, `downloadBlobFile`, … |
| `src/data/fallback*.ts` | Офлайн-fallback справочников |
| `src/styles/` | CSS-переменные / общие стили |
| `scripts/verifySurveySessionPipeline.mjs` | Verify pipeline сессии |
| `scripts/verifyStartState.mjs` | Verify bootstrap / start screen |
| `knip.json` | Dead-code (`--treat-config-hints-as-errors`) |

Подробные таблицы `query/`, `surveySession/`, `hooks/` — [`Plan.md`](../Plan.md) § `frontend/`, [`frontend-calc-runner.md`](frontend-calc-runner.md), [`frontend-query-inventory.md`](frontend-query-inventory.md), [`survey-draft.md`](survey-draft.md).

---

## `docs/` — тематическая документация

| Документ | Тема |
|----------|------|
| [`type-safety.md`](type-safety.md) | Strict TS / checkJs / ESLint / CI |
| [`start-state.md`](start-state.md) | Start Screen, bootstrap, exit, localStorage |
| [`client-share-and-layers.md`](client-share-and-layers.md) | Клиент vs Dev, публичная ссылка, PDF |
| [`project-pdf.md`](project-pdf.md) | Серверная генерация PDF (Chromium) |
| [`frontend-calc-runner.md`](frontend-calc-runner.md) | SurveySession + React Query + calc |
| [`frontend-query-inventory.md`](frontend-query-inventory.md) | Инвентарь query/mutations |
| [`survey-draft.md`](survey-draft.md) | Черновик анкеты v4, compat, verify |
| [`auth.md`](auth.md) | JWT auth Фаза 1: Clerk, pipeline, env, verify, миграция ownerId |
| [`projects-api.md`](projects-api.md) | REST проектов, share, PDF, расчётов |
| [`calc-runtime-context.md`](calc-runtime-context.md) | DI справочников в calc |
| [`calc-input-validation.md`](calc-input-validation.md) | Валидация CalcInput |
| [`financial-summary.md`](financial-summary.md) | Финансовая смета (`commercial`) |
| [`room-exterior-layout.md`](room-exterior-layout.md) | Угол / фасад / коридор |
| [`room-design-air-temp.md`](room-design-air-temp.md) | Расчётная T воздуха санузла |
| [`hydraulics-pipeline.md`](hydraulics-pipeline.md) | Pipeline гидравлики |
| [`manifold-matching.md`](manifold-matching.md) / [`unibox-matching.md`](unibox-matching.md) | Коллекторы / унибоксы |
| [`ufh-presets-mongo.md`](ufh-presets-mongo.md) | Пресеты режимов ТП |
| [`heating-schemes-thermal-regime.md`](heating-schemes-thermal-regime.md) | Схемы котла и режимы |
| [`water-heater-form.md`](water-heater-form.md) | Форма ГВС |
| `boiler-survey-report.md`, `hydraulics-survey-report.md`, `radiators-survey-report.md` | UI-отчёты по доменам |
| `radiator-*.md`, `ufh-*.md`, `*-checklist.md` | Узкие домены / чеклисты тестов |

---

## Как читать код дальше

1. HTTP calc → `backend/src/api/` → `runCalculation` → `report/buildReport` → `matching/`.
2. UI мутация → `surveySession/runSurveyMutationPipeline` → `useSurveyCalc` → `services/calc.ts`.
3. Контракт полей → `openapi.yaml` + `backend/src/types/shared-types.d.ts`.
4. Публичная ссылка → `SharePresentationPage` → `publicShareApi` → `api/publicSharesRoutes.js`.
5. PDF → `projectsApi.downloadProjectPdf` / `downloadPublicSharePdf` → `backend/projects/renderEstimatePdf.js`.
6. Auth → [`auth.md`](auth.md) · Clerk frontend → JWKS backend → `req.user.id` → `projects.ownerId`.
7. Перед merge → из корня `npm run verify` (см. [`type-safety.md`](type-safety.md)).
