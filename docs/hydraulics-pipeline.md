# Гидравлика Pure Pipeline

Архитектура модуля гидравлики: финальный агрегатор данных системы без пересчёта теплотехники upstream-модулей.

## Принципы

1. **SSOT по теплу** — ТП, радиаторы и ГВС считают мощности и расходы; гидравлика только агрегирует.
2. **Два уровня контракта** — `HydraulicsSurveyInput` (анкета) и `HydraulicsPipelineInput` (сервер после matching).
3. **Диаметры только в выходе** — `matching.hydraulics.pipes[]`, не во входе.
4. **Порядок в buildReport** — `matchEquipment` → `buildHydraulicsSnapshots` → `validateHydraulicsPipelineInput` → `runHydraulicsPipeline`.

## Маппинг upstream → DTO

| Поле DTO | Источник |
|----------|----------|
| `source.*` | `matching.boiler` + `heatingSystem` |
| `circuits.radiators` | `matching.radiators.byRoom[]` + `inputs` |
| `circuits.underfloor` | `calculations.underfloorHeating` |
| `circuits.dhw` | `calculations.hotWater` + `matching.indirectWaterHeater` |
| `layout.*` | `input.hydraulics` + `appliances.hydraulics` |
| `rules.*` | `appliances.hydraulics` |

## Модули (`backend/src/hydraulics/`)

| Файл | Назначение |
|------|------------|
| `public.js` | Barrel API |
| `thermalLoadToFlow.js` | SSOT Q/(c·Δt) |
| `buildSnapshots.js` | Сборка DTO |
| `validatePipelineInput.js` | AJV + cross-validation |
| `buildGraph.js` | Топология |
| `pickPipe.js` / `pickPump.js` | Подбор из каталога |
| `pressureDrop.js` | Δp и критический контур |
| `runHydraulicsPipeline.js` | Оркестратор |

## Режимы emitters

- `radiators_only` — котёл → магистраль → ветки радиаторов
- `ufh_only` — котёл → коллектор ТП → петли
- `mixed` — смеситель/гидрострелка + оба контура
