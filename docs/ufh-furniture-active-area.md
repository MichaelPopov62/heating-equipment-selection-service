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
L_змейка = S_акт / шаг_мм × 1000
```

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
| Змейка в полу | `heatedAreaM2 / шаг` | **да** |
| Подвод коллектор → комната | `estimateBranchLengthM(этаж, ufhCollectorBranch)` | **нет** |
| Магистраль котёл → распределитель | `hydraulics.mainLineLengthM` (анкета) | нет |

Лимит **20 кПа** на петлю (`ufhLoopHydraulics.js`) считается по длине **змейки** без подвода.

Подробнее: [`hydraulics-pipeline.md`](hydraulics-pipeline.md).

## Рекомендации (SSOT текстов)

Тексты — в `backend/data/recommendations.json`; навешивание — `applyUnderfloorHeatingRecommendations` / `applyUfhLoopHydraulicsRecommendations`.

| Код | Условие |
|-----|---------|
| `WARN_UFH_ACTIVE_AREA_INSUFFICIENT` | `q_треб > maxAllowableHeatFluxUpWm2` |
| `WARN_UFH_HEATED_AREA_ZERO` | `heatedAreaM2 ≤ 0` |
| `REC_UFH_PIPE_SPACING_AUTO` | `resolvedPipeSpacingMm ≠ requestedPipeSpacingMm` |
| `WARN_UFH_COVERAGE_LOW` | `heatFluxCoverageRatio < 0.95` |

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
- S_акт, q_треб, шаги — в блоке отчёта ТП.

## Verify

```bash
cd backend && npm run verify:ufh-active-area
cd backend && npm run verify:calc-schema
```

Чеклист: [`ufh-roadmap-test-checklist.md`](ufh-roadmap-test-checklist.md) — сценарий 5.

## Вне scope

- Ручной ввод длины подвода коллектор → комната.
- Изменение эвристики `estimateBranchLengthM`.
