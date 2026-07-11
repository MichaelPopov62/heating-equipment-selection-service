# Гидравлика Pure Pipeline

Финальный агрегатор гидравлики: без пересчёта теплотехники upstream-модулей. Контракт отчёта — `components/schemas/Hydraulics*.yaml`, runtime — `backend/src/hydraulics/`.

## Принципы

1. **SSOT по теплу** — ТП, радиаторы и ГВС считают мощности и расходы; гидравлика только агрегирует.
2. **Два уровня входа** — `HydraulicsSurveyInput` (анкета) и `HydraulicsPipelineInput` (сервер после matching).
3. **Диаметры только в matching** — `matching.hydraulics.pipes[]` и `matching.hydraulics.proposal` (brand, model, price).
4. **Порядок в buildReport** — `matchEquipment` → резолв `distributionPreset` ТП → **`pickManifolds`** (`matching.manifolds`, см. [`manifold-matching.md`](manifold-matching.md)) → `buildHydraulicsSnapshots` → `validateHydraulicsPipelineInput` → `runHydraulicsPipeline`.
5. **Зоны циркуляции** — Q и насосы по топологии (`resolveCirculationFlows` → `resolveSystemPumps`), не одной формулой `Math.max`.
6. **Коллектор в графе ≠ SKU** — узлы `ufh_collector` / `radiator_distribution_manifold` задают топологию и длины; позиция каталога для сметы — `matching.manifolds`. Каскад ТП при >12 петлях на этаж (`units[]`) увеличивает число SKU в смете, **не** число узлов графа (один `ufh_collector_floor_N` на этаж).

## ΔT расхода vs температурный график

Два независимых поля для радиаторного контура:

| Поле | Смысл | Пример |
|------|--------|--------|
| `thermalRegime.deltaTK` | Перепад **номинального графика** `supplyC − returnC` | 75/65 → 10 K |
| `flowDeltaTK` | ΔT для **расчёта расхода** Q = P/(c·ΔT) | анкета `deltaTSystemK: 20` |

`input.hydraulics.deltaTSystemK` может отличаться от ΔT графика — это нормально для проектного расчёта гидравлики. Резолвер — `resolveFlowDeltaTK.js`; расходы по комнатам считаются в `pickRadiatorsCore` и попадают в pipeline через `matching.radiators.byRoom[].flowRateM3PerHour`.

## SurveySession (единый pipeline анкеты)

Все мутации анкеты проходят через `dispatch` → `runSurveyMutationPipeline` (`frontend/src/surveySession/`). Подробнее — [`frontend-calc-runner.md`](frontend-calc-runner.md).

Кратко:

1. `reduceSurveyMutation` — черновик
2. `migrateDerivedState` — синхронизация ТП, layout v3 (`wiringLayoutV3`)
3. `buildCalcInputKeyFromDraft` — ключ calc
4. `decideCalcAction` — schedule / abort / manual
5. `useSurveyCalc` — HTTP-исполнитель calc (React Query)

Черновик: `SURVEY_DRAFT_SCHEMA_VERSION=4`, поля `hydraulicsForm`, `wiringLayoutV3`. Verify: `cd frontend && npm run verify:survey-session`.

**UI анкеты (шаг «Гидравлика»):** `HydraulicsSection` — вертикальный radio-список типа разводки (4 схемы с пояснениями под каждым пунктом; `auto` — «Рекомендуется»), длина магистрали котёл → коллектор, таблица подводов коллектор → радиатор по комнатам; для `two-pipe-dead-end` / `two-pipe-pass` — порядок строк (кнопки ↑↓). Подписи — `wiringSystemTypeLabels.ts`. См. [`survey-draft.md`](survey-draft.md) § UI шага «Гидравлика`.

### Схемы разводки радиаторов (`wiringLayoutV3` → граф)

| `wiringLayoutV3.systemType` | `hydraulics.radiatorWiringSystemType` | Топология в `buildRadiatorSubgraph.js` |
|-----------------------------|---------------------------------------|----------------------------------------|
| `auto` | `auto` | Звезда от `main_collector` + `rad_micro_manifold` для микроветок |
| `two-pipe-dead-end` | `two-pipe-dead-end` | Цепочка `radiator_trunk_junction`, Q на `trunk` убывает |
| `two-pipe-pass` | `two-pipe-pass` | Та же цепочка, Q на `trunk` = total |
| `manifold` | `manifold` | Узел `radiator_distribution_manifold`, параллельные ветки |

Порядок радиаторов на магистрали — `radiatorBranchOverrides[]` (из `wiringLayoutV3.branches`). Новые `segmentRole`: `trunk`; узлы: `radiator_trunk_junction`, `radiator_distribution_manifold`. Verify: `npm run verify:radiator-wiring-graph`, фикстуры `radiators_wiring_*` в `verify:hydraulics-pipeline`.

**Подбор trunk (dead-end / pass):** `pickTrunkChain.js` — каскад от downstream к upstream. На участке с максимальным Q — минимальный Ø при `v ≤ mainMax`. При `v < mainMin` **не** откатываться к guard 12 мм: удерживать `Dвн ≥ Ø` следующего downstream-участка (магистраль только заужается, не расширяется).

Подбор труб (`pickPipe.js` + `pipeCatalogPoolFilter.js`): **сначала guard Dвн** (`mainTransitMinInternalDiameterMm` / `branchMinInternalDiameterMm` из `appliances.hydraulics` v4), затем трёхрежимный fallback внутри отфильтрованного пула — (1) минимальный Ø при `v ≤ vMax`; (2) при перегрузке — max Ø + `velocityLimitExceeded`; (3) при микропотоке — min Ø из guard-пула + `velocityBelowMin`. На транзите котла (`isMainLine: true`) guard **приоритетнее** `mainMin`.

Группировка микроветок (`groupRadiatorGraphBranches.js` + `buildGraph.js`): комнаты с `flow < minFlowM3PerHourForIndividualBranch` или `heatLoad < minHeatLoadWattsForIndividualBranch` объединяются в узел `radiator_manifold` (`rad_micro_manifold`); комнаты с нулевой нагрузкой (`skipRadiator` от ТП или **Ф5 skip** внутренних микрокомнат) не попадают в граф. `Σ designFlow` по веткам графа = `circuits.radiators.totalFlowRateM3PerHour`.

### Ф5 «Тамбур» — микронагрузка на радиатор

Порог и типы входных зон — `appliances.radiator.microLoad` (v2): `minDesignWattsThreshold` (150 Вт), `entryRoomTypes` (`прихожая`, `коридор`, `тамбур`).

| Условие | Действие |
|---------|----------|
| `qRad < порога` и (тип входной зоны **или** `roomExteriorLayout` = `facade`/`corner`) | Минимальный прибор (`pickMinimumViableRadiatorSizing`), `radiatorDesignWatts ≥ порога` для гидравлики |
| `qRad < порога` и внутреннее помещение | `radiatorDesignWatts = 0` — в микроколлектор / переток |
| `qRad ≥ порога` | Обычный подбор |

Модуль: `matching/internal/resolveMicroLoadRadiatorStrategy.js`. Verify: `npm run verify:micro-load-radiator`. Рекомендации: `REC_RADIATOR_ENTRY_ZONE_MINIMUM`, `REC_RADIATOR_MICRO_LOAD_SKIP`.

| Поле guard / скорости | Назначение | MVP |
|-----------------------|------------|-----|
| `mainTransitMinInternalDiameterMm` | Мин. Dвн (мм) для `isMainLine` | 20 |
| `branchMinInternalDiameterMm` | Мин. Dвн (мм) для веток | 12 |
| `mainMin` / `mainMax` | Скорость магистрали | 0.2 / 0.8 м/с |
| `branchMin` / `branchMax` | Скорость веток | 0 / 0.5 м/с |

**`isMainLine: true`:** `e_boiler_main`, `e_boiler_separator`, `e_main_to_mixing`. Не путать с `segmentRole: main` на `e_*_to_ufh_collector`.

**Исключение:** `segmentRole: ufh_loop` — guard Dвн не применяется (отдельный пул и min номинальный Ø в `ufhLoopHydraulics.js`).

| Поле `radiatorBranchGrouping` | Назначение |
|-------------------------------|------------|
| `minFlowM3PerHourForIndividualBranch` | Порог Q для отдельной ветки (~0.019 м³/ч ≈ v=0.05 на Ø16) |
| `minHeatLoadWattsForIndividualBranch` | Порог мощности (150 Вт) |
| `manifoldTrunkLengthM` | Длина общего шлейфа коллектора |
| `localZetaManifold` | Местные потери коллектора (Δp) |

### Кейс: mixed + ТП + offset (квартира, гидрострелка)

Фикстура `apartment_mixed_ufh_micro_branches` в `verifyHydraulicsPipeline.js` — регрессия бага Ø63 на микроветках.

| Было (до группировки) | Стало |
|------------------------|--------|
| 4 отдельных ребра r1–r4 с Q ≈ 0.01 / 0.005 / 0.004 / 0.002 м³/ч → fallback max Ø (p-27, Ø63) | 1 ребро `e_*_to_rad_micro_manifold`, Q ≈ 0.021 м³/ч → min Ø из guard-пула (Dвн ≥ 12) |
| r5, r6 — отдельные ветки | без изменений |
| 6 листьев в балансировке | 3: manifold + r5 + r6 |

Условия: `heatingEmittersMode=mixed`, `underfloorDistributionPreset=auto` → гидрострелка; комнаты с ТП получают `radiatorDesignWatts` за вычетом `heatFluxUpWatts` — малый остаток попадает в `microConsumers` по порогам `radiatorBranchGrouping`. `Σ designFlow` веток графа = `circuits.radiators.totalFlowRateM3PerHour`. Транзит котла (`e_boiler_separator`) — Dвн ≥ 20 мм (guard), не p-01.

### Кейс: mixed + ТП + НСУ (квартира, mixing_valve)

Фикстура `apartment_mixed_ufh_mixing_valve` — регрессия guard на `e_boiler_main` / `e_main_to_mixing` при Q≈0,075 м³/ч (низкая отопительная нагрузка, пик ГВС < 50 кВт → авто-НСУ, не гидрострелка).

### Вне scope этого пайплайна: НСУ (`collector_mixing_valve`)

Ветка `resolveCirculationFlows` для смесительного узла ТП использует `qMainThermal = (pRad + pUfh) / (c·ΔT_boiler)`. Если upstream когда-либо передаст несбалансированные `pRad`/`pUfh` (двойной учёт теплопотерь), расход первички завысится. Для mixed+offset с гидрострелкой (типовой кейс verify) баланс `pRad + pUfh = heatLoss.totalWatts` подтверждён — отдельная задача, если появится отчёт с НСУ и расхождением мощностей.

## Маппинг upstream → DTO

| Поле DTO | Источник |
|----------|----------|
| `source.catalogBoilerId` | `matching.boiler.selected.id` или, если нет `id`, `selected.model` (file-каталог) |
| `source.*` (остальное) | `matching.boiler` + `heatingSystem` |
| `source.deltaTK` | `resolveFlowDeltaTK(input.hydraulics.deltaTSystemK, heatingSystem)` — ΔT для Q котлового контура |
| `circuits.radiators.flowDeltaTK` | `matching.radiators.inputs.flowDeltaTK` |
| `circuits.radiators.thermalRegime.deltaTK` | `supplyC − returnC` графика (не для Q) |
| `circuits.radiators.consumers[].flowRateM3PerHour` | `matching.radiators.byRoom[]` |
| `circuits.radiators` (остальное) | `matching.radiators.byRoom[]` + `inputs` |
| `circuits.underfloor` | `calculations.underfloorHeating` |
| `circuits.dhw` | `calculations.hotWater` + `matching.indirectWaterHeater` |
| `layout.*` | `input.hydraulics` + `appliances.hydraulics` |
| `rules.*` | `appliances.hydraulics` (через `hydraulicsRulesFromAppliance`) |

## Модули

| Путь | Назначение |
|------|------------|
| `hydraulics/public.js` | Barrel API |
| `hydraulics/thermalLoadToFlow.js` | SSOT Q/(c·Δt) |
| `hydraulics/resolveFlowDeltaTK.js` | SSOT ΔT расхода (анкета → fallback график) |
| `hydraulics/resolveCirculationFlows.js` | Зоны циркуляции, Q, топология |
| `hydraulics/resolveZoneHead.js` | Напор H по зоне |
| `hydraulics/resolveSystemPumps.js` | Подбор насосов (встроенный котла → каталог) |
| `hydraulics/pickPump.js` | `evaluatePumpModeAtDuty`, `pickPumpForSystem`, `evaluatePumpCurveAtDuty` |
| `hydraulics/buildSnapshots.js` | Сборка DTO |
| `hydraulics/validatePipelineInput.js` | AJV + cross-validation |
| `hydraulics/groupRadiatorGraphBranches.js` | Группировка микроветок радиаторов в графе |
| `hydraulics/buildGraph.js` | Граф (радиаторы до смесителя ТП) |
| `hydraulics/pickPipe.js` | Подбор труб (guard Dвн + скорость) |
| `hydraulics/pickTrunkChain.js` | Каскадный подбор trunk dead-end/pass (монотонное заужение Ø) |
| `hydraulics/pipeCatalogPoolFilter.js` | Guard мин. внутреннего Ø |
| `hydraulics/buildHydraulicsProposal.js` | Предложение клиенту |
| `hydraulics/pressureDrop.js` | Δp, критическое кольцо |
| `hydraulics/circulationLoops.js` | Сумма Δp по веткам |
| `hydraulics/runHydraulicsPipeline.js` | Оркестратор |
| `utils/pumpCurveMath.js` | H(Q), нормализация qMax, геометрия кривой (каталог) |
| `catalog/validateCatalog.js` | Валидация `pumps[]` и `boiler.circulationPump` |

## Топологии и расход Q

`resolveCirculationFlows` строит зоны и возвращает:

| Поле | Смысл |
|------|--------|
| `primaryMainLineFlowM3PerHour` | Расход котловой зоны **по отоплению** (из `boiler_primary.designFlowM3PerHour` до корректировки БКН) |
| `boilerPumpDesignFlowM3PerHour` | Расход котлового насоса **с учётом приоритета ГВС** (`max` отопление / змеевик) |

| Сценарий | Условие | Q котлового насоса | Зональные насосы |
|----------|---------|-------------------|------------------|
| Прямое подключение | `mixed`, без смесителя | `Q_rad + Q_ufh` | — |
| Смесительный узел ТП | `distributionPreset=collector_mixing_valve` | `(P_rad+P_ufh)/(c·ΔT_boiler)` | ТП: `Q_ufh` |
| Гидрострелка | `distributionPreset=hydraulic_separator` | `max(P/(c·ΔT), (Q_rad+Q_ufh)·(1+primaryFlowMarginPercent/100))` | Радиаторы, ТП |
| БКН (приоритет ГВС) | `circuits.dhw` storage + indirectTank | `max(Q_отопления, Q_змеевика)` на `boiler_primary` | зона `dhw_coil` без насоса из каталога |

## Правила `appliances.hydraulics`

Документ MongoDB / `backend/data/appliances.json`, **`schemaVersion: 4`** (`branchMin`, `radiatorBranchGrouping`, `mainTransitMinInternalDiameterMm`, `branchMinInternalDiameterMm`). После изменения — `cd backend && npm run seed` и рестарт API (или TTL `REFERENCE_CACHE_TTL_MS`).

Поля попадают в `HydraulicsPipelineInput.rules` и в runtime через `CalcRuntimeContext`.

### Длины трасс ТП и мебель

| Участок | Формула | Зависит от S_meb |
|---------|---------|------------------|
| Петля в стяжке (`loopLengthM`) | `heatedAreaM2 / pipeSpacingMm / loopsCount` | **да** |
| Транзит до коллектора ТП (`ufh_collector_transit`) | `estimateBranchLengthM(этаж, ufhCollectorBranch)` — одно ребро на этаж | нет |
| Подвод радиатора | `radiatorBranchOverrides[].pipeLengthToEquipmentM` или дефолт из rules | нет |
| Магистраль котёл → распределитель | `hydraulics.mainLineLengthM` (анкета) | нет |

Топология ТП в `buildGraph.js`: узел `ufh_collector_floor_{F}` на каждый этаж; ребро `ufh_collector_transit` от upstream (mixing_node / main) до коллектора; петли `ufh_loop` параллельно от коллектора, `edge.lengthM = loop.loopLengthM` **без** транзита.

См. [`ufh-furniture-active-area.md`](ufh-furniture-active-area.md).

| Поле | Значение MVP | Назначение |
|------|--------------|------------|
| `pumpHeadMarginPercent` | 12 | Нижний целевой запас по напору: `H_target = H_sys × (1 + %/100)` |
| `pumpDutyQMaxUtilizationPercent` | 85 | Рабочая точка не ближе правого края: `Q ≤ qMax × %/100` |
| `pumpMinHeadAtDutyM` | 0.3 | Минимальный `H(Q)` в рабочей точке (м) |
| `pumpMaxHeadMarginPercent` | 60 | Верхний запас по напору; выше — отказ (`head_oversized`) |
| `pumpMinHeadAtQMaxM` | 0.5 | Минимальный `H(qMax)` при валидации кривой в каталоге |
| `primaryFlowMarginPercent` | 12 | Запас расхода первички при гидрострелке |
| `balancingValveKPaPerTurn` | 3 | Балансировка веток |
| `ufhLoopDeltaTK`, `ufhLoopVelocityMinMps`, `ufhLoopVelocityMaxMps`, `maxUfhLoopPressureDropKPa` | 10 / 0.2 / 0.7 / 20 | Петли ТП (`ufhLoopHydraulics.js`) |
| `ufhLoopMinNominalDiameterMm` | 16 | Мин. номинал трубы ТП в каталоге |
| `ufhParasiticDownTriggerWm2`, `ufhParasiticDownToUpRatio` | 5 / 0.15 | Триггер оптимизации Ø при q↓ в перекрытие |
| `ufhLoopPipeResizeEnabled`, `ufhLoopPressureUtilizationForResize` | true / 0.85 | Совместный подбор Ø и числа петель |
| `velocityLimitsMps`, `defaultLengthsM`, `roughnessMmByMaterial`, `localLossZeta`, `maxUfhLoopLengthM` | см. JSON | Трубы, петли ТП, граф |

## Кривая насоса в каталоге

Формула: **H(Q) = a·Q² + b·Q + c** (Q — м³/ч, H — м). Контракт: `PumpCatalogItem.yaml`, `BoilerCatalogItem.circulationPump`.

При `validateAndNormalizeCatalog` для каждого режима `operatingModes` (насосы и `boiler.circulationPump`):

1. **`normalizePumpModeQMaxToCurve`** — если паспортный `qMax` шире кривой, `qMax` **подрезается** до max Q с `H ≥ pumpMinHeadAtQMaxM`.
2. **`assertPumpModeCurveGeometry`** — `H(qMin) > 0`, `H(qMax) ≥ pumpMinHeadAtQMaxM`, кривая убывает на `[qMin, qMax]`.

Константа `PUMP_CURVE_MIN_HEAD_AT_QMAX_M` в `pumpCurveMath.js` согласована с `pumpMinHeadAtQMaxM` в appliances.

**Заполнение каталога:** сначала точки H(Q) из паспорта → коэффициенты → `qMax` = последняя точка с достаточным напором, не «максимальный расход из буклета» без проверки полинома.

## Зона рабочей точки (`evaluatePumpModeAtDuty`)

Единая проверка для `pickPumpForSystem` и `evaluatePumpCurveAtDuty` (встроенный насос котла). Пороги — `dto.rules` → `pumpDutyRulesFromHydraulicsRules`.

| Проверка | Условие отказа |
|----------|----------------|
| `out_of_flow_range` | `Q < qMin` или `Q > qMax` (после нормализации каталога) |
| `near_qmax` | `Q > qMax × pumpDutyQMaxUtilizationPercent / 100` |
| `negative_or_tiny_head` | `H(Q) < pumpMinHeadAtDutyM` |
| `insufficient_head` | `H(Q) < H_target` |
| `head_oversized` | `(H(Q) − H_sys) / H_sys × 100 > pumpMaxHeadMarginPercent` |

**Выбор насоса:** среди режимов с `ok: true` — **минимальный** запас по напору (не самый мощный насос в каталоге).

## Подбор насосов (`resolveSystemPumps`)

1. `resolveCirculationFlows` — duty points по зонам.
2. `resolveHeadForZone` — H по зоне из `pressure`.
3. Для каждой зоны с `requiresCatalogPump`:
   - **main:** если у котла в каталоге есть `circulationPump.operatingModes` — `evaluatePumpCurveAtDuty`; при успехе `pumpSource: boiler_builtin`, иначе fallback в каталог;
   - **все зоны:** `pickPumpForSystem` из `catalog.pumps` (тип `circulation_hot_water` пропускается).

Поиск котла в каталоге: `source.catalogBoilerId` сопоставляется с `boiler.id` **или** `boiler.model`.

В seed `circulationPump` задан для **Vaillant ecoTEC pro VUW 246/5-3**, **Vaillant ecoTEC plus VU 246/5-5**, **Baxi ECO Home 24 F** (3 скорости, q_min=0,4 м³/ч) и **Baxi Luna Duo-Tec E 33** (3 скорости, q_min=0,5 м³/ч). Кривые — **полезный напор**; коэффициенты через `fitPumpCurveFromThreePoints` в `pumpCurveMath.js`.

### Встроенный насос Baxi (Ф2)

| Условие | `issue` / `builtinPumpDuty.status` | Действие |
|---------|-------------------------------------|----------|
| Q < min(qMin режимов) | `below_manufacturer_qmin` | Встроенный насос **учтён**; для настенного котла **без** fallback в каталог |
| Q > qMax режима или H(Q) < `pumpMinHeadAtDutyM` | `curve_unavailable` | Режим не подбирается |
| H(Q) < headTarget | `insufficient_head` | Режим не подбирается |
| OK | `ok` | `pumpSource: boiler_builtin`, режим с минимальным запасом (без `head_oversized` для встроенного) |

Рекомендация: `WARN_BOILER_HEATING_FLOW_BELOW_MIN` при `below_manufacturer_qmin`.

**Где смотреть в JSON-отчёте:**

| Поле | Путь |
|------|------|
| Статус встроенного насоса | `matching.hydraulics.builtinPumpDuty.status` (`ok` \| `below_manufacturer_qmin` \| …) |
| Режим насоса котла | `matching.hydraulics.pumps[]` с `pumpSource: boiler_builtin` |
| Структурированное предупреждение | `report.recommendations[]` — код `WARN_BOILER_HEATING_FLOW_BELOW_MIN` |
| Текст в proposal | `matching.hydraulics.proposal` / `matching.hydraulics.warnings` |

Условие срабатывания: расчётный расход котлового контура ниже `qMin` всех режимов `circulationPump` выбранного котла (Baxi ECO Home 24 F: 0,4 м³/ч; Luna Duo-Tec E 33: 0,5 м³/ч). Для **настенного** котла при `below_manufacturer_qmin` **нет** fallback в каталог насосов — учитывается встроенный насос с предупреждением.

## Отчёт `matching.hydraulics`

| Поле | Описание |
|------|----------|
| `topology` | `direct` \| `mixing_valve` \| `hydraulic_separator` |
| `circulationZones[]` | Зоны с Q, `pumpRole`, `requiresCatalogPump` |
| `pumps[]` | Подбор по зонам (`HydraulicsPumpMatchItem`) |
| `pump` | Legacy: котловая зона (`boiler_primary`) |
| `pumpSource` | `catalog` \| `boiler_builtin` |
| `builtinPumpDuty` | Встроенный насос котла: Q, q_min, `status`, выбранный режим |
| `proposal` | Клиентское предложение (трубы, насосы, цены) |

## Режимы emitters

- `radiators_only` — котёл → магистраль → ветки радиаторов
- `ufh_only` — котёл → коллектор ТП (смеситель / гидрострелка при необходимости)
- `mixed` — параллельно или через смеситель / гидрострелку

## Dev: почему UI не меняется после правок

| Действие | Что обновляет | Чего **не** обновляет |
|----------|---------------|------------------------|
| `npm run seed` | MongoDB: `appliances`, `recommendations`, `products` | JS-модули `pickPipe.js`, `buildGraph.js` в памяти API |
| `npm run start` (рестарт) | Код backend из `backend/src/` | Кэш bundle, если TTL ещё не истёк |
| Пересчёт в UI (POST `/api/v1/calc`) | JSON-отчёт в React | Ничего без рестарта API при смене **кода** |

**Обязательно после merge/коммита гидравлики:** остановить API (`Ctrl+C`) и снова `cd backend && npm run start` (или `npm run dev` с nodemon).

**После `seed` в dev:** in-memory bundle (`REFERENCE_CACHE_TTL_MS`, по умолчанию 1 ч) может остаться старым. Варианты: рестарт API; `AUTO_INVALIDATE_CACHE=true` + `SYSTEM_INTERNAL_TOKEN` в `backend/.env` (см. `.env.example`); `POST /api/v1/system/invalidate-reference-cache`.

**В UI:** подписи `groupedRoomIds` и `(ниже нормы)` — только в раскрываемом блоке **«Детализация по участкам»**; сводная таблица **«Контур отопления (радиаторы)»** показывает агрегат по позициям каталога (суммарная длина), без списка комнат. `REC_RADIATOR_MICRO_BRANCH_MANIFOLD` (`category: automationHints`) попадает в `report.recommendations`, но **не** в `matching.hydraulics.warnings` — в блоке гидравлики видны только строковые `warnings` pipeline.

## Verify

```bash
cd backend && npm run verify:flow-delta-tk       # SSOT resolveFlowDeltaTK
cd backend && npm run verify:circulation-flows   # зоны Q, топологии
cd backend && npm run verify:pump-duty          # зона рабочей точки, геометрия каталога
cd backend && npm run verify:builtin-boiler-pump # circulationPump котла (Baxi 6 режимов)
cd backend && npm run verify:fit-pump-curve      # аппроксимация H(Q) Baxi
cd backend && npm run verify:pick-pipe           # fallback min/max Ø + guard транзита
cd backend && npm run verify:pipe-catalog-pool-filter  # guard Dвн пула каталога
cd backend && npm run verify:hydraulics-pipeline # end-to-end фикстуры calc
cd backend && npm run verify:micro-load-radiator  # Ф5 Тамбур
cd backend && npm run verify:ufh-loop-hydraulics # гидравлика петель ТП (logic/)
cd backend && npm run verify:seed-catalog       # контракт products + нормализация насосов
```
