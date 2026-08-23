# R1 — Инвентаризация расчётного ядра и движка подбора

> Все утверждения о коде — с якорем `file:line`. Что проверить не удалось — в разделе 6 «НЕ ПРОВЕРЕНО».
> Прогонов кода не было (`node_modules` не установлены) — выводы построены на чтении исходников.

## Резюме

Расчётное ядро — **97 исходных модулей** в зоне задания (`logic/` 30, `matching/` 23, `hydraulics/` 26,
`report/` 4, `dhw/` 7, `climate/` 3, `ufh/` 3, `recommendations/` 4) плюс 14 `shared/*.js` и 5 критичных
`utils/*.js` (`boilerMatchingByType`, `boilerMountingConstraints`, `apartmentMatching`,
`apartmentCombiSerialBufferHint`, `math`), которые формально вне списка каталогов, но содержат ключевые
пороги подбора котла. Всего ~19 200 строк расчётной логики.

Зафиксировано **173 порога и ветвления решений** (раздел 2). Из них ~60 вынесены в справочники
(`backend/data/appliances.json`, `water_norms.json`) и меняются без деплоя — это отдельный класс риска:
изменение одной цифры в Mongo переписывает подбор для всех пользователей, и ни один verify-скрипт не
сравнивает справочник с эталоном подбора. Остальные ~110 захардкожены в коде, в том числе такие
«магические» веса, как бренд-бонусы радиаторов (`pickRadiatorsCore.js:148-170`), scoring-функции выбора
прибора (`sizeForcedRoomEmitter.js:341-360`) и scoring конфигурации петель ТП
(`ufhLoopHydraulics.js:207-223`).

Реальный уровень покрытия: **52 backend verify-скрипта в `npm run verify`** (+ 3 вне прогона) и
12 frontend. Из них расчётное ядро реально трогают 20. По импортам (раздел 3) **ни один verify-скрипт не
импортирует** `matching/boiler.js`, `dhw/waterCalc.js`, `climate/*`, `report/automationHints.js`,
`hydraulics/pressureDrop.js`, `hydraulics/circulationLoops.js`, `hydraulics/buildHydraulicsProposal.js`,
`logic/envelopeHeatLoss.js`, `logic/wallAssembly.js`, `logic/ufhPipeSpacingResolve.js` и ещё ~25 модулей.
Подбор котла — ядро продукта — покрыт только косвенно, через `verifyRadiatorSections.js` и
`verifyHydraulicsPipeline.js`, где он вызывается как шаг пайплайна, а его результат не ассертится
ни по одному числу.

Честный вердикт: **сильное точечное покрытие у 4 модулей** (`unibox.js`, `manifold.js`,
`buildFinancialBom.js`, `pickPump.js` — настоящие табличные unit-тесты с числовыми ожиданиями),
**иллюзия покрытия у гидравлического пайплайна** (`verifyHydraulicsPipeline.js` — 6 фикстур, проверяющих
структурные инварианты «поле не пустое / Σ сходится / Ø ≥ guard», без единого эталонного числа Δp, H или
подобранного SKU) и **нулевое покрытие физики ГВС, подбора котла и климата**.

---

## 1. Инвентарь модулей

Условные обозначения чистоты:
- **P** — чистая функция (детерминированная, без I/O, без глобального состояния);
- **P+log** — чистая по данным, но пишет в `logger` (сайд-эффект только наблюдаемый);
- **M** — мутирует переданный объект на месте;
- **IO** — сеть/файлы/БД;
- **T** — зависимость от `new Date()` / `Math.random()`.

### logic/ — физика теплопотерь и тёплого пола

| Модуль | Назначение | Экспорт (сигнатура) | Чистота | ctx / каталог |
|---|---|---|---|---|
| `heatlossByRooms.js` (301) | теплопотери здания по комнатам | `calculateHeatLossForBuilding({temps, building}) → HeatLossReport` | P+log | нет ctx, нет каталога |
| `envelopeHeatLoss.js` (133) | Q = U·S·ΔT·k по элементам | `calculateHeatLoss(HeatLossCalcInput) → HeatLossCalcResult` | P | нет |
| `envelopePresets.js` (429) | справочник U/λ ограждений (данные) | `ENVELOPE_PRESETS`, `getEnvelopePresetById(id)` | P | нет |
| `orientationHeatLoss.js` (50) | β по сторонам света | `ORIENTATION_BETA`, `ORIENTATION_KINDS`, `heatLossFactorForEnvelopeKind(kind, orientation)` | P | нет |
| `roomExteriorLayoutHeatLoss.js` (219) | угловая комната, стена в корид., инференс layout | `countExteriorWallsForRoom`, `inferRoomExteriorLayoutFromWallCounts`, `resolveRoomExteriorLayout`, `resolveElementDeltaT`, `resolveElementUValue`, `resolveElementHeatLossFactors`, `assertRoomExteriorLayoutWalls`, `normalizeRoomExteriorLayouts` | P / **M** (`normalizeRoomExteriorLayouts:213-218` пишет в `room`) | нет |
| `topBoundaryEnvelope.js` (50) | фильтр элементов по границам комнаты | `envelopeKindIncludedForHeatLoss({topBoundary,bottomBoundary,kind}) → boolean` | P | нет |
| `ventilationReserve.js` (41) | kVent | `normalizeVentilationReserveMode`, `resolveKVent`, `ventilationReserveModeLabel` | P | нет |
| `wallAssembly.js` (142) | U многослойной стены | `resolveExternalWallUValue(externalWalls, presetIdOverride?) → number` (throws), `FACADE_SYSTEMS`, `WALL_SURFACE_R`, `INSULATION_THICKNESS_BOUNDS`, `isMineralWoolInsulationPresetId`, `isSftkInsulationPresetId` | P | нет |
| `externalWallsValidate.js` (142) | валидация/нормализация externalWalls | `assertExternalWalls(building)` (throws 400) | **M** (`:44,54-55,83`) | нет |
| `apartmentStackBoundaries.js` (91) | границы комнат квартиры в стояке | `normalizeApartmentStackPosition`, `resolveApartmentRoomBoundaries`, `defaultHouseBottomBoundary`, `warnApartmentCeilingPresetMismatch` | P | нет |
| `heatingThermalRegimes.js` (175) | температурный график | `isHeatingThermalRegimePresetId`, `normalizeHeatingSystemThermalRegime(body)`, `isHighTemperatureHeatingGraph(hs)`, `applyThermalRegimePresetToHeatingSystem(hs,id)`, `alignHeatingGraphForCondensingBoiler(hs, boiler) → string\|null` | **M** (`:54,72-88,146-149`) | каталожный `selectedBoiler` |
| `normalizeHeatingUfhPreset.js` (102) | нормализация `ufhPresetId` / режима | `normalizeHeatingUfhPreset(body, ufhPresets)`, `appendThermalRegimeSchemeWarnings(body)` | **M** | `ctx.ufhPresets` |
| `normalizeUnderfloorDistribution.js` (26) | дефолт схемы распределения ТП | `normalizeUnderfloorDistributionPreset(body)` | **M** | нет |
| `warmFloorCalc.js` (397) | оркестратор расчёта ТП по комнатам | `calculateUnderfloorHeating({temps,building,heatingSystem,heatLoss,ufhPresets,maxUfhLoopLengthM,ufhLoopLengthLayoutFactor}) → UnderfloorHeatingReport\|null` | P (throws 400 `UFH_PRESET_INVALID`) | `ufhPresets` + `appliances.hydraulics` |
| `ufhRoomHeatFlux.js` (226) | физика q↑/q↓/Tповерх | `computeUfhRoomHeatFlux(args) → UfhRoomHeatFluxComputed`, `R_CONV_*` | P | нет |
| `ufhPipeEmbedment.js` (42) | R внедрения трубы по шагу | `R_PIPE_EMBEDMENT_BY_STEP_MM`, `ALLOWED_PIPE_SPACING_MM`, `DEFAULT_PIPE_SPACING_MM`, `isAllowedPipeSpacingMm`, `resolvePipeEmbedmentResistanceM2KW` | P | нет |
| `ufhPipeSpacingResolve.js` (94) | авто-подбор шага 100/150/200 | `resolveUfhPipeSpacingMm(args) → {requested, resolved, pipeSpacingResolution}` | P | нет |
| `ufhRequiredHeatFlux.js` (22) | q_треб = Q/S_акт | `computeUfhRequiredHeatFluxUpWm2(args) → number\|null` | P | нет |
| `ufhActiveFloorArea.js` (37) | S_акт с вычетом мебели | `resolveUfhActiveFloorAreaM2(args)` | P | нет |
| `ufhRoomCoverageCheck.js` (68) | статусы покрытия | `assessUfhRoomHeatLossCoverage`, `assessUfhActiveAreaHeatFlux`, `resolveRoomDesignHeatLossWatts` | P | нет |
| `ufhCircuitResolve.js` (21) | пресет графика контура по финишу | `resolveUfhCircuitForFinish(finishMaterialId)` | P | нет |
| `ufhMixingNode.js` (30) | нужен ли смеситель | `isMixingNodeRequired`, `isMixingNodeRequiredForProject` | P | нет |
| `ufhMixingNodeHydraulics.js` (61) | Q/H/Kvs узла смешения | `computeUfhMixingNodeSpec(args) → UfhMixingNodeSpec` | P | `appliances.underfloor_heating.mixingNode` |
| `ufhDistributionResolve.js` (30) | авто-схема распределения | `ufhDistributionAutoRulesFromAppliances`, `resolveUfhDistributionWithAppliances` | P | `appliances` |
| `ufhHydraulicsCircuit.js` (23) | расход контура ТП | `computeUnderfloorHydraulicsCircuit(args)` | P | нет |
| `ufhLoopGeometry.js` (89) | число и длина петель | `computeUfhLoopGeometry(args)` | P | нет |
| `ufhLoopLength.js` (46) | SSOT длины укладки | `ufhPipeMetersPerSqM`, `computeUfhLoopTotalLengthM`, `UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT` | P | нет |
| `ufhLoopHydraulics.js` (1002) | гидравлика петель + автооптимизация | `estimateUfhLoopElbowCount`, `ufhLoopHydraulicsThresholds`, `shouldTriggerUfhPipeResize`, `validateUfhLoopHydraulics`, `resolveUfhRoomLoopsHydraulics`, `applyUfhLoopHydraulicsRecommendations`, `enrichUnderfloorHeatingLoopHydraulics` | P + **M** (`enrich…:963-1001` мутирует `underfloorHeating.rooms`) | `catalog.pipes` + `appliances.hydraulics` + `recommendations` |

**Важно:** `warmFloorCalc.js:209` и `:363` передают `deltaTK: 10` **хардкодом**, минуя
`appliances.hydraulics.ufhLoopDeltaTK`; `ufhLoopHydraulics.js:434` тот же Δt читает из справочника.
Расхождение справочника с кодом останется незамеченным.

### matching/ — движок подбора

| Модуль | Назначение | Экспорт | Чистота | ctx / каталог |
|---|---|---|---|---|
| `index.js` (314) | оркестрация подбора | `matchEquipment({heatLoss,hotWater,heatingSystem,building,underfloorHeating,hydraulics,ctx}) → {matching, hotWaterForCalculations}` | **M** (`:174-177` удаляет `_normalizationWarnings`; `:213,223` `unshift` в warnings) + log | **ctx обязателен** (`assertCalcRuntimeContext:94`) |
| `boiler.js` (1164) | подбор котла + линии economy/efficient | `pickBoiler({…, ctx}) → BoilerMatchingReport` | P+log | **ctx** (catalog, appliances, recommendations) |
| `radiators.js` (224) | primary + линии economy/efficient | `pickRadiatorsWithProposalLines(args) → RadiatorsMatchingReport` | P (клонирует `heatingSystem` через `structuredClone:22`) | catalog, appliances.radiator, recommendations |
| `internal/pickRadiatorsCore.js` (949) | Two-Pass ядро подбора | `pickRadiators(args) → RadiatorsMatchingReport` | P+log | catalog, radiatorRules, recommendations |
| `internal/exploreRoomEmitterKind.js` (268) | Pass 1 — голос комнаты | `exploreRoomEmitterKindVote`, `sizeSectionalThermal`, `applyWindowWidthRulesSectional`, `sortSectionalByEscalationPower` | P | catalog-пулы |
| `internal/decideObjectEmitterKind.js` (126) | глобальное решение kind | `decideObjectEmitterKind(args) → EmitterKindDecision` | P | нет |
| `internal/sizeForcedRoomEmitter.js` (480) | Pass 2 — sizing с эскалацией | `sizeForcedRoomEmitter`, `pickMinimumViableForcedKind` | P + **M** (`:202-207` дописывает в `chosen.sizingNotes`) | catalog-пулы |
| `internal/resolveMicroLoadRadiatorStrategy.js` (66) | микронагрузка «Тамбур» | `resolveMicroLoadRadiatorStrategy(args)` | P | `radiatorRules.microLoad` |
| `internal/resolveMixedRadiatorRoomLoad.js` (84) | вычет отдачи ТП | `buildUfhHeatFluxUpWattsByRoomId`, `resolveMixedRadiatorRoomLoad` | P | нет |
| `internal/mixedRadiatorsUfhMode.js` (26) | определение mixed-режима | `isMixedRadiatorsUfhHeatingMode` | P | нет |
| `internal/summarizeRadiatorEmitters.js` (132) | агрегат приборов, diff линий | `emptyRadiatorsEmittersSummary`, `summarizeRadiatorEmitters`, `buildRadiatorRoomEmitterDiffs` | P | нет |
| `internal/radiatorConnectionNotes.js` (23) | notes по подводке | `buildRadiatorConnectionSelectionNotes` | P | нет |
| `radiatorSizingHelpers.js` (215) | панель/секция, ΔT-пересчёт, окно | `isPanelRadiator`, `isSectionalRadiator`, `parsePanelLengthMm`, `parsePanelHeightMm`, `inferPanelConnection`, `filterPanelsByConnection`, `adjustOutputWatts`, `adjustedRadiatorWatts`, `pickPanelSkuForRoom`, `underwindowHeightWarning` | P | catalog |
| `waterHeater.js` (126) | электронакопитель | `pickWaterHeater({hotWater, catalog})` | P+log | catalog |
| `indirectWaterHeater.js` (272) | БКН + связка с котлом | `applyIndirectTankToHotWaterReport`, `pickIndirectWaterHeater`, `attachIndirectBoilerCoupling` | `attachIndirectBoilerCoupling` — **M** (мутирует `indirectReport`) | catalog, waterNorms, appliances, recommendations |
| `internal/indirectCatalogHelpers.js` (39) | аксессоры specs БКН | `indirectTankVolumeLiters`, `indirectCoilPowerKw`, `indirectMinSourcePowerKw` | P | catalog |
| `indirectPriorityRoomHint.js` (34) | hint про остывание комнаты | `appendIndirectPriorityRoomWarnings` | **M** | нет |
| `manifold.js` (561) | коллекторы ТП / радиаторы / котельные | `splitOutletsForCascade`, `pickDistributionManifold`, `pickBoilerManifold`, `pickManifoldsCore`, `pickManifolds`, `pickManifoldsWithCore`, `buildEmptyManifoldsFailure`, `buildOkManifoldsReport`, `UFH_MANIFOLD_MAX_OUTLETS_PER_NODE` | P+log, soft-fail (никогда не бросает наружу, `:559-561`) | catalog |
| `unibox.js` (507) | унибоксы по петлям ТП | `minKvM3hForFlowLph`, `uniboxFitsDemand`, `validateUniboxLoopDemand`, `pickUniboxForDemand`, `collectUniboxLoopDemands`, `hasUnderfloorManifoldCascade`, `pickUniboxes`, константы | P+log | catalog |
| `internal/uniboxRoomAirPresets.js` (82) | адаптер T воздуха | `resolveUniboxRoomAirTempC`, `UNIBOX_ROOM_AIR_TEMP_PRESETS_C`, … | P | нет |
| `enrichProposalBundlePrice.js` (235) | цены bundle для proposal-линий | `enrichBoilerMatchingProposals` | **M** | catalog |
| `warmFloor.js` (387) | notes + структурированные WARN/REC ТП | `buildWarmFloorMatchingNotes`, `buildWarmFloorCalcMatchingNotes`, `applyUnderfloorHeatingRecommendations`, `applyUnderfloorMixingDistributionRecommendations` | **M** (дописывает в `report.warnings`, `room.warnings`) | recommendations |
| `public.js` (11) | barrel | `matchEquipment`, `pickManifolds`, `pickUniboxes`, `buildEmptyManifoldsFailure`, `buildOkManifoldsReport` | — | — |

### hydraulics/ — Pure Pipeline

| Модуль | Назначение | Экспорт | Чистота | ctx / каталог |
|---|---|---|---|---|
| `buildSnapshots.js` (369) | сборка `HydraulicsPipelineInput` из отчёта | `buildHydraulicsSnapshots({input,hotWater,underfloorHeating,matching,hydraulicsRules})` | P | `appliances.hydraulics` |
| `validatePipelineInput.js` (53) | AJV + cross-validation DTO | `validateHydraulicsPipelineInput(dto)` (async), `resetHydraulicsPipelineValidatorForTests` | **IO** (читает YAML) + **модульный кэш** `validateFn:16` | components/schemas |
| `pipelineSchemaLoader.js` (28) | загрузка YAML-схемы | `loadHydraulicsPipelineSchemaForAjv()` | **IO** + кэш `cachedSchema:13` | — |
| `crossValidatePipelineInput.js` (111) | согласованность режимов и Q | `crossValidateHydraulicsPipelineInput(dto)` (throws 400) | P | нет |
| `runHydraulicsPipeline.js` (156) | оркестратор | `runHydraulicsPipeline({dto, catalog})` | P | catalog |
| `buildGraph.js` (292) | топологический граф | `buildHydraulicsGraph(dto)` | P | нет |
| `buildRadiatorSubgraph.js` (286) | 4 топологии радиаторов | `buildRadiatorSubgraph(ctx)` | P (через колбэки push) | нет |
| `groupRadiatorGraphBranches.js` (86) | микроветки → коллектор | `partitionRadiatorConsumersForGraph`, `buildMicroManifoldLabel`, `resolveMicroManifoldEdgeLength`, `sumMicroConsumersFlowM3h`, `RAD_MICRO_MANIFOLD_NODE_ID` | P | нет |
| `radiatorGraphHelpers.js` (97) | порядок consumers, длины | `radiatorTrunkJunctionNodeId`, `radiatorConsumerNodeId`, `orderRadiatorConsumers`, `splitMainLineIntoTrunkSegments`, `resolveBranchLengthM`, `radiatorThermalRegime`, `sumConsumerFlowsFromIndex` | P | нет |
| `resolveCirculationFlows.js` (326) | SSOT расходов по зонам | `mixingNodePrimaryBleedM3h`, `resolveCirculationFlows`, `resolvePrimaryMainLineFlowM3h`, `resolveDesignPumpFlowM3h` | P + **M** (`:268-270` мутирует `boilerZone`) | нет |
| `thermalLoadToFlow.js` (28) | G = Q/(c·Δt) | `thermalLoadToFlow(args)` | P | нет |
| `resolveFlowDeltaTK.js` (18) | SSOT ΔT расхода | `resolveFlowDeltaTK(args)` | P | нет |
| `pipeHydraulics.js` (152) | v, Re, λ, Δp участка | `pipeInternalDiameterMm`, `flowVelocityMps`, `computeSegmentHydraulics`, `resolveRoughnessMm`, `pipeVelocityMps`, `resolveVelocityMinMps`, `pickSmallestPipe`, `pickLargestPipe`, `pickSmallestPipeWithinVelocityRange` | P | catalog-item |
| `pipeCatalogPoolFilter.js` (45) | guard Dвн | `resolveMinInternalDiameterMm`, `filterPoolByMinInternalDiameter` | P | catalog |
| `pickPipe.js` (399) | подбор трубы по ребру | `pickPipeForEdgeByCatalogId`, `pickPipeForEdge`, `pickPipesForGraph` | P | catalog.pipes |
| `pickTrunkChain.js` (204) | монотонное заужение магистрали | `orderTrunkChainEdges`, `pickTrunkEdgeWithTaper`, `pickTrunkChainWithTaper`, `usesTrunkTaperPick` | P | catalog.pipes |
| `pressureDrop.js` (121) | Δp, критическое кольцо | `computePressureReport`, `buildConsumerSummaries`, `coarseRecommendedDn`, ре-экспорт `resolveDesignPumpFlowM3h` | P | нет |
| `circulationLoops.js` (175) | кольца, худшая ветка, балансировка | `computeCirculationLoops(args)` | P | нет |
| `resolveZoneHead.js` (41) | H по зоне | `resolveHeadForZone(zoneId, pressure, dto)` | P | нет |
| `pickPump.js` (298) | подбор насоса по H(Q) | `pumpDutyRulesFromHydraulicsRules`, `resolveHeatingCircuitMinFlowM3h`, `evaluatePumpModeAtDuty`, `pickPumpForSystem`, `evaluatePumpCurveAtDuty`, ре-экспорт `pumpHeadM` | P | catalog.pumps |
| `resolveSystemPumps.js` (282) | насосы по зонам + встроенный котла | `resolveSystemPumps({dto,pressure,catalog})` | P | catalog |
| `buildHydraulicsProposal.js` (333) | коммерческое предложение гидравлики | `buildHydraulicsProposal(args)` | P | catalog |
| `parseConnectionDiameter.js` (64) | парсинг «3/4 дюйма» → мм | `parseConnectionDiameterMm`, `parseConnectionDiametersMm` | P | нет |
| `resolveEmittersMode.js` (67) | режим emitters + правила из appliances | `resolvePipelineEmittersMode`, `hydraulicsRulesFromAppliance`, `estimateBranchLengthM` | P | `appliances.hydraulics` |
| `public.js` (12) | barrel | 7 реэкспортов | — | — |

### report/

| Модуль | Назначение | Экспорт | Чистота | ctx |
|---|---|---|---|---|
| `buildReport.js` (771) | оркестратор всего пайплайна | `buildReport({input, ctx}) → Promise<CalcReport>` | **IO** (климат `:231`), **T** (`new Date().toISOString():737`), **M** (`:274-278` мутирует `input.building.temps`, `:476` `underfloorHeating.distributionPreset`) | **ctx обязателен** (`assertCalcRuntimeContext:207`) |
| `buildFinancialBom.js` (725) | коммерческая смета | `buildFinancialBom({input,matching,underfloorHeating})`, `collapseFinancialBomLines`, `FINANCIAL_LABOR_PERCENT`, `FINANCIAL_CONSUMABLES_PERCENT`, `MIXING_NODE_SELF_ASSEMBLY_NOTE`, `FINANCIAL_BOM_SCHEMA_VERSION` | P | нет |
| `automationHints.js` (105) | подсказки схем котёл/ГВС | `buildMatchingAutomationHints(args)` | P | `appliances.boiler.apartmentClassification` |
| `public.js` (5) | barrel | `buildReport` | — | — |

### dhw/

| Модуль | Назначение | Экспорт | Чистота |
|---|---|---|---|
| `waterCalc.js` (145) | формулы ГВС | `hotWaterThermalPowerKw`, `recommendedStorageTankLitersRaw`, `tankVolumeHeatPowerKw`, `estimatePeakSessionLitersMixed`, `equivalentStorageTankLitersFromSession`, `tankFullHeatTimeMinutes`, `simultaneityFactor` | P |
| `loadWaterNorms.js` (86) | загрузка `water_norms` | `loadWaterNorms()` | **IO** (файл/Mongo), auto-fallback `:66-85` |
| `validateWaterNorms.js` (253) | нормализация норм | `validateAndNormalizeWaterNorms(json)` | P (throws) |
| `loadAppliances.js` (59) | загрузка `appliances` | `loadAppliances()` | **IO** |
| `validateAppliances.js` (559) | нормализация правил подбора | `validateAndNormalizeAppliancesBundle(json, source)` | P (throws) |
| `validateReferenceHelpers.js` (76) | `requireObject/PosNum/FiniteNum/NonEmptyString` | — | P |

`logic/hotWater.js` (229) — `calculateHotWaterDemand(input, norms, options?) → HotWaterReport`, чистая,
зависит от `waterNorms`.

### climate/

| Модуль | Назначение | Экспорт | Чистота |
|---|---|---|---|
| `index.js` (41) | фасад | `getDesignOutsideTempC(location) → Promise<ClimateSnapshot\|null>` | **IO** |
| `geocode.js` (107) | Nominatim | `geocodeAddress(address)` | **IO** (`fetch:59`), таймаут `GEOCODE_TIMEOUT_MS` (default 8 с) |
| `snipClimate.js` (358) | Meteostat bulk | `getDesignOutsideTempFromMeteostat({lat,lon})` | **IO** (`fetch:108,132`), **T** (`new Date():270`), **глобальный кэш** `stationsLiteCachePromise:20` |

### ufh/

| Модуль | Экспорт | Чистота |
|---|---|---|
| `loadUnderfloorHeatingPresets.js` (82) | `loadUnderfloorHeatingPresets()` | **IO**, auto-fallback `:65-81` |
| `validateUnderfloorHeatingPresets.js` (165) | `validateAndNormalizeUnderfloorHeatingPresets(json)` | P (throws) |

### recommendations/

| Модуль | Экспорт | Чистота |
|---|---|---|
| `recommendationResolver.js` (77) | `resolveRecommendation(bundle, code, vars?)`, `pushRecommendation(warnings, resolvedList, bundle, code, vars?)` | `resolve` — P (throws без bundle `:26-30`); `push` — **M** |
| `loadRecommendations.js` (63) | `loadRecommendations()` | **IO** |
| `validateRecommendations.js` (111) | `validateAndNormalizeRecommendationsBundle(json, source)` | P |

### shared/

| Модуль | Экспорт (ключевое) | Чистота |
|---|---|---|
| `roomDesignAirTemp.js` (84) | `BATHROOM_ROOM_TYPE`, `BATHROOM_DESIGN_AIR_TEMP_FLOOR_C`, `SMALL_ZONE_ROOM_TYPES`, `resolveDesignRoomAirTempC`, `isSmallZoneRoomType` | P |
| `heatingThermalRegimePresets.js` (117) | `HEATING_THERMAL_REGIME_PRESETS`, `…_ENUM`, `…_UI_OPTIONS`, `…_SURVEY_UI_OPTIONS`, `isDeprecatedHeatingThermalRegimePreset`, `defaultThermalRegimePresetForObjectType`, `isLowTemperatureThermalRegimePreset`, `defaultThermalRegimePresetForMatchingScheme` | P |
| `heatingThermalRegimeRecommendations.js` (80) | `SURVEY_THERMAL_REGIME_PRESET_IDS`, `allowedThermalRegimePresetsForScheme`, `recommendedThermalRegimePresetForScheme`, `thermalRegimeRecommendationHint` | P |
| `heatingMatchingSchemes.js` (63) | 5 констант схем + `…_OPTIONS` | P |
| `ufhCircuitPresets.js` (70) | `UFH_CIRCUIT_PRESETS`, `resolveUfhCircuitPresetForFinishMaterialId`, `getUfhCircuitPresetById`, `isUfhCircuitPresetId` | P |
| `ufhDistributionPresets.js` (84) | `isUfhDistributionPreset`, `resolveAutoUfhDistributionPreset`, `resolveUfhDistributionPreset`, `UFH_DISTRIBUTION_*` | P |
| `ufhModePresetIds.js` (33) | `UFH_PRESET_ONLY`, `UFH_PRESET_MIXED_RADIATORS`, `isUfhModePresetId`, `ufhModePresetIsMixedRadiators` | P |
| `ufhTerminalControl.js` (30) | `UFH_TERMINAL_CONTROL_MAX_AREA_SQM`, `isUfhTerminalControl`, `resolveUfhTerminalControl` | P |
| `radiatorConnection.js` (44) | `RADIATOR_CONNECTION_ENUM`, `normalizeRadiatorConnection`, `radiatorConnectionLabel` | P |
| `radiatorEmitterPreference.js` (72) | `RADIATOR_EMITTER_PREFERENCE_ENUM`, `normalizeRadiatorEmitterPreference`, `radiatorEmitterPreferenceLabel` | P |
| `roomTypeNormalization.js` (42) | `CANONICAL_ROOM_TYPES`, `LEGACY_ROOM_TYPE_MAP`, `ROOM_TYPE_SYNONYMS` | P |
| `waterHeaterFormContract.js` (43) | `shouldShowIndirectDhwSpaceCheckbox`, `objectMetaForCalcPayload` | P |

### utils/ вне списка каталогов, но часть ядра подбора

`boilerMatchingByType.js` (230), `boilerMountingConstraints.js` (133), `apartmentMatching.js` (178),
`apartmentCombiSerialBufferHint.js` (183), `math.js` (16), `pumpCurveMath.js`. Все чистые.

---

## 2. Реестр порогов и ветвлений решений

| ID | Модуль | Условие | Порог | Что меняется в результате | file:line |
|---|---|---|---|---|---|
| **T-01** | ventilationReserve | `mode === 'recuperation'` | 1.1 vs 1.3 | `designWatts = envelopeWatts × kVent` → все теплопотери, котёл, радиаторы | `logic/ventilationReserve.js:9,12,27-31` |
| T-02 | orientationHeatLoss | β по стороне света | N/NE/E 0.1; NW/W/SE 0.05; S/SW 0 | множитель (1+β) на Q стен/окон | `logic/orientationHeatLoss.js:7-16,38-40` |
| T-03 | orientationHeatLoss | применять β только к kind | `{wall, window}` | остальные элементы — factor 1 | `logic/orientationHeatLoss.js:19,48` |
| T-04 | roomExteriorLayout | `roomLayout === 'corner'` | ×1.08 | Q стен/окон угловой комнаты | `logic/roomExteriorLayoutHeatLoss.js:12,149-153` |
| T-05 | roomExteriorLayout | стена в неотапл. коридор | ΔT = insideC − 15 | вместо insideC − outsideC | `logic/roomExteriorLayoutHeatLoss.js:15,105-108` |
| T-06 | roomExteriorLayout | стена в коридор → heatLossFactor | 1 | β и corner-множитель не применяются | `logic/roomExteriorLayoutHeatLoss.js:139-141` |
| T-07 | roomExteriorLayout | инференс layout | `internal>0 && facade===0` → internal; `facade>=2` → corner; иначе facade | множитель угловой комнаты | `logic/roomExteriorLayoutHeatLoss.js:73-77` |
| T-08 | roomExteriorLayout | согласованность layout/стен | internal — ровно 1 корид.; facade — ровно 1 фасад.; corner — ровно 2 | **400 `ROOM_EXTERIOR_LAYOUT_WALLS`** | `logic/roomExteriorLayoutHeatLoss.js:177-204` |
| T-09 | topBoundaryEnvelope | topBoundary=heated | исключить ceiling+roof | `uValue = 0` → Q=0 | `logic/topBoundaryEnvelope.js:14-15`, `logic/heatlossByRooms.js:156-165` |
| T-10 | topBoundaryEnvelope | topBoundary=unheated | исключить roof | Q=0 | `logic/topBoundaryEnvelope.js:16-17` |
| T-11 | topBoundaryEnvelope | topBoundary=roof | исключить ceiling | Q=0 | `logic/topBoundaryEnvelope.js:18-19` |
| T-12 | topBoundaryEnvelope | bottomBoundary=heated | исключить floor | Q=0 | `logic/topBoundaryEnvelope.js:32-34` |
| T-13 | heatlossByRooms | приоритет резолва U | `el.uValue` → externalWalls (wall) → `preset.uModel`+thickness → `preset.uValue` | **400 `ENVELOPE_UVALUE_MISSING`** если ничего | `logic/heatlossByRooms.js:129-146` |
| T-14 | heatlossByRooms | неизвестный `roomId` элемента | — | **400 `UNKNOWN_ROOM`** | `logic/heatlossByRooms.js:105-112` |
| T-15 | envelopeHeatLoss | `areaM2 <= 0` | 0 | throw | `logic/envelopeHeatLoss.js:38-40` |
| T-16 | envelopeHeatLoss | `uValue < 0` / `heatLossFactor <= 0` | 0 | throw; **U=0 допустим** (комментарий `:49`) | `logic/envelopeHeatLoss.js:50-58` |
| T-17 | wallAssembly | R поверхности стены | 0.158 м²·К/Вт | U по слоям | `logic/wallAssembly.js:17,67` |
| T-18 | wallAssembly | `facadeSystem === 'none'` | — | U из uModel+thickness либо `preset.uValue`; иначе throw | `logic/wallAssembly.js:101-113` |
| T-19 | externalWallsValidate | толщина утеплителя | 30…300 мм | **400 `EXTERNAL_WALLS_INSULATION_THICKNESS`** | `logic/wallAssembly.js:20`, `logic/externalWallsValidate.js:77-82` |
| T-20 | externalWallsValidate | `facadeSystem === 'sftk'` | только `insul_sftk_pps16f` | **400 `EXTERNAL_WALLS_SFTK_INSULATION`** | `logic/externalWallsValidate.js:93-100` |
| T-21 | externalWallsValidate | `facadeSystem === 'ventilated'` | только `insul_minwool_*` | **400 `EXTERNAL_WALLS_VENTILATED_INSULATION`** | `logic/externalWallsValidate.js:102-109` |
| T-22 | apartmentStackBoundaries | этаж комнаты и объекта | clamp 1…3 | границы комнаты | `logic/apartmentStackBoundaries.js:42-43` |
| T-23 | apartmentStackBoundaries | `stack === 'last_floor'` | topBoundary unheated только при `f >= maxF` | учёт потолка в теплопотерях | `logic/apartmentStackBoundaries.js:60-63` |
| T-24 | apartmentStackBoundaries | дом, `floor <= 1` | bottomBoundary unheated | учёт пола | `logic/apartmentStackBoundaries.js:72-75` |
| T-25 | roomDesignAirTemp | `roomType === 'санузел'` | пол 24 °C | designAirTempC = max(bathroomAirTempC ?? insideC, 24); влияет на ΔT комнаты, ТП, унибокс | `shared/roomDesignAirTemp.js:14,46-73` |
| **T-30** | hotWater | `residents` | clamp 0…20 | объём бака, β одновременности | `logic/hotWater.js:46` |
| T-31 | hotWater | каждая точка водоразбора | clamp 0…30 | пик расхода | `logic/hotWater.js:49-59` |
| T-32 | hotWater | `coldWaterDesignSeason === 'summer'` | 15 °C vs 5 °C (зима) | ΔT ГВС → мощность | `logic/hotWater.js:63-68`, `water_norms.json` |
| T-33 | hotWater | `hotWaterC` | clamp 55…60, default 60 | ΔT ГВС | `logic/hotWater.js:70-75` |
| T-34 | hotWater | квартира | исключаются `dishwasher`, `washingMachine` | меньше тепловых точек → ниже пик | `logic/hotWater.js:83-89`, `water_norms.json` |
| T-35 | waterCalc | `simultaneityFactor` | n=0 или 1 → β=1; иначе base(0.5 дом / 0.4 кв) × (1+min(pop,6)×0.035) × 1/(1+0.11·(n−1)), clamp 0.2…1 | **пиковый расход ГВС → мощность котла** | `dhw/waterCalc.js:133-145` |
| T-36 | hotWater | пик | `max(Σ×β, maxSingleFlowLps)` | нижняя граница пика — самая мощная точка | `logic/hotWater.js:109` |
| T-37 | hotWater | `dhwSupplyScenario === 'flowThrough'` | — | `recommendedTankLiters = 0`, `hotWaterPowerKw = peak` | `logic/hotWater.js:126-127,174-175` |
| T-38 | waterCalc | legacy-объём | 45 л/чел; при `bath >= 1` не менее 135 л | нижняя граница бака | `dhw/waterCalc.js:31-40`, `water_norms.json` |
| T-39 | waterCalc | сеанс | ванна ≥1 → +150 л; душей `min(shower, max(1, ceil(pop/2)))` × 50 л; кухня `min(n,2)`×15; раковина `min(n,2)`×12; пол 35 л при pop>0 | второй кандидат объёма бака | `dhw/waterCalc.js:64-85` |
| T-40 | waterCalc | эквивалент бака из сеанса | `ceil(L / 1.5)` (`volumeSubstitutionFactor`) | объём бака | `dhw/waterCalc.js:91-96` |
| T-41 | hotWater | `tropicalShower` | ×1.3, `ceil` | объём бака | `logic/hotWater.js:148-152` |
| T-42 | hotWater | округление бака | ряд `[30,50,80,100,120,150,200,250,300]`, иначе последний | итоговый SKU БКН/ЭВН | `logic/hotWater.js:155-162` |
| T-43 | hotWater | storage | `hotWaterPowerKw = max(24, P_бак за 30 мин)` | **нижняя граница мощности котла на ГВС** | `logic/hotWater.js:171-186`, `water_norms.json` `boilerDhwPowerMinKw:24`, `indirectHeatTimeMinutes:30` |
| T-44 | buildReport | квартира + `SINGLE_INDIRECT_SUM` + `_apartmentIndirectDhwStorage` | — | override сценария на `storage` | `report/buildReport.js:335-346` |
| T-45 | buildReport | квартира + `ELECTRIC_SEPARATE` | — | override на `storage` + объём по норме квартиры | `report/buildReport.js:343-345,359-372` |
| T-46 | apartmentMatching | ЭВН квартиры | 50 л/чел, минимум 50 л | объём электробойлера | `utils/apartmentMatching.js:118-128`, `water_norms.json` |
| T-47 | apartmentMatching | буфер 2К / 1К | 25 л/чел, минимум 30 л | объём буфера | `utils/apartmentMatching.js:136-164` |
| T-48 | buildReport | `SINGLE_BUFFER_ELECTRIC` | — | принудительно `dhwSupplyScenario = 'storage'` | `report/buildReport.js:386-397` |
| **T-50** | boiler | запас отопления | ×1.15 (`heatingReserveFactor`) | `heatingLoadKw` → requiredKw | `matching/boiler.js:462-471`, `appliances.json` |
| T-51 | boilerMatchingByType | конденсационная линия | ×1.05 | `heatingLoadKwCondensing` → линия «Эффективный» | `utils/boilerMatchingByType.js:88-90` |
| T-52 | boilerMatchingByType | формула requiredKw | ELECTRIC_SEPARATE / SINGLE_BUFFER → `heat`; SINGLE_INDIRECT_SUM → `heat + hw`; иначе `max(heat, hw)` | **основная формула подбора котла** | `utils/boilerMatchingByType.js:28-39` |
| T-53 | boiler | `forceSingleBoiler` | apartment ∨ MAX_COMBI ∨ COMBI_BUFFER | каскад запрещён | `matching/boiler.js:488-491` |
| T-54 | boiler | hw для формулы при combi | `peakThermalPowerKw > 0 ? peak : hotWaterPowerKw` | requiredKw | `matching/boiler.js:493-499,692-699` |
| T-55 | boiler | 1К+БКН и `specs.minSourcePowerKw` | `requiredKw = max(requiredKw, minSource)` | подбор мощнее | `matching/boiler.js:512-516` |
| T-56 | boilerMounting | квартира | `mountingType === 'floor'` → отсев; `powerKw.max > 30` → отсев | пул котлов | `utils/boilerMountingConstraints.js:105-110`, `appliances.json maxApartmentNominalKw:30` |
| T-57 | boilerMounting | дом + напольный | `boilerPlacementZone === 'boiler_room'` И V ≥ 7.5 м³ И h ≥ 2.2 м | пул котлов | `utils/boilerMountingConstraints.js:83-88,112-118` |
| T-58 | boilerMatchingByType | фильтр контуров | SINGLE_INDIRECT_SUM / ELECTRIC_SEPARATE / SINGLE_BUFFER → `single`; иначе `double` | **пул каталога** | `utils/boilerMatchingByType.js:71-81` |
| T-59 | boiler | кв. + ELECTRIC_SEPARATE, нет 1К в каталоге | — | fallback схемы на MAX_COMBI + `WARN_APT_ELECTRIC_TO_COMBI_NO_SINGLE`, пересчёт requiredKw | `matching/boiler.js:610-662` |
| T-60 | boiler | кв. + ELECTRIC_SEPARATE, oversize 1К | `smallestSingleMax / heatingLoadKw >= 3` | `REC_APT_SINGLE_TO_COMBI_OPTIMIZATION` + warning | `matching/boiler.js:612-631`, `appliances.json singleCircuitOversizeRatio:3` |
| T-61 | boiler | ELECTRIC_SEPARATE, single-пул пуст после фильтра камеры | — | молчаливый откат на весь пул (двухконтурный «резерв») | `matching/boiler.js:669-679` |
| T-62 | boiler | выбор одиночного котла | первый в пуле, отсортированном по `powerKw.max ↑`, с `powerKw.max >= requiredKw` | итоговый SKU | `matching/boiler.js:536-540,707-708` |
| T-63 | boiler | `nominalReservePercent` (single) | `round(((powerKw.min − heatingLoadKw)/heatingLoadKw)×100)`, cap 150 | поле карточки proposal | `matching/boiler.js:338-345`, `appliances.json:150` |
| T-64 | boiler | `requiredKw > 50` | 50 | note про гидрострелку в proposal | `matching/boiler.js:384-388` |
| T-65 | boilerMatchingByType | подсказка каскада | `requiredKw > 30` (`cascadeHintMinKw`) | рекомендация | `utils/boilerMatchingByType.js:174-184` |
| T-66 | boiler | forceSingle + `maxPw < requiredKw` | — | MAX_COMBI/COMBI_BUFFER → мягкий текст; иначе `WARN_BOILER_UNDERPOWERED` | `matching/boiler.js:865-888` |
| T-67 | boiler | каскад | `count = max(1, ceil(requiredKw / powerKw.max))`; лучший — меньший count, затем меньший totalNominalKw | конфигурация котельной | `matching/boiler.js:55-82` |
| T-68 | boiler | линии economy/efficient | economy — только не конденсационные; efficient — только конденсационные; `efficientCircuitMode = double` при combi/maxCombi, иначе single | альтернативные предложения | `matching/boiler.js:920-936`, `utils/boilerMatchingByType.js:120-130` |
| T-69 | boiler | `ufh_only` + (высокотемп. график ∨ не конденсационный) | — | `WARN_UFH_ONLY_TRADITIONAL_BOILER` | `matching/boiler.js:1109-1138` |
| T-70 | heatingThermalRegimes | «высокотемпературный» график | `ret < 55 && supply < 65` → false; `ret >= 55 ∨ supply >= 65` → true | warning про конденсацию | `logic/heatingThermalRegimes.js:115-133` |
| T-71 | heatingThermalRegimes | дефолт без пресета | supply 75 / return 65 | база расчёта радиаторов | `logic/heatingThermalRegimes.js:80-83` |
| T-72 | heatingThermalRegimePresets | пресеты | 95/85 (ΔT70), 75/65 (ΔT50), 55/45 (ΔT50) | supply/return + `radiatorReferenceDeltaT` | `shared/heatingThermalRegimePresets.js:16-35` |
| T-73 | heatingThermalRegimeRecommendations | рекомендуемый график | 2К-схемы → 55/45; 1К-схемы → 75/65; иначе по objectType | подсказка (не lock) | `shared/heatingThermalRegimeRecommendations.js:51-62` |
| T-74 | apartmentCombiSerialBuffer | eligible | apartment ∧ MAX_COMBI ∧ нет fallback ∧ flowThrough ∧ (точек ≥ 2 ∨ peak ≥ 18 кВт) | `REC_APT_COMBI_SERIAL_BUFFER` + automationHint | `utils/apartmentCombiSerialBufferHint.js:56-67`, `appliances.json` |
| T-75 | apartmentMatching | «большая квартира» | `Σ areaM2 > 50` ∨ санузлов ≥ 2 ∨ `heatingLoadKw > 15` | automationHints по схеме ГВС | `utils/apartmentMatching.js:60-70,89`, `appliances.json` |
| T-76 | automationHints | дом + storage | `peak > 30` ∧ MAX_COMBI → предложить 1К+БКН; `peak <= 24` ∧ точек ≤ 4 ∧ 1К+БКН → предложить combi | подсказки в `meta.automationHints` | `report/automationHints.js:46,54` |
| T-77 | automationHints | квартира | large ∧ MAX_COMBI ∧ flowThrough ∧ `peak > 20` → предложить БКН | подсказка | `report/automationHints.js:79-91` |
| T-78 | matching/index | `useIndirectDhw` | scheme ≠ COMBI_BUFFER ∧ storage ∧ (house ∨ (apartment ∧ 1К+БКН ∧ `indirectDhwSpaceAvailable === true`)) ∧ scheme ∈ {MAX_COMBI, 1К+БКН} | подбирается ли БКН вообще | `matching/index.js:117-125` |
| T-79 | indirectWaterHeater | выбор БКН | первый с `volumeLiters >= need` по возрастанию; иначе наибольший + warning | SKU бойлера | `matching/indirectWaterHeater.js:127-151` |
| T-80 | indirectWaterHeater | квартира | только `type === 'indirect_wall'`, иначе fallback + warning | пул БКН | `matching/indirectWaterHeater.js:57-73` |
| T-81 | indirectWaterHeater | котёл слабее источника | `boilerNominalKw + 0.49 < minSourceKw` | warning | `matching/indirectWaterHeater.js:220-228`, `appliances.json` |
| T-82 | indirectWaterHeater | змеевик слабее котла | `coilKw < boilerNominal − 0.5` | warning про тактование | `matching/indirectWaterHeater.js:230-238` |
| T-83 | indirectWaterHeater | время нагрева бака | `>= 95 мин` → `WARN_DHW_TIME_LONG`; `>= 48 мин` → мягкий hint | рекомендация | `matching/indirectWaterHeater.js:252-270`, `appliances.json` |
| T-84 | indirectPriorityRoomHint | hint про остывание | `t < 18 мин` → молчим | **порог 18 захардкожен, не из appliances** | `matching/indirectPriorityRoomHint.js:20` |
| **T-90** | pickRadiatorsCore | дефолты графика | supply 75 / return 65 / inside 20 | targetΔT радиаторов | `matching/internal/pickRadiatorsCore.js:240-242` |
| T-91 | pickRadiatorsCore | `baseDeltaT` | из `radiatorReferenceDeltaT`; иначе economy→70, efficient→50, primary→50 при наличии `proposalEfficient`, иначе 70 | **число секций** | `matching/internal/pickRadiatorsCore.js:249-261` |
| T-92 | radiatorSizingHelpers | пересчёт мощности | `baseWatts × (targetΔT/baseΔT)^1.3` | число секций / длина панели | `matching/radiatorSizingHelpers.js:83-91` |
| T-93 | pickRadiatorsCore | `targetΔT` | `(supply+return)/2 − insideC` | пересчёт мощности | `matching/internal/pickRadiatorsCore.js:131-133,274` |
| T-94 | pickRadiatorsCore | бренд-бонусы | central: mirado/бимет +120, global +60; individual: fondital +120, radik/korado +100, global +70, exclusivo/blitz +50, mirado −40; bottom: VKP +60, панель +20; side: klasik/секцион +30 | **порядок пула → какой SKU выбран** | `matching/internal/pickRadiatorsCore.js:148-170` |
| T-95 | pickRadiatorsCore | вес бренда в ранге | individual ×0.38; central ×0.08 | порядок пула | `matching/internal/pickRadiatorsCore.js:178-183` |
| T-96 | pickRadiatorsCore | правило 70% ширины окна | warning только при `qEnvelope >= 800 Вт` | наличие warning | `matching/internal/pickRadiatorsCore.js:440,743-749` |
| T-97 | exploreRoomEmitterKind | мин. секций под окно | `ceil(0.7 × openingWidth / sectionWidth)`, cap `maxSectionsHeuristic` | секции добавляются сверх тепловой потребности | `matching/internal/exploreRoomEmitterKind.js:202-245` |
| T-98 | radiatorSizingHelpers | фильтр панелей под окно | `panelLength >= 0.7 × openingWidth` (сначала), иначе fallback без фильтра | длина панели | `matching/radiatorSizingHelpers.js:145-179` |
| T-99 | appliances/radiator | emitterKind rules | `maxSectionsBeforeMultiUnit 24`, `maxUnitsPerRoom 4`, `maxSectionsHeuristic 80`, `sectionalCandidatesPerRoom 16`, `tieBreakKind sectional` | эскалация multi-unit, отсечение | `appliances.json`, дубль-дефолт `matching/internal/pickRadiatorsCore.js:39-45` |
| T-100 | decideObjectEmitterKind | порядок решения | forcedOverride → preference → 0 голосов → sectional → ничья → tieBreakKind → majority | **единый тип прибора на объект** | `matching/internal/decideObjectEmitterKind.js:43-111` |
| T-101 | exploreRoomEmitterKind | голос за панель | bottom+панель; ∨ панель закрывает ≥70% окна, а секции нет; ∨ секций > 24 и панель покрывает Q | голос Pass 1 | `matching/internal/exploreRoomEmitterKind.js:81-113` |
| T-102 | resolveMicroLoadRadiatorStrategy | микронагрузка | `qRad < 150 Вт` | входная зона (`прихожая/коридор/тамбур`) ∨ есть наружные стены → `minimum_viable`; иначе `skip` | `matching/internal/resolveMicroLoadRadiatorStrategy.js:29-65`, `appliances.json` |
| T-103 | resolveMixedRadiatorRoomLoad | mixed | `qRad = designWatts − heatFluxUpWatts`; `<= 0` → radiator пропущен | комната без прибора | `matching/internal/resolveMixedRadiatorRoomLoad.js:56-71` |
| T-104 | mixedRadiatorsUfhMode | вычитать ли ТП | mode `ufh_only`/`radiators` → нет; `mixed` → да; иначе по `ufhPresetId`/`waterUnderfloorHeating` | двойной учёт мощности | `matching/internal/mixedRadiatorsUfhMode.js:12-26` |
| T-105 | sizeForcedRoomEmitter | scoring кандидата | `cover×10 + (widthOk ? 50000 : 0) − 100×(units−1) − deficit` | **какой прибор выбран** | `matching/internal/sizeForcedRoomEmitter.js:341-350` |
| T-106 | sizeForcedRoomEmitter | scoring покрывающего | `(widthOk ? 1000 : 0) − 100×(units−1) − sections` | выбор среди покрывающих | `matching/internal/sizeForcedRoomEmitter.js:355-361` |
| T-107 | radiatorSizingHelpers | зазор под подоконником | 100 мм сверху и снизу → `maxH = openingHeight − 200` | warning в sizingNotes | `matching/radiatorSizingHelpers.js:6,198-214` |
| T-108 | pickRadiatorsCore | warning про высокий график | primary ∧ есть efficient ∧ `supply >= 65` ∧ `return >= 55` | warning в отчёте | `matching/internal/pickRadiatorsCore.js:828-839` |
| T-109 | radiators | ufh_only | — | подбор радиаторов **полностью пропускается**, обе линии `unavailable` | `matching/radiators.js:107-125` |
| **T-120** | ufhPipeEmbedment | R внедрения по шагу | 100→0.063; 150→0.1; 200→0.144; иначе default 150 | q↑ / q↓ | `logic/ufhPipeEmbedment.js:7-16,32-42` |
| T-121 | ufhRoomHeatFlux | R конвекции | вверх 0.1; вниз heated 0.05; вниз unheated 0.15 | q↑ / q↓ | `logic/ufhRoomHeatFlux.js:16-20,158-164` |
| T-122 | ufhRoomHeatFlux | температура снизу | heated → insideC; unheated → outsideC | q↓ (паразитный поток) | `logic/ufhRoomHeatFlux.js:159` |
| T-123 | ufhRoomHeatFlux | лимит поверхности | `min(пресет режима, паспорт финиша)` | `maxAllowableHeatFluxUpWm2 = (maxT − insideC)/rFinish` | `logic/ufhRoomHeatFlux.js:56-79,172` |
| T-124 | ufhRoomHeatFlux | обрезка q↑ | `q↑ = min(uncapped, maxAllowable)`, флаг при превышении +1e-9 | **отдача ТП, дальше — мощность котла при ufh_only** | `logic/ufhRoomHeatFlux.js:174-190` |
| T-125 | flooringFinishMaterials | лимиты финиша | плитка max 35 / комфорт 29; ПВХ/ламинат max 27 | лимит q↑ | `data/flooringFinishMaterials.js:16,17,27,36,45` |
| T-126 | ufhCircuitPresets | график контура ТП | плитка → 45/35; ПВХ/ламинат → 40/30 (Δt=10) | circuitMeanC → q↑ | `shared/ufhCircuitPresets.js:16-31` |
| T-127 | ufhPipeSpacingResolve | авто-шаг | перебор 100/150/200; запас 0.05 Вт/м²; requested подходит → `matched_requested`; иначе `min(достаточных)` → `tightened`; ничего → 100 мм + `none_sufficient` | шаг укладки → метраж трубы → смета | `logic/ufhPipeSpacingResolve.js:14,64-93` |
| T-128 | ufhRoomCoverageCheck | покрытие теплопотерь | `ratio < 0.95` → `low` | `WARN_UFH_COVERAGE_LOW` | `logic/ufhRoomCoverageCheck.js:25` |
| T-129 | ufhRoomCoverageCheck | активная площадь | `heatedArea <= 0` → `zero_heated_area`; `qRequired > maxAllowable + 1e-6` → `insufficient_active_area` | `WARN_UFH_HEATED_AREA_ZERO` / `WARN_UFH_ACTIVE_AREA_INSUFFICIENT` | `logic/ufhRoomCoverageCheck.js:36-51` |
| T-130 | ufhActiveFloorArea | S_акт | `max(0, roomArea − furnitureArea)` | q_треб, длина трубы | `logic/ufhActiveFloorArea.js:20-36` |
| T-131 | ufhLoopLength | коэффициент укладки | 1.1 (валидируется 1…1.3 в `validateAppliances.js:405-413`) | метраж трубы → смета | `logic/ufhLoopLength.js:7,16-27`, `appliances.json` |
| T-132 | ufhLoopGeometry | число петель (геометрия) | `maxLen = max(20, maxUfhLoopLengthM=80)`; `loops = ceil(total/maxLen)` | число выходов коллектора | `logic/ufhLoopGeometry.js:43,57-60` |
| T-133 | warmFloorCalc | Δt контура ТП | **хардкод 10 K** в `:209` и `:363` | расход контура (расходится с `appliances.ufhLoopDeltaTK`) | `logic/warmFloorCalc.js:209,363` |
| T-134 | ufhMixingNode | нужен смеситель | `boilerSupplyC > floorSupplyC` (строго) | смеситель, схема распределения, насос зоны | `logic/ufhMixingNode.js:11-16` |
| T-135 | warmFloorCalc | пресет `hasMixingNode === false` | — | смеситель принудительно выключен | `logic/warmFloorCalc.js:303-313` |
| T-136 | ufhDistributionPresets | авто-схема | `requiredBoilerKw > 50` → гидрострелка; apartment → коллектор; `roomsWithUfh >= 7` → гидрострелка; иначе коллектор | **топология системы, состав сметы** | `shared/ufhDistributionPresets.js:57-72`, `appliances.json:50/7` |
| T-137 | ufhMixingNodeHydraulics | узел смешения | Δp клапана 0.17 бар; H ≥ 3 м (коллектор) / 5 м (гидрострелка); `Q = P×0.86/(Δt×ρ)`; `Kvs = Q/Δp` | требования к насосу зоны | `logic/ufhMixingNodeHydraulics.js:28-42`, `appliances.json` |
| T-138 | warmFloor (matching) | паразитный поток вниз | `bottomBoundary === 'heated'` ∧ `q↓ > 5 Вт/м²` | `WARN_UFH_PARASITIC_DOWN_HEATED` | `matching/warmFloor.js:18,176-190` |
| T-139 | warmFloor (matching) | перегрев материала | финиш ∈ {pvc_glue, pvc_click, laminate_click} ∧ (`Tповерх > maxT + 0.05` ∨ обрезка) | `WARN_FLOOR_OVERHEATING_MATERIAL` | `matching/warmFloor.js:9-15,234-238` |
| T-140 | warmFloor (matching) | перегрев комфорта | остальные финиши ∧ `Tповерх > comfortMax + 0.05` | `WARN_FLOOR_OVERHEATING_COMFORT` | `matching/warmFloor.js:239-245` |
| T-141 | warmFloor (matching) | увеличить шаг | `pipeSpacingMm < 200` | `REC_UFH_ACTION_INCREASE_SPACING` | `matching/warmFloor.js:16,256-267` |
| T-142 | ufhLoopHydraulics | перебор конфигураций | `loopsCount` 1…32; выбор ближайшего к `minLoopsGeom` среди полностью валидных | число петель, длина, Ø трубы | `logic/ufhLoopHydraulics.js:21,720-760` |
| T-143 | ufhLoopHydraulics | scoring частичных | низкая v: `1000 + Δ×100`; высокая v: `500 + Δ×100`; Δp: `800 + Δ×10` | какая «плохая» конфигурация победит | `logic/ufhLoopHydraulics.js:207-223` |
| T-144 | ufhLoopHydraulics | число поворотов 90° | `max(2, round(2·√(L/шаг)))` | локальные потери петли | `logic/ufhLoopHydraulics.js:29-36` |
| T-145 | appliances/hydraulics | пороги петли ТП | Δt 10 K; v 0.2…0.7 м/с; Δp ≤ 20 кПа; мин. номинал Ø 16 мм | статус `resolved_auto` / `unresolved_*` | `logic/ufhLoopHydraulics.js:42-58,434`, `appliances.json` |
| T-146 | ufhLoopHydraulics | триггер увеличения Ø | `Δp > 0.85 × maxΔp` ∨ `v > vMax` → upsize; `v < vMin` → downsize | Ø трубы петли → смета | `logic/ufhLoopHydraulics.js:303-405`, `appliances.json:0.85` |
| T-147 | ufhLoopHydraulics | резайз по паразитному потоку | `q↓ >= 5 Вт/м²` при heated ∨ `q↓/q↑ >= 0.15` | `shouldTriggerUfhPipeResize` — **функция экспортируется, но нигде не вызывается** | `logic/ufhLoopHydraulics.js:69-93` |
| T-148 | ufhTerminalControl | унибокс допустим | `areaM2 <= 20` | терминал петли | `shared/ufhTerminalControl.js:7,24-29` |
| **T-160** | manifold | лимит петель на узел | 12 | автокаскад коллекторов, warning | `matching/manifold.js:10,125-143` |
| T-161 | manifold | разбиение каскада | `units = ceil(n/12)`, равномерно (13→[7,6], 25→[9,8,8]) | число коллекторов в смете | `matching/manifold.js:125-143` |
| T-162 | manifold | выбор коллектора | `outletsCount >= need`; сорт: `hasFlowMeters` (ТП) → `outletsCount ↑` → `price ↑`; fallback — макс. по выходам + warning | SKU коллектора | `matching/manifold.js:196-221` |
| T-163 | manifold | котельный коллектор | `circuitsCount >= need` ∧ `maxPowerKw >= needKw`; fallback + warning с дефицитом | SKU | `matching/manifold.js:256-299` |
| T-164 | manifold | нужен ли котельный коллектор | только `house`; гидрострелка → да; иначе есть радиаторная И ТП зона | позиция в смете | `matching/manifold.js:393-402` |
| T-165 | manifold | радиаторный коллектор | только при `radiatorWiringSystemType === 'manifold'`; выходов = комнат с `radiatorDesignWatts > 0` | позиция в смете | `matching/manifold.js:376-382,485-498` |
| T-166 | manifold | комната с унибоксом | не учитывается в выходах коллектора | число выходов | `matching/manifold.js:363` |
| T-167 | unibox | расчётные константы | P = 3 бар; Δp клапана 0.25 бар; `Kv_min = (Q/1000)/√Δp` | фильтр каталога | `matching/unibox.js:20,23,38-42` |
| T-168 | unibox | пригодность | **все неравенства строгие**: `area < maxArea`, `L < maxLoopLength`, `supplyC < maxTemperatureC`, `P < maxPressureBar`, `Kv_min < kvM3h`, `fit === 'eurocone'`, интервалы coolant/air/flow — строго внутри | подобран ли унибокс | `matching/unibox.js:73-123` |
| T-169 | unibox | мягкий лимит зон | `demands.length >= 4` | warning (не блок) | `matching/unibox.js:26,428-433` |
| T-170 | unibox | приоритет типа | rtl_air 0 < rtl_afc 1 < rtl 2 < balancing_valve 3 < air_only 4; затем G3/4, затем цена | SKU унибокса | `matching/unibox.js:48-62,207-220` |
| **T-180** | thermalLoadToFlow | физика расхода | c = 4180 Дж/(кг·К); ρ = 1000 кг/м³ | все расходы системы | `hydraulics/thermalLoadToFlow.js:8-9` |
| T-181 | resolveFlowDeltaTK | ΔT расхода | `deltaTSystemK` приоритет; иначе `max(0.1, supply − return)` | расход радиаторов | `hydraulics/resolveFlowDeltaTK.js:13-17` |
| T-182 | pipeHydraulics | коэффициент трения | Re < 2300 → `64/Re`; иначе Блазиус `0.316/Re^0.25` | Δp | `hydraulics/pipeHydraulics.js:38-41` |
| T-183 | pipeHydraulics | поправка на шероховатость | `λ × (1 + relRough × 10)` — **эмпирика без источника** | Δp | `hydraulics/pipeHydraulics.js:63` |
| T-184 | pipeHydraulics | ν воды | 1.004e-6 м²/с (≈20 °C, не при 60 °C) | Re → λ → Δp | `hydraulics/pipeHydraulics.js:9` |
| T-185 | pipeCatalogPoolFilter | guard Dвн | `ufh_loop` → 0; `isMainLine` → 20 мм; иначе 12 мм | пул труб; при исчерпании — `catalogPoolExhausted` | `hydraulics/pipeCatalogPoolFilter.js:13-27`, `appliances.json` |
| T-186 | pickPipe | лимит скорости | main/trunk/ufh_collector_transit → `mainMax 0.8`; иначе `branchMax 0.5` | Ø трубы | `hydraulics/pickPipe.js:33-39`, `appliances.json` |
| T-187 | pipeHydraulics | мин. скорость | main/trunk → `mainMin 0.2`; branch/dhw/ufh_transit → `branchMin 0` | флаг `velocityBelowMin` | `hydraulics/pipeHydraulics.js:105-112` |
| T-188 | pickPipe | fallback подбора | нет трубы в диапазоне: v(min Ø) > vMax → **largest** + `velocityLimitExceeded`; иначе **smallest** + `velocityBelowMin` | Ø трубы, Δp | `hydraulics/pickPipe.js:82-103` |
| T-189 | pickPipe | локальные сопротивления ζ | teePass 0.6; teeBranchTakeoff 1.2 + elbow 0.9; collector 1.5; ufh_loop/transit collector+elbow; micro-manifold +1.5 | Δp участка | `hydraulics/pickPipe.js:246-277`, `appliances.json localLossZeta` |
| T-190 | pickTrunkChain | заужение магистрали | Ø upstream ≥ Ø downstream (обход цепочки справа налево); при `v < vMin` — не откатываться к guard 12 мм | Ø магистрали | `hydraulics/pickTrunkChain.js:69-196` |
| T-191 | groupRadiatorGraphBranches | микроветка | `flow < 0.019 м³/ч` ∨ `heat < 150 Вт` | комната уходит в `rad_micro_manifold` вместо своей ветки | `hydraulics/groupRadiatorGraphBranches.js:34-41`, `appliances.json` |
| T-192 | resolveEmittersMode | длина ветки по этажу | `base × (0.75 + (floor−1)×0.35)` | Δp ветки, метраж трубы в смете | `hydraulics/resolveEmittersMode.js:64-66` |
| T-193 | appliances/hydraulics | дефолтные длины | магистраль 8 м; ветка радиатора 4 м; транзит коллектора ТП 3 м | Δp, метраж | `appliances.json defaultLengthsM` |
| T-194 | circulationLoops | Δp кольца | `Σ Δp пути × 2` (подача+обратка) | H насоса | `hydraulics/circulationLoops.js:87-93` |
| T-195 | circulationLoops | H | `criticalKPa / 9.81` | требуемый напор | `hydraulics/circulationLoops.js:172` |
| T-196 | circulationLoops | балансировка | `excess < 0.5 кПа` → без рекомендации; `turns = max(1, round(excess/3))` | рекомендации по клапанам | `hydraulics/circulationLoops.js:144-150`, `appliances.json balancingValveKPaPerTurn:3` |
| T-197 | pressureDrop | подъём H | `mixingNode.headMetersMin > H` → берётся он; `requiredKw > 50` ∧ смеситель → минимум 5 м | H насоса | `hydraulics/pressureDrop.js:50-61` |
| T-198 | pressureDrop | рекомендация DN | `>1.5` → DN25–32; `>0.9` → DN20–25; `>0.4` → DN20; иначе DN15–20 | текст отчёта | `hydraulics/pressureDrop.js:116-120` |
| T-199 | resolveCirculationFlows | подмес узла ТП | `Q_ufh × (Δt_ufh / Δt_boiler)` | расход магистрали при `collector_mixing_valve` | `hydraulics/resolveCirculationFlows.js:53-56` |
| T-200 | resolveCirculationFlows | гидрострелка | `Q_primary = max(Q_thermal, Q_secondary × 1.12)` | расход первичного контура | `hydraulics/resolveCirculationFlows.js:139-144,176-183`, `appliances.json primaryFlowMarginPercent:12` |
| T-201 | resolveCirculationFlows | сверка балансов | расхождение теплового баланса и подмеса `> 5%` | warning, берётся тепловой баланс | `hydraulics/resolveCirculationFlows.js:220-228` |
| T-202 | resolveCirculationFlows | приоритет ГВС | `Q_boiler = max(Q_heating, Q_dhw)` | расчётный расход котлового насоса | `hydraulics/resolveCirculationFlows.js:266-290` |
| T-203 | resolveZoneHead | H зоны ТП | `max(mixingNode.headMetersMin, H графа)` | подбор насоса зоны | `hydraulics/resolveZoneHead.js:29-33` |
| T-204 | pickPump | зона рабочей точки | `q < qMin` → отсев (кроме softQMin); `q > qMax` → отсев; `q > 0.85·qMax` → `near_qmax`; `H(q) < 0.3 м` → отсев; `H(q) < H_target` → `insufficient_head`; `margin > 60%` → `head_oversized` | подбор насоса | `hydraulics/pickPump.js:78-111`, `appliances.json` |
| T-205 | pickPump | запас по напору | `H_target = H_req × 1.12` (кроме зон, где `useExactHeadRequired`) | какие насосы проходят | `hydraulics/pickPump.js:139-141`, `appliances.json pumpHeadMarginPercent:12` |
| T-206 | pickPump | выбор насоса | минимальный `headMarginPercent` среди прошедших | SKU насоса + цена в смете | `hydraulics/pickPump.js:191-197` |
| T-207 | pickPump | исключение | `pump.type === 'circulation_hot_water'` пропускается | пул насосов | `hydraulics/pickPump.js:156` |
| T-208 | resolveSystemPumps | встроенный насос ниже q_min | настенный котёл → насос **вообще не подбирается** (`match = null`); напольный → идём в каталог | наличие насоса в смете | `hydraulics/resolveSystemPumps.js:138-150`, `isWallMountedBoiler:36-47` |
| T-209 | resolveSystemPumps | зоны | `softQMin`, `skipHeadOversizedCheck`, `useExactHeadRequired` включаются для `pumpRole === 'zone'` | подбор насоса зоны мягче | `hydraulics/resolveSystemPumps.js:160-169` |
| T-210 | crossValidatePipelineInput | согласованность Q потребителя | относительная ошибка `> 2%` | **400 `HYDRAULICS_PIPELINE_INPUT_INVALID`** | `hydraulics/crossValidatePipelineInput.js:66-72` |
| T-211 | crossValidatePipelineInput | сумма расходов | `\|Σ consumers − total\| > 0.002` | 400 | `hydraulics/crossValidatePipelineInput.js:78-86` |
| T-212 | crossValidatePipelineInput | режим vs контуры | ufh_only с радиаторами / без ТП; radiators_only с ТП; mixed без обоих | 400 | `hydraulics/crossValidatePipelineInput.js:15-46` |
| T-213 | runHydraulicsPipeline | note о длинной магистрали | `mainLineLengthM > 40` | note | `hydraulics/runHydraulicsPipeline.js:61-64` |
| T-214 | runHydraulicsPipeline | note о гидрострелке | **хардкод 50 кВт** при `isMixingNodeRequired` | note (дублирует T-136, но из другого источника) | `hydraulics/runHydraulicsPipeline.js:67-75` |
| T-215 | buildGraph | ГВС-ребро | только `flowThrough` ∧ `peakFlowLps > 0` | узел `dhw_load` в графе | `hydraulics/buildGraph.js:253` |
| T-216 | buildGraph | змеевик БКН | `storage` ∧ `indirectTank` ∧ `hotWaterPowerKw > 0`; длина = 2× ветка радиатора | узел `indirect_coil` | `hydraulics/buildGraph.js:267-289` |
| T-217 | buildGraph | гидрострелка vs коллектор | `isMixingNodeRequired` ∧ preset | топология: `hydraulic_separator` / `main_collector` / `mixing_node` | `hydraulics/buildGraph.js:68-142` |
| T-218 | buildSnapshots | fallback графика | `supplyC ?? 75`, `returnC ?? 65` | ΔT расхода котлового контура | `hydraulics/buildSnapshots.js:146-147` |
| **T-230** | buildFinancialBom | ставки | монтаж 40%, расходники 15% от `equipmentTotalUah` | итоговая сумма клиенту | `report/buildFinancialBom.js:13-14,612-655` |
| T-231 | buildFinancialBom | схлопывание | ключ = kind+categoryId+catalogId+brand+model+qtyUnit+unitPrice+note | число строк и qty | `report/buildFinancialBom.js:98-145` |
| T-232 | buildFinancialBom | встроенный насос котла | `pumpSource === 'boiler_builtin'` → **не в смету** | сумма | `report/buildFinancialBom.js:552` |
| T-233 | buildFinancialBom | коллекторы при soft-fail | `manifolds.ok === false` → **не в смету** | сумма | `report/buildFinancialBom.js:337` |
| T-234 | buildFinancialBom | цена радиатора | панель — за прибор; секция — `unitPrice × sections × units` | сумма | `report/buildFinancialBom.js:289-304` |
| T-235 | buildFinancialBom | смеситель ТП | `isMixingNodeRequired` → строка `kind: 'note'` без цены | не влияет на сумму | `report/buildFinancialBom.js:585-605` |
| T-236 | buildFinancialBom | в смету попадают | только `kind ∈ {equipment, note}`; линии economy/efficient игнорируются | состав сметы | `report/buildFinancialBom.js:685` |
| **T-240** | climate | окно лет Meteostat | `METEOSTAT_YEARS` clamp 1…50, default 10 | расчётная наружная T | `climate/snipClimate.js:268` |
| T-241 | climate | «пятидневка» | минимальное 5-дневное скользящее среднее tavg | расчётная наружная T → **все теплопотери** | `climate/snipClimate.js:47-65,342` |
| T-242 | climate | выбор станции | топ-20 ближайших; пробник HEAD по 3 последним годам; первая с достаточными данными | какая станция даст температуру | `climate/snipClimate.js:210-219,300-310` |
| T-243 | buildReport | вызов климата | только при `input.location` ∧ `temps.outsideC == null` | сетевой запрос в расчёте | `report/buildReport.js:229-237` |
| T-244 | buildReport | отсутствие температур | `insideC == null` → 400 `INSIDE_TEMP_REQUIRED`; `outsideC == null` → 400 `OUTSIDE_TEMP_REQUIRED` | отказ расчёта | `report/buildReport.js:247-260` |
| T-245 | buildReport | база отопления для котла | `ufh_only` ∧ `totalHeatFluxUpWatts > 0` → отдача ТП; иначе теплопотери | **мощность котла** | `report/buildReport.js:404-410`, `matching/index.js:36-62` |
| T-246 | buildReport | soft-fail коллекторов | `pickManifolds` бросил / вернул не тот shape | `ok: false`, `MANIFOLD_INTERNAL`, расчёт продолжается | `report/buildReport.js:520-563` |
| T-247 | buildReport | soft-fail гидравлики | любое исключение пайплайна | `hydraulics` = заглушка, `proposal` с нулями, warning; **расчёт всё равно возвращает 200** | `report/buildReport.js:650-681` |

**Итого: 173 порога/ветвления.**

---

## 3. Карта покрытия verify-скриптами

Прогон: `backend: npm run verify` — 52 скрипта; `frontend: npm run verify` — 10 скриптов + lint/typecheck/knip/build.
Вне прогона: `verifyProjectsAdminAccess.js`, `verifyMongoDatabase.mjs`, `verifyRoomExteriorLayoutHeatLoss.js`
(**существует, но не включён в `npm run verify` и не имеет npm-скрипта** — единственная числовая проверка
поправок теплопотерь, и она не запускается в CI).

| Модуль | Какой verify-скрипт его трогает | Что именно проверяет | Что НЕ проверяет |
|---|---|---|---|
| `logic/heatlossByRooms.js` | `verifyRoomExteriorLayoutHeatLoss.js` (**вне CI**), `verifyRoomDesignAirTemp.js`, `verifyRadiatorSections.js`, `verifyHydraulicsPipeline.js` | β=1.1 для N, corner ×1.08, ΔT=5 для коридорной стены, ratio facade/internal > 5; согласованность `designAirTempC` с `resolveDesignRoomAirTempC` | **kVent (T-01) — ни одного ассерта**; `topBoundary/bottomBoundary` (T-09…T-12) не проверены ни одним кейсом; резолв U по цепочке T-13 не проверен; `UNKNOWN_ROOM` / `ENVELOPE_UVALUE_MISSING` не проверены; ни одного эталонного значения `totalWatts` |
| `logic/envelopeHeatLoss.js` | **никакой** (импортируется только транзитивно) | — | Q = U·S·ΔT·k как формула не проверена ни разу; негативные ветки (`areaM2<=0`, `uValue<0`) не проверены |
| `logic/envelopePresets.js` | **никакой** | — | ни один U-пресет не сверен с эталоном; 429 строк данных без проверки |
| `logic/wallAssembly.js` | **никакой** | — | расчёт U по слоям (T-17, T-18) не проверен; ни одного числа |
| `logic/externalWallsValidate.js` | косвенно `verifyCalcInputValidation.js` (через `validate.js`) | — (в скрипте нет кейсов externalWalls) | правила СФТК/вентфасада (T-20, T-21), границы толщины (T-19) — **иллюзия покрытия**: модуль в графе импорта, но ни одного ассерта |
| `logic/orientationHeatLoss.js` | `verifyRoomExteriorLayoutHeatLoss.js` (вне CI) — только N | β=0.1 для N | остальные 7 румбов; `ORIENTATION_KINDS` (что β не применяется к полу/потолку) |
| `logic/topBoundaryEnvelope.js` | **никакой** | — | все 4 ветки исключения элементов |
| `logic/ventilationReserve.js` | `verifyRadiatorSections.js` (импорт `resolveKVent`) | «дефолт ventilationReserveMode natural» — присутствие поля | что 1.3 и 1.1 действительно применяются к `designWatts`; что режим `recuperation` меняет результат |
| `logic/apartmentStackBoundaries.js` | **никакой** | — | вся матрица границ квартиры (T-22…T-24) |
| `logic/heatingThermalRegimes.js` | `verifyRadiatorSections.js`, `verifyRadiatorConnection.js`, `verifyRadiatorEmitterKind.js` | пресет 55/45 применяется; неверный `thermalRegimePreset` отклоняется; input не мутируется; warning при condensing+75/65 | `isHighTemperatureHeatingGraph` пограничные значения (T-70: ret=55, supply=65, ret=54.9); дефолт 75/65 без пресета (T-71) |
| `logic/warmFloorCalc.js` | `verifyCalcRuntimeContext.js`, `verifyHydraulicsPipeline.js`, `verifyUfhActiveArea.js` | неизвестный `ufhPresetId` → throw; отчёт строится на фикстурах | **ни одного эталонного q↑/Tповерх на уровне комнаты**; ветка `isUfhOnly` с перезаписью графика (`:104-119`); `mixingForcedOffByPreset`; хардкод Δt=10 (T-133) |
| `logic/ufhRoomHeatFlux.js` | `verifyUfhPresets.js` | **лучшее покрытие физики ТП**: `min(пресет, финиш)` = 29/27 °C; обрезка q↑ по поверхности; Tповерх ≤ лимита; q↑ не зависит от толщины XPS снизу | абсолютные значения q↑ для каждого шага/финиша (эталонов нет); q↓ при `unheated`; `R_CONV_*` как константы |
| `logic/ufhPipeSpacingResolve.js` | косвенно `verifyUfhActiveArea.js` (через buildReport) | наличие `REC_UFH_PIPE_SPACING_AUTO` в одном кейсе | три статуса разрешения (T-127) по отдельности; `none_sufficient`; FLUX_EPSILON |
| `logic/ufhRoomCoverageCheck.js` | `verifyUfhActiveArea.js` | `WARN_UFH_ACTIVE_AREA_INSUFFICIENT` при большой мебели; 2× `WARN_UFH_COVERAGE_LOW` | пороговое поведение 0.95 (ratio 0.949 vs 0.951) |
| `logic/ufhActiveFloorArea.js` | `verifyUfhActiveArea.js` | `20 − 5 = 15`; `status ok`; без мебели = roomArea; `S_meb >= areaM2` → 400 | — (покрыт нормально) |
| `logic/ufhLoopHydraulics.js` | `verifyUfhLoopHydraulics.js`, `verifyHydraulicsPipeline.js` (фикстура `ufh_parasitic_down_resize`) | `estimateUfhLoopElbowCount`; `resolveUfhRoomLoopsHydraulics` отрабатывает; резайз трубы в одном сценарии | **scoring частичных конфигураций (T-143) — 0 ассертов**; `resolutionStatus` для всех 4 значений; `shouldTriggerUfhPipeResize` (T-147, мёртвый экспорт); границы v 0.2/0.7 и Δp 20 кПа |
| `logic/ufhLoopGeometry.js`, `ufhLoopLength.js`, `ufhMixingNode.js`, `ufhMixingNodeHydraulics.js`, `ufhDistributionResolve.js`, `ufhHydraulicsCircuit.js`, `ufhCircuitResolve.js`, `ufhPipeEmbedment.js`, `ufhRequiredHeatFlux.js`, `normalizeHeatingUfhPreset.js`, `normalizeUnderfloorDistribution.js` | **никакой** (не импортируются ни одним verify) | — | всё: T-120, T-131, T-132, T-134, T-136, T-137 |
| `logic/hotWater.js` | `verifyHydraulicsPipeline.js`, `verifyRadiatorSections.js` — вызывается как шаг пайплайна | **ничего**: результат не ассертится | **весь блок ГВС**: β одновременности (T-35), объём бака (T-38…T-42), `max(24 кВт, …)` (T-43), клампы, исключения для квартиры (T-34) |
| `dhw/waterCalc.js` | **никакой** | — | все 7 формул ГВС |
| `dhw/validateAppliances.js` | `verifySeedCatalog.js`? нет — импортируется `verifyMongoDatabase.mjs` (вне CI) | — | что справочник в `backend/data/appliances.json` соответствует ожиданиям подбора |
| `dhw/validateWaterNorms.js` | `verifyMongoDatabase.mjs` (вне CI) | — | то же |
| `matching/index.js` | `verifyRadiatorSections.js` (импорт `matchEquipment`) | что `matchEquipment` отрабатывает и radiators считаются | `useIndirectDhw` (T-78) — все 6 комбинаций; ветвление `waterHeater` по схемам (`:253-291`); warnings режима `ufh_only` (`:179-197`) |
| **`matching/boiler.js`** | **ни один verify не импортирует напрямую**; вызывается внутри `matchEquipment` в `verifyRadiatorSections.js` и `verifyHydraulicsPipeline.js` | **ничего**: ни `requiredKw`, ни `selected.model`, ни `proposal*` не ассертятся | **весь подбор котла**: формула по схеме (T-52), запас 1.15/1.05 (T-50, T-51), фильтр монтажа (T-56, T-57), фильтр контуров (T-58), fallback квартиры (T-59…T-61), каскад (T-67), линии economy/efficient (T-68), `WARN_BOILER_UNDERPOWERED` (T-66) |
| `matching/radiators.js` + `internal/pickRadiatorsCore.js` | `verifyRadiatorSections.js`, `verifyRadiatorEmitterKind.js`, `verifyRadiatorEmittersSummary.js`, `verifyMicroLoadRadiator.js`, `verifyMixedRadiatorUfh.js`, `verifyRadiatorConnection.js` | **лучшее покрытие в matching**: 3 секции при 75/65 и 6 при 55/45 (числовые эталоны формулы T-92); majority/tie-break/hard-lock `resolvedEmitterKind`; одинаковый kind на линиях; micro-load skip/minimum_viable; вычет отдачи ТП; фильтр панелей по подводке | бренд-скоринг (T-94, T-95) — **ни одного ассерта на то, какой SKU выбран**; scoring эскалации (T-105, T-106); порог 800 Вт (T-96); multi-unit (units 2…4); `underwindowHeightWarning` (T-107) |
| `matching/internal/sizeForcedRoomEmitter.js` | косвенно через `pickRadiatorsCore` | — | scoring, эскалация multi-unit, `pickMinimumViableForcedKind` для панели |
| `matching/waterHeater.js` | `verifyWaterHeaterMatching.js` (92 строки) | приоритеты объёма и цены на синтетическом каталоге | поведение при `need = 0`; fallback «максимально доступный» с warning |
| `matching/indirectWaterHeater.js` | **никакой** | — | подбор БКН (T-79, T-80), связка с котлом (T-81…T-83), `applyIndirectTankToHotWaterReport` (пересчёт мощности ГВС по фактическому баку) |
| `matching/manifold.js` | `verifyManifoldMatching.js` (611) | **настоящий unit-тест**: `splitOutletsForCascade` 5/12/13/14/25; выбор по `outletsCount`; house vs apartment; каскад >12 с текстом warning; fallback; soft-fail `ok:false` | пороги сортировки `hasFlowMeters` при равном числе выходов; `pickBoilerManifold` при дефиците только по мощности |
| `matching/unibox.js` | `verifyUniboxMatching.js` (727) | **самый плотный тест в репозитории**: ~40 ассертов на `uniboxFitsDemand` (каждое строгое неравенство отдельно), T воздуха по типам комнат, `validateUniboxLoopDemand` коды, `collectUniboxLoopDemands`, degraded-warning при `manifolds.ok=false` | ранжирование типов (T-170) в конкурентном пуле; порог 4 зон (T-169) |
| `matching/enrichProposalBundlePrice.js`, `indirectPriorityRoomHint.js`, `internal/indirectCatalogHelpers.js`, `internal/mixedRadiatorsUfhMode.js` | **никакой** | — | всё |
| `matching/warmFloor.js` | `verifyUfhActiveArea.js`, `verifyUfhPresets.js` | наличие `WARN_UFH_ACTIVE_AREA_INSUFFICIENT`, `WARN_UFH_COVERAGE_LOW` | `WARN_UFH_PARASITIC_DOWN_HEATED` порог 5 Вт/м² (T-138); material vs comfort overheat (T-139, T-140); `REC_UFH_ACTION_INCREASE_SPACING` порог 200 мм |
| `hydraulics/buildSnapshots.js` | `verifyHydraulicsPipeline.js` | что DTO проходит AJV на 6 фикстурах; `flowDeltaTK=20` и `thermalRegime.deltaTK=10` в `radiators_only` | `radiatorBranchOverrides` порядок; `ufhCollectorTransit` по этажам; сборка `dhw.indirectTank` |
| `hydraulics/validatePipelineInput.js` + `crossValidatePipelineInput.js` | `verifyHydraulicsPipeline.js` (позитивный путь) | что валидные DTO проходят | **все негативные ветки**: порог 2% (T-210), 0.002 (T-211), режимы (T-212) — ни одного отрицательного кейса |
| `hydraulics/buildGraph.js` + `buildRadiatorSubgraph.js` | `verifyRadiatorWiringGraph.js` (167), `verifyHydraulicsPipeline.js` | 4 топологии; число trunk-рёбер = n−1; Σ Q веток = total; наличие `rad_distribution_manifold` / `rad_micro_manifold` | ветвления гидрострелка/смеситель/коллектор (T-217); ГВС и БКН рёбра (T-215, T-216) |
| `hydraulics/groupRadiatorGraphBranches.js` | `verifyHydraulicsPipeline.js` (фикстура `apartment_mixed_ufh_micro_branches`) | что микроколлектор создаётся | пороги 0.019 м³/ч и 150 Вт по отдельности (T-191) |
| `hydraulics/pickPipe.js` + `pipeCatalogPoolFilter.js` + `pickTrunkChain.js` | `verifyPickPipe.js` (240), `verifyPipeCatalogPoolFilter.js` (99), `verifyHydraulicsPipeline.js` | guard Dвн ≥ 20 на транзите и ≥ 12 на ветке; монотонность заужения trunk; что `p-27` (Ø63) не попадает на ветку без перегрузки | **ни одного эталонного Δp**; ветка `velocityLimitExceeded` → largest (T-188); ζ по ролям (T-189) |
| `hydraulics/pipeHydraulics.js` | косвенно | — | λ по Блазиусу (T-182), поправка ×(1+relRough×10) (T-183), ν при 20 °C (T-184) — **физика Δp не проверена ни одним числом** |
| `hydraulics/pressureDrop.js` + `circulationLoops.js` + `resolveZoneHead.js` | `verifyHydraulicsPipeline.js` | «есть `circulationLoops`», «`criticalLoop.isCritical === true`», «`criticalPressureDropKPa > 0`» — **типичный пример иллюзии покрытия: только «поле присутствует и > 0»** | ×2 на обратку (T-194), H = Δp/9.81 (T-195), балансировка (T-196), подъём H смесителем и порог 50 кВт (T-197), `coarseRecommendedDn` (T-198) |
| `hydraulics/resolveCirculationFlows.js` | `verifyCirculationFlows.js` (201) | 4 топологических сценария Q по зонам | порог расхождения 5% (T-201); приоритет ГВС `max(Q_heating, Q_dhw)` (T-202); запас 12% гидрострелки (T-200) |
| `hydraulics/pickPump.js` | `verifyPumpDuty.js` (284), `verifyFitPumpCurve.js` (74), `verifyBuiltinBoilerPump.js` (380) | **сильное покрытие**: `near_qmax`, переразмеренность, аппроксимация H(Q) по 3 точкам с контрольными точками паспорта, `below_manufacturer_qmin`, `curve_unavailable`, гибрид zone (softQMin + skip oversized + exact H) | выбор «минимальный margin» среди нескольких подходящих (T-206); исключение `circulation_hot_water` (T-207) |
| `hydraulics/resolveSystemPumps.js` | `verifyBuiltinBoilerPump.js` | `boiler_builtin`, `below_manufacturer_qmin` | **ветка «настенный котёл → насос не подбирается вообще» (T-208) — критична для сметы**, проверена только косвенно |
| `hydraulics/buildHydraulicsProposal.js` | косвенно `verifyHydraulicsPipeline.js` («есть `proposal.pipeSegments`») | наличие непустого массива | агрегация `pipeLines`, цены, `pipeLineGroups`, `unavailableReason` / `pumpUnavailableReason` |
| `hydraulics/parseConnectionDiameter.js`, `resolveEmittersMode.js`, `radiatorGraphHelpers.js`, `thermalLoadToFlow.js` | `resolveEmittersMode` и `radiatorGraphHelpers` — только импорт констант | — | парсинг «3/4 дюйма» (T-192 соседний), `estimateBranchLengthM` (T-192), `thermalLoadToFlow` как формула |
| `hydraulics/resolveFlowDeltaTK.js` | `verifyFlowDeltaTK.js` (32) | приоритет `deltaTSystemK`; fallback | `max(0.1, …)` при supply == return |
| `report/buildReport.js` | `verifyRadiatorSections.js`, `verifyMixedRadiatorUfh.js`, `verifyUfhActiveArea.js` | что отчёт строится; `report.input` не мутируется по графику; warnings присутствуют | `INSIDE_TEMP_REQUIRED` / `OUTSIDE_TEMP_REQUIRED` (T-244); soft-fail коллекторов (T-246) и гидравлики (T-247); резолв схемы ТП после подбора котла (`:461-515`); `meta.generatedAt` (недетерминизм) |
| `report/buildFinancialBom.js` | `verifyFinancialBom.js` (402) | **настоящие числовые эталоны**: 40%/15%, схлопывание (qty 500, 25000), исключение economy/efficient котлов, исключение встроенного насоса, `equipmentTotalUah 60000 → labor 24000 → consumables 9000 → grand 93000` | `manifolds.ok=false` → коллекторы не в смету (T-233); панель vs секция ценообразование (T-234) частично; `qtyUnit: 'm'` для труб |
| `report/automationHints.js` | **никакой** | — | все 4 подсказки и их пороги (T-76, T-77) |
| `recommendations/recommendationResolver.js` | **никакой** (импортируется `validateRecommendations.js` в `verifyMongoDatabase.mjs`, вне CI) | — | подстановка `{{var}}`, поведение при отсутствующем коде (`pushRecommendation` пишет `[CODE] Текст не найден` в warnings пользователю!) |
| `climate/*` | **никакой** | — | всё: геокодинг, выбор станции, 5-дневное среднее (T-240…T-242). **Ни мока, ни стаба.** |
| `shared/roomDesignAirTemp.js` | `verifyRoomDesignAirTemp.js` (174), `verifyUniboxMatching.js` | пол 24 °C, `bathroom_field`, `floor`, `survey`; согласованность heatloss/unibox | — (покрыт хорошо) |
| `shared/radiatorConnection.js`, `radiatorEmitterPreference.js` | `verifyRadiatorConnection.js`, `verifyRadiatorEmitterKind.js` | нормализация, дефолты, метки | — |
| `shared/heatingMatchingSchemes.js` | `verifyWaterHeaterFormUtils.js`, `verifyRadiatorSections.js` (импорт констант) | контракт формы водонагревателя | — |
| `shared/ufhCircuitPresets.js`, `ufhDistributionPresets.js`, `ufhTerminalControl.js`, `heatingThermalRegimeRecommendations.js`, `heatingThermalRegimePresets.js` | **никакой** | — | T-126, T-136, T-148, T-73, T-72 |
| `utils/boilerMatchingByType.js`, `boilerMountingConstraints.js`, `apartmentMatching.js`, `apartmentCombiSerialBufferHint.js` | **никакой** | — | T-50…T-58, T-74, T-75 — весь слой правил подбора котла |
| frontend `verify*.mjs` (12) | — | **все 12 — статический анализ исходников через `readFileSync` + regex/`includes`**: наличие импортов, конфигов, размещение типов, наличие файлов | **ни один не выполняет frontend-код**; ни рендера, ни расчёта, ни клика. К расчётному ядру отношения не имеют |

### Сводка «иллюзия покрытия»

Скрипты, дающие ложное ощущение защиты расчёта:
1. `verifyHydraulicsPipeline.js` (711 строк) — самый большой calc-скрипт. Из ~30 проверок только 4 сравнивают
   с конкретным числом (`flowDeltaTK === 20`, `thermalRegime.deltaTK === 10`, `Σ Q веток = total ± 0.002`,
   `trunk-рёбер = n−1`). Остальные — «поле не null», «массив не пуст», «Ø ≥ guard», «`> 0`». **Δp, H, SKU трубы
   и насоса — ни одного эталона.** Пайплайн можно сломать в физике (например, поменять λ или ×2 на обратку)
   и скрипт останется зелёным.
2. `verifyCalcRuntimeContext.js` — проверяет fail-fast без ctx, т.е. контракт вызова, а не результат.
3. Все 12 frontend-скриптов — статический grep по исходникам, а не выполнение.
4. `verifyProjectsImportAdmin.js` — `readFileSync` роутов + поиск подстроки.
5. `verifyRoomExteriorLayoutHeatLoss.js` — содержательный, но **не запускается в CI** (нет npm-скрипта и нет
   в цепочке `verify`).

---

## 4. Непокрытые узлы по риску

| # | Узел | Почему рискован | Что произойдёт при поломке | Приоритет |
|---|---|---|---|---|
| 1 | **`matching/boiler.js` целиком** (T-50…T-69) | 1164 строки, 20 порогов, главный продукт; ноль прямых ассертов | Клиент получает котёл не той мощности/контура. Недобор мощности зимой = замерзающий объект; перебор = деньги и тактование. Ошибка не видна ни в одном тесте | **P0** |
| 2 | **`dhw/waterCalc.js` + `logic/hotWater.js`** (T-30…T-43) | β одновременности и объём бака входят в `requiredKw` котла через `max`/сумму; ноль ассертов | Неверный пик ГВС → неверный котёл и неверный БКН. Ошибка в `simultaneityFactor` тихо меняет мощность на десятки процентов | **P0** |
| 3 | **`logic/envelopeHeatLoss.js` + `heatlossByRooms.js` kVent (T-01) и границы (T-09…T-12)** | База всего расчёта; `kVent` даёт +30% ко всем теплопотерям и не проверен | Ошибка на 30% в теплопотерях → неверны котёл, радиаторы, ТП, гидравлика и смета одновременно | **P0** |
| 4 | **`utils/boilerMountingConstraints.js` (T-56, T-57)** | Фильтр каталога до подбора; при пустом пуле подбор молча деградирует | Квартире предложат напольный котёл 45 кВт, или наоборот — «нет подходящих котлов» на валидной анкете. Прямая связь с симптомом «не смог заполнить анкету» | **P0** |
| 5 | **`report/buildReport.js` soft-fail гидравлики (T-247)** | Любое исключение в 26 модулях гидравлики маскируется в warning, отчёт возвращает 200 с нулевой сметой труб и насоса | Клиент получает смету без труб и насоса и не понимает, почему. В логах — warn, в CI — зелено | **P0** |
| 6 | **`hydraulics/pipeHydraulics.js` физика Δp (T-182…T-184)** | λ, ν при 20 °C, эмпирическая поправка `×(1+relRough×10)` без источника; на этом стоит весь напор и подбор насоса | Неверный H → неверный насос (или «насос не подобран»), неверная балансировка | **P1** |
| 7 | **`hydraulics/circulationLoops.js` + `pressureDrop.js`** (T-194…T-197) | Проверяется только «поле есть и > 0» | Критическое кольцо выбрано не то → насос слабый → система не прогревается | **P1** |
| 8 | **`matching/indirectWaterHeater.js`** (T-79…T-83) | Подбор БКН и пересчёт мощности ГВС по фактическому баку — вход в `requiredKw` котла | Неверный БКН → неверная мощность котла → каскадная ошибка в смете | **P1** |
| 9 | **`shared/ufhDistributionPresets.js` авто-схема (T-136)** | Порог 50 кВт / 7 комнат определяет, будет ли в проекте гидрострелка (крупная позиция сметы и другая топология насосов) | Лишняя/недостающая гидрострелка: разница в десятки тысяч грн и другая гидравлика | **P1** |
| 10 | **Бренд-скоринг радиаторов (T-94, T-95) и scoring эскалации (T-105, T-106)** | Магические числа (+120/−40, ×0.38, 50000/1000/100) без единого ассерта; определяют, чей SKU попадёт в смету | Смена каталога или веса → другой бренд в смете; коммерчески чувствительно, технически незаметно | **P1** |
| 11 | `climate/*` (T-240…T-243) | Сеть в расчёте, без мока; глобальный кэш станций | Падение Meteostat/Nominatim → 502 на публичном `/api/v1/calc` или флейки в любых будущих E2E | **P1** |
| 12 | `hydraulics/crossValidatePipelineInput.js` негативные ветки (T-210…T-212) | Порог 2% рассогласования Q даёт 400 внутри расчёта; ни один негативный кейс не проверен | Ложный 400 на валидной анкете (симптом владельца) либо пропуск реального рассогласования | **P1** |
| 13 | `logic/ufhLoopHydraulics.js` scoring (T-143) + `resolutionStatus` | Определяет число петель и Ø трубы ТП → метраж в смете | Ошибочная конфигурация петель: неработающий ТП или лишние сотни метров трубы | **P1** |
| 14 | `report/automationHints.js` (T-76, T-77) | Формирует подсказки, на которые ориентируется пользователь при выборе схемы | Неверная подсказка уводит на неподходящую схему ГВС | **P2** |
| 15 | `logic/wallAssembly.js` + `externalWallsValidate.js` (T-17…T-21) | Расчёт U по слоям и жёсткие правила утеплителя; правила бросают 400 | Ложный 400 на валидной конструкции стены; либо занижение теплопотерь при неверном R | **P2** |
| 16 | `logic/apartmentStackBoundaries.js` (T-22…T-24) | Определяет, считаются ли пол/потолок квартиры | Квартира на последнем этаже без учёта чердака → недобор мощности | **P2** |
| 17 | `matching/enrichProposalBundlePrice.js` | Цены bundle в карточках proposal | Неверные цены в UI (не в основной смете) | **P2** |
| 18 | `recommendations/recommendationResolver.js` | При отсутствии кода в справочнике пишет техническую строку `[CODE] Текст рекомендації не знайдено` **в пользовательские warnings** (`:69`) | Пользователь видит внутренний код ошибки в отчёте | **P2** |
| 19 | `hydraulics/parseConnectionDiameter.js` | Fallback `bare` regex `\b(\d{1,2})\b` (`:42-46`) может поймать случайное число из строки каталога | Неверный `connectionNominalMm` в DTO (сейчас нигде не используется как ограничение — риск отложенный) | **P2** |
| 20 | Мёртвый экспорт `shouldTriggerUfhPipeResize` (T-147) | Экспортируется и валидируется в appliances (`ufhParasiticDownTriggerWm2`, `ufhParasiticDownToUpRatio`), но **не вызывается ни из одного модуля** | Справочник содержит пороги, которые ничего не делают — расхождение документации и поведения | **P2** |

---

## 5. Разбор `backend/scripts/fuzz-calc.ts`

652 строки, запуск `npm run test:fuzz` (`tsx scripts/fuzz-calc.ts [iterations]`, default 50).

### Что генерирует

Две фиксированные «персоны» (`:159`, `:423`, вероятность 50/50 через `Math.random() > 0.5`):

**`apartment_mixed_ufh`** (`:211-309`):
- комнат 2…5 (`randomIn(2,5,0)`), одна из них — кухня (случайный индекс);
- тип комнаты из `['гостиная','кухня','спальня','санузел','коридор']`;
- `areaM2` 10…24, `heightM` 2.5…2.8; `floor: 1`; `topBoundary/bottomBoundary: 'heated'`;
  `roomExteriorLayout: 'facade'` — **фиксировано**;
- ТП включается только для кухни и с вероятностью 50% для санузла; финиш из 4 материалов, шаг из [100,150,200];
- на каждую комнату — фасадная стена (6…14 м²) + окно (1200…1800 × 1200…1500 мм) + пол;
- `insideC ∈ {18,20,22}`, `outsideC ∈ {−15,−20,−22,−26}`;
- `heatingSystem` **жёстко фиксирован**: 75/65, `traditional_dt50_75_65`, `ufh_mixed_radiators`, `MAX_COMBI`;
- `hotWater`: residents 1…4, shower 1…2, sink 1…2, kitchenSink 1, bath 0…1, toilet 1…2, `tropicalShower: false`;
- `hydraulics`: `mainLineLengthM` 4…20, `deltaTSystemK: 20`.

**`house_radiators_ufh`** (`:312-420`):
- `floors ∈ {1,2}`, комнат 1…4, `areaM2` 10…30, `heightM` 2.6…3.0;
- ТП при типе кухня/санузел или с вероятностью 35%;
- `topBoundary: 'roof'` с вероятностью 15% на верхнем этаже; `bottomBoundary` по этажу;
- `boilerPlacementZone: 'kitchen'` — **всегда**, т.е. напольные котлы всегда отфильтрованы (T-57);
- схема ГВС случайная из трёх: `MAX_COMBI`, `SINGLE_INDIRECT_SUM`, `ELECTRIC_SEPARATE`;
- `tropicalShower` 50/50; residents 2…5.

**Распределения:** только `Math.random()` через `randomIn` (`:162-165`) и `pickRandom` (`:168-174`) —
равномерные. **Seed-детерминизма нет**: `Math.random()` не сидируется, воспроизвести упавший кейс нельзя.
Упавший payload **не сохраняется** — печатается только `profile`, номер итерации и текст ошибки.

### Какие инварианты уже проверяет

Строго говоря — почти никакие. Проверяется:
1. HTTP-статус: `200` → успех; `400` → счётчик `validationFailed` (**не считается провалом**, `:606-609`);
   `429` → провал после 8 ретраев; прочие / сетевые → `serverCrashed` → `process.exitCode = 1`.
2. «Deadlock»-эвристика (`:519-522`): в `calculations.underfloorHeating.rooms[].warnings` ищутся подстроки
   `'низкая скорость'` и `'высокий риск'`. **Обе — русские, а warnings петель ТП пишутся на украинском**
   (`ufhLoopHydraulics.js:539`: «низька швидкість … високий ризик завоздушування»). Детектор
   **никогда не срабатывает** — это баг скрипта.
3. Ретраи 429 с чтением `Retry-After` / `RateLimit-Reset` (`:46-63`) и троттлинг 120 мс между запросами.

Никаких проверок физики, сумм, монотонности или согласованности блоков отчёта нет.

### Что переиспользовать как основу property-based тестирования

- **Генераторы формы анкеты** (`buildFacadeEnvelope:181`, `generateApartmentMixedInput:211`,
  `generateHouseInput:312`) — готовые фабрики валидного `CalcRequestBody` с корректными `presetId`
  ограждений и согласованными `openingWidthMm/openingHeightMm/areaM2`. Это самая дорогая часть
  property-based теста, и она уже написана и типизирована (`satisfies readonly RoomType[]`).
- **Списки допустимых значений** (`FINISH_MATERIALS`, `ORIENTATIONS`, `PIPE_SPACINGS`,
  `HOUSE_BOILER_SCHEMES`, `APARTMENT_ROOM_TYPES`, `HOUSE_ROOM_TYPES`) — готовые домены для `fc.constantFrom`.
- **Извлекатели из ответа** (`readUfhWarnings:449`, `readHydraulicNotes:464`, `parseCalcErrorDetails:472`,
  `isRecord:444`) — type-safe навигация по `unknown`-ответу; переносится в assert-хелперы как есть.
- **Клиент с ретраями 429** (`postCalcWithRetry:83`, `parseRetryAfterMs:46`) — нужен любому HTTP-fuzz.
- **Структура сводки** (`printFuzzSummary:616`) — компактный отчёт без emoji для узкого терминала.

### Чего ему не хватает

1. **Детерминизма.** Нет seed → упавший кейс невоспроизводим. Нужен PRNG с seed из аргумента/ENV и
   печать seed в сводку.
2. **Сохранения контрпримера.** Payload упавшей итерации не пишется на диск. Нужен дамп в
   `scratch/fuzz-fail-<seed>-<i>.json`.
3. **Shrinking.** Нет минимизации падающего входа — ядро property-based подхода (`fast-check` даёт из коробки).
4. **Инвариантов вместо «не 500».** Ни одного свойства вида:
   `matching.boiler.requiredKw >= heatLoss.totalWatts/1000 × 1.15` при схемах без ГВС;
   `Σ commercial.lines[equipment].lineTotalUah === totals.equipmentTotalUah`;
   `totals.grandTotal === equipment × 1.55`;
   `Σ q↑ по комнатам === totalHeatFluxUpWatts`;
   монотонность: `outsideC ↓ ⇒ totalWatts ↑`, `residents ↑ ⇒ recommendedTankLiters не убывает`;
   `hydraulics.pressure.headRequiredM > 0` при непустом графе;
   единственность `resolvedEmitterKind` на объект.
5. **Локального прогона без HTTP.** Скрипт бьёт по `http://localhost:3001` → требует поднятый сервер,
   Mongo/файловый каталог, упирается в rate-limit. Для CI нужен вызов `buildReport({input, ctx})`
   напрямую с `CATALOG_SOURCE=file`.
6. **Покрытия пространства входов.** Не генерируются: `ufh_only`, `radiators` (только `mixed`),
   `objectMeta.apartmentStackPosition` кроме `middle_floor`, `boilerPlacementZone: 'boiler_room'`
   (⇒ напольные котлы никогда не подбираются), `ventilationReserveMode: 'recuperation'`,
   `facadeSystem: 'sftk'/'ventilated'`, `radiatorWiringSystemType` (всегда `auto`),
   `radiatorEmitterPreference`, `radiatorConnection: 'bottom'`, `ufhTerminalControl: 'unibox'`,
   `furnitureOccupiedAreaM2`, `bathroomAirTempC`, `coldWaterDesignSeason: 'summer'`,
   `pipeMaterialPreference`, `location` (климат), схемы `COMBI_BUFFER_ELECTRIC` и `SINGLE_BUFFER_ELECTRIC`
   (`HOUSE_BOILER_SCHEMES:153-157` — только 3 из 5), `residents: 0`, комнаты без окон.
7. **Разбитого детектора «deadlock»** — русские подстроки против украинских warnings (см. выше).
   Правильный сигнал уже есть структурно: `room.loopHydraulicsResolutionStatus === 'unresolved_*'`.
8. **Трактовки 400 как нормы.** `validationFailed` не роняет прогон (`:606-609`). Но генератор строит
   заведомо валидные анкеты — любой 400 здесь **и есть** искомый дефект «валидная анкета не проходит»,
   т.е. ровно главный симптом владельца. Сейчас он тонет в статистике.

---

## 6. НЕ ПРОВЕРЕНО

1. **Ни один verify-скрипт и `fuzz-calc.ts` не запускались** — `node_modules` не установлены (правило 4
   брифинга). Все утверждения о том, что скрипт «проверяет X», сделаны по чтению его кода, а не по прогону.
   Возможны скрипты, которые сейчас падают или молча выходят до ассертов.
2. **`backend/test_data.json.example`** прочитан только по описанию из `_CONTEXT.md` (126 SKU). Реальный
   состав пулов (сколько 1К/2К котлов проходит фильтр монтажа, есть ли панели VKP, каков минимальный Ø трубы)
   не сверялся — а от него зависит, срабатывают ли ветки fallback (T-59, T-61, T-188).
3. **`logic/envelopePresets.js`** (429 строк) прочитаны только сигнатуры экспорта; конкретные U/λ пресетов
   и их соответствие нормам не проверялись.
4. **`backend/src/api/validate.js`** и `calcInputSchemaLoader.js` не читались (вне списка каталогов задания),
   хотя они содержат фазы нормализации, вызывающие `assertExternalWalls`, `normalizeRoomExteriorLayouts`,
   `normalizeHeatingUfhPreset`, `normalizeApartmentStackPosition`. Порядок фаз и полный набор кодов 400
   не инвентаризован — это зона R-задачи по валидации входа.
5. **`backend/src/catalog/*`** (`validateCatalog.js`, `matchingSortPools.js`, `comparators.js`,
   `pipeCatalogHelpers.js`) не читались. `buildMatchingSortPools` определяет **порядок пула котлов**, от
   которого напрямую зависит T-62 («первый подходящий»). Сортировка не проверена — утверждение
   «по `powerKw.max ↑`» взято из имени поля `boilersSortedByMaxPower`, **не подтверждено кодом**.
6. **`backend/src/utils/pumpCurveMath.js`** не читался; `pumpHeadM(coefficients, q)` принята как
   `a·Q² + b·Q + c` по комментарию `pickPump.js:3`.
7. **`backend/data/recommendations.json`** (36 КБ) не читался — соответствие кодов `REC_*`/`WARN_*`,
   используемых в коде, содержимому справочника **не сверялось**. Отсутствие кода приводит к технической
   строке в пользовательских warnings (`recommendationResolver.js:69`) — это отдельный кейс для плана.
8. **`backend/data/underfloor_heating_presets.json`** не читался; значения `technical.*` взяты из
   ожиданий `verifyUfhPresets.js:31-40` (maxSurfaceTemperatureC = 29).
9. **`components/schemas/HydraulicsPipelineInput.yaml`** не читался — какие поля AJV делает обязательными
   и какие диапазоны задаёт, не инвентаризовано.
10. **Frontend-часть расчёта** (`frontend/src/**`) вне задания R1 и не анализировалась; вывод «все 12
    frontend verify — статический анализ» сделан по первым 10 строкам каждого файла и импортам
    (`readFileSync`/`readdirSync`), не по полному чтению.
11. **Покрытие «по строкам» не измерялось** — инструмента покрытия в проекте нет. Все оценки покрытия
    сделаны по графу импортов verify-скриптов и по тексту ассертов, а не по исполненным веткам.
