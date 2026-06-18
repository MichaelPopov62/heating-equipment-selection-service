# Пресеты режима ТП (Mongo `underfloor_heating_presets`, v3)

Справочник режимов водяного тёплого пола: технические лимиты + человекочитаемый UI. Отдельно от баз конструкции (`warmFloorAssemblyPresets`) и финишей (`flooringFinishMaterials`).

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

## Три обязательных пресета

| presetId | UI (кратко) | maxSupply | maxSurface | hasMixingNode | requiresCondensingBoiler |
|----------|-------------|-----------|------------|---------------|--------------------------|
| `ufh_only` | Только ТП | 40 | 29 | false | **true** |
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

### Meta отчёта

`report.meta.ufhPresetsSource`, `report.meta.ufhPresetsSchemaVersion`.

---

## Поведение в расчёте

| Модуль | Действие |
|--------|----------|
| `normalizeHeatingUfhPreset.js` | lookup пресета, warnings (конденсация, график) |
| `warmFloorCalc.js` | контур `ufh_direct_*` из technical пресета; `circuitSource: ufh_mode_preset` |
| `ufhRoomHeatFlux.js` | `maxSurfaceTemperatureCelsius = min(preset, паспорт финиша)` |
| `matching/radiators.js` | skip при `heatingEmittersMode === 'ufh_only'` |
| `matching/index.js` | котёл: при `ufh_only` база = `totalHeatFluxUpWatts` |
| `matching/boiler.js` | warning, если пресет требует конденсацию, а котёл не condensing |

---

## Frontend

- Карточки режима: `UfhPresetCards`, загрузка `useUfhModePresetsLoader`
- Секция: `WarmFloorSection` — при `ufh_only` скрыта схема распределения ТП
- Payload: `buildCalcRequestPayload.ts` — `ufhPresetId`, `heatingEmittersMode`

---

## Verify

```bash
cd backend && npm run verify:ufh-presets
```

Проверяет JSON, нормализацию, эталонные `technical` и smoke-тест `maxSurface`.
