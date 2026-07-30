# Карта структуры проекта

Навигатор по папкам и ключевым entrypoints. Карта verify и calc flow — [`Plan.md`](../Plan.md); здесь — «куда смотреть» и дерево `backend/`.

Правила кода и бизнес-контекст: [`.cursorrules`](../.cursorrules).  
Контракт API: [`openapi.yaml`](../openapi.yaml).  
Типобезопасность / verify gate: [`type-safety.md`](type-safety.md).  
**Мова UI (user-facing):** [`language-policy.md`](language-policy.md) — українська; whitelist enum/calc payload.

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
| [`Plan.md`](../Plan.md) | Карта модулей backend/frontend |
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

Точка входа: `src/index.js`. Cross-domain импорты — только через barrels `*/public.js` (`api`, `catalog`, `hydraulics`, `matching`, `models`, `reference`, `report`).

### Корень `backend/`

| Путь | Назначение |
|------|------------|
| `README.md` | Quick start, маршруты, verify |
| `package.json` | `npm run start`, `npm run verify`, `npm run seed` |
| `eslint.config.js` / `tsconfig.json` | ESLint, checkJs |
| `.env.example` | Шаблон переменных окружения |
| `Dockerfile` / `docker-compose.pdf.yml` | API + Chromium для PDF |
| `data/` | JSON справочников для seed (см. ниже) |
| `scripts/` | seed, verify, migrate, fixtures, utils |
| `test_data.json.example` / `test_data.json` | Каталог products (example в git) |

### `backend/src/` — домены (18 папок)

| Папка | Назначение |
|-------|------------|
| `api/` | HTTP-слой — см. подтаблицу ниже |
| `auth/` | JWT, Clerk/JWKS, `requireAuth`, `requireRole`, tier — [`auth.md`](auth.md) |
| `catalog/` | `loadCatalog`, `validateCatalog`, helpers, geometry серий |
| `climate/` | `geocode.js`, `snipClimate.js`, Meteostat bulk |
| `data/` | Static пресеты ТП для UI (`warmFloorAssemblyPresets.js`, `flooringFinishMaterials.js`) |
| `dhw/` | water_norms, appliances: load + validate + `waterCalc.js` |
| `feedback/` | Валидация публичного feedback, сериализация admin DTO и SSE-hub |
| `hydraulics/` | Pure Pipeline (~25 модулей), barrel `public.js` |
| `logic/` | Теплопотери, ограждения, ГВС, оркестратор ТП (`warmFloorCalc`, `ufh*`) |
| `matching/` | Подбор оборудования; `internal/` — radiators core, emitter kind, indirect helpers |
| `models/` | Mongoose: runtime `public.js`; discriminators (`Boiler.js`, …) — только seed |
| `projects/` | CRUD, calc, share, PDF — см. подтаблицу ниже |
| `recommendations/` | load/validate/resolver текстов `REC_*` / `WARN_*` |
| `reference/` | `configCache`, bundle, `toCalcRuntimeContext`, `deepFreeze` |
| `report/` | `buildReport.js`, `buildFinancialBom.js`, `automationHints.js`, `public.js` |
| `types/` | `shared-types.d.ts`, `boiler-types.d.ts`, `auth.d.ts`, `express-augment.d.ts` |
| `ufh/` | Mongo-пресеты режимов ТП: load + validate |
| `utils/` | logger, Mongo, `createAppError`, boiler mounting, pump curve, matching hints |

#### `backend/src/api/`

| Файл | Назначение |
|------|------------|
| `routes.js` | Роуты presets + calc |
| `runCalculation.js` | Composition root calc |
| `validate.js` | AJV + нормализация CalcInput |
| `calcInputSchemaLoader.js` | Загрузка OpenAPI-схемы для AJV |
| `public.js` | Barrel HTTP API |
| `projectsRoutes.js` | Projects CRUD, calc, share, PDF |
| `publicSharesRoutes.js` | Публичный share |
| `adminFeedbackRoutes.js` | Admin: список обращений, статусы и SSE `/api/v1/admin/feedback*` |
| `meRoutes.js` / `adminRoutes.js` / `feedbackRoutes.js` / `systemRoutes.js` | `/me`, admin gate/users, публичный feedback, cache invalidate |
| `validateAdminUserPatch.js` | Валидация PATCH admin user |
| `middleware/rateLimiters.js` | Rate limits |

#### `backend/src/matching/`

| Файл / папка | Назначение |
|--------------|------------|
| `index.js` | Оркестратор `matchEquipment` |
| `boiler.js`, `radiators.js`, `waterHeater.js`, `indirectWaterHeater.js` | Подбор по типам |
| `manifold.js`, `unibox.js`, `warmFloor.js`, `hydraulics.js` | Коллекторы, унибоксы, ТП, legacy hydraulics snapshot |
| `radiatorSizingHelpers.js`, `enrichProposalBundlePrice.js` | Sizing, цены proposal |
| `internal/` | `pickRadiatorsCore`, emitter kind, micro-load, mixed UFH, indirect catalog |

#### `backend/src/models/`

Runtime — `public.js` (`Product`, `Project`, `Calculation`, `User`, `Feedback`). Discriminators для seed: `Boiler`, `Radiator`, `WaterHeater`, `Pipe`, `Pump`, `IndirectWaterHeater`, `Manifold`, `BoilerManifold`, `Unibox`; reference: `WaterNorms`, `Appliance`, `Recommendation`, `UnderfloorHeatingPreset`.

#### `backend/src/projects/` — подмодули

| Группа | Ключевые файлы |
|--------|----------------|
| CRUD / calc | `resolveProjectCalcInput.js`, `extractCalculationSummary.js`, `serializeProject.js`, `validateProjectBody.js`, `documentSizeLimits.js`, `projectAccess.js`, `projectChangeMeta.js`, `requireMongo.js` |
| Share | `buildShareSnapshot.js`, `buildPublisherPresentation.js`, `shareToken.js`, `serializeShare.js` |
| PDF | `buildEstimatePdfHtml.js`, `buildTechnicalPdfHtml.js`, `renderPdfFromHtml.js`, `renderEstimatePdf.js`, `pdfFilename.js`, `pdfRenderSemaphore.js`, `pdfHtmlEscape.js` |
| Migrate | `migrateLegacyProjectOwnerId.js` |

Домены в отдельных доках: [`hydraulics-pipeline.md`](hydraulics-pipeline.md), [`manifold-matching.md`](manifold-matching.md), [`unibox-matching.md`](unibox-matching.md), [`calc-runtime-context.md`](calc-runtime-context.md), [`client-share-and-layers.md`](client-share-and-layers.md), [`project-pdf.md`](project-pdf.md).

### `backend/data/` и каталог

| Путь | Назначение |
|------|------------|
| `data/water_norms.json` | Нормы ГВС (seed → Mongo `water_norms`) |
| `data/appliances.json` | Правила техники (не номенклатура) |
| `data/recommendations.json` | Тексты рекомендаций |
| `data/underfloor_heating_presets.json` | Режимы ТП (seed → Mongo `underfloor_heating_presets`) |
| `test_data.json.example` | Эталон каталога products (в git) |
| `test_data.json` | Локальная копия каталога (gitignore; для seed / file mode) |

### `backend/scripts/`

| Группа | Назначение |
|--------|------------|
| `seed.js` + `seedReferenceData.js` | Запись products + reference в Mongo |
| `migrateProjectOwnerIds.js` | Миграция legacy `projects.ownerId` |
| `promoteUserAdmin.js` | Dev-утилита повышения роли |
| `verify*.js` / `verifyFeedback.mjs` / `verifyAdminFeedback.mjs` | Domain-гейты (`npm run verify:*`) |
| `fuzz-calc.ts` | Ручной fuzz POST `/api/v1/calc` (`npm run test:fuzz`; нужен поднятый API) |
| `fixtures/` | Хелперы assert/фикстур для verify-скриптов |
| `utils/` | Пути каталога, seed-normalize, invalidate cache |

Полный список `verify:*` — в `backend/package.json` (сгруппирован в [`Plan.md`](../Plan.md) § verify).

---

## `frontend/` — UI анкеты

Точка входа:

```text
main.tsx → QueryProvider → App.tsx
  └─ BrowserRouter → AuthProvider → AppChromeProvider → AppRouter
       ├─ /s/:shareToken → SharePresentationPage (read-only презентация)
       ├─ /login, /sign-up, /docs, /faq, legal → pages/*
       ├─ /projects → SurveyAppShell → ProtectedRoute → ProjectsPage
       ├─ /admin/feedback → ProtectedRoute → AdminRoute → AdminFeedbackPage
       └─ / → SurveyAppShell → SurveySessionProvider → AppRoot
            ├─ resolving → AppBootstrapSkeleton
            ├─ error     → BootstrapErrorScreen
            ├─ start     → StartScreen + Header (variant=start)
            └─ survey    → AppSurveyContent (шаги анкеты + отчёт)
```

Подробнее bootstrap: [`start-state.md`](start-state.md). Клиент vs Dev: [`client-share-and-layers.md`](client-share-and-layers.md).

| Путь | Назначение |
|------|------------|
| `src/App.tsx` | BrowserRouter, auth/providers и `AppRouter` |
| `src/routing/` | `AppRouter`, `SurveyAppShell`, канонические `paths`; маршруты и справочники RQ |
| `src/AppRoot.tsx` | Bootstrap, Header, DevPanel, ProjectsDialog, `useSurveyProject` |
| `src/AppSurveyContent.tsx` | Шаги анкеты, формы, отчёт |
| `src/surveySession/` | State анкеты: `dispatch` → pipeline → calc; bootstrap |
| `src/surveySession/resolveAppBootstrap.ts` | Hash / localStorage → start \| survey |
| `src/surveySession/createEmptySurveySessionState.ts`, `createDefaultSurveyDraft.ts` | SSOT пустого и дефолтного SurveyDraft |
| `src/query/` | React Query: справочники, calc, проекты, admin feedback list/status |
| `src/services/` | HTTP-клиенты; `meApi`, `projectsApi`, `adminFeedbackApi`, `adminFeedbackStream`, parsers |
| `src/hooks/` | `useSurveyBootstrap`, `useSurveyDraftPersistence`, `useSurveyProject`, `useAdminFeedbackStream`, … |
| `src/pages/` | Login, SignUp, Projects, AdminFeedback, Docs, FAQ, Privacy/Terms/Cookies |
| `src/auth/` | Clerk/AuthProvider, `ProtectedRoute`, `AdminRoute`, redirect и `/me` cache sync |
| `src/shell/` | `AppChromeProvider`: общие действия и модальные окна Header/Footer |
| `src/i18n/` | Украинские UI-тексты, локализация и appearance Clerk |
| `src/components/AccountBar/` | Сессия: «Увійти», email, tier badge, admin-ссылка; «Вийти з акаунта» завершает авторизацию |
| `src/components/SubscriptionTierBadge/` | Badge подписки из `/me` |
| `src/components/PublisherContactBlock/` | Контакт на public share (Pro/Marketplace) |
| `src/components/StartScreen/` | Стартовый экран (cold open) |
| `src/components/SharePresentationPage/` | Публичная страница `/s/{token}` |
| `src/components/DevPanel/` | Панель разработчика; условия включения и действия — [`frontend-dev-panel.md`](frontend-dev-panel.md) |
| `src/components/Footer/`, `ModalHost/`, `CookieConsentBanner/`, `DevToolsDock/` | Общая оболочка SPA |
| `src/auth/` | Clerk SDK, `AuthProvider`, `useAuthMeCacheSync`, `ProtectedRoute`, login — см. [`auth.md`](auth.md) |
| `src/components/Header/` | Клиент: ссылка, PDF, `accountSlot`, hint pro/marketplace; «Вийти з проєкту» открывает Start Screen |
| `src/components/` | Формы, отчёты, `ProjectsDialog/`, … |
| `src/constants/` | SSOT шагов (`SURVEY_STEPS`), типы комнат, compat-id |
| `src/types/` | DTO/view-модели UI |
| `src/utils/` | Парсеры отчёта, миграции, `parseSharePath`, `downloadBlobFile`, … |
| `src/data/fallback*.ts` | Офлайн-fallback справочников |
| `src/styles/` | CSS-переменные / общие стили |
| `scripts/verifySurveySessionPipeline.mjs` | Verify pipeline сессии |
| `scripts/verifyStartState.mjs` | Verify bootstrap / start screen |
| `scripts/verifyFooterNav.mjs`, `verifyFrontendAuth.mjs`, `verifyFrontendMe.mjs`, `verifyAdminFeedback.mjs` | Verify навигации, auth и admin feedback |
| `knip.json` | Dead-code (`--treat-config-hints-as-errors`) |

Подробности `query/`, `surveySession/`, `hooks/` — [`frontend-calc-runner.md`](frontend-calc-runner.md), [`frontend-query-inventory.md`](frontend-query-inventory.md), [`survey-draft.md`](survey-draft.md).

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
| [`survey-draft.md`](survey-draft.md) | SurveyDraft v4, load/save, verify |
| [`auth.md`](auth.md) | JWT, Clerk, tier, `/me`, share contact, verify |
| [`feedback-admin.md`](feedback-admin.md) | Admin REST/SSE обращений, статусы и dashboard |
| [`projects-api.md`](projects-api.md) | REST проектов, share, PDF, расчётов |
| [`calc-runtime-context.md`](calc-runtime-context.md) | DI справочников в calc |
| [`calc-input-validation.md`](calc-input-validation.md) | Валидация CalcInput |
| [`financial-summary.md`](financial-summary.md) | Финансовая смета (`commercial`) |
| [`room-exterior-layout.md`](room-exterior-layout.md) | Угол / фасад / коридор |
| [`room-design-air-temp.md`](room-design-air-temp.md) | Расчётная T воздуха санузла |
| [`hydraulics-pipeline.md`](hydraulics-pipeline.md) | Pipeline гидравлики |
| [`manifold-matching.md`](manifold-matching.md) / [`unibox-matching.md`](unibox-matching.md) | Коллекторы / унибоксы |
| [`ufh-presets-mongo.md`](ufh-presets-mongo.md) | Пресеты режимов ТП |
| [`ufh-test-checklist.md`](ufh-test-checklist.md) | Ручной чеклист ТП |
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
6. Auth / tier UX → [`auth.md`](auth.md) · `/me` → `AccountBar` · Pro share contact → `buildPublisherPresentation.js`.
7. Перед merge → из корня `npm run verify` (см. [`type-safety.md`](type-safety.md)).
