# Гидравлика Pure Pipeline

Финальный агрегатор гидравлики: без пересчёта теплотехники upstream-модулей. Контракт отчёта — `components/schemas/Hydraulics*.yaml`, runtime — `backend/src/hydraulics/`.

## Принципы

1. **SSOT по теплу** — ТП, радиаторы и ГВС считают мощности и расходы; гидравлика только агрегирует.
2. **Два уровня входа** — `HydraulicsSurveyInput` (анкета) и `HydraulicsPipelineInput` (сервер после matching).
3. **Диаметры только в matching** — `matching.hydraulics.pipes[]` и `matching.hydraulics.proposal` (brand, model, price).
4. **Порядок в buildReport** — `matchEquipment` → `buildHydraulicsSnapshots` → `validateHydraulicsPipelineInput` → `runHydraulicsPipeline`.
5. **Зоны циркуляции** — Q и насосы по топологии (`resolveCirculationFlows` → `resolveSystemPumps`), не одной формулой `Math.max`.

## Маппинг upstream → DTO

| Поле DTO | Источник |
|----------|----------|
| `source.catalogBoilerId` | `matching.boiler.selected.id` или, если нет `id`, `selected.model` (file-каталог) |
| `source.*` (остальное) | `matching.boiler` + `heatingSystem` |
| `circuits.radiators` | `matching.radiators.byRoom[]` + `inputs` |
| `circuits.underfloor` | `calculations.underfloorHeating` |
| `circuits.dhw` | `calculations.hotWater` + `matching.indirectWaterHeater` |
| `layout.*` | `input.hydraulics` + `appliances.hydraulics` |
| `rules.*` | `appliances.hydraulics` (через `hydraulicsRulesFromAppliance`) |

## Модули

| Путь | Назначение |
|------|------------|
| `hydraulics/public.js` | Barrel API |
| `hydraulics/thermalLoadToFlow.js` | SSOT Q/(c·Δt) |
| `hydraulics/resolveCirculationFlows.js` | Зоны циркуляции, Q, топология |
| `hydraulics/resolveZoneHead.js` | Напор H по зоне |
| `hydraulics/resolveSystemPumps.js` | Подбор насосов (встроенный котла → каталог) |
| `hydraulics/pickPump.js` | `evaluatePumpModeAtDuty`, `pickPumpForSystem`, `evaluatePumpCurveAtDuty` |
| `hydraulics/buildSnapshots.js` | Сборка DTO |
| `hydraulics/validatePipelineInput.js` | AJV + cross-validation |
| `hydraulics/buildGraph.js` | Граф (радиаторы до смесителя ТП) |
| `hydraulics/pickPipe.js` | Подбор труб |
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

Документ MongoDB / `backend/data/appliances.json`, **`schemaVersion: 2`**. После изменения — `cd backend && npm run seed` и рестарт API (или TTL `REFERENCE_CACHE_TTL_MS`).

Поля попадают в `HydraulicsPipelineInput.rules` и в runtime через `CalcRuntimeContext`.

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

В seed `circulationPump` задан для **Vaillant ecoTEC pro VUW 246/5-3** и **Vaillant ecoTEC plus VU 246/5-5**.

## Отчёт `matching.hydraulics`

| Поле | Описание |
|------|----------|
| `topology` | `direct` \| `mixing_valve` \| `hydraulic_separator` |
| `circulationZones[]` | Зоны с Q, `pumpRole`, `requiresCatalogPump` |
| `pumps[]` | Подбор по зонам (`HydraulicsPumpMatchItem`) |
| `pump` | Legacy: котловая зона (`boiler_primary`) |
| `pumpSource` | `catalog` \| `boiler_builtin` |
| `proposal` | Клиентское предложение (трубы, насосы, цены) |

## Режимы emitters

- `radiators_only` — котёл → магистраль → ветки радиаторов
- `ufh_only` — котёл → коллектор ТП (смеситель / гидрострелка при необходимости)
- `mixed` — параллельно или через смеситель / гидрострелку

## Verify

```bash
cd backend && npm run verify:circulation-flows   # зоны Q, топологии
cd backend && npm run verify:pump-duty          # зона рабочей точки, геометрия каталога
cd backend && npm run verify:builtin-boiler-pump # circulationPump котла
cd backend && npm run verify:hydraulics-pipeline # end-to-end фикстуры calc
cd backend && npm run verify:ufh-loop-hydraulics # гидравлика петель ТП (logic/)
cd backend && npm run verify:seed-catalog       # контракт products + нормализация насосов
```
