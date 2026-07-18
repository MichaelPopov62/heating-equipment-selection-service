# Схемы котла/ГВС и температурный график (v3)

Документ описывает пять схем подбора котла, связь с ГВС и правила **рекомендации** (не блокировки) температурного графика радиаторов.

Источник констант: `shared/heatingMatchingSchemes.js`, `shared/heatingThermalRegimeRecommendations.js`.

---

## Пять схем `hotWaterBoilerPowerMatchingScheme`

| Код API | Суть подбора `requiredKw` | Объём бака и `tropicalShower` |
|---------|---------------------------|-------------------------------|
| `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw` | 2К: **max**(отопление×запас, ГВС); для дома с storage — пик `peakThermalPowerKw` | Дом storage/БКН: объём из `calculateHotWaterDemand` (+30 % при флаге) |
| `heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater` | 1К: только отопление×запас; ГВС — электронакопитель | Квартира: `apartmentElectricStorage` × `tropicalShowerVolumeFactor` при флаге (`buildReport`) |
| `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw` | 1К+БКН: отопление×запас **+** мощность нагрева бака; учёт `minSourcePowerKw` БКН | Storage-объём (дом или override квартиры) + tropical в `hotWater.js` |
| `combiBoilerWithBufferElectricStorage` | 2К+буферный ЭВН: max(отопление×запас, пик ГВС); буфер из `water_norms.combiBufferElectricStorage` | Буфер: `recommendedCombiBufferTankLiters(…, tropicalShower)` |
| `singleCircuitBoilerWithBufferElectricStorage` | 1К+буферный ЭВН: котёл только по отоплению×запас; ГВС через накопитель (`water_norms.singleCircuitBufferElectricStorage`) | Буфер: `recommendedSingleCircuitBufferTankLiters(…, tropicalShower)` |

Множитель: `water_norms.storage.tropicalShowerVolumeFactor` (1.3). Детали — [`water-heater-form.md`](water-heater-form.md) § tropicalShower.

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

### Подводка радиаторов

`heatingSystem.radiatorConnection`: `side` (дефолт) | `bottom`.  
Анкета — шаг «Радиаторы» (`RadiatorsSurveyForm`); детали — [`radiator-connection.md`](radiator-connection.md), UI отчёта — [`radiators-survey-report.md`](radiators-survey-report.md).  
На шаге «Котёл» (`BoilerSurveyForm`) — `thermalRegimePreset` и полный отчёт подбора; см. [`boiler-survey-report.md`](boiler-survey-report.md).

### Тип радиаторов на объект

`heatingSystem.radiatorEmitterPreference`: `auto` | `sectional` | `panel` (дефолт `auto`).  
Единый тип приборов на все помещения (Two-Pass Orchestrator) — [`radiator-emitter-kind.md`](radiator-emitter-kind.md).  
Анкета — шаг «Радиаторы» (рядом с подводкой); полный расчёт — модалка отчёта.

### Конденсационный котёл + высокий график

`alignHeatingGraphForCondensingBoiler` в `heatingThermalRegimes.js` — **только warning** после подбора, без мутации `input.heatingSystem`. Для `heatingEmittersMode=ufh_only` предупреждение не выводится.

---

## Режим излучателей и пресеты ТП

Поля `heatingSystem` (см. `docs/ufh-presets-mongo.md`):

- `ufhPresetId` — режим ТП из Mongo
- `heatingEmittersMode` — `radiators` | `mixed` | `ufh_only` (для `ufh_only` радиаторы не подбираются)

При `ufh_only` мощность котла для `requiredKw` берётся из **`calculations.underfloorHeating.totalHeatFluxUpWatts`** (с запасом `heatingReserveFactor`), а не из `heatLoss.totalWatts`.

---

## Backlog: валидатор Tпод радиаторов (обратный расчёт)

**Контекст:** классические **газовые и электрические** котлы (Baxi ECO Home, Luna Duo-Tec E и аналоги). **Тепловых насосов в сервисе нет** — этот блок к ним не относится.

**Единственный смысл обратного расчёта** — проверить, достаточно ли уже подобранных радиаторов при выбранном графике:

1. После `pickRadiators` по каждой комнате известны: `radiatorDesignWatts`, модель, число секций (или панель), `insideC`, `returnC` графика анкеты.
2. Обратная задача: при фиксированном приборе найти **минимальную** `supplyC`, при которой отдача ≥ `radiatorDesignWatts` (инверсия `adjustOutputWatts` / степенной модели n≈1,3).
3. Результат — **валидатор**, не второй контур подбора:
   - если требуемая `supplyC` **выше** выбранного графика или разумного предела котла → `WARN_*` / пояснение в `byRoom[]` («увеличьте секции» или «снизьте график»);
   - если укладывается — без предупреждения.

**Не входит в scope валидатора:**

- подбор температуры как основной способ закрыть теплопотери комнаты;
- контур тёплого пола, смесительный узел, ГВС;
- тепловые насосы и низкотемпературные источники вне каталога котлов.

Ориентир реализации: модуль `matching/internal/resolveRequiredRadiatorSupplyC.js` (или рядом с `radiatorSizingHelpers.js`), вызов из `pickRadiatorsCore` / отчёта после подбора; verify с синтетической комнатой и каталогом секций.

---

## Связанные файлы

| Область | Файлы |
|---------|--------|
| Shared | `shared/heatingMatchingSchemes.js`, `shared/heatingThermalRegimeRecommendations.js` |
| Валидация | `backend/src/api/validate.js`, `normalizeHeatingUfhPreset.js` |
| Matching | `backend/src/matching/index.js`, `boiler.js`, `radiators.js` |
| Frontend | `BoilerSurveyForm` / `BoilerReport*` (график + отчёт), `WaterHeaterForm/` (схема ГВС), `useSurveyCalc` (calc API, React Query) |
| OpenAPI | `components/schemas/CalcInput.yaml` |

Ручной чеклист: [`heating-schemes-test-checklist.md`](heating-schemes-test-checklist.md).
