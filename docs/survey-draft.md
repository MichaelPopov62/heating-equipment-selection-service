# Survey draft (черновик анкеты)

## SSOT

- `frontend/src/types/surveyDraft.ts` — `SURVEY_DRAFT_SCHEMA_VERSION` (**4**), тип `SurveyDraft`
- Производный runtime-снимок — `SurveyDraftSnapshot` в `frontend/src/surveySession/types.ts` (включает `wiringLayoutV3`)

## Поля v4 (добавлено после гидравлики и SurveySession)

| Поле | Назначение |
|------|------------|
| `hydraulicsForm` | Шаг «Гидравлика»: `mainLineLengthM` (котёл → коллектор), `deltaTSystemK`, `pipeMaterialPreference` |
| `wiringLayoutV3` | Схема разводки v3: `systemType` (`auto` \| `two-pipe-dead-end` \| …), `branches[]` (длина коллектор → радиатор); на calc уходит `hydraulics.radiatorWiringSystemType` + `radiatorBranchOverrides` |
| `ufhPresetId` | Режим emitters (`ufh_only`, `ufh_mixed_radiators`, …); `null` — классика без ТП |

### UI шага «Гидравлика»

Компонент `frontend/src/components/HydraulicsSection/HydraulicsSection.tsx`:

| Поле в UI | Источник в черновике | Поле в POST `/api/v1/calc` |
|-----------|----------------------|----------------------------|
| Тип разводки (radio-список с пояснениями) | `wiringLayoutV3.systemType` | `hydraulics.radiatorWiringSystemType` |
| Длина котёл → коллектор | `hydraulicsForm.mainLineLengthM` | `hydraulics.mainLineLengthM` |
| Подвод коллектор → радиатор (по комнатам) | `wiringLayoutV3.branches[].pipeLengthToEquipmentM` | `hydraulics.radiatorBranchOverrides[]` |
| Порядок радиаторов на магистрали | порядок `branches[]` (кнопки ↑↓ для dead-end / pass) | порядок `radiatorBranchOverrides[]` |

Подписи схем — `frontend/src/utils/wiringSystemTypeLabels.ts` (`WIRING_SYSTEM_TYPE_OPTIONS`: заголовок + `description` под каждым radio). Дефолт — `auto` (бейдж «Рекомендуется»).

| `systemType` | Смысл для пользователя |
|--------------|------------------------|
| `auto` | Группировка: крупные ветки отдельно, мелкие зоны в микроколлектор |
| `two-pipe-dead-end` | Последовательная магистраль, убывающий расход и Ø |
| `two-pipe-pass` | Проходная магистраль, постоянный расход на trunk |
| `manifold` | Все радиаторы строго параллельно от распределительного узла |

Мутации сессии: `WIRING_SCHEME_SET`, `WIRING_BRANCH_LENGTH_SET`, `WIRING_BRANCH_REORDER`, `SET_HYDRAULICS_FORM`.

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
