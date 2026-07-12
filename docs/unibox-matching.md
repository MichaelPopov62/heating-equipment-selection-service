# Подбор унибоксов (matching)

SKU унибоксов из каталога для сметы — локальный регулятор **одной петли** ТП / зоны.  
Топология гидравлики и коллекторы (`matching.manifolds`) **не** заменяются этим модулем — см. [`manifold-matching.md`](manifold-matching.md), [`hydraulics-pipeline.md`](hydraulics-pipeline.md).  
Каскад ТП-коллекторов уже реализован в H.15 (`splitOutletsForCascade`, `units[]`); унибокс только **читает** сигнал `units.length > 1`.

## Каталог (номенклатура)

| JSON seed (`test_data.json`) | Runtime / API (`NormalizedCatalog`) | `kind` в Mongo `products` |
|------------------------------|--------------------------------------|---------------------------|
| `uniboxes[]` | `catalog.uniboxes` | `unibox` |

Контракт: `validateCatalog.js` + OpenAPI `UniboxCatalogItem`.  
Identity: **`id`** (как у насосов `PumpCatalogItem`). Валюта — только корень каталога.  
Seed: discriminator `models/Unibox.js`.

Ключевые поля для подбора (только числа/строки/объекты из паспорта):

| Поле | Назначение в `uniboxFitsDemand` (строгие неравенства) |
|------|--------------------------------------------------------|
| `maxAreaSqM`, `maxLoopLengthM` | `area < maxArea`, `0 < length < maxLength` |
| `min/maxAirTempC` | vs **`roomAirTempC` (T воздуха помещения)** — открытый интервал |
| `min/maxCoolantTempC` | vs `circuitReturnC` (теплоноситель) — открытый интервал |
| `min/maxFlowLph` | vs расход петли, л/ч (`rtl_afc`) — открытый интервал |
| `maxSupplyTempC` | `supply < maxSupplyTempC` (`air_only`) |
| `maxTemperatureC` | `supply < maxTemperatureC` |
| `maxPressureBar` | `P < maxPressureBar` (расчётный P по умолчанию **3** бар) |
| `kvM3h` | `minKv < kv` (`minKv` = Q / √Δp, Δp = **0.25** бар) |
| `connection.fit` | должен быть **`eurocone`** (ТП PEX) |
| `connection.thread` | приоритет сортировки `G3/4` над `G1/2` |

Равенство на границе паспорта (`area === maxArea`, `воздух === maxAir` и т.п.) → **не подходит**.

`null` в JSON запрещён: отсутствующее значение = ключ omit.  
`description` — текст для UI, **не** участвует в числовых сравнениях.

## T воздуха помещения (smart fallback)

Подмена касается **только температуры воздуха** (`roomAirTempC` / `designAirTempC`), сравниваемой с `minAirTempC` / `maxAirTempC` и используемой в ΔT теплопотерь/ТП/радиаторов.  
**Не** подменяются: подача/обратка теплоносителя, `maxTemperatureC`, coolant-лимиты.

SSOT: [`shared/roomDesignAirTemp.js`](../shared/roomDesignAirTemp.js) — см. [`room-design-air-temp.md`](room-design-air-temp.md).

| `building.rooms[].type` | Расчётная T воздуха |
|-------------------------|---------------------|
| `санузел` | **`max(bathroomAirTempC ?? insideC, 24)`** |
| остальные (в т.ч. `коридор`, `прихожая`, `тамбур`, жилые) | `temps.insideC` |

Опциональное поле анкеты: `temps.bathroomAirTempC` (≥ 24) — клиент может поднять воздух санузла выше пола.

Источник в отчёте unibox: `required.roomAirTempSource` = `preset` (пол 24) \| `survey` \| `bathroom_field`.

### Малые зоны vs T воздуха

Типы **`санузел` | `коридор` | `прихожая` | `тамбур`** — типичные малые зоны (часто 1 петля).  
Hard-filter каталога по `roomType` нет. Пол T воздуха — **только** у санузла (24 °C).

## Бизнес-гейт (когда подбираем)

1. Есть петли с `loopLengthM > 0` (без fallback «длина = 0»).
2. Задан `temps.insideC` (иначе пустой отчёт) — база для T воздуха.
3. Число таких петель **1…2** (`UNIBOX_MAX_LOOPS_FOR_MATCHING`). Иначе warning + `byLoop: []`.
4. Нет **каскада** ТП-коллекторов (`manifolds.underfloor[].units.length > 1`, сигнал H.15). Иначе warning + `byLoop: []`.
   - **`manifolds.ok === false`** / пустой `underfloor` — **не** каскад: подбор по петлям продолжается; добавляется informational warning про degraded manifolds.
5. На каждую петлю — `validateUniboxLoopDemand` (площадь, длина, ΔT контура, расход, T воздуха, fit). Fail → `selected: null` + warning.

## Модуль

- `backend/src/matching/unibox.js` — `uniboxFitsDemand`, `validateUniboxLoopDemand`, `pickUniboxForDemand`, `collectUniboxLoopDemands`, `pickUniboxes`, `minKvM3hForFlowLph`, `resolveUniboxRoomAirTempC`
- `backend/src/matching/internal/uniboxRoomAirPresets.js` — пресеты T воздуха
- Public API: `matching/public.js` → `pickUniboxes`
- Вызов в `buildReport` **после** `pickManifolds`, **до** `runHydraulicsPipeline` (передаётся `building.rooms` для `room.type`)
- Отчёт: `report.matching.uniboxes` (`UniboxesMatchingReport`)

Порядок в `buildReport`:

```
matchEquipment → (резолв distributionPreset ТП) → pickManifolds → pickUniboxes → hydraulics pipeline
```

## Алгоритм подбора позиции

1. Собрать demand по каждой петле (площадь, длина, T подачи/обратки, **T воздуха** после resolve, P, minKv, fit, `roomType`).
2. `validateUniboxLoopDemand`.
3. Фильтр пула `catalog.uniboxes` через `uniboxFitsDemand` (строгие `<` / `>`).
4. Сортировка: тип `rtl_air` → `rtl_afc` → `rtl` → `balancing_valve` → `air_only`, затем `G3/4`, затем мин. `price`.
5. Нет подходящих — `selected: null` + warning с параметрами петли (явно: T воздуха и источник).

## Verify

```bash
cd backend && npm run verify:unibox-matching
```

Кейсы: границы паспорта; санузел → T воздуха 24; коридор/прихожая/тамбур → анкета; cascade / >2 петель → skip; `manifolds.ok=false` → не cascade-skip; Δp=0 в `minKvM3hForFlowLph` → finite (fallback/floor); flow=0 → `selected: null`; invalid ΔT → null.

Входит в общий `npm run verify`.
