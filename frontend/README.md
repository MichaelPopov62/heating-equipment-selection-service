# Frontend (HeatCalc)

React + Vite + TypeScript + **@tanstack/react-query**. Точка входа: `src/main.tsx` (`QueryProvider` → `App`).

## Архитектура

| Слой | Путь | Назначение |
|------|------|------------|
| Точка входа | `main.tsx`, `App.tsx`, `AppSurveyContent.tsx` | Провайдер RQ, справочники, форма анкеты |
| Сессия анкеты | `src/surveySession/` | `SurveySessionProvider`, `dispatch` → pipeline; `report` / `uiPhase` |
| Серверные данные | `src/query/` | React Query: справочники, calc, проекты |
| HTTP-клиенты | `src/services/` | Чистые `fetch`-функции (queryFn / mutationFn) |
| UI-оркестрация | `src/hooks/` | Парсинг отчёта, оценки, проекты (без прямого HTTP) |
| UI | `src/components/` | Формы и блоки отчёта |

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

Подробнее: [`docs/frontend-calc-runner.md`](../docs/frontend-calc-runner.md), структура в [`Plan.md`](../Plan.md).

## Команды

```bash
npm install
npm run dev          # http://localhost:5173 (прокси /api → backend :3001)
npm run build
npm run lint
npm run verify:survey-session
```
