# Подводка радиаторов (`radiatorConnection`)

## Контракт

`heatingSystem.radiatorConnection`: `side` | `bottom`.

| Значение | Смысл |
|----------|--------|
| `side` | боковая (K / Klasik); **дефолт** |
| `bottom` | нижняя (VK / VKP); фильтр панельного пула |

Источник SSOT: `shared/radiatorConnection.js`.  
OpenAPI: `components/schemas/CalcInput.yaml`.  
Нормализация: `normalizeHeatingSystemThermalRegime` → `normalizeRadiatorConnection` (пустое/неизвестное → `side`).

**Ортогонально** типу прибора: см. [`radiator-emitter-kind.md`](radiator-emitter-kind.md)
(`radiatorEmitterPreference` / Two-Pass). Подводка **не** переключает section↔panel в комнате.

## Анкета

Шаг «Радиаторы»: компонент `frontend/src/components/RadiatorsSurveyForm/RadiatorsSurveyForm.tsx` — select «Подводка радиаторов».  
Полный расчёт — модалка `RadiatorsReportDialog`; компактный итог — `RadiatorsSummaryTable` в сайдбаре.  
Таблицы линий рядом с котлом остаются в блоке «Рекомендация». См. [`radiators-survey-report.md`](radiators-survey-report.md).  
На шаге «Котёл» остаётся только `thermalRegimePreset` (график подачи/обратки).  
При `ufhPresetId === 'ufh_only'` селект disabled (значения в draft не сбрасываются; matching радиаторов на сервере skip).  
Черновик: `SurveyDraft.radiatorConnection` (compat: при загрузке старых draft без поля → `side`).  
См. также [`survey-draft.md`](survey-draft.md).

## Matching

- Фильтр панельного пула: `filterPanelsByConnection`.
- Notes: `buildRadiatorConnectionSelectionNotes` (без flip kind).
- Economy / Efficient используют **один** `radiatorConnection` из анкеты.

## Verify

```bash
cd backend && npm run verify:radiator-connection
```
