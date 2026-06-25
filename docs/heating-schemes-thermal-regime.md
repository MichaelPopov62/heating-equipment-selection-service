# Схемы котла/ГВС и температурный график (v3)

Документ описывает пять схем подбора котла, связь с ГВС и правила **рекомендации** (не блокировки) температурного графика радиаторов.

Источник констант: `shared/heatingMatchingSchemes.js`, `shared/heatingThermalRegimeRecommendations.js`.

---

## Пять схем `hotWaterBoilerPowerMatchingScheme`

| Код API | Суть подбора `requiredKw` |
|---------|---------------------------|
| `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw` | 2К: **max**(отопление×запас, ГВС); для дома с storage — пик `peakThermalPowerKw` |
| `heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater` | 1К: только отопление×запас; ГВС — электронакопитель |
| `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw` | 1К+БКН: отопление×запас **+** мощность нагрева бака; учёт `minSourcePowerKw` БКН |
| `combiBoilerWithBufferElectricStorage` | 2К+буферный ЭВН: max(отопление×запас, пик ГВС); буфер из `water_norms.combiBufferElectricStorage` |
| `singleCircuitBoilerWithBufferElectricStorage` | 1К+буферный ЭВН: котёл только по отоплению×запас; ГВС через накопитель (`water_norms.singleCircuitBufferElectricStorage`) |

Фильтр контура котла: `resolveBoilerCircuitFilterMode` в `backend/src/utils/boilerMatchingByType.js`.

Квартира без БКН: схема `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw` нормализуется на max-комби (warning в `matching.boiler.warnings`).

---

## Температурный график радиаторов (unlock)

Допустимые пресеты в анкете (оба всегда разрешены):

- `traditional_dt50_75_65` — 75/65 °C
- `condensing_dt30_55_45` — 55/45 °C

Пресет `traditional_high_dt70_95_85` (95/85) — **legacy API**, не используется в UI массового рынка.

### Рекомендация по схеме (не lock)

| Группа схем | Рекомендуемый график |
|-------------|----------------------|
| 2К (`maximumBetween…`, `combiBoilerWithBuffer…`) | 55/45 |
| 1К (`heatingLoadWithReserveOnly…`, `singleCircuit…Indirect…`, `singleCircuit…Buffer…`) | 75/65 |

Функции:

- `recommendedThermalRegimePresetForScheme(scheme, objectType)` — подсказка по умолчанию
- `thermalRegimeRecommendationHint(...)` — текст для UI, если пользователь выбрал иной график
- `allowedThermalRegimePresetsForScheme` — всегда оба рабочих пресета

Расчёт **всегда** идёт по выбранному пользователем графику. Подсказки попадают в `_normalizationWarnings` → `matching.boiler.warnings`.

### Конденсационный котёл + высокий график

`alignHeatingGraphForCondensingBoiler` в `heatingThermalRegimes.js` — **только warning** после подбора, без мутации `input.heatingSystem`. Для `heatingEmittersMode=ufh_only` предупреждение не выводится.

---

## Режим излучателей и пресеты ТП

Поля `heatingSystem` (см. `docs/ufh-presets-mongo.md`):

- `ufhPresetId` — режим ТП из Mongo
- `heatingEmittersMode` — `radiators` | `mixed` | `ufh_only` (для `ufh_only` радиаторы не подбираются)

При `ufh_only` мощность котла для `requiredKw` берётся из **`calculations.underfloorHeating.totalHeatFluxUpWatts`** (с запасом `heatingReserveFactor`), а не из `heatLoss.totalWatts`.

---

## Связанные файлы

| Область | Файлы |
|---------|--------|
| Shared | `shared/heatingMatchingSchemes.js`, `shared/heatingThermalRegimeRecommendations.js` |
| Валидация | `backend/src/api/validate.js`, `normalizeHeatingUfhPreset.js` |
| Matching | `backend/src/matching/index.js`, `boiler.js`, `radiators.js` |
| Frontend | `frontend/src/components/WaterHeaterForm/` (схема ГВС), `App.tsx` (thermalRegimePreset), `useSurveyCalcRunner` (calc API) |
| OpenAPI | `components/schemas/CalcInput.yaml` |

Ручной чеклист: [`heating-schemes-test-checklist.md`](heating-schemes-test-checklist.md).
