# Подбор унибоксов (matching)

SKU унибоксов из каталога для сметы — локальный регулятор **одной петли** ТП / зоны.  
Топология гидравлики и коллекторы (`matching.manifolds`) **не** заменяются этим модулем — см. [`manifold-matching.md`](manifold-matching.md), [`hydraulics-pipeline.md`](hydraulics-pipeline.md).

## Каталог (номенклатура)

| JSON seed (`test_data.json`) | Runtime / API (`NormalizedCatalog`) | `kind` в Mongo `products` |
|------------------------------|--------------------------------------|---------------------------|
| `uniboxes[]` | `catalog.uniboxes` | `unibox` |

Контракт: `validateCatalog.js` + OpenAPI `UniboxCatalogItem`.  
Identity: **`id`** (как у насосов `PumpCatalogItem`). Валюта — только корень каталога.  
Seed: discriminator `models/Unibox.js`.

Ключевые поля для подбора (только числа/строки/объекты из паспорта):

| Поле | Назначение в `uniboxFitsDemand` |
|------|----------------------------------|
| `maxAreaSqM`, `maxLoopLengthM` | лимиты зоны/петли (`loopLengthM > 0`) |
| `min/maxAirTempC` | vs `roomAirTempC` (`temps.insideC`) |
| `min/maxCoolantTempC` | vs `circuitReturnC` |
| `min/maxFlowLph` | vs расход петли, л/ч (`rtl_afc`) |
| `maxSupplyTempC` | vs `circuitSupplyC` (`air_only`) |
| `maxTemperatureC` | vs `circuitSupplyC` |
| `maxPressureBar` | vs `systemPressureBar` (по умолчанию **3** бар) |
| `kvM3h` | vs `minKvM3h` = Q / √Δp, Δp = **0.25** бар |
| `connection.fit` | должен быть **`eurocone`** (ТП PEX) |
| `connection.thread` | приоритет сортировки `G3/4` над `G1/2` |

`null` в JSON запрещён: отсутствующее значение = ключ omit.  
`description` — текст для UI, **не** участвует в числовых сравнениях.

## Бизнес-гейт (когда подбираем)

1. Есть петли с `loopLengthM > 0` (без fallback «длина = 0»).
2. Задан `temps.insideC` (иначе пустой отчёт).
3. Число таких петель **1…2** (`UNIBOX_MAX_LOOPS_FOR_MATCHING`). Иначе warning + `byLoop: []`.
4. Нет **каскада** ТП-коллекторов (`manifolds.underfloor[].units.length > 1`). Иначе warning + `byLoop: []`.

## Модуль

- `backend/src/matching/unibox.js` — `uniboxFitsDemand`, `pickUniboxForDemand`, `collectUniboxLoopDemands`, `pickUniboxes`, `minKvM3hForFlowLph`
- Public API: `matching/public.js` → `pickUniboxes`
- Вызов в `buildReport` **после** `pickManifolds`, **до** `runHydraulicsPipeline`
- Отчёт: `report.matching.uniboxes` (`UniboxesMatchingReport`)
- UI: блок в `RecommendationsBlock` (таблица по петлям)

Порядок в `buildReport`:

```
matchEquipment → (резолв distributionPreset ТП) → pickManifolds → pickUniboxes → hydraulics pipeline
```

## Алгоритм подбора позиции

1. Собрать demand по каждой петле (площадь, длина, T подачи/обратки, воздух, P, minKv, fit).
2. Фильтр пула `catalog.uniboxes` через `uniboxFitsDemand`.
3. Сортировка: тип `rtl_air` → `rtl_afc` → `rtl` → `balancing_valve` → `air_only`, затем `G3/4`, затем мин. `price`.
4. Нет подходящих — `selected: null` + warning с параметрами петли.

## Verify

```bash
cd backend && npm run verify:unibox-matching
```

Входит в общий `npm run verify`.
