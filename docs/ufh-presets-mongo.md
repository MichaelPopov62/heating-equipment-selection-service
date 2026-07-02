# Пресеты режима ТП (Mongo `underfloor_heating_presets`, v3)

Справочник режимов водяного тёплого пола: технические лимиты + человекочитаемый UI. Отдельно от баз конструкции (`warmFloorAssemblyPresets`) и финишей (`flooringFinishMaterials`).

---

## Три слоя ТП (не один источник)

| Слой | Источник | Поля / API | Роль |
|------|----------|------------|------|
| **1. Конструкция комнаты** | `data/warmFloorAssemblyPresets.js` + `data/flooringFinishMaterials.js` | `room.underfloorHeating.{basePresetId, finishMaterialId}`; `GET …/underfloor-heating`, `/bases` | Физика: слои, Rλ,B, теплоотдача |
| **2. Контур по финишу** | `shared/ufhCircuitPresets.js` | derive в `ufhCircuitResolve.js` | 45/35 для плитки, 40/30 для ламината/LVT (mixed) |
| **3. Режим системы** | Mongo/file `underfloor_heating_presets` | `heatingSystem.ufhPresetId`; `GET …/modes` | ufh_only / mixed / direct_*; график котла, skip радиаторов, maxSurface |

В `validate.js`:

- **Фаза 4 (до AJV):** слой 1 — `normalizeUnderfloorHeatingBeforeValidate` (статический `data/`).
- **Фаза 6 (после AJV):** слой 3 — `normalizeHeatingUfhPreset(body, ctx.ufhPresets)` из bundle.
- **Cross-validation:** `assertUfhModeFinishCompatibility` — для `ufh_direct_tile` / `ufh_direct_laminate` финиш комнаты должен совпадать с `finishMaterialIds` контура из слоя 2.

Слои **намеренно разделены** (разный lifecycle: деплой vs Mongo/seed). Риск — рассинхрон между слоями 2 и 3; см. verify ниже.

### Согласованность direct-режимов

| ufhPresetId | Контур (`ufhCircuitPresets`) | Допустимые `finishMaterialId` |
|-------------|------------------------------|-------------------------------|
| `ufh_direct_tile` | `ufh_dt10_45_35` (45/35) | `ceramic_tile` |
| `ufh_direct_laminate` | `ufh_dt10_40_30` (40/30) | `pvc_glue`, `pvc_click`, `laminate_click` |

`ufh_mixed_radiators` и `ufh_only` — контур по финишу комнаты (слой 2) или график из mode preset (`ufh_only`).

### `UFH_PRESETS_SOURCE`

| Режим | Когда |
|-------|--------|
| `mongo` | **Production** — единственный runtime-источник mode preset |
| `file` | Dev без Mongo |
| `auto` | Dev fallback: Mongo → file; **не** гарантирует совпадение с prod после правок только в Mongo |

Слой 1 (базы/финиши) **всегда** из `data/*.js` (деплой); `invalidate-reference-cache` обновляет только bundle (слой 3).

---

## Коллекция и загрузка

| Параметр | Значение |
|----------|----------|
| Коллекция MongoDB | `underfloor_heating_presets` |
| Файл dev/seed | `backend/data/underfloor_heating_presets.json` |
| Переменная | `UFH_PRESETS_SOURCE` (`file` \| `mongo` \| `auto`) |
| Runtime | `loadUnderfloorHeatingPresets.js` → `configCache.js` → **`CalcRuntimeContext.ufhPresets`** → `normalizeHeatingUfhPreset` / `calculateUnderfloorHeating` (см. [`calc-runtime-context.md`](calc-runtime-context.md)) |
| Seed | `backend/scripts/seedReferenceData.js` |

Валидация: `validateUnderfloorHeatingPresets.js` — derive `supplyC` / `returnC` (Δt = **10 K**):

```
supplyC = maxSupplyTemperatureC
returnC = supplyC − 10
```

---

## Четыре обязательных пресета режима

| presetId | UI (кратко) | maxSupply | maxSurface | hasMixingNode | requiresCondensingBoiler |
|----------|-------------|-----------|------------|---------------|--------------------------|
| `ufh_only` | Только ТП | 40 | 29 | false | **true** |
| `ufh_mixed_radiators` | ТП + радиаторы | 45 | 29 | true | false |
| `ufh_direct_tile` | Прямой ТП под плитку | 45 | 29 | false | false |
| `ufh_direct_laminate` | Прямой ТП под ламинат | 40 | **27** | false | false |

Константы ID: `shared/ufhModePresetIds.js`.

---

## API

### `GET /api/v1/presets/underfloor-heating/modes`

Ответ: `schemaVersion`, `source`, `presets[]` с полями `presetId`, `ui` (title, badge, description), `technical` (нормализованные supply/return, флаги).

### Вход расчёта `POST /api/v1/calc`

```json
{
  "heatingSystem": {
    "ufhPresetId": "ufh_direct_laminate",
    "heatingEmittersMode": "mixed",
    "waterUnderfloorHeating": true
  }
}
```

- `heatingEmittersMode` выводится из `ufhPresetId`, если не задан (`ufh_only` → `ufh_only`, иначе `mixed`).
- Для `ufh_only`: нормализация выставляет график котла **40/30**, `thermalRegimePreset` → конденсационный при отсутствии явного выбора.
- Несовместимый финиш при `ufh_direct_*` → **400** `UFH_MODE_FINISH_MISMATCH`.

### Meta отчёта

`report.meta.ufhPresetsSource`, `report.meta.ufhPresetsSchemaVersion`.

---

## Поведение в расчёте

| Модуль | Действие |
|--------|----------|
| `normalizeHeatingUfhPreset.js` | lookup пресета, warnings (конденсация, график) |
| `ufhModeFinishCompatibility.js` | cross-validation mode ↔ finish |
| `warmFloorCalc.js` | контур `ufh_direct_*` из technical пресета; `circuitSource: ufh_mode_preset` |
| `ufhRoomHeatFlux.js` | `maxSurfaceTemperatureCelsius = min(preset, паспорт финиша)` |
| `matching/radiators.js` | skip при `heatingEmittersMode === 'ufh_only'` |
| `matching/index.js` | котёл: при `ufh_only` база = `totalHeatFluxUpWatts` |
| `matching/boiler.js` | warning, если пресет требует конденсацию, а котёл не condensing |

---

## Frontend

- Карточки режима: `UfhPresetCards`, загрузка `useUfhModePresetsQuery` (`frontend/src/query/`)
- Секция: `WarmFloorSection` — при `ufh_only` скрыта схема распределения ТП
- Payload: `buildCalcRequestPayload.ts` — `ufhPresetId`, `heatingEmittersMode`

---

## Verify

```bash
cd backend && npm run verify:ufh-presets
```

Проверяет JSON, нормализацию, эталонные `technical`, согласованность `ufh_direct_*` с `shared/ufhCircuitPresets.js` и smoke-тест `maxSurface`.
