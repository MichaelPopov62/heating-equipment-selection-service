# Frontend: инвентаризация React Query и services

## Query-хуки (все активны, мёртвых нет)

| Хук | Файл | Endpoint / назначение | enabled |
|-----|------|----------------------|---------|
| `useEnvelopePresetsQuery` | `query/queries/useEnvelopePresetsQuery.ts` | `GET /api/v1/presets/envelope` | всегда |
| `useUnderfloorHeatingPresetsQuery` | `query/queries/useUnderfloorHeatingPresetsQuery.ts` | UFH bases + finishes | всегда |
| `useUfhModePresetsQuery` | `query/queries/useUfhModePresetsQuery.ts` | `GET /api/v1/presets/underfloor-heating/modes` | всегда |
| `useCatalogEquipmentQuery` | `query/queries/useCatalogEquipmentQuery.ts` | `GET /api/v1/catalog` | по требованию UI |
| `useProjectsListQuery` | `query/queries/useProjectsListQuery.ts` | `GET /api/v1/projects` | `projectsOpen` в dialog или `true` на `/projects` |
| `useMeQuery` | `query/queries/useMeQuery.ts` | `GET /api/v1/me` | `!authRequired \|\| isAuthenticated` |
| `useAdminFeedbackQuery` | `query/queries/useAdminFeedbackQuery.ts` | `GET /api/v1/admin/feedback` | только `role=admin` |
| `useAdminFeedbackStatusMutation` | `query/mutations/useAdminFeedbackStatusMutation.ts` | `PATCH /api/v1/admin/feedback/:id` | по действию admin |
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
| `fetchMe` | `services/meApi.ts` | `GET /api/v1/me` |
| `fetchPublicShare` | `services/publicShareApi.ts` | public share (+ `parsePublicShare.ts`) |
| `submitFeedback` | `services/feedbackApi.ts` | `POST /api/v1/feedback` |
| `listAdminFeedback`, `patchAdminFeedbackStatus` | `services/adminFeedbackApi.ts` | Admin feedback REST API |
| `streamAdminFeedback` | `services/adminFeedbackStream.ts` | Авторизованный SSE через streaming fetch |
| `getProjectsAuthHeaders` | `services/projectsAuthHeaders.ts` | заголовки Bearer |
| `getProjectsAuthToken` | `services/projectsAuthToken.ts` | Clerk/local/env token |
| `buildCalcRequestPayload` | `services/buildCalcRequestPayload.ts` | локальный маппинг (не HTTP) |
| `parseCatalog*`, `parseMeResponse` | `services/parse*.ts` | runtime-проверка DTO API |

## Константы UI (`src/constants/`)

| Файл | Содержание |
|------|------------|
| `surveySteps.ts` | `SURVEY_STEPS` (`object` → `warmFloor` → `rooms` → … → `technicalResult` → `dataReference` → `financialResult`), `SURVEY_STEP_NAV_ITEMS`, `isSurveyStep`, `surveyStepGlobalMetaTitle` |
| `roomTypes.ts` | `ROOM_TYPE_UI_OPTIONS` (селект типа помещения) |
| `compatLegacyIds.ts` | `LEGACY_COMBINED_WALL_PRESET_IDS` |

Fallback-данные API offline: `src/data/fallback*.ts` (не constants).

## Verify

```bash
cd frontend && npm run lint && npm run build && npm run verify
```

`npm run verify` = `lint` + `typecheck` + `verify:dead-code` + `verify:footer-nav` + `verify:frontend-auth` + `verify:frontend-me` + `verify:admin-feedback` + `build` + `verify:survey-session` + `verify:start-state`. Exit `0` обязателен для приёмки.

**Knip:** `knip --treat-config-hints-as-errors`; compat/pipeline-миграции в графе импортов (см. `docs/survey-draft.md`).
