# Карта структуры проекта

**SSOT** дерева папок и entrypoints репозитория (в т.ч. полный навигатор `backend/`).  
Краткий индекс модулей и доменных ссылок — [`Plan.md`](../Plan.md). Frontend — [`frontend/README.md`](../frontend/README.md). Quick start API — [`backend/README.md`](../backend/README.md).

Правила кода и бизнес-контекст: [`.cursorrules`](../.cursorrules).  
Контракт API: [`openapi.yaml`](../openapi.yaml).  
Типобезопасность / verify gate: [`type-safety.md`](type-safety.md).  
**Мова UI (user-facing):** [`language-policy.md`](language-policy.md) — українська; whitelist enum/calc payload.

В заголовке большинства исходников есть блок «Назначение / Описание»; в `docs/deploy/*.md` — HTML-комментарий `<!-- Назначение: … -->` (проверка: `npm run verify:deploy-docs`).

---

## Дерево верхнего уровня

```text
.
├── openapi.yaml / components/schemas/   # REST-контракт
├── shared/                              # общие константы BE↔FE
├── backend/                             # Express API + calc (+ Dockerfile PDF)
├── frontend/                            # React + Vite UI
├── docs/                                # документация доменов
│   └── deploy/                          # деплой Vercel + Render (hub: deploy/README.md)
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
| `docs/deploy/` | Деплой Vercel + Render — hub [`deploy/README.md`](deploy/README.md) |
| `scripts/verifyNoTypeBypass.mjs` | Gate: запрет `any` / `@ts-ignore` / unsafe eslint-disable |
| `.github/workflows/verify.yml` | CI: bypass → shared → backend → frontend → build |
| `tsconfig.strict-base.json` | Общий strict-профиль для shared / backend / frontend |
| `package.json` (корень) | `npm run verify`, `dev:full`, prefix-скрипты |
| [`Plan.md`](../Plan.md) | Краткий индекс модулей и ссылок на доменные доки |
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

Точка входа: `src/index.js`. Cross-domain импорты в runtime — только через barrels `*/public.js` (`api`, `catalog`, `hydraulics`, `matching`, `models`, `reference`, `report`). `scripts/` импортирует internal напрямую.

Calc HTTP: `runCalculation(body)` → `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })` → matching + hydraulics. Invalidate bundle: `POST /api/v1/system/invalidate-reference-cache`.

Полные деревья ниже — **SSOT** файлов `backend/` (сверка с диском). Локальный мусор (`node`, пустые артефакты npm) в дерево не входит.

### Корень `backend/`

```text
backend/
  README.md
  package.json
  package-lock.json
  eslint.config.js
  tsconfig.json
  .env.example
  Dockerfile
  docker-compose.pdf.yml
  test_data.json.example
  test_data.json          # gitignore; локальная копия каталога
  data/                  # JSON справочников для seed
  scripts/               # seed, verify, migrate, fixtures, utils
  src/
    index.js             # Express entry
    <18 domain folders>
```

| Путь | Назначение |
|------|------------|
| `src/index.js` | Express app: CORS, Helmet, requestId, warmup reference bundle |
| `README.md` | Quick start, маршруты, verify |
| `package.json` | `npm run start`, `npm run verify`, `npm run seed` |
| `eslint.config.js` / `tsconfig.json` | ESLint, checkJs / typecheck |
| `.env.example` | Шаблон env (Mongo, CORS, auth, cache, PDF) |
| `Dockerfile` / `docker-compose.pdf.yml` | API + Chromium для PDF |
| `data/` | JSON-эталоны справочников для seed |
| `scripts/` | seed, verify, migrate, fixtures, utils |
| `test_data.json.example` | Эталон каталога `products` (в git) |
| `test_data.json` | Локальная копия каталога (gitignore; seed / `CATALOG_SOURCE=file`) |

### `backend/src/` — домены (18 папок + `index.js`)

| Папка | Назначение |
|-------|------------|
| `api/` | HTTP `/api/v1/*`, AJV, `runCalculation`, rate limiters |
| `auth/` | JWT pipeline, Clerk/JWKS, `requireAuth`, `requireRole`, tier — см. [`auth.md`](auth.md) |
| `catalog/` | `loadCatalog` / `validateCatalog` (mongo | file | auto), helpers, geometry серий |
| `climate/` | Nominatim geocode + Meteostat bulk |
| `data/` | Static пресеты ТП для UI (не Mongo) |
| `dhw/` | water_norms / appliances: load + validate + `waterCalc` |
| `feedback/` | Публичный feedback + admin DTO + SSE hub |
| `hydraulics/` | Pure Pipeline гидравлики, barrel `public.js` |
| `logic/` | Теплопотери, стены, ГВС, оркестратор ТП (`warmFloorCalc`, `ufh*`) |
| `matching/` | Подбор оборудования; `internal/` — radiators / emitter / indirect helpers |
| `models/` | Mongoose: runtime `public.js`; discriminators — только seed |
| `projects/` | CRUD, calc, share, PDF, import/export |
| `recommendations/` | load / validate / resolver текстов `REC_*` / `WARN_*` |
| `reference/` | TTL bundle + `toCalcRuntimeContext` |
| `report/` | `buildReport`, `buildFinancialBom` → `commercial`, `automationHints` |
| `types/` | JSDoc/`*.d.ts` для HTTP и доменных DTO |
| `ufh/` | load + validate Mongo `underfloor_heating_presets` |
| `utils/` | logger, Mongo, errors, boiler mounting, pump curve, apartment matching |

#### Полные деревья `backend/src/<domain>/`

##### `api/` (16 файлов)

```text
middleware/
  rateLimiters.js
adminFeedbackRoutes.js
adminRoutes.js
calcInputSchemaLoader.js
errorCodes.js
feedbackRoutes.js
meRoutes.js
projectsRoutes.js
public.js
publicSharesRoutes.js
routes.js
runCalculation.js
sendErrorEnvelope.js
systemRoutes.js
validate.js
validateAdminUserPatch.js
```

##### `auth/` (14 файлов)

```text
attachRequestContext.js
authErrors.js
authorizationPolicy.js
extractBearerToken.js
mapJwtPayload.js
optionalAuth.js
platformAdminAllowlist.js
projectsAuthConfig.js
requireAuth.js
requireRole.js
resolveUser.js
runAuthPipeline.js
serializeMeUser.js
verifyAccessToken.js
```

##### `catalog/` (12 файлов)

```text
boilerCatalogHelpers.js
boilerManifoldSeriesGeometry.js
comparators.js
loadCatalog.js
manifoldSeriesGeometry.js
matchingSortPools.js
pipeCatalogHelpers.js
public.js
pumpCatalogHelpers.js
types.d.ts
uniboxCatalogHelpers.js
validateCatalog.js
```

##### `climate/` (3 файлов)

```text
geocode.js
index.js
snipClimate.js
```

##### `data/` (2 файлов)

```text
flooringFinishMaterials.js
warmFloorAssemblyPresets.js
```

##### `dhw/` (7 файлов)

```text
loadAppliances.js
loadWaterNorms.js
types.d.ts
validateAppliances.js
validateReferenceHelpers.js
validateWaterNorms.js
waterCalc.js
```

##### `feedback/` (3 файлов)

```text
adminFeedback.js
feedbackEventHub.js
validateFeedbackBody.js
```

##### `hydraulics/` (26 файлов)

```text
buildGraph.js
buildHydraulicsProposal.js
buildRadiatorSubgraph.js
buildSnapshots.js
circulationLoops.js
crossValidatePipelineInput.js
groupRadiatorGraphBranches.js
parseConnectionDiameter.js
pickPipe.js
pickPump.js
pickTrunkChain.js
pipeCatalogPoolFilter.js
pipeHydraulics.js
pipelineSchemaLoader.js
pressureDrop.js
public.js
radiatorGraphHelpers.js
resolveCirculationFlows.js
resolveEmittersMode.js
resolveFlowDeltaTK.js
resolveSystemPumps.js
resolveZoneHead.js
runHydraulicsPipeline.js
thermalLoadToFlow.js
types.d.ts
validatePipelineInput.js
```

##### `logic/` (30 файлов)

```text
apartmentStackBoundaries.js
envelopeHeatLoss.js
envelopePresets.js
externalWallsValidate.js
heatingThermalRegimes.js
heatlossByRooms.js
hotWater.js
normalizeHeatingUfhPreset.js
normalizeUnderfloorDistribution.js
orientationHeatLoss.js
roomExteriorLayoutHeatLoss.js
topBoundaryEnvelope.js
ufhActiveFloorArea.js
ufhCircuitResolve.js
ufhDistributionResolve.js
ufhHydraulicsCircuit.js
ufhLoopGeometry.js
ufhLoopHydraulics.js
ufhLoopHydraulics.types.d.ts
ufhLoopLength.js
ufhMixingNode.js
ufhMixingNodeHydraulics.js
ufhPipeEmbedment.js
ufhPipeSpacingResolve.js
ufhRequiredHeatFlux.js
ufhRoomCoverageCheck.js
ufhRoomHeatFlux.js
ventilationReserve.js
wallAssembly.js
warmFloorCalc.js
```

##### `matching/` (23 файлов)

```text
internal/
  decideObjectEmitterKind.js
  exploreRoomEmitterKind.js
  indirectCatalogHelpers.js
  mixedRadiatorsUfhMode.js
  pickRadiatorsCore.js
  radiatorConnectionNotes.js
  resolveMicroLoadRadiatorStrategy.js
  resolveMixedRadiatorRoomLoad.js
  sizeForcedRoomEmitter.js
  summarizeRadiatorEmitters.js
  uniboxRoomAirPresets.js
boiler.js
enrichProposalBundlePrice.js
index.js
indirectPriorityRoomHint.js
indirectWaterHeater.js
manifold.js
public.js
radiators.js
radiatorSizingHelpers.js
unibox.js
warmFloor.js
waterHeater.js
```

##### `models/` (20 файлов)

```text
Appliance.js
Boiler.js
BoilerManifold.js
Calculation.js
Feedback.js
IndirectWaterHeater.js
Manifold.js
Pipe.js
Product.js
productSchemas.js
Project.js
public.js
Pump.js
Radiator.js
Recommendation.js
UnderfloorHeatingPreset.js
Unibox.js
User.js
WaterHeater.js
WaterNorms.js
```

##### `projects/` (30 файлов)

```text
buildEstimatePdfHtml.js
buildPublisherPresentation.js
buildShareSnapshot.js
buildTechnicalPdfHtml.js
documentSizeLimits.js
extractCalculationSummary.js
importProjectBundle.js
migrateLegacyProjectOwnerId.js
normalizeLegacySurveyImport.js
parseIncludeTechnicalQuery.js
parseObjectId.js
pdfFilename.js
pdfHtmlEscape.js
pdfRenderSemaphore.js
projectAccess.js
projectChangeMeta.js
projectExportConstants.js
projectOwnerMeta.js
renderEstimatePdf.js
renderPdfFromHtml.js
requireMongo.js
resolveProjectCalcInput.js
serializeProject.js
serializeShare.js
shareToken.js
sortCalculationsForImport.js
stripMongoExportFields.js
validateProjectBody.js
validateProjectImportBody.js
validateProjectSurveyShape.js
```

##### `recommendations/` (4 файлов)

```text
loadRecommendations.js
recommendationResolver.js
types.d.ts
validateRecommendations.js
```

##### `reference/` (6 файлов)

```text
assertCalcRuntimeContext.js
configCache.js
deepFreeze.js
loadReferenceCollection.js
public.js
toCalcRuntimeContext.js
```

##### `report/` (4 файлов)

```text
automationHints.js
buildFinancialBom.js
buildReport.js
public.js
```

##### `types/` (4 файлов)

```text
auth.d.ts
boiler-types.d.ts
express-augment.d.ts
shared-types.d.ts
```

##### `ufh/` (3 файлов)

```text
loadUnderfloorHeatingPresets.js
types.d.ts
validateUnderfloorHeatingPresets.js
```

##### `utils/` (14 файлов)

```text
apartmentCombiSerialBufferHint.js
apartmentMatching.js
boilerMatchingByType.js
boilerMountingConstraints.js
createAppError.js
isPlainObject.js
logger.js
math.js
mongoConnectionConfig.js
mongoDnsPreferPublic.js
mongoReferenceConnection.js
pumpCurveMath.js
sanitizeString.js
setNoStoreCacheHeaders.js
```

Гидравлика после matching — только `backend/src/hydraulics/`.

##### Runtime barrels `*/public.js`

`api/public.js`, `catalog/public.js`, `hydraulics/public.js`, `matching/public.js`, `models/public.js`, `reference/public.js`, `report/public.js`.

### `backend/data/` и каталог

```text
appliances.json
recommendations.json
underfloor_heating_presets.json
water_norms.json
```

| Путь | Назначение |
|------|------------|
| `data/water_norms.json` | Нормы ГВС (seed → Mongo `water_norms`) |
| `data/appliances.json` | Правила техники (не номенклатура) |
| `data/recommendations.json` | Тексты рекомендаций |
| `data/underfloor_heating_presets.json` | Режимы ТП |
| `test_data.json.example` | Эталон каталога products (в git) |
| `test_data.json` | Локальная копия каталога (gitignore) |

### `backend/scripts/`

```text
fixtures/
  calcRuntimeContextFromFiles.js
  scriptAssert.js
  verifyFixtures.js
utils/
  catalogNormalize.js
  catalogPaths.js
  catalogSeedBuild.js
  exitVerifyScript.js
  invalidateReferenceCacheRemote.js
  radiatorHelpers.js
fuzz-calc.ts
migrateProjectOwnerIds.js
promoteUserAdmin.js
seed.js
seedMongoDatabase.mjs
seedReferenceData.js
testApartmentScheme2Payload.json
verifyAdminFeedback.mjs
verifyAuthMiddleware.js
verifyAuthorizationMiddleware.js
verifyAuthorizationPolicy.js
verifyAuthPipeline.js
verifyBuiltinBoilerPump.js
verifyCalcInputSchema.js
verifyCalcInputValidation.js
verifyCalcRuntimeContext.js
verifyCatalogLanguage.js
verifyCirculationFlows.js
verifyDocumentSizeLimits.js
verifyExtractCalculationSummary.js
verifyFeedback.mjs
verifyFinancialBom.js
verifyFitPumpCurve.js
verifyFlowDeltaTK.js
verifyHydraulicsPipeline.js
verifyManifoldMatching.js
verifyMeEndpoint.js
verifyMicroLoadRadiator.js
verifyMigrateProjectOwnerIds.js
verifyMixedRadiatorUfh.js
verifyMongoDatabase.mjs
verifyPickPipe.js
verifyPipeCatalogPoolFilter.js
verifyPipeCatalogValidation.js
verifyPlatformAdminAllowlist.js
verifyProjectCalcInput.js
verifyProjectImport.js
verifyProjectPdf.js
verifyProjectsAdminAccess.js
verifyProjectsAuth.js
verifyProjectShare.js
verifyProjectsImportAdmin.js
verifyPumpDuty.js
verifyRadiatorConnection.js
verifyRadiatorEmitterKind.js
verifyRadiatorEmittersSummary.js
verifyRadiatorSections.js
verifyRadiatorWiringGraph.js
verifyReferenceCacheInvalidate.js
verifyRoomDesignAirTemp.js
verifyRoomExteriorLayoutHeatLoss.js
verifySeedCatalog.js
verifySurveyDraftMigration.js
verifyUfhActiveArea.js
verifyUfhLoopHydraulics.js
verifyUfhPresets.js
verifyUniboxMatching.js
verifyUserModel.js
verifyWaterHeaterFormUtils.js
verifyWaterHeaterMatching.js
```

### Verify (`cd backend && npm run verify`)

SSOT списка скриптов — `backend/package.json` → `verify`. Группы:

| Группа | `npm run verify:…` |
|--------|---------------------|
| Calc / schema | `calc-schema`, `calc-input-validation`, `calc-runtime-context`, `reference-cache-invalidate` |
| Auth / identity | `user-model`, `auth-pipeline`, `auth-middleware`, `authorization-policy`, `authorization-middleware`, `me-endpoint`, `platform-admin`, `feedback`, `admin-feedback`, `projects-auth`, `projects-admin-access`, `migrate-project-owner-ids` |
| Projects / share / PDF | `project-calc-input`, `project-import`, `projects-import-admin`, `document-size-limits`, `extract-calculation-summary`, `project-share`, `project-pdf` |
| Catalog / seed / language | `seed-catalog`, `catalog-language`, `pipe-catalog`, `pipe-catalog-pool-filter`, `financial-bom` |
| Hydraulics / pumps | `hydraulics-pipeline`, `pick-pipe`, `circulation-flows`, `flow-delta-tk`, `builtin-boiler-pump`, `fit-pump-curve`, `pump-duty` |
| Radiators | `radiator-sections`, `radiator-emitters`, `radiator-connection`, `radiator-emitter-kind`, `mixed-radiator-ufh`, `micro-load-radiator`, `radiator-wiring-graph` |
| UFH | `ufh-presets`, `ufh-loop-hydraulics`, `ufh-active-area` |
| Matching extras | `manifold-matching`, `unibox-matching`, `room-design-air-temp`, `water-heater-matching` |
| Frontend-adjacent | `survey-draft-migration`, `water-heater-form` |

Вне `npm run verify`: `node scripts/verifyRoomExteriorLayoutHeatLoss.js`.

Доменные гайды: [`hydraulics-pipeline.md`](hydraulics-pipeline.md), [`manifold-matching.md`](manifold-matching.md), [`unibox-matching.md`](unibox-matching.md), [`calc-runtime-context.md`](calc-runtime-context.md), [`client-share-and-layers.md`](client-share-and-layers.md), [`project-pdf.md`](project-pdf.md), [`projects-api.md`](projects-api.md), [`feedback-admin.md`](feedback-admin.md).

---

## `frontend/` — UI анкеты

Точка входа:

```text
index.html (#static-app-shell: только hero + CTA; без фейкового header)
  → main.tsx (fadeOutStaticShell) → QueryProvider → App.tsx
       BrowserRouter → ClerkLazyRoot → AuthProvider → AppChromeProvider → AppRouter
       ├─ JsonLdBoundary (seo/ — Schema.org по pathname)
       ├─ /s/:shareToken → SharePresentationPage (read-only презентация)
       ├─ /login, /sign-up, /docs, /faq, legal → pages/*
       ├─ /projects → SurveyAppShell → ProtectedRoute → ProjectsPage
       ├─ /admin/feedback → ProtectedRoute → AdminRoute → AdminFeedbackPage
       └─ / → SurveyAppShell → SurveySessionProvider → AppRoot
            ├─ useSurveyBootstrap → start | survey | error
            │    └─ StartAppRoot (лёгкий chunk: StartScreen; resolving/error — skeleton / BootstrapErrorScreen)
            │         · cold open: sync resolve (без фазы resolving)
            │         · resolving только при retryBootstrap()
            └─ survey
                 └─ lazy SurveyAppRoot (тяжёлый chunk)
                      ├─ Header, DevPanel, ProjectsDialog, useSurveyProject
                      └─ lazy AppSurveyContent (шаги анкеты + отчёт)
```

Подробнее bootstrap и static LCP shell: [`start-state.md`](start-state.md). Клиент vs Dev: [`client-share-and-layers.md`](client-share-and-layers.md).

| Путь | Назначение |
|------|------------|
| `index.html` | Static LCP shell (`#static-app-shell`: только hero + CTA) + `#root`; SEO meta / JSON-LD placeholder |
| `src/main.tsx` | Mount React; `fadeOutStaticShell` / `dismissStaticAppShellImmediately` |
| `src/utils/staticAppShellTransition.ts` | Fade/remove overlay `#static-app-shell` |
| `src/App.tsx` | BrowserRouter, `ClerkLazyRoot`, auth/providers и `AppRouter` |
| `src/routing/` | `AppRouter`, `SurveyAppShell`, канонические `paths`; маршруты и справочники RQ |
| `src/AppRoot.tsx` | Оркестратор bootstrap: `useSurveyBootstrap` → `StartAppRoot` \| lazy `SurveyAppRoot` |
| `src/StartAppRoot.tsx` | Cold open: `start` / `resolving` (retry) / `error` (без calc, projects, DevPanel; на localhost — только React Query Devtools) |
| `src/SurveyAppRoot.tsx` | Survey UI: Header, DevPanel, ProjectsDialog, `useSurveyProject`, lazy `AppSurveyContent` |
| `src/AppSurveyContent.tsx` | Шаги анкеты, формы, отчёт |
| `src/seo/` | `JsonLdBoundary`, `JsonLd`, `jsonLdSchemas.ts` — FAQPage и др. по маршруту |
| `src/surveySession/` | State анкеты: `dispatch` → pipeline → calc; bootstrap |
| `src/surveySession/resolveAppBootstrap.ts` | Hash / localStorage → start \| survey |
| `src/surveySession/createEmptySurveySessionState.ts`, `createDefaultSurveyDraft.ts` | SSOT пустого и дефолтного SurveyDraft |
| `src/query/` | React Query: справочники, calc, проекты, admin feedback list/status |
| `src/services/` | HTTP-клиенты; `meApi`, `projectsApi`, `adminFeedbackApi`, `adminFeedbackStream`, parsers |
| `src/hooks/` | `useSurveyBootstrap`, `useSurveyDraftPersistence`, `useSurveyProject`, `useAdminFeedbackStream`, … |
| `src/pages/` | Login, SignUp, Projects, AdminFeedback, Docs, FAQ, Privacy/Terms/Cookies |
| `src/auth/` | Clerk/AuthProvider, `ProtectedRoute`, `AdminRoute`, redirect, `/me` cache sync — см. [`auth.md`](auth.md) |
| `src/shell/` | `AppChromeProvider`: общие действия и модальные окна Header/Footer |
| `src/i18n/` | Украинские UI-тексты, локализация и appearance Clerk |
| `src/components/AccountBar/` | Сессия: «Увійти», email, tier badge, admin-ссылка; «Вийти з акаунта» завершает авторизацию |
| `src/components/SubscriptionTierBadge/` | Badge подписки из `/me` |
| `src/components/PublisherContactBlock/` | Контакт на public share (Pro/Marketplace) |
| `src/components/StartScreen/` | Стартовый экран (cold open) |
| `src/components/SharePresentationPage/` | Публичная страница `/s/{token}` |
| `src/components/DevPanel/` | Панель разработчика; условия включения и действия — [`frontend-dev-panel.md`](frontend-dev-panel.md) |
| `src/components/Footer/`, `ModalHost/`, `CookieConsentBanner/`, `DevToolsDock/` | Общая оболочка SPA |
| `src/components/Header/` | Клиент: ссылка, PDF, `accountSlot`, hint pro/marketplace; «Вийти з проєкту» открывает Start Screen |
| `src/components/` | Формы, отчёты, `ProjectsDialog/`, … |
| `src/constants/` | SSOT шагов (`SURVEY_STEPS`), типы комнат, compat-id |
| `src/types/` | DTO/view-модели UI |
| `src/utils/` | Миграции, форматирование, `downloadBlobFile`, … |
| `src/utils/parsers/` | Парсеры отчёта calc, SurveyDraft, share URL, import bundle |
| `src/data/fallback*.ts` | Офлайн-fallback справочников |
| `src/styles/` | CSS-переменные / общие стили |
| `public/` | Статика Vite: `favicon.svg`, `robots.txt`, `sitemap.xml`, `llms.txt` |
| `scripts/verifySurveySessionPipeline.mjs` | Verify pipeline сессии |
| `scripts/verifyStartState.mjs` | Verify bootstrap / start screen |
| `scripts/verifySeoStatic.mjs` | Verify SEO артефактов и контракта static LCP shell (hero + CTA, без фейкового header) |
| `scripts/verifyFooterNav.mjs`, `verifyFrontendAuth.mjs`, `verifyFrontendMe.mjs`, `verifyAdminFeedback.mjs`, `verifyReportColocation.mjs`, `verifyTypesPlacement.mjs` | Verify навигации, auth, admin feedback, colocation отчётов, размещение типов |
| `knip.json` | Dead-code (`--treat-config-hints-as-errors`) |

### Соглашения размещения frontend (colocation, types, исключения)

Правила doc ↔ code для `frontend/src/`. На Code Review — SSOT: этот подраздел.

#### Colocation чистых хелперов

| Правило | Детали |
|---------|--------|
| Допустимо | Чистая функция, нужная **только** одному модулю — в **его папке** (например `components/BoilerReport/hasBoilerReportContent.ts`, `formatBoilerProposalShortLabel.ts`; паттерн `components/*Report/has*ReportContent.ts`) |
| Парсеры | Только **`src/utils/parsers/`** (отчёт calc, SurveyDraft, share URL, import) |
| Запрещено | Импорт colocated-хелпера из **другой** фичи; `parse*.ts` в корне `utils/` |
| При нарушении | Немедленный перенос в `utils/parsers/` (парсеры) или `utils/` (прочие хелперы) |

Хуки (`use*`) — **не** в `components/`; только `hooks/`, `query/`, `auth/`, `surveySession/`, `shell/` (colocation с контекстом).

##### Whitelist colocated-хелперов отчётов

Паттерн `components/*Report/has*ReportContent.ts` — чистая проверка «есть ли данные для UI отчёта». Дополнительно: `BoilerReport/formatBoilerProposalShortLabel.ts` (только `BoilerSummaryTable`).

| Файл | Допустимые импортёры (кроме своей `*Report/`) |
|------|-----------------------------------------------|
| `BoilerReport/hasBoilerReportContent.ts` | `BoilerSurveyForm`, `RecommendationsBlock` |
| `BoilerReport/formatBoilerProposalShortLabel.ts` | — (только `BoilerReport/`) |
| `HydraulicsReport/hasHydraulicsReportContent.ts` | `HydraulicsSection`, `RecommendationsBlock` |
| `HotWaterReport/hasHotWaterReportContent.ts` | `HotWaterForm` |
| `HotWaterReport/hasHotWaterSummaryContent.ts` | `RecommendationsBlock` |
| `RadiatorsReport/hasRadiatorsReportContent.ts` | `RadiatorsSurveyForm`, `RecommendationsBlock` |
| `WaterHeaterReport/hasWaterHeaterReportContent.ts` | `WaterHeaterForm` |
| `UnderfloorHeatingReport/hasUnderfloorHeatingReportContent.ts` | `WarmFloorSection` |

Новый импортёр вне таблицы → расширить whitelist в docs **и** `frontend/scripts/verifyReportColocation.mjs`. Gate: `npm run verify:report-colocation`.

#### Shared UI между фичами

| Правило | Детали |
|---------|--------|
| Когда | Один и тот же компонент используется в **двух и более** доменных папках `components/*` |
| Куда | Нейтральная папка домена, например `components/Hydraulics/HydraulicsPumpCard` (используется в `HydraulicsReport/` и `UnderfloorHeatingReport/`) |
| Запрещено | Держать shared-комponent в папке одной из фич (`HydraulicsProposal/` и т.п.) |

#### Типы

| Слой | Назначение | Примеры |
|------|------------|---------|
| `src/types/` | Глобальные доменные модели, DTO API, view-модели UI | `surveyDraft.ts`, `rooms.ts`, `hydraulics.ts`, `projectsApi.ts` |
| `*/types.ts`, `*Context.ts` в модуле | Локальный контекст, props, внутреннее состояние **только этого** модуля | `surveySession/types.ts`, props `*Props` в `.tsx` |
| Типы в `utils/` | Только вспомогательные структуры, не дублирующие `types/` | `ExternalWallFieldConfig` в `roomExteriorLayout.ts` |

**SSOT enum/union:** каноничное объявление — в `types/`; из `utils/` и компонентов — **импорт**, без повторного `export type` (например `RoomExteriorLayout` → `types/rooms.ts`).

#### Задокументированные исключения

| Путь | Почему не «стандартный» слой | Ссылка |
|------|------------------------------|--------|
| `components/SharePresentationPage/` | Route-level read-only презентация; lazy из `AppRouter`, не `pages/` | [`client-share-and-layers.md`](client-share-and-layers.md) |
| `surveySession/types.ts` | Типы pipeline сессии tightly coupled к `dispatch` / `reduceSurveyMutation` | [`frontend-calc-runner.md`](frontend-calc-runner.md) |
| `services/catalogTypes.ts` | DTO каталога рядом с `parseCatalog*` | `services/parseCatalogBoilers.ts`, … |
| `shell/appChromeContext.ts` | Типы chrome-контекста рядом с `AppChromeProvider` | — |

Наличие записи в таблице **снимает вопросы** на Code Review; новые исключения добавлять сюда до merge.

##### Локальные типы вне `types/` (допустимо без записи в «исключения»)

| Путь | Классификация |
|------|---------------|
| `auth/authContext.ts`, `auth/clerkLoadContext.ts` | Контекст auth рядом с provider |
| `services/feedbackApi.ts`, `services/adminFeedbackStream.ts` | DTO HTTP-клиента рядом с fetch |
| `utils/roomExteriorLayout.ts` | View-хелперы формы (`ExternalWallFieldConfig`, `WallEnvelopeEntry`) |
| `utils/validateWaterHeaterForm.ts`, `utils/projectBundleTransfer.ts`, … | Локальные структуры util-модуля |
| `*Props` в `.tsx` | Props компонента |

##### Кандидаты на будущий рефакторинг (не блокер)

| Путь | Замечание |
|------|-----------|
| `utils/parsers/parseBoilerFromReport.ts`, `parseRadiatorsMatchingFromReport.ts`, `parseWaterHeaterMatchingFromReport.ts`, `parseIndirectWaterHeaterMatchingFromReport.ts`, `parseUniboxesMatchingFromReport.ts`, `parseCommercialBomFromReport.ts`, `parseProjectImportFile.ts` | `Parsed*` и view-типы colocated с парсером; при росте — вынести в `types/reportParsing.ts` |
| `types/recommendationsBlock.ts`, `types/waterHeaterMatching.ts` | Импорт `Parsed*` из `utils/parsers/` (cross-layer) |
| `types/hydraulics.ts`, `types/underfloorHeating.ts`, `types/hotWaterReport.ts` | **Эталон:** `Parsed*` в `types/`, парсеры импортируют оттуда |

Gate: `npm run verify:types-placement` (наличие исключений, SSOT `RoomExteriorLayout`, парсеры только в `utils/parsers/`).

Подробности `query/`, `surveySession/`, `hooks/` — [`frontend-calc-runner.md`](frontend-calc-runner.md), [`frontend-query-inventory.md`](frontend-query-inventory.md), [`survey-draft.md`](survey-draft.md).

### Соглашения именования и распределение ответственности

SSOT для Code Review: этот подраздел + § «Соглашения размещения frontend» выше.  
Calc-pipeline: [`frontend-calc-runner.md`](frontend-calc-runner.md). Язык UI vs payload enum: [`language-policy.md`](language-policy.md).

#### Распределение ответственности (frontend)

| Слой | Что делает | Что запрещено |
|------|------------|---------------|
| `components/` | UI, локальный state формы, colocated pure helpers | `fetch` / React Query; pipeline calc |
| `hooks/` | Композиция UI, парсинг отчёта для экрана | Прямой HTTP (→ `services/` или `query/`) |
| `query/` | React Query: cache, mutations, `useSurveyCalc` | DOM, JSX |
| `services/` | HTTP + parse ответа API (catalog, projects, calc, feedback) | React hooks, JSX |
| `surveySession/` | SurveyDraft, `dispatch`, pipeline, calc key | HTTP (→ `query/useSurveyCalc`) |
| `utils/` | Pure helpers, миграции, форматирование | React, HTTP |
| `utils/parsers/` | Parse calc report / SurveyDraft / import bundle | JSX |
| `types/` | Глобальные DTO и view-модели | Логика мутаций |
| `pages/` | Route-level страницы | Тяжёлая доменная логика (→ `components/` / `hooks/`) |
| `routing/` | Router, `paths`, `SurveyAppShell` | Бизнес-логика анкеты |

Корень `src/`: только entry/orchestrators — `main.tsx`, `App.tsx`, `AppRoot.tsx`, `StartAppRoot.tsx`, `SurveyAppRoot.tsx`, `AppSurveyContent.tsx`.

**Parse DTO каталога:** `services/parseCatalog*` и `services/catalogTypes.ts` — рядом с `GET /api/v1/catalog` (не `utils/parsers/`). Парсеры **отчёта calc** — только `utils/parsers/`.

#### Распределение ответственности (backend)

| Слой | Что делает | Cross-import |
|------|------------|--------------|
| `api/` | HTTP, AJV, rate limits | → domain barrels `*/public.js` |
| `logic/` | Расчётные формулы (теплопотери, ГВС, ТП) | через `ctx`, без global cache |
| `matching/` | Подбор оборудования | `public.js` |
| `report/` | Сборка JSON-отчёта, смета | `public.js` |
| `hydraulics/` | Pure Pipeline гидравлики | `public.js` |
| `reference/` | TTL bundle + `toCalcRuntimeContext` | `public.js` |
| `catalog/`, `dhw/`, `ufh/` | Load/validate справочников | `catalog/public.js` и internal |
| `models/` | Mongoose runtime | `public.js`; discriminators — только seed |
| `projects/` | CRUD, share, PDF | через `api/projectsRoutes.js` |
| `scripts/` | seed, verify, migrate | internal import напрямую |

#### Таблица именования

| Объект | Стиль | Пример | Примечание |
|--------|-------|--------|------------|
| Папка React-компонента | **PascalCase** | `BoilerReport/` | один UI-модуль = одна папка |
| Route page | **PascalCase** + суффикс `Page` | `ProjectsPage/ProjectsPage.tsx` | только `pages/` |
| Папка слоя frontend | **lowercase** | `hooks/`, `surveySession/`, `utils/parsers/` | |
| Hook | **camelCase**, префикс `use` | `useSurveyBootstrap.ts` | `hooks/`, `query/`, `auth/`, `surveySession/`, `shell/` |
| RQ query / mutation | `use` + Domain + `Query` / `Mutation` | `useMeQuery.ts`, `useProjectMutations.ts` | `query/queries/`, `query/mutations/` |
| Util / service module | **camelCase** | `roomExteriorLayout.ts`, `projectsApi.ts` | |
| Entry orchestrator (корень `src/`) | **PascalCase** `.tsx` | `SurveyAppRoot.tsx` | исключение: `main.tsx` |
| TypeScript type / interface | **PascalCase** | `RoomFormValue`, `CalcReportJson` | SSOT enum/union → `types/` |
| Константа (immutable config) | **SCREAMING_SNAKE** | `SURVEY_STEPS`, `RESULTS_SECTION_IDS` | `constants/` |
| CSS Module | **PascalCase** + `.module.css` | `BoilerReportView.module.css` | рядом с `.tsx` |
| Global CSS | **kebab-case** | `custom-media.css` | `styles/` |
| Backend domain folder | **lowercase** | `matching/`, `hydraulics/` | |
| Backend module file | **camelCase** | `buildReport.js`, `runCalculation.js` | |
| Mongoose model file | **PascalCase** | `IndirectWaterHeater.js`, `WaterNorms.js` | |
| Backend `.d.ts` bundle | **kebab-case** | `shared-types.d.ts`, `boiler-types.d.ts` | `backend/src/types/` |
| OpenAPI path segment | **kebab-case** | `/presets/underfloor-heating/modes` | `openapi.yaml` |
| OpenAPI schema file | **PascalCase** | `CalcInput.yaml`, `BoilerMatchingReport.yaml` | `components/schemas/` |
| Doc file | **kebab-case** | `room-exterior-layout.md` | `docs/` |
| Verify script | **camelCase** `verify*` | `verifyTypesPlacement.mjs` | `frontend/scripts/`, `backend/scripts/` |
| SPA path key (`paths.ts`) | **camelCase** | `signUp: '/sign-up'` | URL-сегменты — kebab-case |
| `shared/` module | **camelCase** | `roomTypeNormalization.js` | парные `.js` + `.d.ts` |
| JSON / API enum **value** | **контракт** | `corner`, `гостиная`, `wall_pps_50` | не переименовывать под UI; см. [`language-policy.md`](language-policy.md) |

##### Известный drift имён (не блокер)

| Область | Замечание |
|---------|-----------|
| ТП в UI | `WarmFloorSection`, `UnderfloorHeatingReport`, `UfhPresetCards` — разные аббревиации одного домена; новые модули — предпочитать `UnderfloorHeating*` или согласованный `Ufh*` |
| Формы шагов | `BoilerSurveyForm` vs `HotWaterForm` — исторический суффикс `SurveyForm` vs `Form`; новые формы — `*SurveyForm` если это шаг анкеты |

Gate colocation/types: `npm run verify:report-colocation`, `npm run verify:types-placement` (из `frontend/`).

---

## `docs/` — тематическая документация

| Документ | Тема |
|----------|------|
| [`type-safety.md`](type-safety.md) | Strict TS / checkJs / ESLint / CI |
| [`start-state.md`](start-state.md) | Start Screen, static LCP shell, bootstrap, exit, localStorage |
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
5. PDF → `projectsApi.downloadProjectPdf` / `downloadPublicSharePdf` → `backend/src/projects/renderEstimatePdf.js`.
6. Auth / tier UX → [`auth.md`](auth.md) · `/me` → `AccountBar` · Pro share contact → `buildPublisherPresentation.js`.
7. Перед merge → из корня `npm run verify` (см. [`type-safety.md`](type-safety.md)).
