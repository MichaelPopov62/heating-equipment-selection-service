# Чеклист тестирования: контур ТП (roadmap фазы 0–8 + v3)

Ручная проверка после реализации фаз 1–8 и плана v3 (пресеты режима ТП, `ufh_only`).

Сервис ориентирован на **квартиры и частные дома с газовыми/электрокотлами**. Тепловой насос **не тестируется**.

Дополнительно: [`heating-schemes-test-checklist.md`](heating-schemes-test-checklist.md) — схемы котла и unlock графика.

---

## Подготовка

- [ ] Backend: `LOG_LEVEL=debug npm run start` (из `backend/`)
- [ ] Frontend: Vite dev или собранный UI
- [ ] `cd backend && npm run verify:calc-schema` — OK
- [ ] `cd backend && npm run verify:ufh-presets` — OK
- [ ] `cd backend && npm run verify:ufh-active-area` — OK (S_meb / S_акт)
- [ ] `GET /api/v1/presets/underfloor-heating` — bases + finishes
- [ ] `GET /api/v1/presets/underfloor-heating/modes` — 3 режима v3

---

## Сценарий 1 — Дом, традиционный контур, плитка (45/35)

**Вход:**

- `objectType: house`
- `thermalRegimePreset: traditional_dt50_75_65` (или дефолт)
- `waterUnderfloorHeating: true`
- Комната: `underfloorHeating.enabled`, `finishMaterialId: ceramic_tile`

**Ожидание в отчёте:**

- [ ] `input.heatingSystem.supplyC` = 75, `returnC` = 65
- [ ] `calculations.underfloorHeating.rooms[].ufhCircuitPresetId` = `ufh_dt10_45_35`
- [ ] `rooms[].circuitSupplyC` = 45, `circuitReturnC` = 35
- [ ] `isMixingNodeRequired` = **true**
- [ ] `mixingNode.flowRateM3PerHour`, `headMetersMin`, `valveKvsMin` заполнены

---

## Сценарий 2 — Конденсационный график + ламинат (40/30)

**Вход:**

- Квартира, схема 2К → дефолт 55/45 **или** явно `condensing_dt30_55_45`
- `finishMaterialId: laminate_click`

**Ожидание:**

- [ ] Радиаторный контур 55/45
- [ ] ТП: `ufh_dt10_40_30`, 40/30 °C
- [ ] `isMixingNodeRequired` = **true** (55 > 40)
- [ ] При высоких теплопотерях — warning покрытия: q↑ < heatLoss комнаты

---

## Сценарий 3 — Два окна разного типа

**UI:**

- [ ] «Добавить окно» → вторая строка с отдельным «Тип окна»
- [ ] Не использовать `count: 2` для разных типов

**API / envelopeElements:**

- [ ] Два элемента `kind=window` с разными `presetId` в одной комнате

---

## Сценарий 4 — Только ТП (`ufh_only`, v3)

**Вход:**

- `heatingSystem.ufhPresetId: ufh_only`
- Комнаты с `underfloorHeating` (base + finish)
- Схема котла с конденсацией (например 2К или 1К)

**Ожидание:**

- [ ] `heatingEmittersMode: ufh_only`, график котла 40/30
- [ ] `isMixingNodeRequired` = **false** (котёл 40, контур ТП ≤ 40)
- [ ] Радиаторы не подбираются (`skippedReason: ufh_only`); в UI нет черновых секций
- [ ] `matching.boiler.requiredKw` от `totalHeatFluxUpWatts` (с запасом), не от envelope `heatLoss`
- [ ] При дефиците покрытия — `WARN_UFH_COVERAGE_LOW_UFH_ONLY` (не «добавьте радиатор» первым шагом)

---

## Сценарий 5 — Прямой ТП под плитку (`ufh_direct_tile`)

- [ ] `circuitSource: ufh_mode_preset`, контур 45/35 во всех комнатах с ТП
- [ ] `maxSurfaceTemperatureCelsius` = min(29, паспорт финиша)

---

## Сценарий 6 — Схема распределения

- [ ] `underfloorDistributionPreset: auto` → для квартиры `collector_mixing_valve`
- [ ] Для дома с `requiredKw > 50` — note / `hydraulic_separator`

---

## Сценарий 5 — Мебель на полу ТП (S_meb)

См. [`ufh-furniture-active-area.md`](ufh-furniture-active-area.md).

**Вход:**

- Комната с ТП, `areaM2: 20`, `furnitureOccupiedAreaM2: 15`, ламинат, контур 40/30

**Ожидание:**

- [ ] `heatedAreaM2` = 5, `roomAreaM2` = 20
- [ ] `requiredHeatFluxUpWm2` = Q_потерь / 5
- [ ] `resolvedPipeSpacingMm` при необходимости &lt; `requestedPipeSpacingMm`
- [ ] `WARN_UFH_ACTIVE_AREA_INSUFFICIENT` при q_треб &gt; maxAllowable
- [ ] `WARN_UFH_COVERAGE_LOW` при `heatFluxCoverageRatio` &lt; 0.95: в UI блок + кнопка «Устранение предупреждения»; первый шаг — «Добавьте радиатор или конвектор»; в тексте WARN мощности в целых Вт
- [ ] Длина петли `loopLengthM` ≈ `heatedAreaM2 / (resolvedPipeSpacingMm/1000) × layoutFactor / loopsCount` (layoutFactor=1.1; maxUfhLoopLengthM=80)
- [ ] В отчёте комнаты есть `pipeMetersPerSqM` и `loopLengthLayoutFactor`
- [ ] `ufhTerminalControl=unibox` при area≤20 → SKU в matching.uniboxes; коллектор без этого outlet

**Регрессия:**

- [ ] `furnitureOccupiedAreaM2: 0` или поле отсутствует — как до фичи
- [ ] `npm run verify:ufh-active-area` — OK

---

## Сценарий 7 — Гидравлика

- [ ] `calculations.hydraulics` — радиаторный контур (Δt ≈ 15–20)
- [ ] `calculations.underfloorHeating.underfloorHydraulics` — Δt = 10

---

## Регрессия (уже работает)

- [ ] `heatLoss` не импортирует справочники ТП
- [ ] `floorPresetId` ≠ `underfloorHeating` (разные поля)
- [ ] WARN перегрева поверхности при T > лимита
- [ ] `lineEconomy` 75/65, `lineEfficient` 55/45 в matching радиаторов (кроме `ufh_only`)

---

## Явно не проверять

- Тепловой насос
- Подбор артикула насоса/клапана из каталога `products`
- Рабочий график 95/85 (legacy API only)
