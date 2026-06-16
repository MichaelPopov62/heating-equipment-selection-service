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

- [ ] В UI доступны все 5 схем (в малой квартире без БКН — без `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw`)
- [ ] `singleCircuitBoilerWithBufferElectricStorage` — подбор 1К + буферный ЭВН, `recommendedTankLiters` из `water_norms`
- [ ] `combiBoilerWithBufferElectricStorage` — 2К + буфер, объём из `combiBufferElectricStorage`
- [ ] Квартира + БКН-схема → нормализация на max-комби + warning в отчёте

---

## Unlock графика радиаторов

- [ ] Можно выбрать 75/65 при схеме 2К (не блокируется)
- [ ] Показывается hint «рекомендуем 55/45» (или 75/65 для 1К)
- [ ] Расчёт радиаторов по **выбранному** графику
- [ ] При подборе condensing + график 75/65 — warning в `matching.boiler.warnings`, input не мутируется

---

## Пресеты режима ТП

### `ufh_direct_tile`

- [ ] Карточка в UI, `ufhPresetId: ufh_direct_tile`
- [ ] Контур комнат 45/35, `circuitSource: ufh_mode_preset`
- [ ] `isMixingNodeRequired` зависит от `supplyC` котла (75 > 45 → да)

### `ufh_direct_laminate`

- [ ] Контур 40/30, `maxSurface` лимит **27** °C в отчёте комнаты
- [ ] Смеситель не требуется при котле 40/30

### `ufh_only`

- [ ] `heatingEmittersMode: ufh_only`, радиаторы не подбираются (`matching.radiators` с skip-warning)
- [ ] График котла 40/30 в `input.heatingSystem`
- [ ] `matching.boiler.requiredKw` от **отдачи ТП** (`totalHeatFluxUpWatts`×запас), не от `heatLoss.totalWatts`
- [ ] При q↑ < теплопотерь — warning дефицита в `matching.boiler.warnings`
- [ ] `requiresCondensingBoiler` → warning, если подобран не-condensing котёл

---

## maxSurface из пресета

- [ ] Плитка + `ufh_direct_tile`: `maxSurfaceTemperatureCelsius` = 29, warning про паспорт 35 °C
- [ ] Ламинат + `ufh_direct_laminate`: applied max = 27
- [ ] В UI блока «Тёплый пол» — «применённый лимит» при override пресетом

---

## Регрессия

- [ ] `lineEconomy` / `lineEfficient` в matching радиаторов (кроме `ufh_only`)
- [ ] REC/WARN ТП (`REC_UFH_*`, `WARN_UFH_MIXING_NODE_REQUIRED`) в `recommendations`
- [ ] `meta.ufhPresetsSource` в отчёте calc

---

## Не в scope v3

- Структурированные коды REC для расхождения схема↔график (достаточно строк в warnings)
- Подбор котла по ТП при `mixed` (только `ufh_only`)
- Тепловой насос
