# Frontend (HeatCalc)

React + Vite + TypeScript + **@tanstack/react-query**. Точка входа: `src/main.tsx` (`QueryProvider` → `App`).

## Архитектура

| Слой | Путь | Назначение |
|------|------|------------|
| Точка входа | `main.tsx`, `App.tsx`, `AppRoot.tsx`, `AppSurveyContent.tsx` | RQ-провайдер; share-route или bootstrap Start/survey |
| Bootstrap | `hooks/useSurveyBootstrap.ts`, `surveySession/resolveAppBootstrap.ts` | Cold open → Start Screen или восстановление черновика |
| Persistence | `services/surveyDraftStorage.ts`, `hooks/useSurveyDraftPersistence.ts` | localStorage черновика (debounce 400 ms) |
| Сессия анкеты | `src/surveySession/` | `SurveySessionProvider`, `dispatch` → pipeline; `report` / `uiPhase` |
| Серверные данные | `src/query/` | React Query: справочники, calc, проекты |
| HTTP-клиенты | `src/services/` | `projectsApi`, `publicShareApi`, `calc`, справочники |
| UI-оркестрация | `src/hooks/` | `useSurveyProject` (share, PDF, Dev), парсинг отчёта, оценки |
| UI | `src/components/` | Формы, отчёты, `StartScreen`, `SharePresentationPage`, `DevPanel` |

### Маршрутизация (`App.tsx`)

```text
/s/{shareToken}  → SharePresentationPage (read-only)
иначе            → SurveySessionProvider → AppRoot
                     ├─ start     → StartScreen
                     ├─ resolving → AppBootstrapSkeleton
                     ├─ error     → BootstrapErrorScreen
                     └─ survey    → AppSurveyContent
```

### `src/query/`

| Модуль | Назначение |
|--------|------------|
| `QueryProvider.tsx` | Корневой `QueryClientProvider` |
| `queryClient.ts`, `queryKeys.ts` | Конфигурация и ключи кэша |
| `useDebouncedValue.ts` | Debounce автопересчёта (700 ms) |
| `useReferenceData.ts` | Композиция справочников для `App.tsx` |
| `useSurveyCalc.ts` | POST `/api/v1/calc` |
| `queries/*` | envelope, underfloor, ufh-modes, catalog, projects |
| `mutations/useProjectMutations.ts` | save/load проекта |

### Ключевые компоненты (share / start / dev)

| Компонент | Назначение |
|-----------|------------|
| `StartScreen/` | Стартовый экран «Новый расчёт» / «Проекты» |
| `SharePresentationPage/` | Публичная презентация по `/s/{token}` |
| `Header/` | Клиент: ссылка, PDF, выход (без JSON) |
| `DevPanel/` | JSON, server save, hash — только DEV / `VITE_DEV_TOOLS=1` |
| `ShareLinkToast/` | Toast после копирования публичной ссылки |

Подробнее: [`docs/start-state.md`](../docs/start-state.md), [`docs/frontend-calc-runner.md`](../docs/frontend-calc-runner.md), публичная ссылка и PDF — [`docs/client-share-and-layers.md`](../docs/client-share-and-layers.md), [`docs/project-pdf.md`](../docs/project-pdf.md), структура в [`Plan.md`](../Plan.md), карта папок — [`docs/project-structure.md`](../docs/project-structure.md).

PDF сметы скачивается с API (`downloadProjectPdf` / `downloadPublicSharePdf` → `utils/downloadBlobFile.ts`) без `window.open`.

## Команды

```bash
npm install
npm run dev          # http://localhost:5173 (прокси /api → backend :3001)
npm run build
npm run lint
npm run verify:survey-session
npm run verify:start-state
npm run verify           # полный gate
```
