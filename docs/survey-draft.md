# Состояние анкеты (SurveyDraft)

Клиентское состояние анкеты между шагами UI, в `localStorage`, в `project.survey` и в hash-URL. На сервер calc уходит отдельный **CalcInput** через `buildCalcPayloadFromDraft()`.

См. также: [`start-state.md`](start-state.md), [`frontend-calc-runner.md`](frontend-calc-runner.md).

---

## Bootstrap

| Событие | Режим | Действие |
|---------|-------|----------|
| Cold open | `start` | Start Screen, без persist и calc |
| Hash / localStorage / file / project | `survey` | `DRAFT_LOADED` |
| «Начать новый расчёт» | `survey` | `SURVEY_STARTED` → `createDefaultSurveyDraft.ts` |

Локальный ключ: `heatcalc:survey-draft:v1` (`surveyDraftStorage.ts`, debounce 400 ms в `useSurveyDraftPersistence`).

---

## SSOT

| Артефакт | Путь |
|----------|------|
| Версия схемы | `SURVEY_DRAFT_SCHEMA_VERSION = 4` — `frontend/src/types/surveyDraft.ts` |
| Тип | `SurveyDraft` |
| Шаги UI | `frontend/src/constants/surveySteps.ts` — `object` → `warmFloor` → `rooms` → … → `technicalResult` → `dataReference` → `financialResult` |
| Runtime-снимок | `SurveyDraftSnapshot` — `frontend/src/surveySession/types.ts` (`wiringLayoutV3`, формы шагов) |

---

## Поля схемы v4

| Поле | Назначение |
|------|------------|
| `hydraulicsForm` | `mainLineLengthM`, `deltaTSystemK`, `pipeMaterialPreference` |
| `wiringLayoutV3` | `systemType`, `branches[]` → calc: `hydraulics.radiatorWiringSystemType`, `radiatorBranchOverrides` |
| `ufhPresetId` | Режим emitters (`ufh_only`, `ufh_mixed_radiators`, …); `null` — без ТП |
| `radiatorConnection` | `side` \| `bottom` → `heatingSystem.radiatorConnection` — [`radiator-connection.md`](radiator-connection.md) |
| `radiatorEmitterPreference` | `auto` \| `sectional` \| `panel` → calc — [`radiator-emitter-kind.md`](radiator-emitter-kind.md) |

### ТП в комнате: `ufhTerminalControl`

`rooms[].underfloorHeating`: `collector` (default) \| `unibox` (при `areaM2 ≤ 20`).

### UI шага «Гидравлика»

`HydraulicsSection.tsx`:

| UI | SurveyDraft | POST `/api/v1/calc` |
|----|-------------|---------------------|
| Тип разводки | `wiringLayoutV3.systemType` | `hydraulics.radiatorWiringSystemType` |
| Длина котёл → коллектор | `hydraulicsForm.mainLineLengthM` | `hydraulics.mainLineLengthM` |
| Подвод по комнатам | `wiringLayoutV3.branches[].pipeLengthToEquipmentM` | `hydraulics.radiatorBranchOverrides[]` |
| Порядок радиаторов | порядок `branches[]` | порядок overrides |

Подписи: `wiringSystemTypeLabels.ts`. Отчёты: [`hydraulics-survey-report.md`](hydraulics-survey-report.md).

Мутации: `WIRING_SCHEME_SET`, `WIRING_BRANCH_LENGTH_SET`, `WIRING_BRANCH_REORDER`, `SET_HYDRAULICS_FORM`.

---

## Загрузка и сохранение

| Операция | Функция |
|----------|---------|
| Загрузка / нормализация | `migrateSurveyDraft()` — `frontend/src/utils/migrateSurveyDraft.ts` |
| Сохранение | `buildSurveyDraft()` — `frontend/src/utils/buildSurveyDraft.ts` |
| Парсинг | `frontend/src/utils/parseSurveyDraft.ts` → `migrateSurveyDraft()` |
| В сессию | `DRAFT_LOADED` → `runSurveyMutationPipeline` |

Источники: JSON-файл, `projects.survey`, hash (`frontend/src/utils/surveyShare.ts`).

При загрузке snapshot вызывается **`migrateSurveyDraft`**: дефолты для отсутствующих полей v4, нормализация прежних типов комнат, стен и ТП (`migrateLegacyRoomTypes.ts`, `migrateLegacyExternalWalls.ts`, `migrateRoomUnderfloorHeating.ts`, функция `migrateLegacyWallAreaM2` в `roomEnvelopeFields.ts`). Телеметрия срабатываний — `compatTelemetry.ts` (`[survey-compat]` в DEV).

**Pipeline (не удалять):** `migrateDerivedState.ts` — синхронизация ТП и wiring на каждой мутации и при `DRAFT_LOADED`.

---

## Поля только при чтении snapshot

| В snapshot | После `migrateSurveyDraft` |
|------------|----------------------------|
| `hotWaterBoilerPowerMatchingScheme` (корень) | `waterHeaterForm.hotWaterBoilerPowerMatchingScheme` |
| `objectMeta.indirectDhwSpaceAvailable` | `waterHeaterForm.indirectDhwSpaceAvailable` |

В POST `/api/v1/calc` флаг БКН мержится через `objectMetaForCalcPayload()` — см. [`water-heater-form.md`](water-heater-form.md).

---

## Verify

```bash
cd backend && npm run verify:survey-draft-migration
cd frontend && npm run verify
```

Frontend `verify` = lint + typecheck + knip + build + `verify:survey-session`.

См. [`type-safety.md`](type-safety.md), [`water-heater-form.md`](water-heater-form.md).
