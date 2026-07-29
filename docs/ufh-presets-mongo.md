# Пресеты режима ТП (Mongo `underfloor_heating_presets`, v3)

Справочник режимов водяного тёплого пола: технические лимиты + человекочитаемый UI. Отдельно от баз конструкции (`warmFloorAssemblyPresets`) и финишей (`flooringFinishMaterials`).

> **Мова UI:** поля `ui.title`, `ui.badge`, `ui.description` у `backend/data/underfloor_heating_presets.json` та `name`/`description` у `warmFloorAssemblyPresets.js` — **українською**. Технічні `presetId`, `finishMaterialId` — без змін. Деталі: [`language-policy.md`](language-policy.md).
>
> Labels контуру ТП: `shared/ufhCircuitPresets.js` — UA.

---

## Три слоя ТП (не один источник)

| Слой | Источник | Поля / API | Роль |
|------|----------|------------|------|
| **1. Конструкция комнаты** | `data/warmFloorAssemblyPresets.js` + `data/flooringFinishMaterials.js` | `room.underfloorHeating.{basePresetId, finishMaterialId}`; `GET …/underfloor-heating`, `/bases` | Физика: слои, Rλ,B, теплоотдача |
| **2. Контур по финишу** | `shared/ufhCircuitPresets.js` | derive в `ufhCircuitResolve.js` | 45/35 для плитки, 40/30 для ламината/LVT (mixed) |
| **3. Режим системы** | Mongo/file `underfloor_heating_presets` | `heatingSystem.ufhPresetId`; `GET …/modes` | ufh_only / mixed; график котла, skip радиаторов, maxSurface |

В `validate.js`:

- **Фаза 4 (до AJV):** слой 1 — `normalizeUnderfloorHeatingBeforeValidate` (статический `data/`).
- **Фаза 6 (после AJV):** слой 3 — `normalizeHeatingUfhPreset(body, ctx.ufhPresets)` из bundle.

Слои **намеренно разделены** (разный lifecycle: деплой vs Mongo/seed). Риск — рассинхрон между слоями 2 и 3; см. verify ниже.

`ufh_mixed_radiators` использует контур по финишу комнаты (слой 2), `ufh_only` — график из mode preset.

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

## Обязательные пресеты режима

| presetId | UI (кратко) | maxSupply | maxSurface | hasMixingNode | requiresCondensingBoiler |
|----------|-------------|-----------|------------|---------------|--------------------------|
| `ufh_only` | Только ТП | 40 | 29 | false | **true** |
| `ufh_mixed_radiators` | ТП + радиаторы | 45 | 29 | true | false |

Константы ID: `shared/ufhModePresetIds.js`.

---

## API

### `GET /api/v1/presets/underfloor-heating/modes`

Ответ: `schemaVersion`, `source`, `presets[]` с полями `presetId`, `ui` (title, badge, description), `technical` (нормализованные supply/return, флаги).

### Вход расчёта `POST /api/v1/calc`

```json
{
  "heatingSystem": {
    "ufhPresetId": "ufh_mixed_radiators",
    "heatingEmittersMode": "mixed",
    "waterUnderfloorHeating": true
  }
}
```

- `heatingEmittersMode` выводится из `ufhPresetId`, если не задан (`ufh_only` → `ufh_only`, иначе `mixed`).
- Для `ufh_only`: нормализация **всегда** выставляет график котла **40/30** и `thermalRegimePreset = condensing_dt30_55_45` (даже если во входе был `traditional_dt50_75_65`); `heatingEmittersMode = ufh_only`.

### Meta отчёта

`report.meta.ufhPresetsSource`, `report.meta.ufhPresetsSchemaVersion`.

---

## Поведение в расчёте

| Модуль | Действие |
|--------|----------|
| `normalizeHeatingUfhPreset.js` | lookup пресета, warnings (конденсация, график) |
| `warmFloorCalc.js` | контур ТП из финиша комнаты; `circuitSource: finish_preset` (или `ufh_mode_preset` для `ufh_only`) |
| `ufhRoomHeatFlux.js` | `maxSurfaceTemperatureCelsius = min(preset, паспорт финиша)` |
| `matching/radiators.js` | skip при `heatingEmittersMode === 'ufh_only'` |
| `matching/index.js` | котёл: при `ufh_only` база = `totalHeatFluxUpWatts` |
| `matching/boiler.js` | warning, если пресет требует конденсацию, а котёл не condensing |

---

## Frontend

- Карточки режима: `UfhPresetCards`, загрузка `useUfhModePresetsQuery` (`frontend/src/query/`)
- Секция: `WarmFloorSection` на шаге `warmFloor` (`SURVEY_STEPS`: после `object`, перед `rooms`); при `ufh_only` скрыта схема распределения ТП
- Полный отчёт ТП + унибоксы + насос зоны ТП (при смесителе): кнопка «Отчёт по расчёту ТП»
- Шаг `technicalResult`: `UnderfloorHeatingSummaryTable` — агрегаты ТП; ссылки `SurveyStepLink`
- Котловой насос — в блоке гидравлики «Итог» (`boiler_primary`), не в отчёте ТП
- Payload: `buildCalcRequestPayload.ts` — `ufhPresetId`, `heatingEmittersMode`
- Порядок шагов: [`frontend-calc-runner.md`](frontend-calc-runner.md) § «Шаги анкеты» / § «UI блока Тёплый пол»

---

## Verify

```bash
cd backend && npm run verify:ufh-presets
```

Проверяет JSON, нормализацию, эталонные `technical` и smoke-тест `maxSurface`.
