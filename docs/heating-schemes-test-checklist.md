# Чеклист тестирования: схемы котла и режимы ТП (v3)

Ручная проверка после реализации плана v3. Автоматика: `npm run verify:calc-schema`, `npm run verify:ufh-presets` (из `backend/`).

---

## Подготовка

- [ ] `cd backend && npm run verify:calc-schema` — OK
- [ ] `cd backend && npm run verify:ufh-presets` — OK
- [ ] `GET /api/v1/presets/underfloor-heating/modes` — 3 пресета с `ui` и `technical`
- [ ] Backend + frontend запущены

---

## Схемы котла (5)

- [ ] В UI доступны все 5 схем на шаге **«Водонагреватель»** (`WaterHeaterForm`; в малой квартире без БКН — без `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw`)
- [ ] Галочка места под БКН видна **только** при квартире + схема «1К + БКН» (не на шаге «Объект», не для дома)
- [ ] Смена схемы или галочки → debounce → обновление карточек БКН/ЭВН в модалке `WaterHeaterReportDialog` (`WaterHeaterMatchingPreview`); на `technicalResult` — строки `HotWaterSummaryTable`
- [ ] `singleCircuitBoilerWithBufferElectricStorage` — подбор 1К + буферный ЭВН, `recommendedTankLiters` из `water_norms`
- [ ] `combiBoilerWithBufferElectricStorage` — 2К + буфер, объём из `combiBufferElectricStorage`
- [ ] Квартира + БКН-схема → нормализация на max-комби + warning в отчёте
- [ ] Дом + `ufh_only` + «1К + БКН» + успешный БКН: `matching.waterHeater.requiredTankLiters === 0`, `selected === null`; в `HotWaterSummaryTable` ЭБ = «Не участвует в расчёте», БКН = модель; карточки ЭБ в модалке нет
- [ ] «1К + БКН» без подходящего БКН в каталоге → запасной ЭВН + warning; строка ЭБ с результатом подбора

### `tropicalShower` (+30 % к объёму бака)

- [ ] **Квартира** + `combiBoilerWithBufferElectricStorage`, 3 жильца: без флага → **80 л**, с флагом → **100 л** (`requiredTankLiters` / карточка ЭВН)
- [ ] **Квартира** + отдельный ЭВН (`heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater`), 3 жильца: без флага → **150 л**, с флагом → **200 л**
- [ ] **Дом** + storage/БКН: включение «тропический душ» увеличивает `recommendedTankLiters` (типично 200 → 250 при ванне + душах)
- [ ] Чекбокс на шаге «Горячая вода» → debounce calc → объём в отчёте ГВ и в подборе ВН обновляется

---

## Unlock графика радиаторов

- [ ] Можно выбрать 75/65 при схеме 2К (не блокируется)
- [ ] Показывается hint «рекомендуем 55/45» (или 75/65 для 1К)
- [ ] Расчёт радиаторов по **выбранному** графику
- [ ] При подборе condensing + график 75/65 — warning в `matching.boiler.warnings`, input не мутируется

---

## Пресеты режима ТП

### `ufh_mixed_radiators`

- [ ] Карточка в UI, `ufhPresetId: ufh_mixed_radiators`
- [ ] Контур комнаты выбирается по финишу: плитка 45/35, ламинат/LVT 40/30
- [ ] `isMixingNodeRequired` зависит от `supplyC` котла и контура комнаты

### `ufh_only`

- [ ] `heatingEmittersMode: ufh_only`, радиаторы не подбираются (`matching.radiators.skippedReason: ufh_only`)
- [ ] В UI итога радиаторов нет локальных оценок секций (`useSurveyEstimates`, 100 Вт/м²); подпись «не требуется» / skip-hint
- [ ] График котла 40/30 в `input.heatingSystem`
- [ ] `matching.boiler.requiredKw` от **отдачи ТП** (`totalHeatFluxUpWatts`×запас), не от `heatLoss.totalWatts`
- [ ] При q↑ < теплопотерь — `WARN_UFH_COVERAGE_LOW_UFH_ONLY` (шаги без «добавьте радиатор» первым)
- [ ] `requiresCondensingBoiler` → warning, если подобран не-condensing котёл
- [ ] При схеме «1К + БКН» и успешном БКН `technicalResult` не показывает фальшивый ЭБ по литрам ГВС (см. пункт схем котла выше)

---

## maxSurface из пресета

- [ ] `maxSurfaceTemperatureCelsius` = min(лимит mode preset, паспорт финиша)
- [ ] В UI блока «Тёплый пол» показан применённый лимит

---

## Регрессия

- [ ] `lineEconomy` / `lineEfficient` в matching радиаторов (кроме `ufh_only`)
- [ ] REC/WARN ТП (`REC_UFH_*`, `WARN_UFH_MIXING_NODE_REQUIRED`, `WARN_UFH_COVERAGE_LOW` + `resolutionSteps`) в `recommendations`
- [ ] `meta.ufhPresetsSource` в отчёте calc

---

## Не в scope v3

- Структурированные коды REC для расхождения схема↔график (достаточно строк в warnings)
- Подбор котла по ТП при `mixed` (только `ufh_only`)
- Тепловой насос
