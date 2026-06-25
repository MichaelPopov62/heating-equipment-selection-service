# Survey draft (черновик анкеты)

## SSOT

- `frontend/src/types/surveyDraft.ts` — `SURVEY_DRAFT_SCHEMA_VERSION`, тип `SurveyDraft`

## Загрузка и сохранение

| Операция | Функция |
|----------|---------|
| Загрузка | `migrateSurveyDraft()` — `frontend/src/utils/migrateSurveyDraft.ts` |
| Сохранение | `buildSurveyDraft()` — `frontend/src/utils/buildSurveyDraft.ts` |
| Парсинг (алиас) | `parseSurveyDraft()` → `migrateSurveyDraft()` |

Точки вызова загрузки: файл JSON, `projects.survey` на сервере, hash-URL (`surveyShare.ts`), хук `useSurveyProject`.

## Устаревшие поля в snapshot (только при чтении)

| Поле в snapshot | Куда попадает после `migrateSurveyDraft` |
|-----------------|------------------------------------------|
| `hotWaterBoilerPowerMatchingScheme` (корень) | `waterHeaterForm.hotWaterBoilerPowerMatchingScheme` |
| `objectMeta.indirectDhwSpaceAvailable` | `waterHeaterForm.indirectDhwSpaceAvailable` |

После нормализации UI и state **не** содержат `indirectDhwSpaceAvailable` в `objectMeta`. В POST `/api/v1/calc` флаг мержится через `objectMetaForCalcPayload()`.

## Verify

```bash
cd backend && npm run verify:survey-draft-migration
```

См. также: [`water-heater-form.md`](water-heater-form.md), [`frontend-calc-runner.md`](frontend-calc-runner.md).
