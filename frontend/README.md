# Frontend (HeatCalc)

React + Vite + TypeScript + **@tanstack/react-query**. Точка входа: `src/main.tsx` (`QueryProvider` → `App`).

## Архитектура

| Слой | Путь | Назначение |
|------|------|------------|
| Точка входа | `main.tsx`, `App.tsx` | QueryProvider, BrowserRouter, auth и общие providers |
| Маршрутизация | `src/routing/` | `AppRouter`, `SurveyAppShell`, канонические пути SPA |
| Bootstrap | `hooks/useSurveyBootstrap.ts`, `surveySession/resolveAppBootstrap.ts` | Cold open → Start Screen или восстановление SurveyDraft |
| Bootstrap-оркестратор | `AppRoot.tsx` | Выбор `StartAppRoot` vs lazy `SurveyAppRoot` по `bootstrapMode` |
| Bootstrap UI (лёгкий) | `StartAppRoot.tsx` | Start / resolving / error без survey-chunk |
| Bootstrap UI (тяжёлый) | `SurveyAppRoot.tsx` | Projects, DevPanel, persistence, lazy `AppSurveyContent` |
| Persistence | `services/surveyDraftStorage.ts`, `hooks/useSurveyDraftPersistence.ts` | localStorage SurveyDraft (debounce 400 ms) |
| Сессия анкеты | `src/surveySession/` | `SurveySessionProvider`, `dispatch` → pipeline; `report` / `uiPhase` |
| Серверные данные | `src/query/` | React Query: справочники, calc, проекты |
| HTTP-клиенты | `src/services/` | `projectsApi`, `publicShareApi`, `calc`, справочники |
| UI-оркестрация | `src/hooks/` | `useSurveyProject` (share, PDF, Dev), парсинг отчёта, оценки |
| UI | `src/components/` | Формы, отчёты, `StartScreen`, `SharePresentationPage`, `DevPanel` |
| Страницы | `src/pages/` | Login, SignUp, Projects, Docs, FAQ и legal |
| Оболочка и тексты | `src/shell/`, `src/i18n/` | Header/Footer actions и украинская локализация |
| SEO | `src/seo/` | JSON-LD (`JsonLdBoundary` в `AppRouter`) |
| Типы / fallback / стили | `src/types/`, `src/data/`, `src/styles/` | DTO UI, offline-fallback справочников, глобальные CSS |
| Парсеры | `src/utils/parsers/` | Отчёт calc, SurveyDraft, share URL, import bundle |
| Статика Vite | `public/` | `favicon.svg`, `robots.txt`, `sitemap.xml`, `llms.txt` |

### Маршрутизация (`src/routing/AppRouter.tsx`)

```text
/s/:shareToken                     → SharePresentationPage (read-only)
/login, /sign-up                   → auth pages
/docs, /faq, /privacy, /terms, ... → static pages
/projects                          → SurveyAppShell → ProtectedRoute → ProjectsPage
/                                  → SurveyAppShell → SurveySessionProvider → AppRoot
                                       ├─ start | resolving | error → StartAppRoot
                                       └─ survey → lazy SurveyAppRoot → AppSurveyContent
```

### Code-split bootstrap

- `StartAppRoot` — в main bundle (cold open без calc и projects).
- `SurveyAppRoot` и `AppSurveyContent` — отдельные lazy-чанки.
- Контракт проверяется: `npm run verify:start-state`, `npm run verify:frontend-me`.

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

Подробнее: [`docs/start-state.md`](../docs/start-state.md), [`docs/frontend-calc-runner.md`](../docs/frontend-calc-runner.md), публичная ссылка и PDF — [`docs/client-share-and-layers.md`](../docs/client-share-and-layers.md), [`docs/project-pdf.md`](../docs/project-pdf.md), **деплой Vercel/Render** — [`docs/deploy/README.md`](../docs/deploy/README.md), структура в [`Plan.md`](../Plan.md), карта папок и **соглашения именования/слоёв** — [`docs/project-structure.md`](../docs/project-structure.md) § «Соглашения именования и распределение ответственности».

PDF сметы скачивается с API (`downloadProjectPdf` / `downloadPublicSharePdf` → `utils/downloadBlobFile.ts`) без `window.open`.

## Vercel (вариант A)

Сборка **не** из каталога `frontend/` — Root Directory в Vercel Dashboard = **корень монорепо**.  
Install/build/output: [`docs/deploy/vercel.md`](../docs/deploy/vercel.md). Локально: `npm run vercel-build` из корня репозитория.

## Быстрая шпаргалка DevPanel

Условия отображения панели описаны в [`docs/frontend-dev-panel.md`](../docs/frontend-dev-panel.md).

Кнопка **Dev** появляется только после входа в анкету или проект (`SurveyAppRoot`), не на стартовом экране.

1. Сохранить черновик локально → **`Зберегти JSON`**.
2. Экспорт проекта для переноса между базами → **`📥 Експорт (Save JSON)`**.
3. Импорт проекта в текущую MongoDB → **`📤 Імпорт (Load JSON)`**.
4. Загрузить черновик с диска (только UI) → **`Відкрити JSON`**.
5. Сохранить проект в MongoDB без расчёта → **`На сервер`**.
6. Сохранить проект и, если анкета готова, получить расчёт → **`На сервер + розрахунок`**.
7. Пересчитать вручную без сохранения проекта → **`POST /api/v1/calc`**.
8. Посмотреть запрос, сформированный для расчёта → **`CalcInput`**.
9. Посмотреть полный результат → **`Report`**; основные блоки результата → **`Модули`**.
10. Скачать краткую текстовую сводку → **`TXT зведення`**.
11. Передать черновик через legacy hash-ссылку без сервера → **`Hash #survey=`**.
12. Закрыть ранее опубликованную клиентскую ссылку → **`Відкликати share`**.

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
npm run verify:report-colocation
npm run verify:types-placement
npm run verify           # полный gate
```
