# Валидация входа POST /api/v1/calc

Пайплайн: `backend/src/api/validate.js` → `validateAndNormalizeInput(body, ctx)`.

Схема: `components/schemas/CalcInput.yaml` (AJV через `calcInputSchemaLoader.js`).

---

## Фазы обработки

| # | Фаза | Модули | HTTP |
|---|------|--------|------|
| 1 | Reject legacy | `rejectLegacyHotWaterFields` | **400** `HOT_WATER_LEGACY_FIELD` |
| 2 | Compat room types | `normalizeRoomTypesBeforeValidate` | **400** `ROOM_TYPE_INVALID` или warning после AJV |
| 3 | Derive границы | `normalizeRoomBoundariesBeforeValidate` | silent (не ошибка) |
| 4 | UFH pre-check | `normalizeUnderfloorHeatingBeforeValidate` | **400** `UNDERFLOOR_HEATING_*` |
| 5 | AJV strict | `coerceTypes: false`, `removeAdditional: true` | **400** `VALIDATION_ERROR` + `details[]` |
| 6 | Post-AJV normalize | thermal regime, UFH preset (`ctx.ufhPresets`), … | warnings в input |
| 6b | UFH mode ↔ finish | `assertUfhModeFinishCompatibility` | **400** `UFH_MODE_FINISH_MISMATCH` |
| 7 | Cross-validation | externalWalls, `assertBoilerPlacementAndBoilerRoom`, ventilation, … | **400** с доменными кодами |

---

## Типы комнат (`building.rooms[].type`)

**До AJV** (`normalizeRoomTypesBeforeValidate`):

| Вход | Действие |
|------|----------|
| Канонический enum (после trim / регистра) | без изменений |
| Synonym / legacy (`living` → `гостиная`, `kitchen` → `кухня`, …) | замена; warning в `_normalizationWarnings` **после AJV** (поле не в схеме heatingSystem) |
| Неизвестная строка (`офис`, `garbage`) | **400** `ROOM_TYPE_INVALID` |

**Не используется:** silent-подстановка «помещение» для неизвестных значений.

---

## Границы комнат (`bottomBoundary`, `topBoundary`)

| objectType | Поведение |
|------------|-----------|
| `apartment` | Границы **выводятся** из `apartmentStackPosition` и этажа комнаты (доменное правило, не «fix invalid JSON»). `topBoundary: roof` не перезаписывается. |
| `house` | Если `bottomBoundary` не `heated`/`unheated` — подставляется default по этажу. |

Невалидный `apartmentStackPosition` → default `middle_floor` (compat). Нормализация поля — **только** в `normalizeRoomBoundariesBeforeValidate` (фаза 3); повторно в cross-validation не вызывается.

В фазе 7 (`assertBoilerPlacementAndBoilerRoom`) для `apartment` удаляются поля дома (`boilerPlacementZone`, `boilerRoomAreaM2`, `ceilingHeightM`, …); для `house` — наоборот удаляется `apartmentStackPosition`.

---

## Тёплый пол (ТП): три слоя данных

| Слой | Когда в validate | Источник |
|------|------------------|----------|
| Конструкция комнаты (`basePresetId`, `finishMaterialId`) | фаза 4, **до AJV** | `data/warmFloorAssemblyPresets.js`, `data/flooringFinishMaterials.js` |
| Режим системы (`heatingSystem.ufhPresetId`) | фаза 6, **после AJV** | `ctx.ufhPresets` (Mongo/file, `UFH_PRESETS_SOURCE`) |
| Контур 45/35 vs 40/30 | в расчёте | `shared/ufhCircuitPresets.js` |

Для `ufh_direct_tile` / `ufh_direct_laminate` финиш включённых комнат должен совпадать с контуром (см. [`ufh-presets-mongo.md`](ufh-presets-mongo.md)). Коды: `UNDERFLOOR_HEATING_*`, `UFH_PRESET_INVALID`, `UFH_MODE_FINISH_MISMATCH`.

---

## AJV: `coerceTypes: false`

Числовые поля должны приходить **числом** в JSON (`insideC: 20`, не `"20"`). Иначе **400** `VALIDATION_ERROR` — ошибка типа видна в `error.details`.

---

## Коды ошибок (основные)

| code | Когда |
|------|--------|
| `ROOM_TYPE_INVALID` | Неизвестный `rooms[].type` после compat-слоя |
| `VALIDATION_ERROR` | AJV / общая валидация схемы |
| `HOT_WATER_LEGACY_FIELD` | Удалённые поля ГВС |
| `EXTERNAL_WALLS_*` | Cross-validation фасада |
| `HEATING_SYSTEM_INVALID` | returnC ≥ supplyC |
| `UFH_MODE_FINISH_MISMATCH` | `ufh_direct_*` + несовместимый `finishMaterialId` в комнате с ТП |
| `ENVELOPE_UVALUE_MISSING` | Нет `uValue` и не выведен из `presetId` / `externalWalls` |

Полный список — description ответа **400** в `openapi.yaml` для `POST /api/v1/calc`.

---

## Коэффициент U ограждений

SSOT: `envelopePresets.js` + `wallAssembly.js` → `heatlossByRooms.js` вычисляет `uValue` до формулы Q = U·S·ΔT (`envelopeHeatLoss.js`). Legacy-словарь `construction:material` **не используется**. Вход анкеты: `presetId`, `thicknessMm`, `objectMeta.externalWalls` или явный `uValue`.

---

## Verify

```bash
cd backend && npm run verify:calc-input-validation
cd backend && npm run verify:calc-schema
```

---

## Связанные файлы

- `shared/roomTypeNormalization.js` — CANONICAL_ROOM_TYPES, legacy, synonyms
- `backend/src/logic/apartmentStackBoundaries.js` — derive границ квартиры
- `backend/src/logic/heatlossByRooms.js` — резолв U и теплопотери; `envelopeHeatLoss.js` — только Q = U·S·ΔT
- `backend/src/logic/ufhModeFinishCompatibility.js` — mode preset ↔ finish
- `docs/ufh-presets-mongo.md` — три слоя ТП, `UFH_PRESETS_SOURCE`
- `docs/projects-api.md` — расчёт через проекты (тот же `validateAndNormalizeInput`)
