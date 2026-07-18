# Отчёт и итог гидравлики (UI)

## Разделение ответственности

| Слой | Компоненты | Содержимое |
|------|------------|------------|
| Ввод | `HydraulicsSection` | тип разводки, длины, Δt, материал труб |
| Полный расчёт | `HydraulicsReportDialog` → `HydraulicsReportView` | график/Δt, расход/напор, насосы (без зон ТП), трубы **с** Цена/м и Сумма, детализация по участкам, warnings |
| Сайдбар «Итог» | `HydraulicsSummaryTable` | KPI (расход, напор, Δt); длины **Магистраль** / **Коллектор** из `pipeSegments` (не число SKU); `SurveyStepLink` на шаг «Гидравлика» |
| Блок «Рекомендация» | `HydraulicsProposalTable` | плоский подбор труб **без** цен и **без** группировки по контурам / участков |

Насосы зон `ufh_*` — только в отчёте шага «Тёплый пол» (`excludeUfhZonePumps`).

Контракт API без изменений: `matching.hydraulics` / `calculations.hydraulics` → `parseHydraulicsFromReport`.

## Навигация

- Якорь: `RESULTS_SECTION_IDS.hydraulics` → `results-hydraulics`.
- «Назад к результатам» на шаге «Гидравлика» → `navigateToResultsSection`.
- Из summary: `SurveyStepLink step="hydraulics"`.

## Связанные docs

- [`hydraulics-pipeline.md`](hydraulics-pipeline.md)
- [`frontend-calc-runner.md`](frontend-calc-runner.md)
- [`survey-draft.md`](survey-draft.md)
- [`boiler-survey-report.md`](boiler-survey-report.md)
- [`radiators-survey-report.md`](radiators-survey-report.md)
