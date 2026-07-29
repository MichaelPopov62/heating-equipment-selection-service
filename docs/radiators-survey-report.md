# Отчёт и итог радиаторов (UI)

> **Мова UI:** user-facing тексти — **українською**; [`language-policy.md`](language-policy.md).

## Разделение ответственности

| Слой | Компоненты | Содержимое |
|------|------------|------------|
| Ввод | `RadiatorsSurveyForm` | `radiatorConnection`, `radiatorEmitterPreference` |
| Полный расчёт | `RadiatorsReportDialog` → `RadiatorsReportView` | inputs, агрегаты, линии economy/efficient, warnings |
| Шаг `technicalResult` | `RadiatorsSummaryTable` | KPI + `SurveyStepLink` на шаг «Радиаторы» |
| Шаг `technicalResult` | `RadiatorProposalLineTable` | радиаторы по вариантам (отдельно от таблицы котлов) |
| Шаг `technicalResult` | `BoilerProposalCard` × economy/efficient | котлы — см. [`boiler-survey-report.md`](boiler-survey-report.md) |

Контракт API без изменений: `matching.radiators` → `parseRadiatorsMatchingFromReport`.

## Навигация

- Якорь: `RESULTS_SECTION_IDS.radiators` → `results-radiators`.
- «Назад к результатам» на шаге «Радиаторы» → `navigateToResultsSection`.
- Из summary: `SurveyStepLink step="radiators"`.

## ufh_only

Селекты формы disabled; после calc в matching есть skip-warning → `hasRadiatorsReportContent` = true → отчёт и summary показывают пояснение.

## Связанные docs

- [`radiator-connection.md`](radiator-connection.md)
- [`radiator-emitter-kind.md`](radiator-emitter-kind.md)
- [`radiator-emitters-summary.md`](radiator-emitters-summary.md)
- [`frontend-calc-runner.md`](frontend-calc-runner.md)
- [`survey-draft.md`](survey-draft.md)
