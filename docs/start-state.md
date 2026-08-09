# Start State (стартовый экран)

## Назначение

При **первом входе** (нет сохранённого SurveyDraft в localStorage, hash, загруженного проекта) пользователь видит **Start Screen** с основным действием «Почати новий розрахунок», без полной анкеты и автоматического calc. Проекты открываются через Header/Footer и маршрут `/projects`.

## Режимы UI (`AppBootstrapMode`)

| Режим | Когда | UI |
|-------|-------|-----|
| `resolving` | Первые ~200 ms после mount | `AppBootstrapSkeleton` + `Spinner` |
| `start` | Cold open | `StartScreen` + Header (`variant=start`) |
| `survey` | SurveyDraft / «Начать» / import / project | `AppSurveyContent` |
| `error` | Timeout bootstrap 3 s | `BootstrapErrorScreen` |

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

## Skeleton и индикаторы загрузки

| Событие | Skeleton / «Загрузка…» |
|---------|------------------------|
| Первое открытие сайта | ✅ `resolving` → `AppBootstrapSkeleton` (~200 ms) |
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
cd frontend && npm run verify
```

## См. также

- [`survey-draft.md`](survey-draft.md)
- [`frontend-calc-runner.md`](frontend-calc-runner.md)
- [`project-structure.md`](project-structure.md) § `frontend/`

## Файлы в репозитории

| Слой | Путь |
|------|------|
| Bootstrap hook | `frontend/src/hooks/useSurveyBootstrap.ts` |
| Resolve hash/storage | `frontend/src/surveySession/resolveAppBootstrap.ts` |
| Режимы UI | `frontend/src/AppRoot.tsx` (оркестратор), `StartAppRoot.tsx` (start/resolving/error), lazy `SurveyAppRoot.tsx` (survey); тип `AppBootstrapMode` в `surveySession/types.ts` |
| Маршруты | `frontend/src/routing/AppRouter.tsx`, `paths.ts`, `SurveyAppShell.tsx` |
| Проекты | `frontend/src/pages/ProjectsPage/`, `frontend/src/utils/pendingProjectNavigation.ts` |
| Общие действия | `frontend/src/shell/AppChromeProvider.tsx` |
| Start / skeleton / error | `frontend/src/components/StartScreen/`, `AppBootstrapSkeleton/`, `BootstrapErrorScreen/` |
| localStorage | `frontend/src/services/surveyDraftStorage.ts`, `frontend/src/hooks/useSurveyDraftPersistence.ts` |
| Пустой / дефолтный draft | `frontend/src/surveySession/createEmptySurveySessionState.ts`, `createDefaultSurveyDraft.ts` |
| Verify | `frontend/scripts/verifyStartState.mjs` |
