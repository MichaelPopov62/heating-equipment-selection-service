# ТП: площадь под мебелью и активная зона пола

Учёт мебели без укладки трубы в комнатах с водяным тёплым полом.

## Разделение площадей

| Поле | Назначение |
|------|------------|
| `room.areaM2` | Полная площадь комнаты — теплопотери, объём, ограждения (**не меняется**) |
| `room.underfloorHeating.furnitureOccupiedAreaM2` | S_meb — площадь под мебелью без ножек / низкой посадки |
| `heatedAreaM2` (отчёт) | S_акт = S_комн − S_meb |

Валидация входа: `0 ≤ S_meb < S_комн`.

## Формулы расчёта

```
S_акт = max(0, S_комн − S_meb)
q_треб = Q_потерь_комнаты / S_акт     (при S_акт > 0)

норма укладки на 1 м²:  m_пм = layoutFactor / a
  a = шаг_мм / 1000
  layoutFactor = appliances.hydraulics.ufhLoopLengthLayoutFactor (классика 1.1)

L_сумм = S_акт × m_пм = S_акт / a × layoutFactor
L_петли = L_сумм / loopsCount
  (деление при L_сумм > maxUfhLoopLengthM; сейчас max = 80 м)
```

| Шаг | Норма м/м² при factor=1.1 |
|-----|---------------------------|
| 100 мм | 11.0 |
| 150 мм | 7.33 |
| 200 мм | 5.5 |

SSOT длины: `backend/src/logic/ufhLoopLength.js` (`computeUfhLoopTotalLengthM`, `ufhPipeMetersPerSqM`).  
Повороты в Δp считаются отдельно (`estimateUfhLoopElbowCount` + ζ) и **не** заменяют `layoutFactor`.

В отчёте комнаты: `pipeMetersPerSqM`, `loopLengthLayoutFactor`.

- **q↑** (Вт/м²) — из физики контура и лимита температуры поверхности (`maxAllowableHeatFluxUpWm2`).
- **Критерий краевого случая:** `q_треб > maxAllowableHeatFluxUpWm2` → `WARN_UFH_ACTIVE_AREA_INSUFFICIENT`.
- Суммарная отдача ТП: `heatFluxUpWatts = heatFluxUpWm2 × S_акт`.

Лимит q↑ **не** фиксированная константа 80–100 Вт/м²: `maxAllowableHeatFluxUpWm2 = (T_max_поверх − insideC) / R_финиш` (см. `ufhRoomHeatFlux.js`).

## Авто-шаг укладки (вариант B)

В анкете `pipeSpacingMm` — **желаемый** шаг (`requestedPipeSpacingMm`).

Сервер подбирает `resolvedPipeSpacingMm` перебором **100 → 150 → 200** мм (меньший шаг → выше q↑): первый шаг, при котором `deliverable q↑ ≥ q_треб`.

| `pipeSpacingResolution` | Смысл |
|-------------------------|--------|
| `matched_requested` | Запрошенный шаг достаточен |
| `tightened` | Применён меньший шаг, чем запрошен |
| `none_sufficient` | Даже 100 мм не покрывает q_треб в пределах лимита поверхности |

В отчёте `pipeSpacingMm` = фактический (`resolvedPipeSpacingMm`).

## Гидравлика

| Участок | Источник длины | Зависит от мебели |
|---------|----------------|-------------------|
| Петля ТП в стяжке | `loopLengthM` = `S_акт / шаг × layoutFactor / loopsCount` | **да** |
| Транзит до коллектора ТП (этаж) | `ufhCollectorTransit[].transitLengthM` = `estimateBranchLengthM(этаж, ufhCollectorBranch)` | **нет** |
| Магистраль котёл → распределитель | `hydraulics.mainLineLengthM` (анкета) | нет |

Лимит **20 кПа** на петлю (`ufhLoopHydraulics.js`) считается по **`loopLengthM`** без транзита.

Форма укладки в полу (меандр, улитка) в backend **не задаётся** явно — длина с `layoutFactor=1.1` (классический запас на повороты); местные потери — отдельно через ζ.

Подробнее: [`hydraulics-pipeline.md`](hydraulics-pipeline.md).

## Рекомендации (SSOT текстов)

Тексты — в `backend/data/recommendations.json`; навешивание — `applyUnderfloorHeatingRecommendations` / `applyUfhLoopHydraulicsRecommendations`.

| Код | Условие |
|-----|---------|
| `WARN_UFH_ACTIVE_AREA_INSUFFICIENT` | `q_треб > maxAllowableHeatFluxUpWm2` |
| `WARN_UFH_HEATED_AREA_ZERO` | `heatedAreaM2 ≤ 0` |
| `REC_UFH_PIPE_SPACING_AUTO` | `resolvedPipeSpacingMm ≠ requestedPipeSpacingMm` |
| `WARN_UFH_COVERAGE_LOW` | `heatFluxCoverageRatio < 0.95` (`heatFluxCoverageStatus === 'low'`) |

### `WARN_UFH_COVERAGE_LOW` — шаги устранения (UI)

В `recommendations.json` у кода заданы **`resolutionSteps`** (тот же паттерн, что у `WARN_UFH_PARASITIC_DOWN_HEATED` / `WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE` / низкой скорости петель):

1. **Добавьте радиатор или конвектор** — режим «ТП + радиаторы», закрытие дефицита прибором.
2. **Уменьшите шаг укладки трубы** — 200 → 150/100 мм, рост q↑.
3. **Замените тип чистового покрытия** — более теплопроводный финиш.
4. **Снизьте теплопотери ограждений** — утепление / окна / площади.

В отчёте ТП (`UnderfloorHeatingReportView`): тексты WARN по комнатам агрегируются в общий блок с кнопкой **«Устранение предупреждения»** → модалка `UfhWarningResolutionDialog` (шаги из `resolvedRecommendations`). Если API ещё без `resolutionSteps` (кэш/Mongo до seed) — UI подставляет fallback `UFH_COVERAGE_LOW_RESOLUTION_STEPS_FALLBACK` (тот же первый шаг «Добавьте радиатор или конвектор»). Классификация и дедуп — `ufhWarningDisplay.ts` (`UFH_WARN_COVERAGE_LOW_CODE`, `collectCoverageLowWarnings` из room.warnings и resolvedRecommendations).

В шаблоне текста мощности **`heatFluxUpWatts`** / **`roomHeatLossWatts`** округляются до целых Вт (`recommendationVarsForRoom` в `matching/warmFloor.js`).

## Модули backend

| Файл | Ответственность |
|------|-----------------|
| `logic/ufhActiveFloorArea.js` | S_акт |
| `logic/ufhRequiredHeatFlux.js` | q_треб |
| `logic/ufhPipeSpacingResolve.js` | Авто-шаг (вариант B) |
| `logic/ufhRoomHeatFlux.js` | q↑, мощность на S_акт |
| `logic/ufhRoomCoverageCheck.js` | Проверки (структура, без текстов) |
| `logic/ufhLoopGeometry.js` | Длина петель по S_акт |
| `logic/warmFloorCalc.js` | Оркестратор |

## UI

- Поле «Площадь, занятая мебелью…» только при включённом ТП в комнате.
- Tooltip с пояснением; **без** отображения вычисляемой S_акт в hint анкеты.
- S_акт, q_треб, шаги, **число и длина петель** — в блоке отчёта ТП.
- При `WARN_UFH_COVERAGE_LOW` — блок предупреждений + кнопка устранения с `resolutionSteps` (см. выше).

## Verify

```bash
cd backend && npm run verify:ufh-active-area
cd backend && npm run verify:calc-schema
```

Чеклист: [`ufh-roadmap-test-checklist.md`](ufh-roadmap-test-checklist.md) — сценарий 5.

## Вне scope

- Ручной ввод длины транзита коллектора ТП (только эвристика этажа).
- Детализация формы укладки (змейка / улитка) в гидравлике.
