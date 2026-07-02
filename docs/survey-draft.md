# Survey draft (черновик анкеты)

## SSOT

- `frontend/src/types/surveyDraft.ts` — `SURVEY_DRAFT_SCHEMA_VERSION` (**4**), тип `SurveyDraft`
- Производный runtime-снимок — `SurveyDraftSnapshot` в `frontend/src/surveySession/types.ts` (включает `wiringLayoutV3`)

## Поля v4 (добавлено после гидравлики и SurveySession)

| Поле | Назначение |
|------|------------|
| `hydraulicsForm` | Шаг «Гидравлика»: `deltaTSystemK`, `mainLineLengthM`, `pipeMaterialPreference` |
| `wiringLayoutV3` | Схема разводки v3: `systemType` (`auto` \| `two-pipe-dead-end` \| …), ветки для UI/графа |
| `ufhPresetId` | Режим emitters (`ufh_only`, `ufh_mixed_radiators`, …); `null` — классика без ТП |

Миграция v3→v4: `migrateSurveyDraft.ts` — дефолты для `hydraulicsForm` и `wiringLayoutV3`.

## Загрузка и сохранение

| Операция | Функция |
|----------|---------|
| Загрузка | `migrateSurveyDraft()` — `frontend/src/utils/migrateSurveyDraft.ts` |
| Сохранение | `buildSurveyDraft()` — `frontend/src/utils/buildSurveyDraft.ts` |
| Парсинг (алиас) | `parseSurveyDraft()` → `migrateSurveyDraft()` |
| Применение в сессию | `DRAFT_LOADED` → `runSurveyMutationPipeline` |

Точки вызова загрузки: файл JSON, `projects.survey` на сервере (через `useProjectMutations` / `useSurveyProject`), hash-URL (`surveyShare.ts`).

## Устаревшие поля в snapshot (только при чтении)

| Поле в snapshot | Куда попадает после `migrateSurveyDraft` |
|-----------------|------------------------------------------|
| `hotWaterBoilerPowerMatchingScheme` (корень) | `waterHeaterForm.hotWaterBoilerPowerMatchingScheme` |
| `objectMeta.indirectDhwSpaceAvailable` | `waterHeaterForm.indirectDhwSpaceAvailable` |

После нормализации UI и state **не** содержат `indirectDhwSpaceAvailable` в `objectMeta`. В POST `/api/v1/calc` флаг мержится через `objectMetaForCalcPayload()`.

## Verify

```bash
cd backend && npm run verify:survey-draft-migration
cd frontend && npm run verify:survey-session
```

См. также: [`water-heater-form.md`](water-heater-form.md), [`frontend-calc-runner.md`](frontend-calc-runner.md).
