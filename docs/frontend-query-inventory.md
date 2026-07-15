# Frontend: инвентаризация React Query и services

## Query-хуки (все активны, мёртвых нет)

| Хук | Файл | Endpoint / назначение | enabled |
|-----|------|----------------------|---------|
| `useEnvelopePresetsQuery` | `query/queries/useEnvelopePresetsQuery.ts` | `GET /api/v1/presets/envelope` | всегда |
| `useUnderfloorHeatingPresetsQuery` | `query/queries/useUnderfloorHeatingPresetsQuery.ts` | UFH bases + finishes | всегда |
| `useUfhModePresetsQuery` | `query/queries/useUfhModePresetsQuery.ts` | `GET /api/v1/presets/underfloor-heating/modes` | всегда |
| `useCatalogEquipmentQuery` | `query/queries/useCatalogEquipmentQuery.ts` | `GET /api/v1/catalog` | по требованию UI |
| `useProjectsListQuery` | `query/queries/useProjectsListQuery.ts` | `GET /api/v1/projects` | `projectsOpen` |
| `useProjectCalculationsQuery` | `query/queries/useProjectCalculationsQuery.ts` | calculations list | `projectId` задан |
| `useProjectMutations` | `query/mutations/useProjectMutations.ts` | save/load project, calc | по действию |
| `useSurveyCalc` | `query/useSurveyCalc.ts` | `POST /api/v1/calc` | auto: `canAutoCalc`; manual: mutation |
| `useReferenceData` | `query/useReferenceData.ts` | оркестратор пресетов | — |
| `useDebouncedValue` | `query/useDebouncedValue.ts` | debounce для calc key | — |

Ключи: `query/queryKeys.ts`.

## Services (fetch-обёртки)

| Функция | Файл | HTTP |
|---------|------|------|
| `postCalc` | `services/calc.ts` | `POST /api/v1/calc` |
| `fetchCatalogEquipment` | `services/catalog.ts` | `GET /api/v1/catalog` |
| `fetchEnvelopePresets` | `services/envelopePresets.ts` | envelope presets |
| `fetchUnderfloorHeatingPresets` | `services/underfloorHeatingPresets.ts` | UFH presets |
| `fetchUfhModePresets` | `services/ufhModePresets.ts` | UFH mode presets |
| `listProjects`, `createProject`, … | `services/projectsApi.ts` | projects API |
| `getProjectsAuthHeaders` | `services/projectsAuthHeaders.ts` | заголовки Bearer |
| `buildCalcRequestPayload` | `services/buildCalcRequestPayload.ts` | локальный маппинг (не HTTP) |

## Константы UI (`src/constants/`)

| Файл | Содержание |
|------|------------|
| `surveySteps.ts` | `SURVEY_STEPS` (`object` → `warmFloor` → `rooms` → … → `summary`), `SURVEY_STEP_NAV_ITEMS`, `isSurveyStep`, `isCalcApiBarStep`, `surveyStepGlobalMetaTitle` |
| `roomTypes.ts` | `ROOM_TYPE_UI_OPTIONS` (селект типа помещения) |
| `compatLegacyIds.ts` | `LEGACY_COMBINED_WALL_PRESET_IDS` |

Fallback-данные API offline: `src/data/fallback*.ts` (не constants).

## Verify

```bash
cd frontend && npm run lint && npm run build && npm run verify
```

`npm run verify` = `lint` + `verify:survey-session` + `verify:dead-code` (knip). Exit `0` обязателен для приёмки.

**Knip:** compat-модули миграции черновика — в `knip.json` → `ignore` (см. `docs/survey-draft.md`).
