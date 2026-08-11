# Start State (стартовый экран)

## Назначение

При **первом входе** (нет сохранённого SurveyDraft в localStorage, hash, загруженного проекта) пользователь видит **Start Screen** с основным действием «Почати новий розрахунок», без полной анкеты и автоматического calc. Проекты открываются через Header/Footer и маршрут `/projects`.

## Режимы UI (`AppBootstrapMode`)

| Режим | Когда | UI |
|-------|-------|-----|
| `start` | Cold open без валидного draft | `StartScreen` + Header (`variant=start`) |
| `survey` | Draft / «Начать» / import / project | lazy `SurveyAppRoot` → `AppSurveyContent` |
| `resolving` | Только **`retryBootstrap()`** после `error` | `AppBootstrapSkeleton` (+ timeout **3 s** → `error`) |
| `error` | Сбой resolve / timeout retry | `BootstrapErrorScreen` |

**Cold open:** `useSurveyBootstrap` резолвит hash/storage **синхронно** в инициализаторе `useState` → сразу `start` или `survey` (без фазы `resolving` / skeleton на первом paint — LCP/CLS). Режим `resolving` **не** используется при обычном входе.

## Критерий Start State

Пользователь в Start, если после `resolveAppBootstrap`:

- нет валидного hash `#survey=…`;
- нет валидного `localStorage` ключа `heatcalc:survey-draft:v1`;
- → `mode: 'start'` и `dispatch(SESSION_RESET)`.

## Bootstrap (порядок)

1. `decodeSurveyDraftFromHash` (лимит JSON ~50 KB) → `DRAFT_LOADED` → `survey`
2. `loadSurveyDraftFromStorage` → `DRAFT_LOADED` → `survey`
3. иначе → `SESSION_RESET` → `start`

Hash после загрузки удаляется: `history.replaceState`.

## Мутации сессии

| Мутация | Эффект |
|---------|--------|
| `SESSION_RESET` | Пустой draft (`rooms: []`), report=null, calc abort |
| `SURVEY_STARTED` | Дефолтный draft (1 комната), report=null |
| `DRAFT_LOADED` | Загрузка из hash/storage/file/project |

SSOT дефолтов:

- `createEmptySurveySessionState.ts` — cold open
- `createDefaultSurveyDraft.ts` — после «Начать новый расчёт»

## Persistence

- Модуль: `frontend/src/services/surveyDraftStorage.ts`
- Debounce 400 ms: `useSurveyDraftPersistence` (только `bootstrapMode === 'survey'`)
- Пустой draft не пишется (`isPersistableSurveyDraft`)

## Calc guard

`POST /api/v1/calc` только при `bootstrapMode === 'survey'` (`SurveySessionProvider.calcEnabled`).

## Static LCP shell (до mount React)

До загрузки JS-бандла в `frontend/index.html` поверх пустого `#root` показывается overlay `#static-app-shell` (критический CSS в `<head>`). Назначение: FCP/LCP главной без ожидания React. После mount React shell скрывается через `fadeOutStaticShell` (`STATIC_SHELL_FADE_MS` = 220 ms; при `prefers-reduced-motion` — сразу remove).

### Контракт содержимого

| Разрешено в `#static-app-shell` | Запрещено |
|----------------------------------|-----------|
| `main.static-start-screen`: SVG-логотип, один `h1`, lead, disabled CTA | Фейковый header (классы `.static-app-shell__header*`) |
| Текст hero/CTA, согласованный с `StartScreen` / `startScreenUk` | Chip-плейсхолдеры кнопок (`.static-app-shell__chip`) |
| Fade-out → remove (`frontend/src/utils/staticAppShellTransition.ts`) | Дублировать «Увійти» / «Проєкти» без реального UI Header/AccountBar |

Настоящий `Header` (`variant=start`) и `AccountBar` появляются только после mount React в `StartAppRoot`. Пустой logo-box и chip-кнопки в static shell не использовать: они воспринимаются как дефект UI, а не как скелетон.

### Последовательность cold open `/`

1. HTML: `#static-app-shell` — только hero + CTA.
2. `main.tsx`: mount React + `fadeOutStaticShell`.
3. React: sync `useSurveyBootstrap` → `start` \| `survey` (без bootstrap skeleton / `resolving`).
4. Опционально: при `sessionStorage` ключе `heatcalc:clerk-sticky:v1` — `ClerkLazyRoot` Suspense → `ClerkAuthLoadingFallback` («Завантаження автентифікації…»), затем UI. Это не часть static shell; см. [`auth.md`](auth.md) § Frontend (lazy Clerk).

### SEO при правках shell

Не удалять и не ослаблять:

- `<title>`, `meta name="description"`, `meta name="robots"`;
- static `h1` («Підбір опалення для дому та квартири») и CTA («Почати новий розрахунок»);
- `#static-app-shell`, `.static-start-screen`, класс fade-out;
- JSON-LD (`Organization` / `WebSite` / `WebApplication`) — инъекция на build;
- отсутствие `modulepreload` Clerk на cold open.

Gate: `cd frontend && npm run verify:seo` (входит в `npm run verify`).

## Skeleton и индикаторы загрузки

| Событие | Skeleton / «Загрузка…» |
|---------|------------------------|
| Первое открытие сайта (HTML) | Static LCP shell: только hero + CTA (без фейкового header) |
| Первое открытие сайта (React) | ❌ сразу `start` или `survey` (sync resolve, без bootstrap skeleton) |
| Lazy Clerk при sticky / auth-маршруте | Suspense → `ClerkAuthLoadingFallback` |
| Lazy-load survey-chunk / route | Suspense → `AppBootstrapSkeleton` |
| `retryBootstrap()` после error | `resolving` → `AppBootstrapSkeleton`; при зависании > **3 s** → `error` |
| Загрузка сохранённого проекта с сервера | Переход `/projects` → `pendingProjectNavigation` → загрузка in-place, без bootstrap skeleton |
| Перерасчёт после изменения параметров | локальный `calcLoading` / «Расчёт…» в секциях |
| **«Вийти з проєкту» (Exit)** | ❌ сразу Start Screen |
| **Новый проект** | ❌ сразу Start Screen |

Exit и «Новый проект» **не** вызывают `retryBootstrap()` и **не** переводят в `resolving`.

## «Вийти з проєкту» (Exit)

Клиентский Header (`variant=survey`): кнопка **«Вийти з проєкту»** → `exitProject()` → `exitToStart()`.
Не путать с **«Вийти з акаунта»** в `AccountBar`: она завершает авторизованную сессию,
а не закрывает текущий проект.

**Очерёдность** (синхронно, без `await`, без `showOk`/`showErr` после exit):

1. `resetToStart()` — `SESSION_RESET`, `clearSurveyDraftStorage()`, `bootstrapMode = 'start'`
2. `setStatusMessage(null)`
3. `setStatusError(null)`
4. `setClientName('')`
5. `setProjectId(null)`
6. `setPublicPath(null)`
7. `setShareToastOpen(false)`
8. `setProjectsOpen(false)`

Confirm: если `projectId` уже есть (проект на сервере) — выход **без** диалога; иначе при несохранённых данных — confirm.

Проект в MongoDB **не удаляется**; очищается только локальная сессия и `localStorage` (`heatcalc:survey-draft:v1`).

## «Новый проект»

`startNewProject` → confirm (если report / заполненные rooms) → **`exitToStart()`** (та же очистка, без skeleton).

Header в режиме `start`: **Проекты** и AccountBar. В режиме `survey`: **Проекты**, **Ссылка** (публичная `/s/{shareToken}` + toast), **PDF / Скачать**, **Выйти**. JSON, server-save и ручной calc — только **DevPanel** в режиме **`survey`** (`SurveyAppRoot`; `useDevPanelAccess`, staging + admin). На стартовом экране (`StartAppRoot`) кнопка **Dev** не показывается.

Публичная страница: маршрут `/s/:shareToken` в `frontend/src/routing/AppRouter.tsx` → `SharePresentationPage` (без анкеты). См. [`client-share-and-layers.md`](client-share-and-layers.md).

## Verify

```bash
cd frontend && npm run verify:start-state
cd frontend && npm run verify:seo
cd frontend && npm run verify
```

## См. также

- [`survey-draft.md`](survey-draft.md)
- [`frontend-calc-runner.md`](frontend-calc-runner.md)
- [`auth.md`](auth.md) § Frontend (lazy Clerk)
- [`project-structure.md`](project-structure.md) § `frontend/`

## Файлы в репозитории

| Слой | Путь |
|------|------|
| Static LCP shell | `frontend/index.html` (`#static-app-shell`, только hero + CTA) |
| Fade shell → React | `frontend/src/utils/staticAppShellTransition.ts`, `frontend/src/main.tsx` |
| Bootstrap hook | `frontend/src/hooks/useSurveyBootstrap.ts` |
| Resolve hash/storage | `frontend/src/surveySession/resolveAppBootstrap.ts` |
| Режимы UI | `frontend/src/AppRoot.tsx` (оркестратор), `StartAppRoot.tsx` (start/resolving/error), lazy `SurveyAppRoot.tsx` (survey); тип `AppBootstrapMode` в `surveySession/types.ts` |
| Маршруты | `frontend/src/routing/AppRouter.tsx`, `paths.ts`, `SurveyAppShell.tsx` |
| Проекты | `frontend/src/pages/ProjectsPage/`, `frontend/src/utils/pendingProjectNavigation.ts` |
| Общие действия | `frontend/src/shell/AppChromeProvider.tsx` |
| Start / skeleton / error | `frontend/src/components/StartScreen/`, `AppBootstrapSkeleton/`, `BootstrapErrorScreen/` |
| localStorage | `frontend/src/services/surveyDraftStorage.ts`, `frontend/src/hooks/useSurveyDraftPersistence.ts` |
| Пустой / дефолтный draft | `frontend/src/surveySession/createEmptySurveySessionState.ts`, `createDefaultSurveyDraft.ts` |
| Verify bootstrap | `frontend/scripts/verifyStartState.mjs` |
| Verify SEO / static shell | `frontend/scripts/verifySeoStatic.mjs` |
