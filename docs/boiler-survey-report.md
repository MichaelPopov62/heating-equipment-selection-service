# Отчёт и итог котла (UI)

## Разделение ответственности

| Слой | Компоненты | Содержимое |
|------|------------|------------|
| Ввод | `BoilerSurveyForm` | `thermalRegimePreset` |
| Полный расчёт | `BoilerReportDialog` → `BoilerReportView` | summary (теплопотери/запас/requiredKw), warnings, `BoilerProposalCard` × economy/efficient или legacy |
| Сайдбар «Итог» | **новая** `BoilerSummaryTable` | KPI + `SurveyStepLink` на шаг «Котёл» |
| Блок «Рекомендация» | `BoilerProposalCard` × economy/efficient | полные варианты: котёл + ЭВН/БКН и **Итого по варианту** |
| Блок «Рекомендация» | `RadiatorProposalLineTable` | радиаторы отдельно (не внутри карточек котла) |

Существующие summary других модулей (`RadiatorsSummaryTable`, `HotWaterSummaryTable`, …) **не изменяются**.

Контракт API без изменений: `matching.boiler` → `parseBoilerFromReport`.

## Навигация

- Якорь: `RESULTS_SECTION_IDS.boiler` → `results-boiler`.
- «Назад к результатам» на шаге «Котёл» → `navigateToResultsSection`.
- Из summary: `SurveyStepLink step="boiler"`.

## Связанные docs

- [`heating-schemes-thermal-regime.md`](heating-schemes-thermal-regime.md)
- [`frontend-calc-runner.md`](frontend-calc-runner.md)
- [`radiators-survey-report.md`](radiators-survey-report.md)
- [`survey-draft.md`](survey-draft.md)
