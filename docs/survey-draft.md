# Survey draft (черновик анкеты)

## SSOT

- `frontend/src/types/surveyDraft.ts` — `SURVEY_DRAFT_SCHEMA_VERSION` (**4**), тип `SurveyDraft`
- Порядок шагов UI и валидация `currentStep` — `frontend/src/constants/surveySteps.ts` (`SURVEY_STEPS`, `isSurveyStep`)
- Производный runtime-снимок — `SurveyDraftSnapshot` в `frontend/src/surveySession/types.ts` (включает `wiringLayoutV3`)

## Поля v4 (добавлено после гидравлики и SurveySession)

| Поле | Назначение |
|------|------------|
| `hydraulicsForm` | Шаг «Гидравлика»: `mainLineLengthM` (котёл → коллектор), `deltaTSystemK`, `pipeMaterialPreference` |
| `wiringLayoutV3` | Схема разводки v3: `systemType` (`auto` \| `two-pipe-dead-end` \| …), `branches[]` (длина коллектор → радиатор); на calc уходит `hydraulics.radiatorWiringSystemType` + `radiatorBranchOverrides` |
| `ufhPresetId` | Режим emitters (`ufh_only`, `ufh_mixed_radiators`, …); `null` — классика без ТП |
| `radiatorConnection` | Подводка радиаторов: `side` \| `bottom` (дефолт `side`); UI — шаг «Котёл»; в calc → `heatingSystem.radiatorConnection`. SSOT — `shared/radiatorConnection.js`, см. [`radiator-connection.md`](radiator-connection.md). Старые draft без поля → `side` в `migrateSurveyDraft` |
| `radiatorEmitterPreference` | Тип приборов на объект: `auto` \| `sectional` \| `panel` (дефолт `auto`); UI — шаг «Котёл»; в calc → `heatingSystem.radiatorEmitterPreference`. SSOT — `shared/radiatorEmitterPreference.js`, см. [`radiator-emitter-kind.md`](radiator-emitter-kind.md). Старые draft без поля → `auto` |

### ТП в комнате: `ufhTerminalControl`

В `rooms[].underfloorHeating` (compat через `migrateRoomUnderfloorHeating`):

| Значение | Смысл |
|----------|--------|
| omit / `collector` | Петля на коллекторе ТП (default) |
| `unibox` | Локальный регулятор; только при `areaM2 ≤ 20` |

Старые черновики без поля → `collector`.

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

## Compat-слой (НЕ dead code)

До релиза и снятия freeze (**целевая дата review: +1 месяц после внедрения телеметрии**) следующие модули **обязательны** и **не удаляются** как «мёртвый код»:

| Модуль | Назначение |
|--------|------------|
| `utils/migrateLegacyRoomTypes.ts` | `living`/`bathroom`/`tech` → канонические типы |
| `utils/migrateLegacyExternalWalls.ts` | `wall_pps_*`, `insul_*` в `presetId` стены |
| `utils/migrateRoomUnderfloorHeating.ts` | монолитный `presetId` ТП → `basePresetId` + `finishMaterialId` |
| `utils/migrateSurveyDraft.ts` | единая точка загрузки snapshot |
| `utils/migrateLegacyWallAreaM2` в `roomEnvelopeFields.ts` | `wallAreaM2` → `externalWall1/2` |
| `constants/compatLegacyIds.ts` | ID устаревших пресетов стен |
| `migrateDerivedState.ts` (ветка `DRAFT_LOADED`) | bootstrap `wiringLayoutV3` при загрузке |

**Живая pipeline-логика (не compat):** `migrateDerivedState.ts` — синхронизация ТП и wiring на каждой мутации; **не удалять**.

**Телеметрия freeze:** `utils/compatTelemetry.ts` — `console.warn('[survey-compat] …')` только в `import.meta.env.DEV`, при фактическом срабатывании миграции. Когда за месяц QA логи = 0 → спринт на Hard Reset (удаление compat, отказ `schemaVersion < 4`).

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
cd frontend && npm run verify
```

`npm run verify` во frontend = `lint` + **`typecheck`** + `verify:survey-session` + `verify:dead-code` (knip).

### Автоматизированная приёмка (frontend)

Перед сдачей задачи на чистой кодовой базе:

```bash
cd frontend && npm run verify && npm run build
```

- **`npm run verify`** — exit `0` обязателен; ошибки ESLint (`strictTypeChecked`), `typecheck`, `verify:survey-session` или knip (вне `ignore`) блокируют приёмку.
- **`npm run build`** — `typecheck` + Vite без ошибок.
- Полный gate репозитория: из корня `npm run verify` (см. [`type-safety.md`](type-safety.md)).

**Knip (`knip.json`):** модули живой миграции черновиков в секции `ignore` (не анализируются, без ложных срабатываний):

- `migrateLegacyRoomTypes.ts`
- `migrateRoomUnderfloorHeating.ts`
- `migrateLegacyExternalWalls.ts`
- `migrateDerivedState.ts`
- `migrateSurveyDraft.ts`

См. также: [`water-heater-form.md`](water-heater-form.md), [`frontend-calc-runner.md`](frontend-calc-runner.md).
