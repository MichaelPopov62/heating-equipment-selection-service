# Frontend (HeatCalc)

React + Vite + TypeScript + **@tanstack/react-query**. Точка входа: `src/main.tsx` (`QueryProvider` → `App`).

## Архитектура

| Слой | Путь | Назначение |
|------|------|------------|
| Точка входа | `main.tsx`, `App.tsx` | QueryProvider, BrowserRouter, auth и общие providers |
| Маршрутизация | `src/routing/` | `AppRouter`, `SurveyAppShell`, канонические пути SPA |
| Bootstrap | `hooks/useSurveyBootstrap.ts`, `surveySession/resolveAppBootstrap.ts` | Cold open → Start Screen или восстановление SurveyDraft |
| Persistence | `services/surveyDraftStorage.ts`, `hooks/useSurveyDraftPersistence.ts` | localStorage SurveyDraft (debounce 400 ms) |
| Сессия анкеты | `src/surveySession/` | `SurveySessionProvider`, `dispatch` → pipeline; `report` / `uiPhase` |
| Серверные данные | `src/query/` | React Query: справочники, calc, проекты |
| HTTP-клиенты | `src/services/` | `projectsApi`, `publicShareApi`, `calc`, справочники |
| UI-оркестрация | `src/hooks/` | `useSurveyProject` (share, PDF, Dev), парсинг отчёта, оценки |
| UI | `src/components/` | Формы, отчёты, `StartScreen`, `SharePresentationPage`, `DevPanel` |
| Страницы | `src/pages/` | Login, SignUp, Projects, Docs, FAQ и legal |
| Оболочка и тексты | `src/shell/`, `src/i18n/` | Header/Footer actions и украинская локализация |

### Маршрутизация (`src/routing/AppRouter.tsx`)

```text
/s/:shareToken                     → SharePresentationPage (read-only)
/login, /sign-up                   → auth pages
/docs, /faq, /privacy, /terms, ... → static pages
/projects                          → SurveyAppShell → ProtectedRoute → ProjectsPage
/                                  → SurveyAppShell → SurveySessionProvider → AppRoot
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
| `useReferenceData.ts` | Композиция справочников для `SurveyAppShell.tsx` |
| `useSurveyCalc.ts` | POST `/api/v1/calc` |
| `queries/*` | envelope, underfloor, ufh-modes, catalog, projects |
| `mutations/useProjectMutations.ts` | save/load проекта |

### Ключевые компоненты (share / start / dev)

| Компонент | Назначение |
|-----------|------------|
| `StartScreen/` | Стартовый экран с действием «Почати новий розрахунок» |
| `SharePresentationPage/` | Публичная презентация по `/s/{token}` |
| `Header/` | Клиент: ссылка, PDF, выход (без JSON) |
| `DevPanel/` | Служебная панель разработчика; подробнее — [`frontend-dev-panel.md`](../docs/frontend-dev-panel.md) |
| `ShareLinkToast/` | Toast после копирования публичной ссылки |

Подробнее: [`docs/start-state.md`](../docs/start-state.md), [`docs/frontend-calc-runner.md`](../docs/frontend-calc-runner.md), публичная ссылка и PDF — [`docs/client-share-and-layers.md`](../docs/client-share-and-layers.md), [`docs/project-pdf.md`](../docs/project-pdf.md), структура в [`Plan.md`](../Plan.md), карта папок — [`docs/project-structure.md`](../docs/project-structure.md).

PDF сметы скачивается с API (`downloadProjectPdf` / `downloadPublicSharePdf` → `utils/downloadBlobFile.ts`) без `window.open`.

## Быстрая шпаргалка DevPanel

Условия отображения панели описаны в [`docs/frontend-dev-panel.md`](../docs/frontend-dev-panel.md).

1. Сохранить черновик локально → **`Зберегти JSON`**.
2. Загрузить черновик с диска → **`Відкрити JSON`**.
3. Сохранить проект в MongoDB без расчёта → **`На сервер`**.
4. Сохранить проект и, если анкета готова, получить расчёт → **`На сервер + розрахунок`**.
5. Пересчитать вручную без сохранения проекта → **`POST /api/v1/calc`**.
6. Посмотреть запрос, сформированный для расчёта → **`CalcInput`**.
7. Посмотреть полный результат → **`Report`**; основные блоки результата → **`Модули`**.
8. Скачать краткую текстовую сводку → **`TXT зведення`**.
9. Передать черновик через legacy hash-ссылку без сервера → **`Hash #survey=`**.
10. Закрыть ранее опубликованную клиентскую ссылку → **`Відкликати share`**.

Точное назначение кнопок, условия доступности и различия способов расчёта описаны в [`docs/frontend-dev-panel.md`](../docs/frontend-dev-panel.md).

## Команды

```bash
npm install
npm run dev          # http://localhost:5173 (прокси /api → backend :3001)
npm run build
npm run lint
npm run verify:dead-code
npm run verify:footer-nav
npm run verify:frontend-auth
npm run verify:frontend-me
npm run verify:survey-session
npm run verify:start-state
npm run verify           # полный gate
```
