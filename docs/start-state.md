# Start State (стартовый экран)

## Назначение

При **первом входе** (нет локального черновика, hash, загруженного проекта) пользователь видит **Start Screen** — три действия без полной анкеты и без автоматического calc.

## Режимы UI (`AppBootstrapMode`)

| Режим | Когда | UI |
|-------|-------|-----|
| `resolving` | Первые ~200 ms после mount | `AppBootstrapSkeleton` + `Spinner` |
| `start` | Cold open | `StartScreen` + Header (`variant=start`) |
| `survey` | Черновик / «Начать» / import / project | `AppSurveyContent` |
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
| Загрузка сохранённого проекта с сервера | ⚠️ отдельная задача (in-place, без bootstrap skeleton) |
| Перерасчёт после изменения параметров | локальный `calcLoading` / «Расчёт…» в секциях |
| **Выход из проекта (Exit)** | ❌ сразу Start Screen |
| **Новый проект** | ❌ сразу Start Screen |

Exit и «Новый проект» **не** вызывают `retryBootstrap()` и **не** переводят в `resolving`.

## Выход из проекта (Exit)

Клиентский Header (`variant=survey`): кнопка **«Выйти»** → `exitProject()` → `exitToStart()`.

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

Проект в MongoDB **не удаляется**; очищается только локальная сессия и `localStorage` черновика.

## «Новый проект»

`startNewProject` → confirm (если report / заполненные rooms) → **`exitToStart()`** (та же очистка, без skeleton).

Клиентский Header: **Проекты**, **Ссылка** (публичная `/s/{shareToken}` + toast под кнопкой), **PDF / Скачать**, **Выйти**. JSON и server-save — только **DevPanel** (`isDevToolsEnabled`).

Публичная страница: pathname `/s/{token}` → `SharePresentationPage` (без анкеты). См. [`client-share-and-layers.md`](client-share-and-layers.md).

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
| Режимы UI | `frontend/src/AppRoot.tsx`, тип `AppBootstrapMode` в `surveySession/types.ts` |
| Start / skeleton / error | `frontend/src/components/StartScreen/`, `AppBootstrapSkeleton/`, `BootstrapErrorScreen/` |
| localStorage | `frontend/src/services/surveyDraftStorage.ts`, `frontend/src/hooks/useSurveyDraftPersistence.ts` |
| Пустой / дефолтный draft | `frontend/src/surveySession/createEmptySurveySessionState.ts`, `createDefaultSurveyDraft.ts` |
| Verify | `frontend/scripts/verifyStartState.mjs` |
