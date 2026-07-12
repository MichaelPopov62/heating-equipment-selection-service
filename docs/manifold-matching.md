# Подбор коллекторов (matching)

SKU коллекторов из каталога для сметы. Топологические узлы гидравлики (`ufh_collector`, `radiator_distribution_manifold`) **не** заменяются этим модулем — см. [`hydraulics-pipeline.md`](hydraulics-pipeline.md).

## Каталог (номенклатура)

| JSON seed (`test_data.json`) | Runtime / API (`NormalizedCatalog`) | `kind` в Mongo `products` |
|------------------------------|--------------------------------------|---------------------------|
| `manifold[]` | `catalog.manifolds` | `manifold` |
| `boilerManifold[]` | `catalog.boilerManifolds` | `boilerManifold` |

Контракт: `validateCatalog.js` + OpenAPI `ManifoldCatalogItem` / `BoilerManifoldCatalogItem`.  
Геометрия серий: `catalog/manifoldSeriesGeometry.js`, `catalog/boilerManifoldSeriesGeometry.js`.  
Seed: discriminators `models/Manifold.js`, `models/BoilerManifold.js`.

Ключевые поля для подбора:

- **manifold:** `outletsCount`, `manifoldApplication` (`radiator` \| `underfloor`), `hasFlowMeters`, `price`
- **boilerManifold:** `circuitsCount`, `maxPowerKw`, `price`

## Модуль

- `backend/src/matching/manifold.js` — `pickDistributionManifold`, `pickBoilerManifold`, `pickManifolds`, `splitOutletsForCascade`
- Константа: `UFH_MANIFOLD_MAX_OUTLETS_PER_NODE = 12`
- Public API: `matching/public.js` → `pickManifolds`
- Вызов в `buildReport` **после** резолва `underfloorHeating.distributionPreset`, **до** `runHydraulicsPipeline`
- Отчёт: `report.matching.manifolds` (`ManifoldsMatchingReport`)

Порядок в `buildReport`:

```
matchEquipment → (резолв distributionPreset ТП) → pickManifolds → pickUniboxes → hydraulics pipeline
```

Унибоксы (локальный регулятор петли, 1…2 петли без каскада коллекторов): см. [`unibox-matching.md`](unibox-matching.md).

## Алгоритм

### ТП (`underfloor[]`)

1. По комнатам `underfloorHeating.rooms` взять `loopsCount` (fallback — `loops.length`).
2. Сгруппировать по этажу комнаты (`building.rooms[].floor`).
3. На каждый этаж: `parts = splitOutletsForCascade(total)`:
   - `total ≤ 12` → `[total]` — один коллектор;
   - `total > 12` → равномерный split (`14 → [7,7]`, `25 → [9,8,8]`).
4. Для каждой части — `pickDistributionManifold({ application: 'underfloor' })` → элемент `units[]`.
5. При `parts.length > 1` — warning:  
   `Превышен лимит петель на один узел (max 12). Система автоматически разделена на N коллектора (…+…).`
6. Среди кандидатов с `outletsCount ≥ need` части: приоритет `hasFlowMeters`, затем мин. `outletsCount`, затем мин. `price`.
7. Если подходящих нет **для одной части** — максимальный в пуле + warning дефицита (отдельно от каскада).

Контракт этажа:

```text
underfloor[].requiredOutlets  — сумма петель этажа
underfloor[].units[]          — 1…N устройств сметы (index, requiredOutlets, selected)
```

### Радиаторы (`radiator`)

Только если `hydraulics.radiatorWiringSystemType === 'manifold'`:

- `requiredOutlets` = число комнат в `matching.radiators.byRoom` с `radiatorDesignWatts > 0`
- `application: 'radiator'`

Иначе `radiator: null`.

### Котельный (`boilerManifold`)

| objectType | Условие подбора |
|------------|-----------------|
| `apartment` | **не** подбирается (`null`) |
| `house` | `distributionPreset === 'hydraulic_separator'` **или** есть зона радиаторов **и** зона ТП |

- `requiredCircuits` = (1 если есть радиаторы) + (1 если есть ТП), минимум 1
- `requiredPowerKw` = `matching.boiler.requiredKw`
- Фильтр: `circuitsCount ≥ need` и `maxPowerKw ≥ requiredKw`; иначе max в каталоге + warning

## Verify

```bash
cd backend && npm run verify:manifold-matching
```

Кейсы: 5→1 unit; 12→1 без cascade-warning; 14→2 units (7+7) + warning; 25→3 (9+8+8).

## UI

Справочник номенклатуры: `CatalogEquipmentReference` (`catalog.manifolds` / `catalog.boilerManifolds`).  
Карточки сметы по `matching.manifolds.underfloor[].units` — отдельный шаг UI.
