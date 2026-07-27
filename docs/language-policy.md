# Політика мови сервісу (UA)

Єдиний стандарт user-facing текстів для рефакторингу «змішання мов RU/UA».
План виконання — пофазово (PR-1 … PR-6); цей документ — **SSOT правил** для всіх фаз.

Пов’язані документи: [`.cursorrules`](../.cursorrules), [`project-structure.md`](project-structure.md), [`room-exterior-layout.md`](room-exterior-layout.md).

---

## 1. Ціль

**100 % користувацьких текстів** сервісу — **українська мова**:

- UI анкети та звітів (label, placeholder, hint, button, aria)
- Підказки котла, ТП, гідравліки
- Backend-справочники (`recommendations.json`, `envelopePresets.js`, …)
- Повідомлення валідації, HTTP-помилки, PDF
- Inline warnings у `report.warnings[]`

**Стратегія перекладу:** прямa заміна RU → UA in-place. **Без** ключів локалізації та без i18n-фреймворку для другої мови.

---

## 2. Що перекладаємо

| Категорія | Приклади |
|-----------|----------|
| Label | `<label>`, `styles.label`, заголовки секцій |
| Placeholder | `placeholder="…"` |
| Hint / підказка | `<p className={styles.hint}>`, tooltip, `title` |
| Button / link text | текст між тегами кнопок |
| aria-label / aria-labelledby | доступність |
| Текст `<option>` | **лише текст між тегами**, не `value=` |
| Повідомлення валідації | `throw new Error('…')`, `return '…'` з validate-* |
| Backend display | `title`, `text`, `material`, `description` у JSON/JS data |
| PDF / print HTML | видимий користувачу текст |
| Toast / dialog | повідомлення в UI |

**Правило per-file:** у кожному зміненому файлі перекладаються **всі** user-facing рядки згідно з таблицею вище.

---

## 3. Що **не** перекладаємо

| Категорія | Приклади | Причина |
|-----------|----------|---------|
| Імена змінних, функцій | `roomLayout`, `ufhEnabled` | код |
| Ключі об’єктів / DTO | `roomId`, `floorPresetId`, `externalWall1` | контракт |
| Enum **values** (payload) | `'санузел'`, `'гостиная'`, `'facade'` | AJV / state |
| **Construction (calc input)** | `'наружная стена'`, `'стена в неотопливаемый коридор'` | API contract |
| Scheme keys | `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw` | enum key |
| Preset / recommendation **id** | `wall_gas_concrete_d500`, `WARN_BOILER_UNDERPOWERED` | ключі довідників |
| Recommendation **code** | `REC_*`, `WARN_*` | ключі в коді |
| Legacy compat values | `living`, `bathroom`, `жилое` | міграція чернеток |
| CSS class names | `styles.label` | код |
| Коментарі / JSDoc | `/** … */` | dev-only (поза scope ТЗ) |
| OpenAPI descriptions | yaml dev-docs | dev-only (поза scope ТЗ) |

---

## 4. Правило «payload vs display»

Одна й та сама фраза може з’являтися в **двох контекстах**:

| Контекст | `'наружная стена'` | Дія |
|----------|-------------------|-----|
| **Calc payload** (`envelopeElements[].construction`, `roomExteriorLayout.ts` → build) | значення enum | **Не змінювати** |
| **Display** (`envelopePresets.js` → `construction`, підпис `<option>`) | текст на екрані | **Перекласти** → `зовнішня стіна` |

Аналогічно для типів кімнат:

- `room.type = 'санузел'` — **value не змінювати**
- label у селекті «Санузел» → «Санітарний вузол» — **перекласти**

---

## 5. Whitelist (grep-аудит)

Наступні рядки **допустимі** після завершення ТЗ (не вважаються порушенням політики):

### 5.1 Типи приміщень (enum values)

Джерело: `shared/roomTypeNormalization.js` → `CANONICAL_ROOM_TYPES`

```
прихожая, тамбур, гостиная, коридор, спальня, кухня, санузел, тех, котельная, помещение
```

Legacy (compat): `жилое`, `living`, `bathroom`, `tech`, `kitchen`, `guest room`, …

### 5.2 Construction (calc input)

```
наружная стена
стена в неотопливаемый коридор
```

Джерело: `frontend/src/utils/roomExteriorLayout.ts`, `components/schemas/EnvelopeElementInput.yaml`.

### 5.3 Layout enum values

```
corner, facade, internal
```

### 5.4 Heating / DHW scheme keys

```
maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw
heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater
singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw
combiBoilerWithBufferElectricStorage
singleCircuitBoilerWithBufferElectricStorage
```

### 5.5 Thermal regime preset ids

```
traditional_high_dt70_95_85
traditional_dt50_75_65
condensing_dt30_55_45
```

### 5.6 Verify / test fixtures

Файли `backend/scripts/verify*.js`, `fuzz-calc.ts` — рядки payload для calc **залишаються** з whitelist construction/room types.

---

## 6. Джерела текстів (карта)

| Шар | Шлях | Мова зараз |
|-----|------|------------|
| Shell UI | `frontend/src/i18n/uk/*.ts` | **UA** ✓ |
| Анкета / звіти | `frontend/src/components/`, `constants/`, `utils/` | **UA** ✓ |
| Shared labels | `shared/heatingMatchingSchemes.js`, … | **UA** ✓ |
| Recommendations | `backend/data/recommendations.json` | **UA** ✓ |
| Envelope presets | `backend/src/logic/envelopePresets.js` | **UA** ✓ |
| UFH presets | `backend/data/underfloor_heating_presets.json` | **UA** ✓ |
| Inline backend | `validate.js`, `matching/*.js`, PDF builders | **UA** ✓ |
| Products (каталог) | `backend/test_data.json.example` → Mongo `products` | **UA** ✓ |

Після PR-1 … PR-6 усі рядки з таблиці — **UA** (див. §17–§19).

**Автоперевірка:** `npm run verify:language-policy` (корінь репо); `npm run verify:catalog-language` (backend / `products`).

---

## 7. Чеклист на кожен файл (обов’язковий)

Перед commit у PR:

- [ ] Усі label / placeholder / hint / button / aria — UA
- [ ] Тексти `<option>` (між тегами) — UA; `value=` — без змін
- [ ] Повідомлення валідації — UA
- [ ] Enum strings у payload (`'санузел'`, `'наружная стена'`) — **без diff**
- [ ] Імена змінних, ключі DTO — **без diff**
- [ ] `npm run verify` — green (на рівні PR або перед merge)

---

## 8. Автоперевірка мови

Єдиний gate user-facing RU поза whitelist §5 — **без ripgrep** (`rg`), лише Node.js:

```bash
npm run verify:language-policy
```

**Очікування:** `verifyLanguagePolicy: OK`, exit 0 (`echo $?` у Bash).

Скрипт: [`scripts/verifyLanguagePolicy.mjs`](../scripts/verifyLanguagePolicy.mjs). Входить у корневий `npm run verify`.

**Що перевіряє:** `frontend/src`, `shared`, `backend/src` — user-facing RU-маркери в рядках з літералами; whitelist §5 (enum payload, construction) — виключення; dev-throw validators/catalog — поза scope §3.

Після завершення ТЗ: **0** user-facing RU поза whitelist §5.

---

## 9. Фази виконання (коротко)

| Фаза | PR | Зміст |
|------|-----|-------|
| **0** | — | Baseline, цей документ, whitelist |
| 1 | PR-1 | `recommendations.json`, `envelopePresets.js`, UFH/warmFloor data | **✅ 2026-07-27** |
| 2 | PR-2 | shared labels, frontend constants/utils | **✅ 2026-07-27** |
| 3 | PR-3 | форми анкети | **✅ 2026-07-27** |
| 4 | PR-4 | звіти, print, share | **✅ 2026-07-27** |
| 5 | PR-5 | backend inline, PDF | **✅ 2026-07-27** |
| 6–7 | PR-6 | dead code, grep-аудит, оновлення domain docs, `.cursorrules` | **✅ 2026-07-27** |
| **CAT** | PR-CAT | `test_data.json.example` (products), `verify:catalog-language` | **✅ 2026-07-27** |

> **Примітка:** нумерація PR-1…PR-6 стосується **лише** цього ТЗ (українізація).
> Окремий roadmap auth ([`docs/auth.md`](auth.md)) має власні PR-7 (Clerk SDK), PR-8 тощо — **не плутати**.

---

## 10. Baseline (Фаза 0)

Зафіксовано при старті робіт:

| Перевірка | Результат | Дата |
|-----------|-----------|------|
| `git status` | clean (гілка `main`) | 2026-07-27 |
| `npm run verify` (root) | **exit 0**, green | 2026-07-27 |
| `recommendations.json` — RU-маркери | ~35 записів із змішанням | baseline |
| `envelopePresets.js` — RU display | ~43 входження `ё`/типових слів | baseline |
| `frontend/src` — файли з `ё` | ~100+ файлів (частина — вже UA shell) | baseline |
| Shell UI (`i18n/uk/*`) | вже UA | — |

Після PR-6 baseline-метрики замінено на «0 RU user-facing (whitelist)» — див. §17.

---

## 12. Фаза 1 / PR-1 (2026-07-27)

**Перекладено backend data (прямий UA-текст, ключі без змін):**

| Файл | Зміни |
|------|--------|
| `backend/data/recommendations.json` | 35 RU-записів → UA; 3 записи вже були UA |
| `backend/src/logic/envelopePresets.js` | 47 пресетів: `construction`, `material`, `description` → UA |
| `backend/data/underfloor_heating_presets.json` | `ui.title`, `ui.badge`, `ui.description` → UA |
| `backend/src/data/warmFloorAssemblyPresets.js` | `name`, `description`, layer `name` → UA |
| `backend/src/recommendations/recommendationResolver.js` | fallback повідомлення → UA |

**Не змінювалось:** `code`, `id`, enum calc payload (`наружная стена` у verify/input), коментарі в коді.

**Після seed:** оновити Mongo (`npm run seed` у `backend/`) або дочекатися TTL `REFERENCE_CACHE_TTL_MS`.

**Перевірки PR-1:** `npm run verify`, `verify:ufh-presets`, `verify:ufh-active-area`, завантаження recommendations з файлу, grep RU у data-файлах PR-1 (0 user-facing RU).

**Verify-скрипти (синхронізація з UA resolutionSteps):** `verifyUfhPresets.js`, `verifyUfhActiveArea.js` — очікувані `title` resolutionSteps оновлено на UA.

---

## 13. Фаза 2 / PR-2 (2026-07-27)

**Перекладено shared labels і frontend constants/utils (прямий UA-текст, enum keys/values calc payload без змін):**

| Шар | Файли |
|-----|--------|
| **shared/** | `heatingMatchingSchemes.js`, `heatingThermalRegimePresets.js`, `heatingThermalRegimeRecommendations.js`, `radiatorConnection.js`, `radiatorEmitterPreference.js` |
| **frontend/constants/** | `surveySteps.ts`, `roomTypes.ts` (лише display labels) |
| **frontend/utils/** | `boilerUiLabels.ts`, `wiringSystemTypeLabels.ts`, `roomExteriorLayout.ts` (UI label/hint/placeholder; `construction` payload — whitelist), `externalWallsSummary.ts`, `hotWaterEquipmentParticipation.ts`, `validateWaterHeaterForm.ts`, `ufhWarningDisplay.ts` (fallback steps + regex RU/UA), `manifoldApplicationLabel.ts` |
| **frontend/data/** | `fallbackEnvelopePresets.ts`, `fallbackUfhModePresets.ts` |

**Не змінювалось:** scheme enum keys, `room.type` values, `INTERNAL_CORRIDOR_WALL_CONSTRUCTION`, `'наружная стена'` у calc payload, коментарі/JSDoc.

**Перевірки PR-2:** `npm run verify`, grep RU user-facing у файлах PR-2 (0 поза regex-compat і коментарями).

---

## 14. Фаза 3 / PR-3 (2026-07-27)

**Перекладено форми анкети та оркестратор (прямий UA-текст, enum keys/values calc payload без змін):**

| Шар | Файли |
|-----|--------|
| **shared/** | `ufhDistributionPresets.js` (UI labels select ТП) |
| **frontend/components/** | `RoomAccordionItem.tsx`, `RoomsForm.tsx`, `ObjectMetaForm.tsx`, `HotWaterForm.tsx`, `BoilerSurveyForm.tsx`, `RadiatorsSurveyForm.tsx`, `WaterHeaterForm.tsx`, `WarmFloorSection.tsx`, `UfhDistributionSelect.tsx`, `UfhPresetCards.tsx`, `HydraulicsSection.tsx` |
| **frontend/** | `AppSurveyContent.tsx` (globalMeta hints, temp labels, `radiatorsDisabledReason`, `aria-label` навігації) |
| **verify** | `frontend/scripts/verifySurveySessionPipeline.mjs` — очікувані UA-підписи розводки (`Тип розводки системи опалення`, `Рекомендовано`) |

**Не змінювалось:** `room.type` values (`'санузел'`, `'помещение'`), `construction` payload, enum keys calc, коментарі/JSDoc/CSS-коментарі.

**Перевірки PR-3:** `npm run verify` — exit 0; grep RU user-facing у JSX форм PR-3 — 0 (звітні *Report* / *Summary* — Фаза 4).

---

## 15. Фаза 4 / PR-4 (2026-07-27)

**Перекладено звіти, sidebar «Результати», print/share (прямий UA-текст, enum keys/values calc payload без змін):**

| Шар | Файли |
|-----|--------|
| **frontend/components/** | `RecommendationsBlock`, `HeatLossReport/HeatLossSummaryTable`, `BoilerReport/*`, `BoilerProposalCard`, `RadiatorsReport/*`, `RadiatorProposalLineTable`, `HotWaterReport/*`, `HydraulicsReport/*`, `HydraulicsProposal/HydraulicsPumpCard`, `UnderfloorHeatingReport/*`, `WaterHeaterReport/*`, `WaterHeaterProposalCard`, `WaterHeaterMatchingPreview`, `FinancialSummary/FinancialSummaryTable`, `ProjectsDialog`, `SharePresentationPage`, `ShareLinkToast`, `BootstrapErrorScreen`, `AppErrorBoundary`, `CatalogEquipmentReference` |
| **frontend/utils/** | `buildTechnicalPrintHtml.ts` (PDF/HTML техрозрахунку), `surveyShare.ts` (текстова сводка export/share), `parseRadiatorsMatchingFromReport.ts` (emitters summary labels), `ufhHydraulicsPumps.ts` (`ufhPumpSummaryLabel`) |

**Не змінювалось:** `ReportBugModal` (i18n `modalsUk`), динамічні тексти з API (`warnings`, `unavailableReason`, `equipmentTypeLabel`), коментарі/JSDoc, backend PDF (`buildTechnicalPdfHtml.js` — Фаза 5).

**Перевірки PR-4:** `npm run verify` — exit 0; grep RU user-facing у JSX/print/share PR-4 — 0 поза коментарями та API-driven рядками.

---

## 16. Фаза 5 / PR-5 (2026-07-27)

**Перекладено backend inline, PDF та HTTP-помилки (прямий UA-текст, enum keys/values calc payload без змін):**

| Шар | Файли |
|-----|--------|
| **PDF** | `buildTechnicalPdfHtml.js`, `buildEstimatePdfHtml.js`, `pdfFilename.js`, `renderPdfFromHtml.js` |
| **validate / logic** | `validate.js`, `externalWallsValidate.js`, `envelopeHeatLoss.js`, `roomExteriorLayoutHeatLoss.js`, `apartmentStackBoundaries.js`, `heatlossByRooms.js`, `heatingThermalRegimes.js`, `ventilationReserve.js`, `warmFloorCalc.js`, `ufhMixingNodeHydraulics.js`, `ufhLoopHydraulics.js`, `ufhRoomHeatFlux.js` |
| **matching/** | `boiler.js`, `index.js`, `manifold.js`, `unibox.js`, `radiators.js`, `warmFloor.js`, `waterHeater.js`, `indirectWaterHeater.js`, `indirectPriorityRoomHint.js`, `internal/*` (pickRadiatorsCore, sizeForcedRoomEmitter, exploreRoomEmitterKind, resolveMicroLoadRadiatorStrategy, decideObjectEmitterKind, resolveMixedRadiatorRoomLoad, radiatorConnectionNotes) |
| **report/** | `buildReport.js`, `buildFinancialBom.js`, `automationHints.js` |
| **hydraulics/** | `buildGraph.js`, `buildHydraulicsProposal.js`, `resolveCirculationFlows.js`, `resolveSystemPumps.js`, `pickPump.js`, `pickPipe.js`, `runHydraulicsPipeline.js`, `circulationLoops.js`, `groupRadiatorGraphBranches.js`, `buildRadiatorSubgraph.js`, `crossValidatePipelineInput.js` |
| **utils/** | `boilerMatchingByType.js`, `apartmentCombiSerialBufferHint.js` |
| **API / auth / climate** | `index.js`, `projectsRoutes.js`, `routes.js`, `adminRoutes.js`, `publicSharesRoutes.js`, `rateLimiters.js`, `meRoutes.js`, `requireAuth.js`, `requireRole.js`, `validateAdminUserPatch.js`, `systemRoutes.js`, `authErrors.js`, `authorizationPolicy.js`, `geocode.js`, `snipClimate.js` |
| **projects/** | `buildShareSnapshot.js`, `projectAccess.js`, `validateProjectBody.js`, `resolveProjectCalcInput.js`, `requireMongo.js`, `documentSizeLimits.js` |
| **feedback** | `validateFeedbackBody.js` |
| **catalog** | `loadCatalog.js` (user-facing throw messages) |
| **verify sync** | `verifyUfhPresets.js`, `verifyRadiatorSections.js`, `verifyMixedRadiatorUfh.js`, `verifyProjectPdf.js`, `verifyFinancialBom.js`, `verifyManifoldMatching.js`, `verifyUniboxMatching.js` |

**Не змінювалось:** JSDoc/коментарі, enum calc payload (`котельная`, `наружная стена`, `room.type`), dev-throw у validators/catalog, OpenAPI descriptions.

**Перевірки PR-5:** `npm run verify` — exit 0; user-facing RU у backend/src — 0 поза whitelist §5 та JSDoc.

---

## 11. Definition of Done (весь ТЗ)

- [x] 100 % user-facing текст — українська
- [x] Enum values calc payload — не змінені (whitelist §5)
- [x] `npm run verify` — green
- [x] `npm run verify:language-policy` — green (§8)
- [ ] Smoke E2E UI (11 кроків анкети, PDF, share, 400) — **ручний чеклист** (див. §18)
- [x] `npm run verify:language-policy` — green (gate після post-close fix)
- [x] `.cursorrules` оновлено (посилання на цей документ)
- [x] Domain docs оновлено (boiler, radiators, ufh, hydraulics, …)

---

## 17. Фаза 6 / PR-6 (2026-07-27)

**Фіналізація: grep-аудит, dead code, docs (прямий UA-текст, enum keys/values calc payload без змін):**

| Шар | Файли / дії |
|-----|-------------|
| **frontend services/hooks/query** | `calc.ts`, `catalog.ts`, `projectsApi.ts`, `parsePublicShare.ts`, `publicShareApi.ts`, `ufhModePresets.ts`, `useSurveyCalc.ts`, `useProjectCalculationsQuery.ts`, `useProjectMutations.ts`, `useUfhModePresetsQuery.ts`, `useSurveyProject.ts`, `migrateSurveyDraft.ts`, `main.tsx` |
| **frontend UI (залишки)** | `DevPanel.tsx`, `Spinner.tsx`, `AppBootstrapSkeleton.tsx` |
| **dead code** | `ufhWarningDisplay.ts` — regex-класифікація WARN лише UA (після PR-1…5 API); прибрано RU-гілки compat |
| **backend залишки** | `warmFloorCalc.js`, `index.js` (stderr) |
| **docs** | `language-policy.md`, `boiler-survey-report.md`, `radiators-survey-report.md`, `hydraulics-survey-report.md`, `.cursorrules` |

**Не змінювалось:** JSDoc/коментарі, enum calc payload, dev-throw validators/catalog, OpenAPI descriptions, verify-fixtures payload (whitelist §5.6).

**Перевірки PR-6:** `npm run verify` — exit 0; `verify:language-policy` (§8) — green.

**Baseline після PR-6:** user-facing RU поза whitelist §5 — **0** (JSDoc/dev-throw — поза scope).

---

## 18. Post-close fix (2026-07-27)

Закриття оговорок після аудиту PR-6 (grep + ручна перевірка):

| Файл | Зміна |
|------|--------|
| `frontend/src/utils/parseHydraulicsProposalFromReport.ts` | UA fallback labels контурів (`Контур опалення (радіатори)`, `Контур теплої підлоги`); SSOT API — `buildHydraulicsProposal.js` |
| `shared/ufhCircuitPresets.js` | UA labels пресетів контуру ТП |
| `frontend/src/constants/roomTypes.ts` | UA dev-throw `неканонічний type` |
| `backend/src/logic/normalizeHeatingUfhPreset.js` | UA `_normalizationWarnings` для режиму ТП |
| `scripts/verifyLanguagePolicy.mjs` | автоматичний grep-gate (`npm run verify:language-policy`) |

**Перевірки post-close:** `npm run verify` — exit 0; `npm run verify:language-policy` — exit 0.

### Ручний Smoke E2E UI (чеклист)

Автоматичний `npm run verify` не покриває повний UI-прогон. Перед релізом:

- [ ] 11 кроків анкети — label / hint / button на UA
- [ ] Автопересчёт / «Помилка розрахунку» при недоступному backend
- [ ] Блок «Рекомендація» — гідравліка: «Контур опалення / теплої підлоги»
- [ ] PDF завантажується, текст UA
- [ ] Share link публікується
- [ ] POST `{}` → 400 з UA-повідомленнями (якщо backend віддає)

### Операційний крок (Mongo production)

Якщо `CATALOG_SOURCE=mongo`: після PR-1 потрібен `npm run seed` у `backend/` або TTL `REFERENCE_CACHE_TTL_MS` / `POST /api/v1/system/invalidate-reference-cache` — інакше в БД можуть лишитися старі RU-тексти recommendations/presets, хоча JSON-файли вже UA.

---

## 19. Фаза catalog / PR-CAT (2026-07-27)

**Перекладено user-facing display-поля номенклатури `products` (прямий UA-текст; `id`, `model`, `brand`, enum keys без змін):**

| Шар | Поля / файли |
|-----|----------------|
| **Котли** | `fuel`, `connectionDiameters`, `positioning`, `circulationPump.operatingModes[].modeName` |
| **Радіатори** | `description`, `material` (`Алюміній`, `Біметал`) |
| **Труби** | `material`, `category` |
| **Насоси** | `operatingModes[].modeName` (`Швидкість N`) |
| **Колектори** | `model` (`Колектор …`), `material` |
| **Еталон** | `backend/test_data.json.example` |
| **Verify sync** | `verifyCatalogLanguage.js`, `verifyFinancialBom.js`, `verifyBuiltinBoilerPump.js` |

**Не змінювалось:** `appliances.json` (методика; `label` — dev/metadata), `model`/`brand` латиницею, технічні ключі JSON, `tags` (enum EN).

**Gate:** `npm run verify:catalog-language` (backend; входить у `npm run verify`).

**Після seed:** `npm run seed` + invalidate cache — щоб Mongo `products` відповідав etalon JSON.
