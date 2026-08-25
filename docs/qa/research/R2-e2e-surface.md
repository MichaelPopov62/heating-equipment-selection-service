# R2 — Поверхность E2E

> Все утверждения о коде снабжены якорем `file:line`. Где проверить не удалось — стоит
> «НЕ ПРОВЕРЕНО». Подписи UI — дословно по-украински в кавычках, идентификаторы — как в коде.
> Границы схемы сервера сверены по `components/schemas/*.yaml` (resolve всех `$ref`),
> доменные проверки — по `backend/src/api/validate.js` и вызываемым модулям.

## Резюме

1. **`data-testid` в проекте нет вообще: `grep -rn 'data-testid' frontend/src | wc -l` → `0`.**
   Единственный стабильный data-атрибут — `data-survey-step` (5 вхождений, только для
   inline-навигации из итогов, `components/SurveyNavigation/SurveyStepLink.tsx:25`).
   Компенсация есть и она лучше, чем ожидалось: **102 `id=`, 58 `htmlFor`, 65 `aria-label`,
   35 `aria-labelledby`, 70 `role=`** в 99 `.tsx`. Почти каждый контрол анкеты имеет
   `id` + `<label htmlFor>`, значит `getByLabel` работает — но на шаге «Приміщення»
   подписи повторяются (см. §6).

2. **Реестр расхождений «границы клиента ↔ границы схемы сервера» — 30 позиций** (§4),
   из них **18 способны породить HTTP 400, который интерфейс не может объяснить** (ОТКАЗ A),
   и **6 — доменные кросс-правила сервера, у которых на клиенте нет вообще никакого аналога**.
   Полностью защищено клиентом ровно **два** поля из ~60: «Повітря в санвузлі, °C» и
   «Кількість приміщень». Ещё 9 полей защищены атрибутами `min`/`max`, но **без рантайм-клампа**,
   то есть `min`/`max` на `<input type="number">` вне `<form>` ничего не блокируют.

3. **ОТКАЗ B автоматизируем уже сегодня, но ненадёжно.** Гейт локализован точно:
   `canAutoCalcFromDraft` — `frontend/src/surveySession/buildCalcInputSnapshot.ts:40-68`.
   Отличить «расчёт выполнен» от заглушки можно по строке
   «Джерело: швидка оцінка (100 Вт/м²)» vs «Джерело: розрахунок API за огородженнями»
   (`frontend/src/components/HeatLossReport/HeatLossSummaryTable.tsx:26-28`).
   **Но этой строки недостаточно**: после ошибки 400 предыдущий отчёт не сбрасывается
   (`runSurveyMutationPipeline.ts:144-153`), и подпись остаётся «розрахунок API» при неверном входе.
   Нужен маркер свежести (см. §7, ОТКАЗ B).

4. **DevPanel — самый дешёвый ускоритель E2E, но только на `vite dev`.**
   `isLocalDevRuntime()` → `import.meta.env.DEV` → на localhost панель доступна **всем, без auth**
   (`frontend/src/utils/isDevToolsEnabled.ts:10-12,30-34`). Кнопка `Report` печатает полный
   `calcReport` в `<pre>` (`components/DevPanel/DevPanel.tsx:177-181`) — это готовый оракул
   для ОТКАЗА B без единой правки продукта. На собранном билде нужны
   `VITE_DEV_TOOLS=1` + `VITE_APP_ENV=staging` + `GET /api/v1/me` с `role=admin`.

5. **Один URL на все 11 шагов.** Роутов SPA — 11 (§1), но вся анкета живёт на `/`
   (`routing/AppRouter.tsx:84`), шаг хранится в состоянии сессии
   (`surveySession/types.ts:27`), не в URL. Deep-link на шаг невозможен; каждый E2E-сценарий
   обязан проходить навигацию кликами. Это главный множитель длительности прогонов.

---

## 1. Карта роутов и страниц

### 1.1 Роуты (`frontend/src/routing/AppRouter.tsx`, `paths.ts`)

| Путь | Компонент | Защита | Якорь |
|---|---|---|---|
| `/` | `SurveyAppShell` → `AppRoot` → `StartAppRoot` \| lazy `SurveyAppRoot` | публичный | `AppRouter.tsx:84` |
| `/s/:shareToken` | `ShareRoute` → `SharePresentationPage` (lazy) | публичный, без JWT | `AppRouter.tsx:56`, `:96-103` |
| `/login/*` | `LoginPage` (lazy) | публичный | `AppRouter.tsx:57` |
| `/sign-up/*` | `SignUpPage` (lazy) | публичный | `AppRouter.tsx:58` |
| `/docs` | `DocsPage` (lazy) | публичный | `AppRouter.tsx:59` |
| `/faq` | `FaqPage` (lazy) | публичный | `AppRouter.tsx:60` |
| `/privacy` | `LegalPage kind="privacy"` | публичный | `AppRouter.tsx:61` |
| `/terms` | `LegalPage kind="terms"` | публичный | `AppRouter.tsx:62` |
| `/cookies` | `LegalPage kind="cookies"` | публичный | `AppRouter.tsx:63` |
| `/projects` | `SurveyAppShell` → `ProtectedRoute` → `ProjectsPage` | **вход обязателен** | `AppRouter.tsx:64-73` |
| `/admin/feedback` | `ProtectedRoute` → `AdminRoute` → `AdminFeedbackPage` | **вход + `role=admin`** | `AppRouter.tsx:74-84` |
| `*` | `Navigate → /` | — | `AppRouter.tsx:85` |

Определения путей — `frontend/src/routing/paths.ts:5-17`.
Глобально поверх роутов монтируются `ModalHost` (`AppRouter.tsx:88`) и
`CookieConsentBanner` (`AppRouter.tsx:89`) — оба видны на любом E2E-сценарии,
баннер cookie перекрывает низ экрана и должен закрываться в `beforeEach`.

**Следствие для E2E №1.** Все 11 шагов анкеты — на одном URL `/`. Кнопка «назад» браузера
уводит из приложения (находка U4), потому что истории шагов нет. Каждый сценарий
«дойти до шага N» — это N кликов по левому меню либо восстановление черновика (§8).

**Следствие для E2E №2.** `/projects` и `/admin/feedback` требуют Clerk-сессию.
Обход — `VITE_PROJECTS_BEARER_TOKEN` (`frontend/src/vite-env.d.ts:21`,
`services/projectsAuthToken.ts`), но `ProtectedRoute` смотрит на состояние `AuthProvider`,
а не на наличие токена. **НЕ ПРОВЕРЕНО:** пропускает ли `ProtectedRoute` при
`VITE_AUTH_REQUIRED=false` — требует чтения `auth/ProtectedRoute.tsx` и живого прогона.

### 1.2 Bootstrap (`docs/start-state.md`, `hooks/useSurveyBootstrap.ts`)

Резолв **синхронный, в инициализаторе `useState`** — фазы `resolving`/skeleton при обычном
входе нет (`useSurveyBootstrap.ts:36-47`, `:70`).

| Порядок | Источник | Результат | Якорь |
|---|---|---|---|
| 1 | `#survey=<base64>` в URL | `DRAFT_LOADED` → `survey`, hash стирается `history.replaceState` | `resolveAppBootstrap.ts:21-24`, `:34-38` |
| 2 | `localStorage['heatcalc:survey-draft:v1']` | `DRAFT_LOADED` → `survey` | `resolveAppBootstrap.ts:25-27` |
| 3 | иначе | `SESSION_RESET` → `start` (StartScreen) | `resolveAppBootstrap.ts:28` |

`retryBootstrap()` — единственный путь в режим `resolving`, таймаут 3000 мс → `error`
(`useSurveyBootstrap.ts:19`, `:103-107`).

**Критично для E2E:** справочники (`GET /api/v1/presets/envelope` и т. д.) грузятся
**только после** перехода в `survey`: `useReferenceData({ enabled: calcEnabled })`,
`calcEnabled = (mode === 'survey')` — `routing/SurveyAppShell.tsx:29-31`, `:43`.
То есть при восстановлении черновика пресеты **гарантированно приходят позже** черновика.
Это делает «гонку» из находки U4 не гонкой, а детерминированной последовательностью (§8.7).

### 1.3 Группы компонентов (`frontend/src/`, 99 `.tsx` + 192 `.ts`)

**Оболочка и bootstrap**
| Модуль | Назначение |
|---|---|
| `App.tsx`, `AppRoot.tsx` | router/auth/providers; оркестратор bootstrap (`AppRoot.tsx:85-104`) |
| `StartAppRoot.tsx` | лёгкая ветка `start`/`resolving`/`error`, без `useSurveyProject` |
| `SurveyAppRoot.tsx` | тяжёлая ветка `survey`: Header, projects, persistence, DevPanel |
| `AppSurveyContent.tsx` | тело анкеты: левое меню шагов + globalMeta + workArea |
| `routing/SurveyAppShell.tsx` | `SurveySessionProvider` + справочники |
| `components/AppBootstrapSkeleton` | «Завантаження сторінки…» / «Завантаження анкети…» |
| `components/BootstrapErrorScreen` | экран ошибки bootstrap |
| `components/AppErrorBoundary` | error boundary всего приложения |
| `components/StartScreen` | стартовый экран: h1 «Підбір опалення для дому та квартири», кнопка «Почати новий розрахунок» (`i18n/uk/startScreen.ts:6-9`) |

**Шапка, футер, модалки**
| Модуль | Назначение |
|---|---|
| `components/Header` | «Ім'я клієнта», «Проєкти», «Зберегти», «Посилання», «PDF / Завантажити» (меню из 2 пунктов), «Вийти з проєкту» |
| `components/AccountBar`, `SubscriptionTierBadge`, `ClerkAuthWidget`, `ClerkAuthLoadingFallback`, `AuthRedirectShell` | сессия Clerk |
| `components/Footer`, `FooterLinkGroup`, `ModalHost`, `ModalDialog`, `ContactModal`, `ReportBugModal`, `CookieConsentBanner`, `Logo`, `Spinner`, `StaticPageLayout` | общий хром |
| `components/ProjectsDialog`, `ProjectTransferDialog` | список проектов / admin-перенос |
| `components/ShareLinkToast` | тост после копирования публичной ссылки |

**Формы шагов анкеты**
| Модуль | Шаг |
|---|---|
| `components/ObjectMetaForm` | `object` |
| `components/WarmFloorSection` + `UfhDistributionSelect` + `UfhPresetCards` | `warmFloor` |
| `components/RoomsForm` + `RoomAccordionItem` (43 КБ, 1014 строк) | `rooms` |
| `components/HotWaterForm` | `hotWater` |
| `components/BoilerSurveyForm` | `boiler` |
| `components/RadiatorsSurveyForm` | `radiators` |
| `components/WaterHeaterForm` | `waterHeater` |
| `components/HydraulicsSection` | `hydraulics` |
| `components/RecommendationsBlock` | `technicalResult` |
| `components/CatalogEquipmentReference` | `dataReference` |
| `components/FinancialSummary/FinancialSummaryTable` | `financialResult` |

**Отчёты (пары «модалка + view» + «summary-таблица»)**
`BoilerReport` (Dialog/View/SummaryTable/hasContent), `RadiatorsReport`, `HotWaterReport`
(+ `HotWaterFixturesTable`, `HotWaterFixturesSummaryTable`, `HotWaterSummaryTable`),
`WaterHeaterReport` (+ `WaterHeaterMatchingPreview`, `WaterHeaterProposalCard`),
`UnderfloorHeatingReport` (+ `UfhLoopHydraulicsTable`, `UfhMixingNodeSpecCard`,
`UfhWarningResolutionDialog`, `UniboxMatchingSection`, `UnderfloorHeatingSummaryTable`),
`HydraulicsReport` (+ `HydraulicsProposalTable`, `HydraulicsSummaryTable`),
`Hydraulics/HydraulicsPumpCard`, `HeatLossReport/HeatLossSummaryTable`,
`BoilerProposalCard`, `RadiatorProposalLineTable`.
Единый паттерн: кнопка «Звіт з …» + `disabled={!canOpenReport}` + предикат `hasXxxReportContent`.

**Публичная ссылка и Dev**
`SharePresentationPage`, `PublisherContactBlock`, `DevPanel`, `DevToolsDock`.

**Хуки состояния**
`useSurveySession`, `useCalcReport`, `useSurveyEstimates`, `useRoomsOrchestration`,
`useSurveyStepNavigation`, `useSurveyDraftPersistence`, `useSurveyProject`,
`useProjectBundleTransfer`, `useSurveyBootstrap`, `useDevPanelAccess`, `usePresetLists`.

---

## 2. Машина состояний анкеты и черновик

### 2.1 Где живёт состояние

`SurveySessionState` — `frontend/src/surveySession/types.ts:69-78`:
`draft`, `report`, `reportEpoch`, `uiPhase`, `calcError`, `draftInitializing`,
`thermalRegimeTouched`, `calcInputKey`.
Хранится в `useState` внутри `SurveySessionProvider` (`SurveySessionProvider.tsx:55`),
раздаётся через контекст (`:155-169`). **Наружу (в `window`) не экспонировано ничего** —
для E2E состояние читается только через DOM или через `localStorage`.

### 2.2 События (мутации) — 20 штук

`SurveyMutation` — `surveySession/types.ts:43-64`:

| Событие | Что меняет | Якорь reduce |
|---|---|---|
| `SET_CURRENT_STEP` | `draft.currentStep` | `reduceSurveyMutation.ts:21-22` |
| `SET_OBJECT_META` | `draft.objectMeta` | `:23-24` |
| `SET_ROOMS` | `draft.rooms` | `:25-26` |
| `SET_TEMPS` | `draft.temps` | `:27-28` |
| `SET_HOT_WATER_FORM` | нормализуется `normalizeHotWaterForm` | `:29-33` |
| `SET_WATER_HEATER_FORM` | нормализуется `normalizeWaterHeaterForm` | `:34-38` |
| `HEATING_EMITTERS_MODE_SET` | `ufhPresetId`; при `null` — гасит ТП во всех комнатах | `:39-40` + `migrateDerivedState.ts:73-100` |
| `WATER_UFH_FLAG_SET` | флаг ТП; при `false` — гасит ТП в комнатах и обнуляет `ufhPresetId` | `:41-42` + `migrateDerivedState.ts:102-115` |
| `UFH_DISTRIBUTION_PRESET_SET` | схема распределения ТП | `:43-44` |
| `WIRING_SCHEME_SET` | тип разводки | `:45-52` |
| `SET_WIRING_BRANCHES` / `WIRING_BRANCH_LENGTH_SET` / `WIRING_BRANCH_REORDER` | ветки разводки | `:53-106` |
| `SET_THERMAL_REGIME_PRESET` | график котла (+ флаг `touched`) | `:107-108` |
| `SET_RADIATOR_CONNECTION` / `SET_RADIATOR_EMITTER_PREFERENCE` | подводка / тип приборов | `:109-112` |
| `SET_HYDRAULICS_FORM` | форма гидравлики | `:113-114` |
| `DRAFT_LOADED` | полная замена черновика (`structuredClone`) | `:115-116` |
| `SESSION_RESET` | пустой черновик (`rooms: []`) | `:117-118` |
| `SURVEY_STARTED` | дефолтный черновик (1 комната) | `:119-120` |
| `RUN_CALC_MANUAL` | черновик не меняет, только триггерит calc | `:121-122` |

### 2.3 Pipeline мутации (4 шага)

`runSurveyMutationPipeline.ts:21-103`:
`reduceSurveyMutation` (`:25`) → `migrateDerivedState` (`:26`) →
`buildCalcInputKeyFromDraft` (`:64`) → `decideCalcAction` (`:77`).

`decideCalcAction` (`decideCalcAction.ts:14-52`):

| Условие | Действие |
|---|---|
| `next.draftInitializing` | `none` (`:19-21`) |
| `RUN_CALC_MANUAL` + `canAutoCalcFromDraft` | `schedule_immediate` (`:23-25`) |
| `DRAFT_LOADED` + `canAutoCalcFromDraft` | `schedule` (`:27-29`) |
| `SESSION_RESET` | `abort_only` (`:31-33`) |
| `SURVEY_STARTED` | `none` (`:35-37`) |
| ключ не изменился и «стало можно считать» не наступило | `none` (`:43-45`) |
| `!canAutoCalc` | `abort_only` (`:47-49`) |
| иначе | `schedule` (`:51`) |

Переходы `uiPhase` (`runSurveyMutationPipeline.ts:79-84`):
`schedule`/`schedule_immediate` → `recalculating` (+ `calcError = null`);
`abort_only` → `stable` при наличии отчёта, иначе `idle`.

Ответы calc:
- `applyCalcResponseOk` → полная замена `report`, `reportEpoch + 1`, `uiPhase='stable'` (`:124-135`);
- **`applyCalcResponseFail` → `uiPhase='error'`, `calcError=message`, `report` НЕ трогается** (`:144-153`) — это F-07 / N-30;
- `applyCalcSkippedDedup` → `stable`/`idle` без POST (`:161-167`).

### 2.4 Гейт запуска расчёта — ОТКАЗ B

`canAutoCalcFromDraft` — `frontend/src/surveySession/buildCalcInputSnapshot.ts:40-68`:

1. `rooms.length > 0` (`:41`);
2. **у каждой** комнаты `areaM2 > 0` и `heightM > 0` (`:42-49`);
3. **хотя бы у одной** комнаты есть источник теплопотерь (`:51-67`):
   `totalExternalWallAreaM2(r) > 0` **или** `roofAreaM2 > 0` при `topBoundaryType === 'roof'`
   **или** `ceilingAreaM2 > 0` при `topBoundaryType === 'unheated'` **или**
   окно с `openingWidthMm > 0 && openingHeightMm > 0`.

Условие 3 — `.some()`, а серверная проверка `assertRoomExteriorLayoutWalls` требует
согласованности **по каждой** комнате. Отсюда обе половины ОТКАЗА B:
- ни одной стены нигде → `canAutoCalc === false` → POST не отправляется вовсе;
- стены есть у части комнат → POST уходит → сервер бракует **первую** проблемную комнату.

Дополнительно `calcEnabled` (`SurveySessionProvider.tsx:84`) — расчёт разрешён только при
`bootstrapMode === 'survey'`.

### 2.5 HTTP-исполнитель

`query/useSurveyCalc.ts`:
- debounce `SURVEY_CALC_DEBOUNCE_MS = 700` (`:15`, `:57`);
- `autoEnabled = canAutoCalc && !draftInitializing && debouncedKey === calcInputKey` (`:59-63`);
- dedup: `JSON.stringify(payload)` сравнивается с последним успешным (`:69-72`),
  совпало → искусственная ошибка `CALC_SKIP_DEDUP` (`:17`);
- `retry: false`, `staleTime: 0`, `gcTime: 0` (`:78-80`);
- ручной расчёт — `useMutation` + сброс dedup (`:132-136`), вызывается только из DevPanel.

**Для E2E:** после любого ввода ждать `waitForResponse('**/api/v1/calc')`, а не таймаут.
Но при dedup POST не уйдёт вовсе — ожидание зависнет. Надёжнее ждать снятия
`uiPhase === 'recalculating'`, а для этого нужен DOM-маркер (§7).

### 2.6 Черновик в localStorage

| Параметр | Значение | Якорь |
|---|---|---|
| Ключ | `heatcalc:survey-draft:v1` | `services/surveyDraftStorage.ts:9` |
| Версия схемы | `SURVEY_DRAFT_SCHEMA_VERSION = 4` | `types/surveyDraft.ts` (по `docs/survey-draft.md`) |
| Запись | debounce 400 мс | `hooks/useSurveyDraftPersistence.ts:14`, `:48` |
| Сборка | `buildSurveyDraft()` | `utils/buildSurveyDraft.ts:25-67` |
| Чтение | `parseSurveyDraft` → `migrateSurveyDraft` | `services/surveyDraftStorage.ts:20`, `utils/migrateSurveyDraft.ts:48` |
| Битый JSON | ключ удаляется молча | `surveyDraftStorage.ts:21-27` |
| «Пустой» черновик не пишется | `isPersistableSurveyDraft` | `surveyDraftStorage.ts:52-59` |

**`lastCalcReport` попадает в localStorage** (`buildSurveyDraft.ts:66`) — то есть
E2E может прочитать полный отчёт из браузерного хранилища. Оговорка ниже.

#### Триггер записи — источник F-08

`useSurveyDraftPersistence.ts:61` — зависимости эффекта:
`[bootstrapMode, calcInputKey, clientName, projectId]`.
**`currentStep` в `calcInputKey` не входит** (`utils/surveyCalcInputKey.ts:57-117` — поля ключа
перечислены явно, `currentStep` там нет). Значит:

- `currentStep` **сохраняется** в черновик (`buildSurveyDraft.ts:50`) и **восстанавливается**
  (`surveyDraftBridge.ts:22`, `migrateSurveyDraft.ts:128-135`);
- но запись срабатывает **только** при изменении данных расчёта / имени клиента / projectId.
  Смена шага сама по себе черновик не переписывает.

**Уточнение к F-08 из U5:** формулировка «`currentStep` не сохраняется вообще» неточна.
Механизм тоньше: сохраняется шаг, актуальный на момент **последней** записи черновика.
Пользователь, который заполнил объект и потом просто прокликал до «Результат технічний»,
после перезагрузки вернётся на «Об'єкт», потому что записи после смены шага не было.
Правка дешевле, чем описано в U5: добавить `draft.currentStep` в массив зависимостей —
**0.5–1 ч** вместо 2–4 ч.

**Оговорка для E2E-оракула:** `lastCalcReport` попадёт в storage только со **следующей**
записью после успешного расчёта, потому что приход отчёта сам по себе `calcInputKey` не меняет.
То есть `localStorage` как оракул «расчёт выполнен» отстаёт на одну мутацию — использовать
можно, но с явным «сделай ещё одно изменение и дождись persist», что хрупко.

### 2.7 Миграции черновика (`utils/migrateSurveyDraft.ts`)

| Проверка / преобразование | Якорь | Что теряется |
|---|---|---|
| не объект → `Error('Файл проєкту: очікується JSON-об'єкт')` | `:49-51` | — |
| нет `objectMeta`/`rooms`/`temps` → `Error('Файл проєкту: неповний чернетка анкети')` | `:52-54` | — |
| `schemaVersion > 4` → `Error('Непідтримувана schemaVersion: …')` | `:56-61` | загрузка отклоняется |
| `schemaVersion < 4` → телеметрия `[survey-compat]` | `:63-68` | — |
| корневые `hotWaterBoilerPowerMatchingScheme` / `objectMeta.indirectDhwSpaceAvailable` → `waterHeaterForm` | `:71-87` | ключи из `objectMeta` вырезаются |
| `externalWalls` без `presetId` → подставляется `wall_gas_concrete_d500`, `facadeSystem: 'none'` | `:92-101` | **исходные данные стены** |
| комнаты: `migrateLegacyRoomTypes` → `migrateRoomEnvelopeFields` → `migrateRoomUnderfloorHeating` | `:105-107` | legacy `wallAreaM2` → `externalWall1` (`roomEnvelopeFields.ts:82-113`); `externalWall2` обнуляется, если layout ≠ `corner` (`:134-140`) |
| пустой `clientName` → `'Без імені'` (укр.) | `:109-112` | — |
| deprecated `thermalRegimePreset` → `traditional_dt50_75_65` | `:114-121` | выбор пользователя |
| `currentStep === 'summary'` → `'financialResult'`; неизвестный → `'object'` | `:128-135` | — |
| **`Number(raw.temps.insideC) \|\| 20`**, **`Number(raw.temps.outsideC) \|\| -5`** | `:139-140` | **честный `0 °C` подменяется дефолтом** (N-07) |
| `bathroomAirTempC` берётся только если `≥ 24` | `:141-145` | значения `< 24` отбрасываются |
| `underfloorDistributionPreset` невалиден → `'auto'` | `:150-153` | — |
| `ufhPresetId`: `ufh_direct_tile`/`ufh_direct_laminate` → `ufh_mixed_radiators`; неизвестный → `null` | `:161-169` | **режим ТП молча пропадает** |
| `hydraulicsForm` не объект / отрицательные значения → `DEFAULT_HYDRAULICS_FORM` (`{8, 20, ''}`) | `:170-194` | введённые длины |
| `wiringLayoutV3.schemaVersion !== 3` → **полная пересборка из комнат** | `:224-227` | **ручной порядок радиаторов и длины подводов** |
| `estimatedLengthM` → `pipeLengthToEquipmentM`, иначе `4` | `:213-221` | — |

**Асимметрия имён клиента.** Запись даёт `'Без имени'` по-русски
(`utils/buildSurveyDraft.ts:44`), чтение даёт `'Без імені'` по-украински
(`migrateSurveyDraft.ts:112`), а `isPersistableSurveyDraft` считает «пустым» только
русский вариант (`surveyDraftStorage.ts:54`). Три разных строки для одного смысла —
это и F-11, и источник ложных «черновик не пустой» после round-trip через файл.

---

## 3. Шаги анкеты: поля, обязательность, валидация

Условные обозначения:
- **Обязательное фактически** — без него сервер вернёт 400 либо клиент не отправит POST.
- **Помечено** — есть ли звёздочка / слово «обов'язково» / `required`.
  **Ответ везде «нет»: `required` в анкете не используется ни разу.**
- **Валидация клиента**: `attr` — только HTML-атрибуты `min`/`max` (не блокируют,
  форма не сабмитится); `clamp` — рантайм-ограничение в обработчике.

### 3.1 `object` — «Об'єкт»

Форма: `components/ObjectMetaForm/ObjectMetaForm.tsx` + блок температур
`AppSurveyContent.tsx:485-545`.

| Поле (укр. дословно) | Тип | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Тип об'єкта» | select `#objectType` | да | нет | enum UI (`ObjectMetaForm.tsx:155-156`) | required, enum `house\|apartment` (`BuildingObjectMeta.yaml:5-7`) | `house` (`createDefaultSurveyDraft.ts:56`) | нет |
| «Поверх квартири в будинку» | select `#apartmentStackPosition` (только квартира) | нет | нет | enum UI (`:176-178`) | enum `first_floor\|middle_floor\|last_floor` (`BuildingObjectMeta.yaml:8-10`) | `middle_floor` | нет |
| «Поверховість об'єкта» | select `#floors` | да | нет | enum `1\|2\|3` (`:202-204`) | required, enum `1,2,3` (`BuildingObjectMeta.yaml:15-17`) | `1` | нет |
| «Кількість приміщень (1…50)» | number `#roomsCount` | да | нет | **clamp 1…50** (`:216-218`, `:40-43`) | required, `1…50` (`BuildingObjectMeta.yaml:18`) | `1` | нет |
| «Вентиляція та провітрювання» | select `#ventilationReserveMode` | нет | нет | enum UI (`:244-249`) | enum `natural\|recuperation` (`BuildingObjectMeta.yaml:50-52`) | `natural` | нет |
| «Заплановане встановлення котла» | select `#boilerPlacementZone` (только дом) | **да для дома** | нет | enum UI (`:274-276`) | enum; **`BOILER_PLACEMENT_REQUIRED`** для дома (`validate.js:686-694`) | `kitchen` | нет |
| «Площа котельні, м²» | number `#boilerRoomAreaM2` | условно | нет | `attr min 0.1` (`:293`) | `min 0.01`, max нет (`BuildingObjectMeta.yaml:35`); **XOR-правило** (`validate.js:700-707`) | пусто | нет |
| «Висота стелі котельні, м» | number `#ceilingHeightM` | условно | нет | `attr min 2.2 max 6` (`:318-320`) | `2…6` (`BuildingObjectMeta.yaml:41`) | пусто | нет |
| «Несуча стіна (без утеплювача)» | select `#wallPresetId` | да | нет | список из API; при пустом списке `value=''` (`:347`) | `minLength 1` (`BuildingObjectMeta.yaml:66`); `EXTERNAL_WALLS_PRESET_REQUIRED` (`externalWallsValidate.js:29-31`) | `wall_gas_concrete_d500` | нет |
| «Товщина несучої стіни, мм» | number `#wallThicknessMm` | условно | нет | `attr min 50 max 2000 step 10` (`:381-383`), **без clamp** | `50…2000` (`BuildingObjectMeta.yaml:72`) | `300`, **перетирается на `200`** (§8.7) | нет |
| «Утеплення фасаду» | select `#facadeSystem` | нет | нет | enum UI (`:418-420`) | enum `none\|sftk\|ventilated` (`BuildingObjectMeta.yaml:77-79`) | `none` | нет |
| «Утеплювач СФТК» / «Мінеральна вата» | select `#insulationPresetId` | при фасаде ≠ none | нет | список отфильтрован по типу фасада (`:60-65`) | `minLength 1`; `EXTERNAL_WALLS_INSULATION_REQUIRED`, `..._SFTK_INSULATION`, `..._VENTILATED_INSULATION` (`externalWallsValidate.js:61-106`) | первый из списка | нет |
| «Товщина утеплювача, мм» | number `#insulationThicknessMm` | при фасаде ≠ none | нет | `attr min 30 max 300 step 10` (`:465-467`), **без clamp** | `30…300` (`BuildingObjectMeta.yaml:88`) + `EXTERNAL_WALLS_INSULATION_THICKNESS` (`externalWallsValidate.js:75-80`) | `100` | нет |
| «Покрівля за замовчуванням (пресет)» | select `#roofPresetId` | нет | нет | список из API + опция «Не враховувати покрівлю» (`:512`) | `minLength 0` — пустая строка проходит (`BuildingObjectMeta.yaml:23`) | первый из API (`useRoomsOrchestration.ts:106-112`) | нет |
| **«Всередині, °C»** | number, **без `id`**, implicit `<label>` | **да** | нет | **ничего**; `Number('')===0` (`AppSurveyContent.tsx:495`) | **required, `5…35`** (`CalcInput.yaml:38-40`) | `20` (`migrateDerivedState.ts:168`) | нет |
| **«Зовні, °C»** | number, **без `id`** | нет | нет | **ничего**; `Number('')===0` (`:508`) | **`−60…40`** (`CalcInput.yaml:41`) | `−5` (`migrateDerivedState.ts:168`) | нет |
| «Повітря в санвузлі, °C» | number, **без `id`**, `placeholder="≥24"` | нет | нет | `attr min 24 max 35` + **clamp** `Math.max(24, Math.min(35, n))` (`:517-518`, `:532`) | `24…35` (`CalcInput.yaml:42`) | не задан | нет |

**Ничего на шаге «Об'єкт» не блокирует переход дальше.**
Подсказка на шаге ровно одна и объясняет только санузел (`AppSurveyContent.tsx:541-544`).

**Локализована подсказка про котельную** (открытый вопрос U5):
`ObjectMetaForm.tsx:278-281` — «Напольні котли підбираються лише при виборі котельні
та об'ємі не менше 7,5 м³ (приміщення «Котельня» в списку приміщень або площа й висота нижче).»
Условие действительно зависит от комнаты типа «Котельня», которая задаётся **позже**,
на шаге «Приміщення» (`constants/roomTypes.ts:22`). Серверная проверка —
`BOILER_ROOM_VOLUME_INVALID` (`validate.js:719-724`).

### 3.2 `warmFloor` — «Тепла підлога»

Форма: `components/WarmFloorSection/WarmFloorSection.tsx`.

| Поле (укр. дословно) | Тип | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Лише радіатори» / «Класика» | button-карточка в `role="radiogroup" aria-label="Режим опалення"` | нет | нет | `onSelect(null)` (`UfhPresetCards.tsx:36-47`) | `ufhPresetId` отсутствует | выбрана по умолчанию (`ufhPresetId === null`) | нет |
| «Тепла підлога + радіатори» / «Змішана система» | button-карточка | нет | нет | `presetId='ufh_mixed_radiators'` | enum (`CalcInput.yaml:175-179`) | — | нет |
| «Опалення лише теплою підлогою» / «Сучасний будинок» | button-карточка | нет | нет | `presetId='ufh_only'` | enum | — | нет |
| «У проєкті передбачена водяна тепла підлога (кімнати на кроці «Приміщення»)» | checkbox без `id` | нет | нет | — | `waterUnderfloorHeating: boolean` (`CalcInput.yaml:172`) | `false` | нет |
| «Схема підключення контуру ТП» | select `#ufh-distribution-preset`, показан при `waterUnderfloorHeating && ufhPresetId != null && ufhPresetId !== 'ufh_only'` (`WarmFloorSection.tsx:55-58`) | нет | нет | enum UI | enum `auto\|collector_mixing_valve\|hydraulic_separator` (`UfhDistributionPreset.yaml:5-8`) | `auto` | нет |
| «Звіт з розрахунку ТП» | button | — | — | `disabled={!canOpenReport}` (`:100`) | — | disabled | — |

Подписи карточек приходят из API (`GET /api/v1/presets/ufh-modes`); локальный эталон —
`data/fallbackUfhModePresets.ts:7-25` (тексты выше — оттуда). Для E2E: **если API отдаст
другие тексты, ассерты по заголовкам сломаются**; надёжнее ассертить по `presetId`,
которого в DOM нет.

Побочные эффекты (`migrateDerivedState.ts:73-115`): выбор `ufh_only` **молча** ставит
`thermalRegimePreset = 'condensing_dt30_55_45'` (`:92-94`); снятие флага ТП гасит ТП
во всех комнатах (`:107-109`) и пересобирает `wiringLayoutV3`.

### 3.3 `rooms` — «Приміщення»

Форма: `components/RoomsForm/RoomsForm.tsx` + `RoomAccordionItem.tsx`.
Все `id` контролов шаблонизированы `room.id` (`r1`, `r2`, … из `useRoomsOrchestration.ts:140`).
**Одновременно открыта не более одной карточки** (`RoomsForm.tsx:62`, `:70-72`);
закрытые панели остаются в DOM с `hidden` (`RoomAccordionItem.tsx:300`).

| Поле (укр. дословно) | Тип / id | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Назва» | text `#name-${roomId}` | **да** | нет | **ничего**, пустое допускается (`:309-315`) | **required, `minLength 1`** (`CalcInput.yaml:55`, `:58`) | «Комната 1»/«Комната N» (`createDefaultSurveyDraft.ts:36`, `useRoomsOrchestration.ts:141`) | нет |
| «Тип» | select `#type-${roomId}` | да | нет | только канон (`:328-329`) | required, enum из 10 (`CalcInput.yaml:59,67-77`) | `помещение` → подпись «Приміщення» | нет |
| «Поверх» | select `#floor-${roomId}` | да | нет | ≤ `maxFloors` (`:361-363`) | required, `1…3` (`CalcInput.yaml:78`) | `1` | нет |
| «Нижня межа» | select `#bottom-boundary-${roomId}` (дом) | да | нет | enum UI (`:395-396`) | required, `heated\|unheated` (`CalcInput.yaml:91-93`); **сервер перезаписывает** (`validate.js:560-565`) | `unheated` при этаже 1, иначе `heated` (`apartmentStackBoundaries.ts:57-59`) | нет |
| «Верхня межа» | select `#top-boundary-${roomId}` (дом) | да | нет | enum UI (`:411-413`) | required, `heated\|unheated\|roof` (`CalcInput.yaml:83-85`) | **`heated` всегда** (`useRoomsOrchestration.ts:143`) | нет |
| «Межі (квартира в будинку)» | read-only текст (квартира) | — | — | задаётся на шаге «Об'єкт» (`:372-380`) | — | по `apartmentStackPosition` | — |
| «Площа, м²» (комнаты) | number `#area-${roomId}` | **да** | нет | `attr min 0.1 step 0.1`, **без clamp** (`:427-428`) | required, `min 0.01`, **max нет** (`CalcInput.yaml:97`) | `''` (пусто) | **да** — блокирует POST (`buildCalcInputSnapshot.ts:44-47`) |
| «Висота, м» | number `#height-${roomId}` | **да** | нет | `attr min 1.8 step 0.05`, **без clamp** (`:445-446`) | required, `min 0.01`, **max нет** (`CalcInput.yaml:98`) | `2.7` | **да** — блокирует POST (`:46-47`) |
| «Розташування приміщення» | select `#room-layout-${roomId}` | да | нет | enum UI (`:469-475`) | enum `corner\|facade\|internal` (`RoomExteriorLayout.yaml:2`) | `facade` (или `internal` для прихожая/коридор/тамбур — `roomExteriorLayout.ts:27-29`) | нет |
| «Зовнішні стіни (об'єкт)» | read-only сводка | — | — | `formatExternalWallsSummary` | — | — | — |
| «Стіна №1» → «Площа, м²» | number `#externalWall1-area-${roomId}` | **да** (при layout `facade`/`corner`) | нет | `attr min 0`, **без clamp** (`:819-820`) | элемент `envelopeElements` `min 0.01` (`EnvelopeElementInput.yaml:25`) | `''` | **да** — 0 ⇒ элемент выбрасывается (`buildCalcRequestPayload.ts:111-112`) ⇒ ОТКАЗ B |
| «Стіна №1» → «Орієнтація» | select `#externalWall1-or-${roomId}` | нет | нет | enum UI (`:842-846`) | enum 8 значений (`EnvelopeElementInput.yaml:31-37`) | `N` (`roomEnvelopeFields.ts:36`) | нет |
| «Стіна №2» → «Площа, м²» / «Орієнтація» | `#externalWall2-*-${roomId}`, только при layout `corner` | **да при `corner`** | нет | `attr min 0` | как выше; `layout=corner вимагає дві фасадні стіни` (`roomExteriorLayoutHeatLoss.js:193`) | `''` / `N` | **да при `corner`** |
| «Стіна в загальний коридор під'їзду» / «Стіна в холодний коридор / тамбур» → «Площа, м²» | `#externalWall1-area-${roomId}` при layout `internal` | **да** | нет | `attr min 0` | `layout=internal вимагає рівно одну стіну в коридор` (`roomExteriorLayoutHeatLoss.js:181`) | `''` | **да** |
| «Стеля (пресет)» | select `#ceilingPresetId-${roomId}`, только при `topBoundaryType='unheated'` | условно | нет | список API (`:717`) | `presetId` без ограничений (`EnvelopeElementInput.yaml:22`) | `ceilingPresets[0]` (`useRoomsOrchestration.ts:118-119`) | нет |
| «Площа стелі, м²» | number `#ceiling-area-${roomId}` | условно | нет | `attr min 0 step 0.1` (`:740-741`) | `min 0.01` (`EnvelopeElementInput.yaml:25`) | `''` | нет; 0 ⇒ элемент выбрасывается (`buildCalcRequestPayload.ts:149-150`) |
| «Покрівля (пресет)» | select `#roofPresetId-${roomId}`, только при `topBoundaryType='roof'` | условно | нет | список API + «Не враховувати покрівлю» (`:774`) | — | `roofPresets[0]` | нет |
| «Площа скатів покрівлі (за поверхнею), м²» | number `#roof-area-${roomId}` | условно | нет | `attr min 0 step 0.1` (`:792-793`) | `min 0.01` | `''` | нет; 0 ⇒ выбрасывается (`:137-138`) |
| «Підлога (огородження)» | select `#floorPresetId-${roomId}` | да | нет | список API (`:503`/`:688`) | — | `floorPresets[0]` (`useRoomsOrchestration.ts:116-117`) | нет; пустой `floorPresetId` ⇒ элемент пола не отправляется (`:125`) |
| «Тепла підлога в цьому приміщенні» | checkbox `#ufh-enabled-${roomId}`, только при глобальном флаге ТП | нет | нет | — | — | `false` | нет |
| «Основа ТП (перекриття + стяжка)» | select `#ufh-base-${roomId}` | при ТП | нет | список API | required + `UNDERFLOOR_HEATING_BASE_INVALID` (`validate.js:415-420`) | `DEFAULT_UNDERFLOOR_HEATING_BASE_ID` | нет |
| «Фінішне покриття» | select `#ufh-finish-${roomId}` | при ТП | нет | список API | required + `UNDERFLOOR_HEATING_FINISH_INVALID` (`validate.js:421-426`) | `DEFAULT_FLOORING_FINISH_ID` | нет |
| «Бажаний крок укладки, мм» | select `#ufh-spacing-${roomId}` | нет | нет | enum `100\|150\|200` (`:601-605`) | enum `100,150,200` (`RoomUnderfloorHeating.yaml:23`) | `150` | нет |
| «Площа, зайнята меблями (без ніжок / низька посадка), S<sub>meb</sub> (м²)» | number `#ufh-furniture-${roomId}` | нет | нет | `attr min 0 step 0.1` (`:619-621`) | `min 0`, max нет; **`>= room.areaM2` ⇒ 400** (`validate.js:464-472`) | `''` | нет |
| «Регулювання контуру ТП (площа ≤ 20 м²)» → «Колектор теплої підлоги» / «Унібокс (локальний регулятор)» | radio `name="ufh-terminal-${roomId}"`, показ при `0 < areaM2 ≤ 20` (`:152-155`) | нет | нет | UI-условие | enum `collector\|unibox`; при `> 20 м²` **молча деградирует** до `collector` (`validate.js:485-488`) | `collector` | нет |
| «Додати вікно» | button без `id` (`:863-865`) | — | — | — | — | 1 окно на комнату по умолчанию | — |
| «Тип вікна» | select `#win-preset-${roomId}-${wi}` | нет | нет | список API + офлайн-дефолт (`:898-908`) | — | `windowPresets[0]` | нет |
| «Ширина, мм» | number `#win-w-${roomId}-${wi}` | нет | нет | `attr min 200`, **max нет**, без clamp (`:920`) | **`200…6000`** (`EnvelopeElementInput.yaml:38`) | `''` | нет; пустая ширина ⇒ окно выбрасывается (`buildCalcRequestPayload.ts:163-165`) |
| «Висота, мм» | number `#win-h-${roomId}-${wi}` | нет | нет | `attr min 200`, **max нет**, без clamp (`:937`) | **`200…4000`** (`EnvelopeElementInput.yaml:43`) | `''` | нет; пустая высота ⇒ окно выбрасывается |
| «Орієнтація» (окна) | select `#win-or-${roomId}-${wi}` | нет | нет | enum UI | enum 8 значений | `N` | нет |
| «К-сть однакових» | number `#win-count-${roomId}-${wi}` | нет | нет | `attr min 1`, **max нет**, без clamp (`:973`) | **`1…50`** (`EnvelopeElementInput.yaml:26`) | `1` | нет |
| «Видалити вікно» | button `#win-remove-${roomId}-${wi}` | — | — | — | — | — | — |
| «Скопіювати з першої кімнати» | button, виден при `value.length > 1` (`RoomsForm.tsx:112-122`) | — | — | копирует всё, кроме `name`/`type`/`areaM2`/`heightM` (`:78-104`) | — | — | — |

**Ключевой вывод шага.** Обязательных полей на комнату ровно два — «Площа, м²» комнаты и
«Площа, м²» «Стіни №1» (три при «Кутове / торцеве»). Ни одно из них не помечено;
«Висота, м» имеет дефолт `2.7`, поэтому фактически «своими руками» заполняются два поля.
Совпадает с U5.

### 3.4 `hotWater` — «Гаряча вода»

Форма: `components/HotWaterForm/HotWaterForm.tsx`. Заголовок «Гаряче водопостачання» (`:63`).

| Поле (укр. дословно) | Тип / id | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Посилений («тропічний») душ — збільшує розрахунковий об'єм накопичувального / буферного бака на 30 %» | checkbox без `id` (`:74-77`) | нет | нет | — | `boolean` (`CalcInput.yaml:221`) | `false` | нет |
| «Кількість осіб» | number `#hw-residents` | нет | нет | `attr 0…20` + **clamp 0…20** (`:95-97`, `:24-27`, `:41-42`) | `min 0`, **max нет** (`CalcInput.yaml:209`) | `0` (`hotWaterFormDefaults.ts:51`) | нет |
| «Розрахункова температура холодної води» → «Зима (+5 °C)» / «Літо (+15 °C)» | radio `name="coldWaterDesignSeason"`, `role="group" aria-labelledby="hw-cold-season-label"` (`:103-125`) | нет | нет | enum UI | enum `winter\|summer` (`CalcInput.yaml:210-212`) | `winter` | нет |
| «ГВ, °C (55…60)» | number `#hw-hot` | нет | нет | `attr min 55 max 60 step 0.5`, **clamp ОТСУТСТВУЕТ** (`:134-139`, сеттер `:44-45`) | **`55…60`** (`CalcInput.yaml:216`) | `60` | нет |
| «Мийка / змішувач» | number `#fx-kitchen-sink` | нет | нет | `attr 0…30` + **clamp** (`:47-57`) | `0…30` (`CalcInput.yaml:234`) | `0` | нет |
| «Посудомийна машина» | number `#fx-dishwasher` | нет | нет | как выше | `0…30` (`:235`) | `0` | нет |
| «Душ» | number `#fx-shower` | нет | нет | как выше | `0…30` (`:230`) | `0` | нет |
| «Ванна» | number `#fx-bath` | нет | нет | как выше | `0…30` (`:231`) | `0` | нет |
| «Раковина» | number `#fx-sink` | нет | нет | как выше | `0…30` (`:232`) | `0` | нет |
| «Унітаз» | number `#fx-toilet` | нет | нет | как выше | `0…30` (`:233`) | `0` | нет |
| «Біде» | number `#fx-bidet` | нет | нет | как выше | `0…30` (`:238`) | `0` | нет |
| «Мийка» (госпблок) | number `#fx-laundry` | нет | нет | как выше | `0…30` (`:236`) | `0` | нет |
| **«Прална машина»** (опечатка, должно быть «Пральна») | number `#fx-washer` | нет | нет | как выше | `0…30` (`:237`) | `0` | нет |
| «Звіт з розрахунку ГВ» | button | — | — | `disabled` пока нет точек и нет отчёта (`:37-39`, `:304`) | — | disabled | — |
| «Назад до результатів» | button | — | — | — | — | — | — |

Подзаголовки-секции: «Точки за приміщеннями» (`:144`), «Кухня» (`:147`),
«Санітарний вузол» (`:184`), «Госпблок / техприміщення / пральня» (`:263`).
Подсказка при пустых точках: «Вкажіть точки водорозбору — звіт і таблиця в «Результатах»
з'являться одразу; розрахунок потужності — після авторозрахунку.» (`:325-328`).

### 3.5 `boiler` — «Котел»

Форма: `components/BoilerSurveyForm/BoilerSurveyForm.tsx`.

| Поле (укр. дословно) | Тип / id | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Режим графіка опалення (подача / зворот, пресет під тип котла)» | select `#thermal-regime-preset` | нет | нет | 2 опции: «Традиційний котел (газ/електро): 75/65 °C — базовий для радіаторів», «Конденсаційний котел: 55/45 °C — низькотемпературний радіаторний режим» (`shared/heatingThermalRegimePresets.js:43-50,68-75`) | enum из 3 (устаревший `traditional_high_dt70_95_85` в UI скрыт) (`CalcInput.yaml:193-198`) | `recommendedThermalRegimePresetForScheme(...)` (`createDefaultSurveyDraft.ts:26-29`) | нет |
| «Режим графіка опалення (лише тепла підлога)» | текст вместо select при `ufhPresetId === 'ufh_only'` (`:54-65`) | — | — | select скрыт | сервер жёстко ставит `condensing_dt30_55_45` (`normalizeHeatingUfhPreset.js:44-52`) | — | — |
| «Звіт з підбору котла» | button | — | — | `disabled={!canOpenReport}` (`:108`) | — | disabled | — |

**Шаг не даёт выбрать котёл** (замешательство U1/U2 из U5) — подтверждено: единственный
контрол шага задаёт температурный график; сам котёл подбирается сервером.
`supplyC`/`returnC` в UI недоступны вообще и **безусловно перезаписываются пресетом**
(`backend/src/logic/heatingThermalRegimes.js:57-77`) — отсюда F-11/N-19.

Заголовок секции — «Котел: температурний графік опалення» (`constants/surveySteps.ts:30`).
Подсказка шага (`AppSurveyContent.tsx:461-466`) прямо говорит: «Підводка та тип приладів —
на кроці «Радіатори». Сценарій ГВП і підбір БКН/електробойлера — на кроці «Водонагрівач».»

### 3.6 `radiators` — «Радіатори»

| Поле (укр. дословно) | Тип / id | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Підводка радіаторів» | select `#radiator-connection`: «Бічне підведення (K / Klasik)», «Нижнє підведення (VK / VKP)» (`shared/radiatorConnection.js:15-18`) | нет | нет | enum-guard `isRadiatorConnection` (`:78`) | enum `side\|bottom`, схемный `default: side` (не применяется — `useDefaults` выключен) (`CalcInput.yaml:134-137`) | `side` | нет |
| «Тип радіаторів на об'єкт» | select `#radiator-emitter-preference`: «Авто (єдиний тип за об'єктом)», «Лише секційні», «Лише панельні» (`shared/radiatorEmitterPreference.js:21-34`) | нет | нет | enum-guard (`:112`) | enum `auto\|sectional\|panel` (`CalcInput.yaml:143-146`) | `auto` | нет |
| «Звіт з розрахунку радіаторів» | button | — | — | `disabled={!canOpenReport}` | — | disabled | — |

При `ufhPresetId === 'ufh_only'` оба селекта `disabled` + сообщение
`role="status"` (`AppSurveyContent.tsx:628-632`, `RadiatorsSurveyForm.tsx:61-65`) —
текст содержит разработческий жаргон «heatingSystem» и «matching.radiators» (F-11).

### 3.7 `waterHeater` — «Водонагрівач»

| Поле (укр. дословно) | Тип / id | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Як котел пов'язаний із гарячою водою» | select `#water-heater-scheme`, 5 опций (`shared/heatingMatchingSchemes.js:37-63`) | нет | нет | список фильтруется: для «малой» квартиры схема 1К+БКН скрыта (`waterHeaterSchemeOptions.ts:39-48`); при недоступности — авто-сброс на `MAX_COMBI` (`AppSurveyContent.tsx:359-383`) | enum из 5 (`CalcInput.yaml:151-158`) | `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw` (`waterHeaterFormDefaults.ts:12`) | нет |
| «Є техприміщення або ніша під бойлер непрямого нагріву (БКН). Без цієї позначки для квартири підбір БКН не виконується.» | checkbox без `id`, показ при `shouldShowIndirectDhwSpaceCheckbox` (`:72-75`, `:127-144`) | нет | нет | — | `indirectDhwSpaceAvailable: boolean`; сервер молча меняет схему и пишет warning (`validate.js:775-778`) | `false` | нет |
| «Звіт з підбору водонагрівача» | button | — | — | `disabled={!canOpenReport}` | — | disabled | — |

Подсказка содержит **разработческий жаргон в UI**: «В API: `heatingSystem.hotWaterBoilerPowerMatchingScheme`»
(`WaterHeaterForm.tsx:119-125`) — F-11, якорь найден.
Блок «Підказки» (`role="status"`, `:152-161`) выводит `validateWaterHeaterForm(...).warnings`
— единственная в анкете клиентская доменная валидация с выводом на экран.

### 3.8 `hydraulics` — «Гідравліка»

| Поле (укр. дословно) | Тип / id | Обяз. факт. | Помечено | Валидация клиента | Границы схемы сервера | Дефолт | Блокирует переход |
|---|---|---|---|---|---|---|---|
| «Тип розводки системи опалення» (legend) → «Авто (оптимальний підбір системи)» / «Двотрубна з «тупиками»» / «Двотрубна прохідна (петля Тіхельмана)» / «Колекторна променева (виділена)» | radio `#wiring-system-${value}`, `name="wiringSystemType"` (`:86-115`; подписи `utils/wiringSystemTypeLabels.ts:19-48`) | нет | нет | enum UI | enum `auto\|two-pipe-dead-end\|two-pipe-pass\|manifold` (`HydraulicsSurveyInput.yaml:20-23`) | `auto` (бейдж «Рекомендовано») | нет |
| «Довжина магістралі котел → колектор, м» | number **без `id`**, wrapping `<label>` (`:119-133`) | нет | нет | `attr min 0 step 0.5`; `Number(...) \|\| 0`, **отрицательные проходят** | `min 0`, max нет (`HydraulicsSurveyInput.yaml:7`) | `8` (`types/hydraulics.ts:14`) | нет |
| «Δt системи опалення (радіатори), K» | number **без `id`** (`:135-150`) | нет | нет | `attr min 1 max 30 step 1`, **clamp ОТСУТСТВУЕТ**; `Number(...) \|\| 20` | **`1…30`** (`HydraulicsSurveyInput.yaml:11`) | `20` | нет |
| «Перевага матеріалу труб (опційно)» | select **без `id`**: «Авто (з каталогу)» / «PEX» / «Металопластик» / «Сталь» (`:152-168`) | нет | нет | enum UI | enum `pex\|metal_plastic\|steel` (`HydraulicsSurveyInput.yaml:16-18`) | `''` (не отправляется) | нет |
| «Підводи колектор → радіатор, м» → «Довжина, м» | number без `id`, по строке на комнату (`:220-232`) | нет | нет | `attr min 0 step 0.5`; `Number(...) \|\| 0` | `min 0` (`RadiatorBranchOverride.yaml:7`) | `4` или `min(mainLineLengthM, 8)` (`migrateDerivedState.ts:56-61`) | нет |
| «Порядок» → кнопки `↑`/`↓` с `aria-label="Вище: {имя}"` / `"Нижче: {имя}"` | button (`:197-214`) | — | — | видны только при `two-pipe-dead-end`/`two-pipe-pass` (`:52-54`) | порядок массива overrides | порядок комнат | — |
| «Звіт з гідравліки» | button | — | — | `disabled={!canOpenReport}` | — | disabled | — |

Пустое состояние без комнат: «Додайте приміщення на кроці «Приміщення», щоб задати довжини
підводів до радіаторів.» (`:240-243`).

### 3.9 `technicalResult` — «Результат технічний»

Только чтение (`components/RecommendationsBlock/RecommendationsBlock.tsx`).
Заголовок `<h2 id="calculation-results-title">Результати розрахунку</h2>` (`:83`).

| Блок | Условие показа | Якорь | DOM-якорь |
|---|---|---|---|
| Источник каталога («Підбір обладнання виконано за каталогом із бази даних (MongoDB).» / «Підбір за файловим каталогом. …») | `apiCatalogSource != null` | `:85-91` | нет id (F-11: «MongoDB» в UI клиента) |
| «Оновлення розрахунку на сервері… Показано дані попередньої відповіді до завершення перерахунку.» | `calcLoading \|\| reportIsStale \|\| uiPhase==='recalculating'` | `:93-97` | `role="status" aria-live="polite"` |
| «Рекомендації щодо схеми котел / ГВП» + кнопка «Застосувати схему в анкеті» | `apiAutomationHints.length > 0` | `:99-123` | `role="status"` |
| «Тепловтрати» (`HeatLossSummaryTable`) | **всегда** | `:127-130` | `id="results-heat-loss"`, `aria-labelledby="heating-loss-title"` |
| Точки водоразбора (`HotWaterFixturesSummaryTable`) | есть ненулевые точки | `:133-137` | `id="results-hot-water"` |
| Итог ТП (`UnderfloorHeatingSummaryTable`) | `apiUnderfloorHeatingFromReport != null` | `:139-147` | `id="results-warm-floor"` |
| Итог котла (`BoilerSummaryTable`) | `hasBoilerReportContent` | `:149-157` | `id="results-boiler"` |
| Итог радиаторов (`RadiatorsSummaryTable`) | `hasRadiatorsReportContent` | `:159-166` | `id="results-radiators"` |
| Итог гидравлики (`HydraulicsSummaryTable`) | `hasHydraulicsReportContent` | `:168-174` | `id="results-hydraulics"` |
| Итог ЭБ/БКН (`HotWaterSummaryTable`) | `hasHotWaterSummaryContent` | `:176-190` | `id="results-water-heater"` |
| Карточки котла economy/efficient | есть `tierEconomy`/`tierEfficient` | `:194-227` | `titleDomId="boiler-proposal-economy"` / `"…-efficient"` |
| «Радіатори · за варіантами» + «Варіант 1 · економ» / «Варіант 2 · ефективний» | есть линии подбора | `:239-258` | `tableId="radiators-line-economy"` / `"…-efficient"` |
| «Радіатори за варіантами не підбираються: режим «лише тепла підлога».» | `isRadiatorsMatchingSkipped` | `:260-264` | `role="status"` |
| Подбор труб (`HydraulicsProposalTable`) | всегда | `:266-268` | — |

**Таблица «Тепловтрати»** — 4 строки: «Загальна площа приміщень», «Потужність приміщень»,
«Запас (15%)», «Разом за теплом» (`HeatLossSummaryTable.tsx:49-75`), плюс подпись-источник
(`:79`). Именно эта таблица и есть заглушка ОТКАЗА B: при `apiHeatLoss == null` значения
берутся из `quickEstimate` (`:23-25`), который считает `площадь × 100 Вт/м²`
(`hooks/useSurveyEstimates.ts:43`).

### 3.10 `dataReference` — «Довідник даних»

`components/CatalogEquipmentReference/CatalogEquipmentReference.tsx` — read-only таблицы
`GET /api/v1/catalog`, есть кнопка повторной загрузки (`AppSurveyContent.tsx:708-710`).
Подпись источника — «Джерело: <strong>{srcLabel}</strong>. Повний перелік використовується
сервером для підбору;…» (`:153-154`). Данных анкеты не содержит; для E2E — только
smoke-проверка непустоты и обработки ошибки загрузки.

### 3.11 `financialResult` — «Підсумок фінансовий»

`components/FinancialSummary/FinancialSummaryTable.tsx`.

| Состояние | Текст | Якорь |
|---|---|---|
| Нет сметы | «Немає актуальної кошторису. Заповніть анкету та дочекайтеся розрахунку.» (`role="status"`) | `:139-141` |
| Идёт пересчёт, сметы нет | «Триває перерахунок…» | `:135-137` |
| Идёт пересчёт, смета есть | «Триває перерахунок — суми можуть оновитися…» | `:154-158` |
| Смета есть | заголовок `id="financial-summary-title"` «Підсумок фінансовий» | `:151-153` |

Колонки таблицы: «Тип об'єкта», «Тип обладнання», «Марка (модель)», «Кількість»,
«Ціна, грн», «Сума, грн» (`:168-173`).
Итоговые строки: «Разом за обладнанням» (`:208`), «Монтажні роботи ({n}%)» (`:218`),
«Витратні матеріали ({n}%)» (`:224`), «Загальна вартість об'єкта» (`:231`).
Мета-строка: «Валюта: {currency}. Монтаж {n}% і витратні матеріали {n}% від вартості обладнання.» (`:159-163`).

**Ни одна из строк не имеет `id` или `data-testid`** — ассерты возможны только по тексту
ячейки соседа, что ломается при малейшей смене формулировки.

---

## 4. Реестр расхождений «границы клиента ↔ границы схемы сервера»

Легенда колонки «Класс»:
- **A** — клиент допускает значение, которое сервер отвергнет ⇒ **400 без указания поля** (ОТКАЗ A);
- **B** — клиент строже сервера ⇒ часть допустимого API-диапазона недостижима из UI (не отказ, но дыра покрытия);
- **C** — доменное правило сервера, у которого на клиенте нет вообще никакого аналога;
- **=** — совпадает.

| # | Поле (укр.) | Клиент | Сервер | Класс | Якорь клиента | Якорь сервера |
|---|---|---|---|---|---|---|
| D-01 | «Всередині, °C» | **нет min/max, нет clamp**; очистка поля ⇒ `0` | required, `5…35` | **A** | `AppSurveyContent.tsx:489-498` (`Number` на `:495`) | `CalcInput.yaml:38`, `:40` |
| D-02 | «Зовні, °C» | **нет min/max, нет clamp** | `−60…40` | **A** | `AppSurveyContent.tsx:502-511` (`Number` на `:508`) | `CalcInput.yaml:41` |
| D-03 | «Ширина, мм» (окно) | `min 200`, **max нет** | `200…6000` | **A** | `RoomAccordionItem.tsx:916-926` | `EnvelopeElementInput.yaml:38` |
| D-04 | «Висота, мм» (окно) | `min 200`, **max нет** | `200…4000` | **A** | `RoomAccordionItem.tsx:933-943` | `EnvelopeElementInput.yaml:43` |
| D-05 | «К-сть однакових» | `min 1`, **max нет** | `1…50` | **A** | `RoomAccordionItem.tsx:970-978` | `EnvelopeElementInput.yaml:26` |
| D-06 | «ГВ, °C (55…60)» | атрибуты `55…60`, **clamp нет** | `55…60` | **A** | `HotWaterForm.tsx:131-140`, сеттер `:44-45` | `CalcInput.yaml:216` |
| D-07 | «Δt системи опалення (радіатори), K» | атрибуты `1…30`, **clamp нет** | `1…30` | **A** | `HydraulicsSection.tsx:137-149` | `HydraulicsSurveyInput.yaml:11` |
| D-08 | «Довжина магістралі котел → колектор, м» | `attr min 0`, **отрицательные проходят** | `min 0` | **A** | `HydraulicsSection.tsx:121-132` | `HydraulicsSurveyInput.yaml:7` |
| D-09 | «Довжина, м» (подвод к радиатору) | `attr min 0`, **отрицательные проходят** | `min 0` | **A** | `HydraulicsSection.tsx:220-232` | `RadiatorBranchOverride.yaml:7` |
| D-10 | «Товщина несучої стіни, мм» | атрибуты `50…2000`, **clamp нет** | `50…2000` | **A** | `ObjectMetaForm.tsx:376-400` | `BuildingObjectMeta.yaml:72` |
| D-11 | «Товщина утеплювача, мм» | атрибуты `30…300`, **clamp нет** | `30…300` + доменная проверка | **A** | `ObjectMetaForm.tsx:461-485` | `BuildingObjectMeta.yaml:88`, `externalWallsValidate.js:75-80` |
| D-12 | «Висота стелі котельні, м» | атрибуты `2.2…6`, **clamp нет** | `2…6` | **A** + B | `ObjectMetaForm.tsx:314-333` | `BuildingObjectMeta.yaml:41` |
| D-13 | «Площа, м²» (комната) | `attr min 0.1`, **clamp нет**, отрицательные проходят | `min 0.01`, max нет | **A** | `RoomAccordionItem.tsx:424-434` | `CalcInput.yaml:97` |
| D-14 | «Висота, м» (комната) | `attr min 1.8`, **clamp нет** | `min 0.01`, **max нет** | **A** + B | `RoomAccordionItem.tsx:442-452` | `CalcInput.yaml:98` |
| D-15 | «Площа, м²» (Стіна №1/№2, стена в коридор) | `attr min 0`, **clamp нет** | элемент `min 0.01`; `0` ⇒ элемент выбрасывается клиентом | **A** | `RoomAccordionItem.tsx:815-826`, `buildCalcRequestPayload.ts:111-112` | `EnvelopeElementInput.yaml:25` |
| D-16 | «Площа стелі, м²» | `attr min 0` | `min 0.01`; `0` ⇒ выбрасывается | **A** | `RoomAccordionItem.tsx:736-745`, `buildCalcRequestPayload.ts:149-150` | `EnvelopeElementInput.yaml:25` |
| D-17 | «Площа скатів покрівлі (за поверхнею), м²» | `attr min 0` | `min 0.01`; `0` ⇒ выбрасывается | **A** | `RoomAccordionItem.tsx:788-797`, `buildCalcRequestPayload.ts:137-138` | `EnvelopeElementInput.yaml:25` |
| D-18 | «Площа котельні, м²» | `attr min 0.1`, **clamp нет** | `min 0.01`, max нет | **A** + B | `ObjectMetaForm.tsx:290-308` | `BuildingObjectMeta.yaml:35` |
| D-19 | «Назва» комнаты | **пустое допускается** | required, `minLength 1` | **A** | `RoomAccordionItem.tsx:309-315`, payload `buildCalcRequestPayload.ts:69` | `CalcInput.yaml:55`, `:58` |
| D-20 | «Несуча стіна (без утеплювача)» и прочие селекты пресетов | при пустом списке из API `value=''`, ошибка не показывается | `minLength 1` / `EXTERNAL_WALLS_PRESET_REQUIRED` | **A** | `ObjectMetaForm.tsx:347`, `:352-354` | `BuildingObjectMeta.yaml:66`, `externalWallsValidate.js:29-31` |
| D-21 | «Кількість осіб» | **clamp 0…20** | `min 0`, **max нет** | **B** | `HotWaterForm.tsx:41-42`, `:95-97` | `CalcInput.yaml:209` |
| D-22 | «Кількість приміщень (1…50)» ↔ массив `building.rooms` | clamp `1…50` | `roomsCount 1…50`, но **массив `rooms` без `maxItems`** | **B** (асимметрия схемы) | `ObjectMetaForm.tsx:40-43` | `BuildingObjectMeta.yaml:18`, `CalcInput.yaml:49-51` |
| D-23 | «Площа, зайнята меблями … S<sub>meb</sub> (м²)» | `attr min 0`, **нет сравнения с площадью комнаты** | `min 0` **+ должно быть строго < `room.areaM2`** | **C** | `RoomAccordionItem.tsx:616-628` | `validate.js:464-472` |
| D-24 | Согласованность «Розташування приміщення» ↔ заполненные стены | **проверки нет вообще** | `ROOM_EXTERIOR_LAYOUT_WALLS`, 6 вариантов сообщения, **выбрасывается на первой плохой комнате** | **C** | `roomExteriorLayout.ts:160-192`, `buildCalcRequestPayload.ts:106-122` | `roomExteriorLayoutHeatLoss.js:163-205`, вызов `validate.js:368` |
| D-25 | «Заплановане встановлення котла» = «Окрема котельня / топочна» + метрики | **XOR-проверки нет**; оба поля можно оставить наполовину пустыми | `BOILER_ROOM_METRICS_INCOMPLETE` при заполнении ровно одного | **C** | `ObjectMetaForm.tsx:284-336` | `validate.js:700-707` |
| D-26 | Объём котельной ≥ 7,5 м³ | только текстовая подсказка | `BOILER_ROOM_VOLUME_INVALID` | **C** | `ObjectMetaForm.tsx:278-281` | `validate.js:719-724` |
| D-27 | `returnC < supplyC` | температуры подачи/обратки **в UI отсутствуют** | `HEATING_SYSTEM_INVALID` (`validate.js:341-346`), практически мёртвая — пресет уже перезаписал обе (`heatingThermalRegimes.js:57-77`) | **C** | — | `validate.js:341-346` |
| D-28 | ХВ < ГВ | ХВ фиксирована 5/15, ГВ ≥ 55 ⇒ недостижимо из UI | `HOT_WATER_TEMPS_INVALID` (`validate.js:353-358`) | **C** | `HotWaterForm.tsx:106-141` | `validate.js:353-358` |
| D-29 | «Повітря в санвузлі, °C» | `attr 24…35` + **clamp 24…35** | `24…35` | **=** | `AppSurveyContent.tsx:517-518`, `:532` | `CalcInput.yaml:42` |
| D-30 | Точки водоразбора ×9 | `attr 0…30` + **clamp 0…30** | `0…30` | **=** | `HotWaterForm.tsx:47-57` | `CalcInput.yaml:230-238` |

**Итого 30 позиций: 20 класса A (18 уникальных полей + 2 с двойным классом), 3 класса B,
6 класса C, 2 совпадения.**

### 4.1 Три системных вывода

**(1) `min`/`max` на `<input type="number">` в этом приложении не валидируют ничего.**
Форм с `<form>`/`submit` в анкете нет — значение уходит в состояние на каждый `onChange`,
а `min`/`max` браузер применяет только при валидации формы. Из 20 расхождений класса A
**девять** (D-06, D-07, D-10, D-11, D-12, D-13, D-14, D-18, плюс D-03/D-04/D-05 частично)
существуют **только потому, что рядом с атрибутом нет рантайм-клампа**. Шаблон клампа
в проекте уже есть в трёх местах (`AppSurveyContent.tsx:532`, `ObjectMetaForm.tsx:40-43`,
`HotWaterForm.tsx:24-27`) — их достаточно скопировать.

**(2) Все 25+ доменных проверок сервера отдают ответ БЕЗ `details`.**
`details` заполняется только для `VALIDATION_ERROR` (`validate.js:271-272`, `:282`);
`assertRoomExteriorLayoutWalls` конструирует ошибку вручную и `details` не ставит
(`roomExteriorLayoutHeatLoss.js:198-203`). Даже если фронт научится читать `details`
(F-01), для класса C он всё равно получит только текст сообщения и вынужден будет парсить
его регуляркой. Это надо заложить в план F-01: **две разные механики, а не одна**.

**(3) `removeAdditional: true` делает 200 ненадёжным оракулом.**
`backend/src/api/validate.js:80` + `additionalProperties: false` на всех 16 объектных узлах
схемы. Опечатка в имени поля или устаревшее поле из черновика исчезают без ошибки.
**Для E2E это значит: «200 OK» не доказывает, что расчёт сделан по отправленным данным.**
Проверять надо не статус, а эхо входа в отчёте либо конкретные числа результата.

---

## 5. Условные ветки UI

Матрица переключателей, меняющих состав последующих шагов. Это основа набора E2E-сценариев.

### 5.1 «Тип об'єкта»: Будинок ↔ Квартира

| Переключатель | Появляется | Исчезает | Якорь |
|---|---|---|---|
| → «Квартира» | «Поверх квартири в будинку» (шаг «Об'єкт»); в карточке комнаты — read-only «Межі (квартира в будинку)»; в схемах ГВС для «малой» квартиры исчезает вариант «Одноконтурний котел і бойлер непрямого нагрівання (БКН)»; появляется чекбокс «Є техприміщення або ніша під бойлер непрямого нагріву (БКН)» при выбранной схеме 1К+БКН | «Заплановане встановлення котла», «Площа котельні, м²», «Висота стелі котельні, м»; селекты «Нижня межа»/«Верхня межа» в комнате | `ObjectMetaForm.tsx:160-185`, `:257-338`; `RoomAccordionItem.tsx:372-417`; `waterHeaterSchemeOptions.ts:39-48`; `WaterHeaterForm.tsx:72-75`, `:127-144` |
| Побочно | границы и пресеты комнат **перезаписываются** по `apartmentStackPosition` | — | `useRoomsOrchestration.ts:212-259` |
| Побочно | подпись layout «Внутрішнє (стіна в загальний коридор під'їзду)» вместо «Внутрішнє (стіна в холодний коридор / тамбур)» | — | `RoomAccordionItem.tsx:471-475`, `roomExteriorLayout.ts:87-99` |
| Побочно | рекомендуемый график котла меняется (квартира → `condensing_dt30_55_45`) | — | `shared/heatingThermalRegimePresets.js:94-98`, применение `AppSurveyContent.tsx:276-284` |

**«Малая квартира»** определяется как `totalArea > 50` **или** `max(санузлов, ванна+душ) >= 2`
(`waterHeaterSchemeOptions.ts:19-32`) — то есть **зависит от уже заполненных комнат и точек ГВС**.
Значит порядок заполнения меняет доступный набор схем. Для E2E — отдельный кейс:
выбрать 1К+БКН на большой квартире, потом уменьшить площадь ⇒ схема **молча** сбрасывается
на `MAX_COMBI` (`AppSurveyContent.tsx:359-383`).

### 5.2 «Заплановане встановлення котла» (только дом)

| Значение | Появляется | Якорь |
|---|---|---|
| «Кухня (настінний)» / «Житлова зона (настінний)» | — | `ObjectMetaForm.tsx:274-275` |
| «Окрема котельня / топочна» | «Площа котельні, м²» + «Висота стелі котельні, м» | `ObjectMetaForm.tsx:284-336` |

### 5.3 «Утеплення фасаду»

| Значение | Появляется | Исчезает | Якорь |
|---|---|---|---|
| «Без утеплювача» | — | «Утеплювач СФТК»/«Мінеральна вата», «Товщина утеплювача, мм»; поля `insulationPresetId`/`insulationThicknessMm` **удаляются из состояния** | `ObjectMetaForm.tsx:79-93`, `:428-493` |
| «СФТК (мокрий фасад) — ППС 16Ф» | «Утеплювач СФТК» (список = только `DEFAULT_SFTK_INSULATION_PRESET_ID`) + «Товщина утеплювача, мм» (дефолт 100) | — | `ObjectMetaForm.tsx:94-101`, `usePresetLists.ts:33-35` |
| «Відкритий / вентильований фасад — мінвата» | «Мінеральна вата» (список = `insul_minwool_*`) + «Товщина утеплювача, мм» | — | `ObjectMetaForm.tsx:103-118`, `usePresetLists.ts:36-38` |

### 5.4 Режим ТП (карточки шага «Тепла підлога»)

| Карточка | `ufhPresetId` | `waterUnderfloorHeating` | Появляется | Исчезает | Якорь |
|---|---|---|---|---|---|
| «Лише радіатори» | `null` | принудительно `false` | — | «Схема підключення контуру ТП»; блок «Водяна тепла підлога» в каждой комнате; ТП во всех комнатах **гасится** | `migrateDerivedState.ts:74-86` |
| «Тепла підлога + радіатори» | `ufh_mixed_radiators` | принудительно `true` | «Схема підключення контуру ТП»; блок ТП в комнате | — | `migrateDerivedState.ts:87-99`, `WarmFloorSection.tsx:55-58` |
| «Опалення лише теплою підлогою» | `ufh_only` | принудительно `true` | блок ТП в комнате; на шаге «Котел» select заменяется текстом; на шаге «Радіатори» оба select `disabled` | **«Схема підключення контуру ТП» скрыта** (`ufhPresetId === 'ufh_only'`); `thermalRegimePreset` **молча** → `condensing_dt30_55_45` | `migrateDerivedState.ts:92-94`, `WarmFloorSection.tsx:57-58`, `BoilerSurveyForm.tsx:54-65`, `AppSurveyContent.tsx:628-632` |

Отдельный чекбокс «У проєкті передбачена водяна тепла підлога …» может быть снят при
выбранной карточке — тогда `ufhPresetId` тоже обнуляется (`migrateDerivedState.ts:106`).
**Две ручки на одну сущность** — обязательный E2E-кейс на рассогласование.

### 5.5 ТП в комнате (шаг «Приміщення»)

| Переключатель | Появляется | Якорь |
|---|---|---|
| Глобальный `waterUnderfloorHeating = true` | колонка «Водяна тепла підлога» с чекбоксом «Тепла підлога в цьому приміщенні» | `RoomAccordionItem.tsx:488-528` |
| Чекбокс комнаты включён | «Основа ТП (перекриття + стяжка)», «Фінішне покриття», «Бажаний крок укладки, мм», «Площа, зайнята меблями …» | `RoomAccordionItem.tsx:529-676` |
| Площадь комнаты `0 < S ≤ 20 м²` | «Регулювання контуру ТП (площа ≤ 20 м²)»: radio «Колектор теплої підлоги» / «Унібокс (локальний регулятор)» | `RoomAccordionItem.tsx:152-155`, `:630-667` |
| Площадь > 20 м² | радиогруппа исчезает; ранее выбранный `unibox` **молча деградирует** до `collector` и на клиенте (`:156-159`), и на сервере (`validate.js:485-488`) | `shared/ufhTerminalControl.js:26-31` |

**Униботы** — единственная ветка, зависящая от **числового** значения другого поля.
Кейс: включить унибокс на 15 м², затем изменить площадь на 25 м² ⇒ настройка исчезает
без уведомления.

### 5.6 «Верхня межа» комнаты (только дом)

| Значение | Появляется | Якорь |
|---|---|---|
| «Зверху тепле приміщення (стелю не враховувати)» | — | `RoomAccordionItem.tsx:411` |
| «Зверху холодна зона / горище (стеля)» | секция «Стеля»: «Стеля (пресет)» + «Площа стелі, м²» | `RoomAccordionItem.tsx:706-752` |
| «Покрівля (мансарда)» | секция «Покрівля»: «Покрівля (пресет)» + «Площа скатів покрівлі (за поверхнею), м²» + подсказка «Для мансарди верхня межа враховується як покрівля (скати), а не як стеля.» | `RoomAccordionItem.tsx:755-804`, `:1006-1010` |

### 5.7 «Розташування приміщення»

| Значение | Блоков стен | Подписи | Якорь |
|---|---|---|---|
| «На фасаді (одна зовнішня стіна)» | 1 | «Стіна №1» | `roomExteriorLayout.ts:101-111` |
| «Кутове / торцеве (дві зовнішні стіни)» | 2 | «Стіна №1», «Стіна №2» | `roomExteriorLayout.ts:112-126` |
| «Внутрішнє …» | 1 | «Стіна в загальний коридор під'їзду» (квартира) / «Стіна в холодний коридор / тамбур» (дом) | `roomExteriorLayout.ts:87-100` |

Смена на не-`corner` **обнуляет** площадь «Стіни №2», если она была > 0
(`roomExteriorLayout.ts:134-147`). Смена «Типу» комнаты на прихожая/коридор/тамбур
автоматически меняет layout на `internal` (`RoomAccordionItem.tsx:330-338`,
`roomExteriorLayout.ts:13`, `:27-29`) — **и тоже стирает вторую стену**.

### 5.8 Схема котёл/ГВС (шаг «Водонагрівач»)

| Схема | Одно- / двухконтурный котёл | Появляется | Якорь |
|---|---|---|---|
| `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw` | 2К | — | `shared/heatingMatchingSchemes.js:38-42` |
| `heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater` | 1К + ЭВН | — | `:43-47` |
| `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw` | 1К + БКН | для квартиры — чекбокс «Є техприміщення або ніша під бойлер непрямого нагріву (БКН)»; **скрыта для «малой» квартиры** | `:48-52`, `WaterHeaterForm.tsx:72-75`, `waterHeaterSchemeOptions.ts:43-47` |
| `combiBoilerWithBufferElectricStorage` | 2К + буферный ЭБ | — | `:53-57` |
| `singleCircuitBoilerWithBufferElectricStorage` | 1К + буферный ЭБ | — | `:58-62` |

Схема влияет на рекомендуемый график котла (`AppSurveyContent.tsx:251-258`, `:276-284`) —
пока пользователь не тронул select графика вручную (`thermalRegimeTouched`,
`runSurveyMutationPipeline.ts:28-31`), он **перезаписывается автоматически** при каждой
смене схемы или типа объекта.

### 5.9 Тип разводки (шаг «Гідравліка»)

| Значение | Появляется | Якорь |
|---|---|---|
| «Двотрубна з «тупиками»» / «Двотрубна прохідна (петля Тіхельмана)» | колонка «Порядок» с кнопками `↑`/`↓` + подсказка «Порядок рядків задає послідовність радіаторів на магістралі …» | `HydraulicsSection.tsx:52-54`, `:175-180`, `:194-217` |
| «Авто …» / «Колекторна променева (виділена)» | колонки «Порядок» нет | — |
| комнат нет | вместо таблицы — «Додайте приміщення на кроці «Приміщення», щоб задати довжини підводів до радіаторів.» | `HydraulicsSection.tsx:239-244` |

### 5.10 Итоговая матрица сценариев

Минимальный набор комбинаций, покрывающий все ветви (без перебора):

| # | Тип | Этажность | Фасад | Режим ТП | Униботы | Схема ГВС | Разводка | Что проверяет |
|---|---|---|---|---|---|---|---|---|
| S-1 | Квартира, середній поверх | 1 | none | Лише радіатори | — | 2К max-combi | Авто | базовый минимальный путь |
| S-2 | Квартира, останній поверх | 1 | СФТК | ТП + радіатори | 1 комната ≤20 м² | 1К+БКН (чекбокс вкл.) | Колекторна | квартира + БКН + униботы + «Верхня межа» ⇒ стеля |
| S-3 | Будинок | 1 | none | Лише радіатори | — | 1К + ЭВН | Двотрубна з «тупиками» | порядок радиаторов; дефолты границ одноэтажного дома (§7, N-12) |
| S-4 | Будинок | 2 | Вентильований | Лише тепла підлога | 2 комнаты | 2К + буферний ЭБ | Авто | `ufh_only`: скрытие графика, disabled-радиаторы, скрытая схема ТП |
| S-5 | Будинок + «Окрема котельня» | 3 | СФТК | ТП + радіатори | — | 1К+БКН | Прохідна | котельная (XOR + объём), мансарда «Покрівля» |
| S-6 | Квартира, перший поверх | 1 | none | Лише радіатори | — | 1К + буферний ЭБ | Авто | нижняя граница `unheated`; «малая» квартира ⇒ пропадание схемы 1К+БКН |

---

## 6. Стабильные селекторы: фактическое состояние и оценка работ

### 6.1 Факты (проверено командами)

```
grep -rn 'data-testid' frontend/src | wc -l   → 0
grep -rn 'data-test|data-qa|data-cy' …        → 0
grep -rn 'data-survey-step' frontend/src      → 5
```

Единственный существующий data-атрибут — `data-survey-step`
(`components/SurveyNavigation/SurveyStepLink.tsx:25`, обработка делегированием в
`RecommendationsBlock.tsx:42-48`). Он покрывает только inline-переходы из блока итогов.

Что есть вместо testid (в `.tsx`):

| Механизм | Количество | Комментарий |
|---|---|---|
| `id=` | **102** | почти все — на контролах форм |
| `htmlFor=` | **58** | связь label↔control ⇒ `getByLabel` работает |
| `aria-label=` | **65** | шапка, навигация, карточки комнат, кнопки порядка |
| `aria-labelledby=` | **35** | секции результатов, radiogroup, диалоги |
| `role=` | **70** | `status` (≈20), `alert`, `menu`, `menuitem`, `radiogroup`, `group`, `region` |

Отдельно есть **семь стабильных `id` секций результата** —
`constants/surveyResultsSections.ts:6-21`: `results-heat-loss`, `results-hot-water`,
`results-warm-floor`, `results-water-heater`, `results-radiators`, `results-boiler`,
`results-hydraulics`, плюс `calculation-results-title` (`:27`),
`boiler-proposal-economy` / `boiler-proposal-efficient`
(`RecommendationsBlock.tsx:208`, `:220`), `radiators-line-economy` / `radiators-line-efficient`
(`:249`, `:254`), `financial-summary-title` (`FinancialSummaryTable.tsx:151`),
`heating-loss-title` (`HeatLossSummaryTable.tsx:36`), `global-meta-title`
(`AppSurveyContent.tsx:431`), `start-screen-title` (`StartScreen.tsx:31`).

**Вывод: ситуация не «нет селекторов», а «селекторы есть, но это внутренние `id`,
не объявленные контрактом».** Их можно переименовать в любом рефакторинге без единого
предупреждения — `npm run verify` их не проверяет.

### 6.2 Где `getByLabel` / `getByRole` работают, а где ломаются

**Работают надёжно:**
- шаг «Об'єкт»: все 14 контролов формы имеют уникальные `id` + `htmlFor`
  (`ObjectMetaForm.tsx:123`, `:162`, `:188`, `:209`, `:230`, `:260`, `:287`, `:311`, `:341`,
  `:373`, `:409`, `:431`, `:458`, `:496`);
- три температурных поля используют **обёртывающий** `<label>` без `id`
  (`AppSurveyContent.tsx:487-537`) — implicit-ассоциация, `getByLabel('Зовні, °C')` работает
  и уникальна на странице;
- шаги «Котел», «Радіатори», «Водонагрівач», «Гаряча вода» — уникальные `id` на страницу;
- шапка: `getByRole('textbox', { name: 'Ім'я клієнта' })` (`Header.tsx:152`) и кнопки по
  тексту «Проєкти», «Зберегти», «Посилання», «PDF / Завантажити», «Вийти з проєкту»;
- меню PDF: `getByRole('menuitem', { name: 'Фінансовий підсумок (PDF)' })` (`Header.tsx:237-257`);
- левое меню шагов: `getByRole('navigation', { name: 'Етапи анкети' })` →
  `getByRole('button', { name: 'Приміщення' })` (`AppSurveyContent.tsx:406`, `:411-418`);
  текущий шаг помечен `aria-current="step"` (`:414`).

**Ломаются (перечислено полностью):**

| Проблема | Где | Почему |
|---|---|---|
| «Площа, м²» дублируется 2–3 раза **внутри одной комнаты** | `RoomAccordionItem.tsx:422` (комната), `:813` (Стіна №1), `:813` при `corner` (Стіна №2) | одинаковая подпись, разные `id`; заголовок блока «Стіна №1» — обычный `<div>`, не `<legend>`/`<fieldset>`, поэтому scope нет |
| «Площа, м²» дублируется **× число комнат** | все карточки в DOM одновременно | закрытые панели имеют `hidden` (`:300`), но Playwright в strict-режиме их всё равно считает |
| «Орієнтація» дублируется: стена №1, стена №2, каждое окно | `:829`, `:947` | — |
| «Ширина, мм» / «Висота, мм» / «К-сть однакових» / «Тип вікна» — × число окон | `:913`, `:930`, `:947`, `:967`, `:889` | заголовок «Вікно 1» — `<h4>`, не `aria-label` контейнера |
| «Висота, м» (комната) vs «Висота стелі котельні, м» (объект) vs «Висота, мм» (окно) | `:439`, `ObjectMetaForm.tsx:311`, `:930` | подстрочное совпадение при `getByLabel` без `exact: true` |
| «Приміщення» — 4 разных смысла | кнопка шага (`AppSurveyContent.tsx:409-418`), `<h2>` (`RoomsForm.tsx:111`), подпись типа комнаты (`roomTypes.ts:23`), `<th>` таблицы гидравлики (`HydraulicsSection.tsx:187`) | нужен `getByRole` + scope по `nav` |
| «Довжина, м» — по строке на комнату, без `id` и без `aria-label` | `HydraulicsSection.tsx:220-232` | различить можно только по `<td>` соседа с именем комнаты |
| «Довжина магістралі котел → колектор, м», «Δt системи опалення (радіатори), K», «Перевага матеріалу труб (опційно)» — без `id` | `HydraulicsSection.tsx:119-168` | implicit `<label>` работает, но подписи длинные и содержат `→` и `Δ` — хрупко к правкам текста |
| `role="status"` встречается ≈20 раз | `HotWaterForm.tsx:320`, `WaterHeaterForm.tsx:153`, `:184`, `BoilerSurveyForm.tsx:59`, `:127`, `RadiatorsSurveyForm.tsx:62`, `:155`, `HydraulicsSection.tsx:269`, `FinancialSummaryTable.tsx:135`, `:139`, `:155`, `RecommendationsBlock.tsx:94`, `:100`, `:261`, `Header.tsx:128`, `UfhPresetCards.tsx:32` … | `getByRole('status')` неоднозначен всегда |
| Ошибка расчёта — единственный `role="alert"` в анкете | `AppSurveyContent.tsx:393` | работает, но второй `role="alert"` есть в шапке (`Header.tsx:133`) и на share-странице (`SharePresentationPage.tsx:92`) |
| Кнопки «Звіт з …» и «Назад до результатів» — 6 пар с разными текстами | `SurveyReportActions.module.css` общий | текст различается, но «Назад до результатів» одинаков на 6 шагах (одновременно виден один) |
| Карточки режима ТП | `UfhPresetCards.tsx:37-59` | заголовки приходят **из API**, локальные — только fallback (`data/fallbackUfhModePresets.ts`) ⇒ ассерт по тексту зависит от содержимого Mongo |
| Строки финансовой таблицы | `FinancialSummaryTable.tsx:177-234` | ни одного `id`/`data-*`; сумма находится только через текст соседней ячейки |
| Строки таблицы «Тепловтрати» | `HeatLossSummaryTable.tsx:47-76` | то же |

**Обходной путь без правок кода** (работает, но дорог в поддержке):
`page.locator('#area-r1')`, `#externalWall1-area-r1`, `#win-w-r1-0`.
`room.id` детерминирован: комнаты создаются как `r${i}` при росте `roomsCount`
(`useRoomsOrchestration.ts:140`) и усекаются с хвоста (`:134`), кнопки удаления комнаты
нет вообще. То есть `#area-r3` устойчив **пока не изменится внутренняя схема id** —
контракта на это нет.

### 6.3 Оценка объёма: сколько `data-testid` нужно и куда

Подсчёт по фактическому числу интерактивных и ассертируемых узлов
(шаблонизированные атрибуты считаются как одно выражение в коде):

| Область | Атрибутов | Файлы |
|---|---|---|
| Левое меню шагов (11 кнопок + контейнер) | 12 | `AppSurveyContent.tsx` |
| Шаг «Об'єкт» (14 контролов + 3 температуры) | 17 | `ObjectMetaForm.tsx`, `AppSurveyContent.tsx` |
| Шаг «Приміщення»: карточка + 24 поля комнаты + 6 полей окна + 2 кнопки | 33 | `RoomAccordionItem.tsx`, `RoomsForm.tsx` |
| Шаг «Гаряча вода»: 3 + 9 точек + 2 радио + чекбокс + 2 кнопки | 17 | `HotWaterForm.tsx` |
| Шаг «Тепла підлога»: 3 карточки + чекбокс + select + 2 кнопки | 7 | `WarmFloorSection.tsx`, `UfhPresetCards.tsx`, `UfhDistributionSelect.tsx` |
| Шаг «Котел» | 3 | `BoilerSurveyForm.tsx` |
| Шаг «Радіатори» | 4 | `RadiatorsSurveyForm.tsx` |
| Шаг «Водонагрівач» | 5 | `WaterHeaterForm.tsx` |
| Шаг «Гідравліка»: 4 радио + 3 поля + строка/длина/2 кнопки порядка + 2 кнопки | 13 | `HydraulicsSection.tsx` |
| «Результат технічний»: 7 секций + маркер источника + 2 карточки котла + 2 таблицы радиаторов + hints + баннер пересчёта | 15 | `RecommendationsBlock.tsx`, `HeatLossSummaryTable.tsx`, summary-таблицы |
| «Підсумок фінансовий»: таблица, строки-группы, 4 итоговых строки, пустое состояние | 8 | `FinancialSummaryTable.tsx` |
| «Довідник даних»: контейнер + таблицы по типам оборудования | 10 | `CatalogEquipmentReference.tsx` |
| Шапка: 8 кнопок/полей + статус + ошибка | 10 | `Header.tsx` |
| Глобальные сообщения: ошибка расчёта, «Розрахунок…», баннер пересчёта, тост ссылки, cookie-баннер | 6 | `AppSurveyContent.tsx`, `ShareLinkToast.tsx`, `CookieConsentBanner.tsx` |
| Start screen + skeleton + error screen | 5 | `StartScreen.tsx`, `AppBootstrapSkeleton.tsx`, `BootstrapErrorScreen.tsx` |
| Share-страница | 7 | `SharePresentationPage.tsx`, `PublisherContactBlock.tsx` |
| Диалоги отчётов (6 модалок: контейнер + кнопка закрытия) | 12 | `*ReportDialog.tsx`, `ModalDialog.tsx` |
| Диалог проектов | 6 | `ProjectsDialog.tsx` |
| DevPanel (16 кнопок + `<pre>`) | 17 | `DevPanel.tsx` |
| **Итого** | **≈ 207** | **≈ 30 файлов** |

**Минимальный набор, закрывающий проходимость анкеты и ОТКАЗ A/B** (шаги, «Об'єкт»,
«Приміщення», «Гаряча вода», маркеры результата, шапка, сообщения об ошибках):
**≈ 100–110 атрибутов в ≈ 10 файлах.**

**Оценка трудозатрат** (только простановка, без написания тестов):

| Работа | Оценка |
|---|---|
| Соглашение об именовании + краткий раздел в `docs/` | 2–4 ч |
| Минимальный набор (~105 атрибутов, 10 файлов), включая шаблонизированные по `roomId`/`windowIndex` | 8–14 ч |
| Полный набор (~207 атрибутов, 30 файлов) | 18–28 ч |
| `frontend/scripts/verifyTestIds.mjs` — гейт «обязательные testid на месте» (по образцу существующих 10 verify-скриптов) | 4–8 ч |
| Прогон `npm run verify` (lint + typecheck + knip + build) и правки | 2–4 ч |
| **Итого минимальный вариант** | **16–30 ч** |
| **Итого полный вариант** | **26–44 ч** |

Правки чисто аддитивные: добавление атрибута к JSX-элементу не меняет поведения и не
конфликтует с `strictTypeChecked` ESLint. Риск — только в шаблонизированных атрибутах
внутри `RoomAccordionItem.tsx` (33 выражения в одном файле на 1014 строк).

### 6.4 Альтернатива на случай отказа от `data-testid`

Двухуровневая стратегия «scope + label»:

1. **Уровень scope** — уже существующие ARIA-контейнеры:
   - `getByRole('navigation', { name: 'Етапи анкети' })` (`AppSurveyContent.tsx:406`);
   - `getByRole('article', { name: 'Приміщення 1' })` — карточка комнаты
     (`RoomAccordionItem.tsx:270`, `aria-label={\`Приміщення ${index + 1}\`}`);
   - `getByRole('region', { name: /Приміщення 1/ })` — панель аккордеона
     (`:296-301`, `role="region" aria-labelledby={btnId}`);
   - `getByRole('radiogroup', { name: 'Режим опалення' })` (`UfhPresetCards.tsx:36`);
   - `getByRole('group', { name: 'Розрахункова температура холодної води' })` (`HotWaterForm.tsx:106`);
   - `locator('#results-heat-loss')` и остальные шесть `RESULTS_SECTION_IDS`.
2. **Уровень поля** — `getByLabel(..., { exact: true })` внутри scope.

**Что этим НЕ закрывается** (и требует правок кода в любом случае):
- «Площа, м²» комнаты vs «Площа, м²» стены **внутри одной карточки** — общего контейнера
  с доступным именем у блока стены нет (`RoomAccordionItem.tsx:807-852`: `<div className={fieldGroup}>`
  с `<div className={fieldGroupTitle}>`). Минимальная правка — превратить в
  `<fieldset><legend>Стіна №1</legend>` (**1–2 ч**), тогда
  `getByRole('group', { name: 'Стіна №1' }).getByLabel('Площа, м²')` станет однозначным;
- окна — та же правка на `<fieldset><legend>Вікно 1</legend>` (**1 ч**);
- строки таблиц результата и сметы — доступного имени у строки нет вообще, ассерт остаётся
  текстовым;
- «Довжина, м» в таблице подводов — нужен `aria-label={\`Довжина підводу: ${roomName}\`}`
  (**0.5 ч**), кнопки порядка такие подписи уже имеют (`HydraulicsSection.tsx:202`, `:211`);
- скрытые (`hidden`) карточки закрытых комнат — Playwright видит их локаторами; либо
  `.filter({ has: page.locator(':visible') })` в каждом хелпере, либо в коде рендерить
  только открытую панель (изменение поведения, **не рекомендуется**).

Хрупкость текстовой стратегии в целом: подписи меняются вместе с F-11 («убрать
разработческий жаргон и русские вкрапления») — то есть **план исправления проходимости
сам по себе сломает все текстовые ассерты**. Это решающий аргумент за `data-testid`
до начала работ по F-01…F-12, а не после.

---

## 7. Привязка к находкам живого прохода (ОТКАЗ A, ОТКАЗ B, F-01..F-12)

Для каждой находки: где в коде, что нужно изменить, чтобы кейс стал автоматизируемым, цена изменения.

### ОТКАЗ A — «Зовні, °C = 50»: 400 без указания поля

| Звено | Файл:строка |
|---|---|
| Поле без границ | `frontend/src/AppSurveyContent.tsx:502-511` (симметрично `insideC` — `:489-498`) |
| Схема сервера | `components/schemas/CalcInput.yaml:41` (`outsideC: −60…40`), `:40` (`insideC: 5…35`, required) |
| AJV собирает полный массив ошибок в `details` | `backend/src/api/validate.js:271-272`, `:282` |
| `details` уходит в конверт | `backend/src/index.js:190`, `:244-247` |
| Фронт извлекает только `error.message` | `frontend/src/services/calc.ts:64-77`, `frontend/src/utils/apiError.ts:9-17` |
| Единственный вывод ошибки на экран | `frontend/src/AppSurveyContent.tsx:388-398` (`role="alert"`) |

**Что нужно, чтобы кейс стал автоматизируемым.**
Сейчас тест может проверить только факт «на экране появился `role="alert"` с текстом
«Некоректні вхідні дані»» — это подтверждает наличие дефекта, но не даёт регрессионного
контроля после починки. Нужно:

1. Прокинуть `details` через `postCalc` (сейчас там `throw new Error(msg)` — `calc.ts:77`,
   структура теряется). Создать `CalcValidationError extends Error` с полем
   `details: AjvErrorLike[]` — **3–5 ч**.
2. В DOM добавить контейнер ошибок с адресами полей:
   `<ul data-testid="calc-errors"><li data-instance-path="/building/temps/outsideC">…</li></ul>` —
   **2–4 ч**. Тогда ассерт: `expect(page.getByTestId('calc-errors')).toContainText('outsideC')`
   либо точнее — по `data-instance-path`.
3. Маппинг `instancePath → шаг + элемент` и скролл к полю (это уже полноценный F-01) —
   **8–14 ч**; для автоматизации достаточно, чтобы у подсвеченного поля появлялся
   `aria-invalid="true"` и `aria-describedby` на текст ошибки. Ассерт становится
   `expect(page.getByLabel('Зовні, °C')).toHaveAttribute('aria-invalid', 'true')` — устойчивый,
   не зависящий от формулировки.

**Цена (только под автоматизацию, без полного F-01): 5–9 ч.**
Полная починка + автоматизируемость: **13–23 ч** (согласуется с оценкой F-01 12–20 ч).

**Важная поправка к плану F-01.** `details` есть **только** у `VALIDATION_ERROR`.
Все 25+ доменных проверок (`HEATING_SYSTEM_INVALID`, `ROOM_EXTERIOR_LAYOUT_WALLS`,
`UNDERFLOOR_HEATING_*`, `BOILER_ROOM_*`, `EXTERNAL_WALLS_*`, `VENTILATION_LEGACY_FIELD`,
`HOT_WATER_LEGACY_FIELD`, `ROOM_TYPE_INVALID`, `UFH_PRESET_INVALID`) отдают конверт
**без `details`**. Ошибка `assertRoomExteriorLayoutWalls` конструируется вручную
(`backend/src/logic/roomExteriorLayoutHeatLoss.js:198-203`) и `details` не ставит.
Дополнительно: `error.code` уже приходит на фронт в конверте, но фронт его не читает
(`apiError.ts:9-17` берёт только `message`). **Минимальная правка с максимальным эффектом
для тестов — вынести `error.code` в DOM** (`data-error-code`): 25+ доменных кейсов
получают устойчивый ассерт без текстовых регулярок. **1–2 ч.**

### ОТКАЗ B — пустая «Площа, м²» у «Стіна №1»: расчёт молча не запускается

**Локализация — полная.**

| Звено | Файл:строка |
|---|---|
| Гейт запуска расчёта | `frontend/src/surveySession/buildCalcInputSnapshot.ts:40-68` (`canAutoCalcFromDraft`) |
| Использование гейта | `SurveySessionProvider.tsx:84` → `useSurveyCalc.ts:59-63` (`autoEnabled`) |
| Стена с площадью `0` выбрасывается из payload | `frontend/src/services/buildCalcRequestPayload.ts:111-112` |
| Заглушка «швидка оцінка» — расчёт | `frontend/src/hooks/useSurveyEstimates.ts:41-49` (`площадь × 100 Вт/м²` на `:43`) |
| Заглушка — рендер и подпись | `frontend/src/components/HeatLossReport/HeatLossSummaryTable.tsx:23-28`, вывод подписи `:79` |
| Таблица всегда показывается, даже без отчёта | `frontend/src/components/RecommendationsBlock.tsx:126-131` |
| Смета пуста | `frontend/src/components/FinancialSummary/FinancialSummaryTable.tsx:128-144` |
| Вторая фаза (400 по одной комнате) | `backend/src/logic/roomExteriorLayoutHeatLoss.js:163-205`, вызов `backend/src/api/validate.js:368` |

**Почему «отримано: 0» получает даже тот, кто layout не задавал.**
`normalizeRoomExteriorLayouts` (`validate.js:367`) сначала **записывает**
`roomExteriorLayout`, а инференс для комнаты без единой стены возвращает `'facade'`
(`roomExteriorLayoutHeatLoss.js:72-78`). Следующей строкой `assertRoomExteriorLayoutWalls`
требует ровно одну фасадную стену → сообщение обвиняет пользователя в значении,
которого он не отправлял. Для E2E это значит: **ассерт по тексту сообщения проверяет
не пользовательский ввод, а серверный дефолт** — тест будет «зелёным» на неверном поведении.

#### Как тест отличит настоящий результат от заглушки — четыре варианта

| # | Способ | Работает сегодня | Надёжность | Цена |
|---|---|---|---|---|
| 1 | Текст подписи: «Джерело: швидка оцінка (100 Вт/м²)» vs «Джерело: розрахунок API за огородженнями» (`HeatLossSummaryTable.tsx:26-28`) | **да** | **низкая**: строка без `id`; **и главное — не отличает свежий отчёт от устаревшего** (после 400 отчёт остаётся, `runSurveyMutationPipeline.ts:144-153`) | 0 ч |
| 2 | `page.waitForRequest('**/api/v1/calc')` с таймаутом | да | **низкая**: провал = отсутствие запроса, то есть проверяется таймаутом; плюс dedup (`useSurveyCalc.ts:69-72`) даёт ложноотрицательные — payload не изменился, POST законно не ушёл | 0 ч |
| 3 | Чтение `localStorage['heatcalc:survey-draft:v1'].lastCalcReport` (`buildSurveyDraft.ts:66`) | **да** | **средняя**: отчёт попадает в storage только со **следующей** записью, потому что приход отчёта не меняет `calcInputKey` (`useSurveyDraftPersistence.ts:61`); нужен искусственный «пинок» | 0 ч |
| 4 | DevPanel → кнопка «Report» → `JSON.parse(<pre>)` (`DevPanel.tsx:172-181`) | **да, но только при `import.meta.env.DEV`** | **высокая**: полный отчёт из состояния сессии | 0 ч |

**Вывод по автоматизируемости ОТКАЗА B: кейс автоматизируем уже сегодня, но ни один
из четырёх способов не даёт одновременно надёжности и работы на production-билде.**
Вариант 4 — рабочее решение для CI (E2E против `npm run dev`), варианты 1+3 — костыль
для прогонов против собранного билда.

#### Что нужно изменить в коде

**Минимум (обязателен) — маркер источника и фазы, 3–5 ч:**

- `HeatLossSummaryTable.tsx:79` → добавить
  `data-testid="heatloss-source"` и `data-source={apiHeatLoss ? 'api' : 'quick-estimate'}`.
  Ассерт становится атрибутным и не зависит от формулировки. **1 ч.**
- Корневой контейнер анкеты (`AppSurveyContent.tsx:425` `<main ref={mainColumnRef}>`) →
  `data-calc-phase={uiPhase}` и `data-report-epoch={sessionState.reportEpoch}`.
  Оба значения **уже есть в состоянии** (`surveySession/types.ts:72`, `:73`) — вычислять
  ничего не надо. Даёт: ожидание `[data-calc-phase="stable"]` вместо таймаутов,
  и обнаружение «отчёт не обновился» через неизменившийся `data-report-epoch`. **2–3 ч.**
- Итоговый ассерт ОТКАЗА B становится:
  `await expect(main).toHaveAttribute('data-calc-phase', 'stable')` **и**
  `await expect(source).toHaveAttribute('data-source', 'api')` — два независимых условия,
  каждое устойчиво к правкам текстов.

**Полноценно (решает и продуктовую проблему, и автоматизацию) — 10–18 ч:**

- `canAutoCalcFromDraft` вернуть не `boolean`, а `{ ok: boolean; missing: MissingField[] }`
  (`buildCalcInputSnapshot.ts:40-68`) — все три условия уже разделены, нужно только
  собирать причины вместо ранних `return false`. **4–6 ч.**
- Заменить таблицу-заглушку блоком «яких даних не вистачає» с
  `data-testid="calc-blocked-reason"` и списком `data-missing-field="rooms/r2/externalWall1.areaM2"`.
  Это и есть F-02, и одновременно самый устойчивый из возможных ассертов. **6–12 ч.**

**Дополнительно (устраняет ложные срабатывания варианта 1) — F-07, см. ниже.**

### F-01 — показывать `details[]` рядом с полем

- **Где:** `frontend/src/services/calc.ts:64-77`, `frontend/src/utils/apiError.ts:9-17`,
  `backend/src/api/validate.js:271-277`, вывод — `AppSurveyContent.tsx:388-398`.
- **Для автоматизации:** `data-testid="calc-errors"` + `data-instance-path` на каждой строке
  ошибки + `aria-invalid`/`aria-describedby` на самом поле + `data-error-code` на контейнере.
- **Цена автоматизируемости:** 3–6 ч поверх самой починки. **Оценка U5 12–20 ч подтверждается**,
  но с поправкой: `ajv-i18n` покрывает только `VALIDATION_ERROR`; доменные сообщения уже
  украинские (кроме одного русского — `normalizeHeatingUfhPreset.js:24-30`
  «Неизвестный ufhPresetId …»), их локализовать не нужно, нужно только отобразить.

### F-02 — убрать заглушку «швидка оцінка (100 Вт/м²)»

- **Где:** `HeatLossSummaryTable.tsx:23-28`, `:79`; источник чисел `useSurveyEstimates.ts:41-49`;
  безусловный рендер `RecommendationsBlock.tsx:126-131`.
- **Побочные потребители `quickEstimate`,** которые тоже надо решить: `boilerKw`
  (`useSurveyEstimates.ts:48`) уходит в `BoilerSummaryTable` как `requiredKwFallback`
  (`RecommendationsBlock.tsx:154`), `radiatorsSections` (`:49`) — в `useCalcReport`
  (`AppSurveyContent.tsx:319`). То есть заглушка живёт **в трёх местах, а не в одном** —
  это увеличивает объём F-02 относительно оценки U5.
- **Для автоматизации:** `data-testid="calc-blocked-reason"` + `data-missing-field` (см. выше).
- **Цена:** 8–16 ч (оценка U5 подтверждается) + 2–3 ч на маркеры.

### F-03 — пометить обязательные поля и незавершённые шаги

- **Где:** `constants/surveySteps.ts` (SSOT шагов, сейчас только подписи), карточка комнаты
  `RoomAccordionItem.tsx`, левое меню `AppSurveyContent.tsx:409-420`.
- **Ключевой факт:** `grep -n 'required' frontend/src/components/RoomsForm/RoomAccordionItem.tsx`
  и по всей анкете — атрибута `required` нет ни на одном контроле; звёздочек и слова
  «обов'язково» в подписях нет.
- **Для автоматизации:** пометка обязательности как `required` + `aria-required="true"`
  на самих полях даёт ассерт `getByLabel('Площа, м²').toHaveAttribute('aria-required')`;
  пометка незавершённого шага в меню — `data-step-status="incomplete|complete"` на кнопке
  шага. Оба — атрибутные ассерты, не текстовые. **3–4 ч поверх починки.**
- **Цена:** 12–20 ч (оценка U5 подтверждается).

### F-04 — синхронизировать границы UI со схемой

- **Где:** `AppSurveyContent.tsx:489-498` (`insideC`), `:502-511` (`outsideC`);
  схема — `CalcInput.yaml:40-41`.
- **Поправка по объёму:** это не 2 поля, а **20** (§4, класс A). Шаблон клампа уже есть
  в трёх местах, но **правильная правка — не `min`/`max`, а рантайм-клампа**, иначе
  расхождение сохранится (§4.1, вывод 1).
- **Для автоматизации:** после клампа кейс «ввести 50 → значение стало 40» проверяется
  через `toHaveValue('40')` — без сервера и без сети. Дополнительно нужен маркер
  «значение скорректировано» (`data-clamped="true"` или видимая подсказка), иначе тест не
  отличит клампу от игнорирования ввода. **1–2 ч на маркер.**
- **Цена:** 3–6 ч на два температурных поля (как в U5); **10–18 ч на все 20 полей** реестра §4.

### F-05 — кросс-проверка `outsideC < insideC`

- **Где:** на сервере — нет (`grep outsideC backend/src/api/validate.js` → 0 совпадений,
  подтверждено); на клиенте — нет.
- **Для автоматизации:** после появления проверки кейс автоматизируется тривиально
  (это станет класс A с известным `data-error-code`). Сегодня же тест может проверять
  только конечное число (отрицательные теплопотери в отчёте) — то есть кейс относится
  к покрытию расчётного ядра, а не к E2E.
- **Цена:** 4–8 ч (оценка U5 подтверждается), маркеров сверх F-01 не требуется.

### F-06 — кнопки «Зберегти» / «Посилання» / «PDF» у анонима

- **Где:** `frontend/src/hooks/useSurveyProject.ts:499-503` — условия активности:
  `canPrintPdf = hasFinancialReport && canRunCalc`, `canPublishShare = Boolean(clientName.trim()) && canPrintPdf`,
  `canSaveProject = Boolean(clientName.trim())`. **Ни одно не смотрит на авторизацию.**
- **Механика 401:** «PDF / Завантажити» → `printPdf` (`:371-399`) → `ensureProjectSaved()`
  (`:383` → `:285-312`) → `saveProjectMutation` → `POST /api/v1/projects` → 401.
  То же для «Посилання» (`copyPublicLink` → `ensureProjectSaved` — `:331`).
  Ошибка выводится в шапке через `showErr` → `Header.tsx:132-136` (`role="alert"`).
- **Для автоматизации:** кнопки уже находятся по тексту; ассерт «аноним получает 401» —
  `expect(page.getByRole('alert')).toContainText('Authorization')`. Устойчивее — вывести
  `data-error-code` (см. ОТКАЗ A) и `data-auth-required` на кнопке. **1–2 ч.**
- **Цена:** 6–12 ч (оценка U5 подтверждается).

### F-07 — инвалидировать результат при ошибке

- **Где:** `frontend/src/surveySession/runSurveyMutationPipeline.ts:144-153`
  (`applyCalcResponseFail` не трогает `report`), потребитель —
  `useSurveyProject.ts:499-502` (`canPrintPdf` считается по сохранённому `lastCalcReport`).
- **Почему это критично именно для тестов:** пока отчёт не сбрасывается, **подпись
  «Джерело: розрахунок API за огородженнями» остаётся истинной при неверном входе**,
  и вариант 1 ассерта ОТКАЗА B даёт ложноположительный результат. То есть **F-07 —
  предпосылка достоверности E2E, а не просто UX-дефект.**
- **Для автоматизации:** `data-report-epoch` (см. ОТКАЗ B, минимум) + `data-calc-phase="error"`
  на корне. Ассерт «после ошибки экспорт заблокирован»:
  `expect(page.getByRole('button', { name: 'PDF / Завантажити' })).toBeDisabled()`.
- **Цена:** 4–8 ч (оценка U5 подтверждается), маркеры входят в 2–3 ч из ОТКАЗА B.

### F-08 — сохранять текущий шаг в черновике

- **Где:** `hooks/useSurveyDraftPersistence.ts:61` — зависимости эффекта
  `[bootstrapMode, calcInputKey, clientName, projectId]`; `currentStep` в `calcInputKey`
  не входит (`utils/surveyCalcInputKey.ts:57-117`).
- **Поправка:** шаг **сохраняется и восстанавливается** (`buildSurveyDraft.ts:50`,
  `surveyDraftBridge.ts:22`, `migrateSurveyDraft.ts:128-135`) — не сохраняется только
  **изменение шага само по себе**.
- **Для автоматизации:** дополнительных маркеров не нужно — текущий шаг уже читается
  по `aria-current="step"` (`AppSurveyContent.tsx:414`).
- **Цена: 0.5–1 ч** (добавить `draft.currentStep` в массив зависимостей),
  а не 2–4 ч как в U5.

### F-09 — потеря «Ім'я клієнта» и сброс «Товщина несучої стіни»

**(а) «Ім'я клієнта» → «Без имени».**
Литерал — `frontend/src/utils/buildSurveyDraft.ts:44`:
`const name = params.clientName.trim() || 'Без имени';`.
Состояние `clientName` живёт в `SurveyAppRoot` (`SurveyAppRoot.tsx:87`) и при уходе на
`/login` компонент размонтируется (`AppRouter.tsx:57` рендерит `LoginPage` вместо
`SurveyAppShell`); возврат восстанавливает `clientName` из `draftMeta` (`AppRoot.tsx:42-47`),
то есть из черновика. Если между вводом имени и уходом черновик успел записаться с
непустым именем — потери нет; если запись прошла раньше ввода — сохранится `'Без имени'`.
`isPersistableSurveyDraft` дополнительно считает `'Без имени'` эквивалентом пустого
(`surveyDraftStorage.ts:54`). **Точный сценарий потери НЕ ПРОВЕРЕН живьём** — нужен прогон
с фиксацией порядка событий.

**(б) «Товщина несучої стіни» → 200 мм. Механизм найден, гонка детерминирована.**

1. Справочники грузятся **только после** перехода в `survey`:
   `useReferenceData({ enabled: calcEnabled })` — `routing/SurveyAppShell.tsx:43`,
   `calcEnabled = (mode === 'survey')` — `:29-31`.
2. Черновик применяется **синхронно на mount**, в `useLayoutEffect`
   (`useSurveyBootstrap.ts:79-99`) — то есть **всегда раньше** прихода пресетов.
3. Эффект синхронизации толщины: `hooks/useRoomsOrchestration.ts:177-209`.
   `presetChanged = lastWallPresetIdRef.current !== presetId`; при первом прогоне
   `lastWallPresetIdRef.current === null` (`:175`) ⇒ `presetChanged === true` ⇒
   ранний выход `if (!presetChanged && current != null) return;` (`:187`) **не срабатывает**.
4. `next = options[0]` (`:190-191`) → `setObjectMeta` (`:200-203`).
5. Для пресета по умолчанию `wall_gas_concrete_d500`
   `thicknessOptionsMm: [200, 300, 375, 400, 500]`
   (`frontend/src/data/fallbackEnvelopePresets.ts:30`) ⇒ **`options[0] === 200`**.
   Значение `300` из дефолтного черновика (`createDefaultSurveyDraft.ts:62`) затирается.

**Это не «плавающая» гонка, а детерминированная последовательность** — вопрос U5
«нужен детерминированный сценарий» закрыт. Сценарий: заполнить анкету → перезагрузить
страницу → проверить `#wallThicknessMm`.
**Исправление:** `presetChanged` не должен считаться `true` на первом прогоне при уже
заданном `thicknessMm` — инициализировать `lastWallPresetIdRef` значением из черновика.
**1–2 ч** (а не 8–16 ч на весь F-09; оценка U5 покрывает оба подпункта).
**Для автоматизации маркеров не нужно** — поле имеет `id="wallThicknessMm"`.

### F-10 — две вкладки затирают друг друга

- **Где:** подписки на `window.addEventListener('storage', …)` **нет нигде**
  (`grep -rn "addEventListener('storage'" frontend/src` → 0 совпадений, проверено).
  Запись — `saveSurveyDraftToStorage` (`surveyDraftStorage.ts:33-36`), безусловный
  `setItem`, без сравнения версий и без merge.
- **Для автоматизации:** Playwright открывает две страницы в одном контексте
  (`context.newPage()`) — общее хранилище обеспечено. Ассерт: изменить поле в первой
  вкладке → изменить другое поле во второй → перезагрузить первую → проверить,
  что первое изменение пропало. **Маркеров не нужно, кейс автоматизируем сегодня.**
  Единственная сложность — синхронизация с debounce 400 мс (`useSurveyDraftPersistence.ts:14`):
  нужно ждать появления ожидаемого значения в `localStorage` через `page.waitForFunction`.
- **Цена починки:** 8–16 ч (оценка U5 подтверждается).

### F-11 — жаргон и русские вкрапления в UI

Найденные якоря (список для гейта `verify:language-policy`):

| Строка | Файл:строка |
|---|---|
| «В API: `heatingSystem.hotWaterBoilerPowerMatchingScheme`» | `WaterHeaterForm.tsx:119-125` |
| «В API: `heatingSystem.thermalRegimePreset`» | `BoilerSurveyForm.tsx:94-98` |
| «В API: `heatingSystem.radiatorConnection`» / «`heatingSystem.radiatorEmitterPreference`» | `RadiatorsSurveyForm.tsx:90-94`, `:122-128` |
| «Поля API: `heatingSystem.ufhPresetId` …» (только DEV) | `WarmFloorSection.tsx:122-129` |
| «Підбір обладнання виконано за каталогом із бази даних (MongoDB).» и «Підбір за файловим каталогом. Для використання БД: `CATALOG_SOURCE=auto` …, змінні `MONGODB_*` і колекція `Product` після seed.» | `RecommendationsBlock.tsx:87-90` |
| «Пресети несучого шару — з довідника API (`/api/v1/presets/envelope`, kind=wall).» | `ObjectMetaForm.tsx:366-368` |
| «Режим «лише тепла підлога» (`ufh_only`): підбір радіаторів на сервері пропускається… потрапляють у `heatingSystem`… на `matching.radiators` не впливають…» | `AppSurveyContent.tsx:630` |
| Дефолт «Без имени» (рус.) | `utils/buildSurveyDraft.ts:44`, `surveyDraftStorage.ts:54` |
| Дефолт «Комната 1» (рус.) | `createDefaultSurveyDraft.ts:36`, `useRoomsOrchestration.ts:141` |
| Канонические типы комнат по-русски в значении и в `cardMeta` («Тип: помещение») | `types/rooms.ts:6-16`, вывод — `RoomAccordionItem.tsx:285` |
| Опечатка **«Прална машина»** (должно быть «Пральна») | `HotWaterForm.tsx:286` |
| Русские `name` элементов в payload: «Пол», «Скаты кровли», «Потолок», «Окно {id}», `construction: 'наружная стена'`, `'пол'`, `'кровля'`, `'потолок'`, `'окно'`, `'стена в неотапливаемый коридор'` | `buildCalcRequestPayload.ts:129-132`, `:141-145`, `:153-157`, `:179-185`; `roomExteriorLayout.ts:11`, `:167`, `:181` |
| Русское серверное сообщение «Неизвестный ufhPresetId …» | `backend/src/logic/normalizeHeatingUfhPreset.js:24-30` |

**Почему это проходит `npm run verify:language-policy`: НЕ ПРОВЕРЕНО** — нужно прочитать
`frontend/scripts/verify*.mjs` и правила гейта. Гипотеза: проверяются только файлы `i18n/`,
а inline-JSX не сканируется.

**Влияние на E2E, критическое:** правки F-11 меняют подписи «Прална машина», названия
типов комнат в `cardMeta`, тексты подсказок. Любой текстовый ассерт по ним сломается.
**Это дополнительный аргумент делать `data-testid` ДО F-11, а не после.**

### F-12 — индикатор загрузки на расчёте

- **Где:** индикаторы **есть**: `AppSurveyContent.tsx:391` («Розрахунок…», `styles.hint`),
  `RecommendationsBlock.tsx:93-97` («Оновлення розрахунку на сервері…», `role="status"`),
  плюс «Оновлення розрахунку…» на 5 шагах-формах (`HotWaterForm.tsx:319-323`,
  `BoilerSurveyForm.tsx:126-130`, `RadiatorsSurveyForm.tsx:154-158`,
  `WaterHeaterForm.tsx:183-187`, `HydraulicsSection.tsx:268-272`).
- **Поправка к U5:** проблема не в отсутствии индикатора, а в том, что на первом расчёте
  пользователь чаще всего находится **не на том шаге**, где индикатор рендерится:
  «Розрахунок…» показывается только внутри `workArea` (`AppSurveyContent.tsx:746`) или
  вместо неё (`:749`), то есть на шаге `object` (у которого `workArea` нет —
  `surveySteps.ts:98-99`) он выводится, а вот на шагах-формах он теряется в конце секции.
  Глобального индикатора в шапке нет.
- **Для автоматизации:** `data-calc-phase` на корне (ОТКАЗ B, минимум) закрывает и это —
  тест ждёт `[data-calc-phase="recalculating"]` → `[data-calc-phase="stable"]`.
- **Цена:** 2–4 ч (оценка U5 подтверждается).

### Прочие места замешательства из U5

| Что | Локализация | Статус |
|---|---|---|
| Подсказка про напольные котлы и 7,5 м³ | `ObjectMetaForm.tsx:278-281` | **локализовано** (был открытый вопрос) |
| Шаг «Котел» не даёт выбрать котёл | `BoilerSurveyForm.tsx:67-101` — единственный контрол `#thermal-regime-preset` | **локализовано** |
| «Площа стіни» надо считать самому | `RoomAccordionItem.tsx:807-852` — калькулятора из периметра и высоты нет | **подтверждено** |
| Дом 1 этаж по умолчанию «зверху тепле приміщення» | `useRoomsOrchestration.ts:143` — новые комнаты получают `topBoundaryType: 'heated'`; **эффекта, корректирующего верхнюю границу для дома, нет вообще** (для нижней он есть — `:262-272`) | **локализовано; N-12 требует уточнения (ниже)** |
| Кнопка «назад» браузера выбрасывает из приложения | `routing/AppRouter.tsx:84` — все 11 шагов на `/` | **подтверждено** |

**Уточнение к N-12.** Нижняя граница для дома **корректируется автоматически**:
`defaultHouseBottomBoundary(floor)` даёт `'unheated'` для 1-го этажа
(`utils/apartmentStackBoundaries.ts:57-59`, применение `useRoomsOrchestration.ts:262-272`),
то есть потери через пол одноэтажного дома **учитываются**. Наблюдение U1
«Підлога — міжповерхове перекриття (квартира/сусіди)» относится не к границе, а к
**пресету** пола: `floorPresetId` безусловно ставится в `floorPresets[0]?.id`
(`useRoomsOrchestration.ts:116-117`), то есть в первый пресет из ответа API, независимо
от физики. **Верхняя граница действительно не корректируется никогда** — для дома всегда
`'heated'` (`:143`), значит потери через крышу/чердак одноэтажного дома по умолчанию
равны нулю. Итог: N-12 верен наполовину; корректная формулировка — «крыша не учитывается
по умолчанию + пресет пола выбирается первым попавшимся из справочника».
**Какой именно пресет идёт первым в ответе `GET /api/v1/presets/envelope` — НЕ ПРОВЕРЕНО.**

### Сводная таблица маркеров, которые надо добавить в код

| Маркер | Где | Закрывает | Цена |
|---|---|---|---|
| `data-calc-phase={uiPhase}` + `data-report-epoch={reportEpoch}` на `<main>` | `AppSurveyContent.tsx:425` | ОТКАЗ B, F-07, F-12, все ожидания вместо таймаутов | 2–3 ч |
| `data-source={apiHeatLoss ? 'api' : 'quick-estimate'}` + `data-testid="heatloss-source"` | `HeatLossSummaryTable.tsx:79` | ОТКАЗ B | 1 ч |
| `data-error-code={error.code}` на контейнере ошибки | `AppSurveyContent.tsx:393`, прокинуть из `calc.ts:77` | ОТКАЗ A, все 25+ доменных проверок | 1–2 ч |
| `data-instance-path` на строках `details[]` | новый компонент ошибок | ОТКАЗ A, F-01 | 2–4 ч |
| `data-testid="calc-blocked-reason"` + `data-missing-field` | новый блок вместо заглушки | ОТКАЗ B, F-02, F-03 | 4–6 ч (поверх F-02) |
| `aria-required`/`required` на обязательных полях | `RoomAccordionItem.tsx`, `AppSurveyContent.tsx` | F-03 | 1–2 ч |
| `data-step-status` на кнопках шага | `AppSurveyContent.tsx:411-418` | F-03 | 1–2 ч |
| `<fieldset><legend>Стіна №1</legend>` и `<legend>Вікно 1</legend>` | `RoomAccordionItem.tsx:807-852`, `:879-1000` | однозначность «Площа, м²» и «Ширина, мм» | 2–3 ч |
| `aria-label` на поле «Довжина, м» подвода | `HydraulicsSection.tsx:220-232` | шаг «Гідравліка» | 0.5 ч |
| **Итого маркеров (без самих починок)** | | | **14–25 ч** |

---

## 8. Тяжело воспроизводимые состояния

### 8.1 Восстановление из hash / share-ссылки

**Механика.** `#survey=<base64>` — `utils/surveyShare.ts:13`.
Кодирование: `JSON.stringify(draft без lastCalcReport)` → `encodeURIComponent` → посимвольно
в latin1 → `btoa` (`:67-77`). Декодирование зеркальное (`:83-97`), лимит
`MAX_HASH_JSON_BYTES = 51 200` **проверяется после `atob`, по длине JSON** (`:15`, `:94`).
Резолв — синхронно в `useState`-инициализаторе (`useSurveyBootstrap.ts:36-47`), затем
hash стирается `history.replaceState` (`resolveAppBootstrap.ts:34-38`).

**Что нужно для автоматизации.**
- Кодировщик придётся продублировать в тестовом хелпере (продуктовый — не экспортируемый
  из бандла модуль). Формула однозначна и стабильна: `btoa(латинизированный encodeURIComponent(JSON))`.
  **2–3 ч** на хелпер + фикстуры.
- Альтернатива дешевле: `page.addInitScript(() => localStorage.setItem('heatcalc:survey-draft:v1', ...))`
  — тот же эффект (ветка 2 резолва), без возни с base64, и **работает на production-билде**.
  **1 ч.** Рекомендуемый путь.
- **Ловушка:** черновик проходит `migrateSurveyDraft` (`surveyDraftStorage.ts:20`), который
  может молча изменить фикстуру (§2.7). Фикстуру нужно валидировать «round-trip»:
  записать → перезагрузить → сравнить с ожидаемым **после** миграции, а не до.
- **Ловушка 2:** после `DRAFT_LOADED` пресеты ещё не пришли ⇒ сработает сброс толщины
  стены (§8.7). Тесты, восстанавливающие черновик, обязаны это учитывать, иначе будут
  ловить «чужой» дефект.

**Публичная share-ссылка `/s/:shareToken`** — это другой механизм (серверный snapshot),
см. §8.4.

### 8.2 Импорт JSON проекта

**Механика.** Один общий скрытый `<input type="file" accept="application/json,.json">`
рендерится **всегда** в `SurveyAppRoot.tsx:272-280` (класс `styles.hiddenInput`).
Обработчик — `useProjectBundleTransfer.handleFileInputChange`
(`hooks/useProjectBundleTransfer.ts:109-124`).

**Критично для автоматизации:** обработчик читает `pendingModeRef.current`
(`:113`) и при `mode == null` **выходит молча** (`:115`). Режим ставится только
кнопками DevPanel: `requestImport` → `'import'` (`:126-129`),
`requestOpenLocal` → `'openLocal'` (`:131-134`).
Значит **`page.setInputFiles('input[type=file]', …) без предварительного клика по кнопке
DevPanel — это no-op.** Правильная последовательность:

```
Promise.all([
  page.waitForEvent('filechooser'),   // или setInputFiles сразу после клика
  page.getByRole('button', { name: '📤 Імпорт (Load JSON)' }).click(),
])
```

Два режима с разными эффектами:
- «Відкрити JSON» (`openLocal`) — только локальная сессия, `parseSurveyDraft` (`:96-98`);
- «📤 Імпорт (Load JSON)» — `POST /api/v1/projects/import`, требует JWT и `role=admin`
  (см. N-28: при **выключенном** `PROJECTS_AUTH_ENABLED` эндпоинт отдаёт `403 ADMIN_REQUIRED`).
Перед импортом — `window.confirm('Поточна анкета буде замінена імпортованим проєктом. Продовжити?')`
(`useSurveyProject.ts:139-144`) ⇒ нужен `page.on('dialog', d => d.accept())`.

**Оценка:** хелпер импорта черновика через `openLocal` — **2–3 ч**;
импорт bundle с авторизацией — блокируется N-28, оценивать после его разрешения.

### 8.3 DevPanel — вердикт как ускорителя E2E

**Условия показа** (`utils/isDevToolsEnabled.ts`):

| Среда | Условие | Якорь |
|---|---|---|
| `npm run dev` (localhost) | **всегда, без авторизации** — `isLocalDevRuntime()` = `import.meta.env.DEV` | `:10-12`, `:31` |
| Собранный билд | `VITE_DEV_TOOLS === '1'` **и** `VITE_APP_ENV === 'staging'` **и** `GET /api/v1/me` → `role === 'admin'` | `:18-22`, `:30-38` |
| Production | никогда | `:21` |
| Монтируется только в режиме `survey` | `SurveyAppRoot.tsx:307-340`; на StartScreen кнопки «Dev» нет | `docs/frontend-dev-panel.md` |

**Что даёт (16 кнопок, `DevPanel.tsx:119-176`):**

| Кнопка | Ценность для E2E |
|---|---|
| «Report» → `<pre>` c полным `calcReport` (`:172-181`) | **прямой оракул**: `JSON.parse(await page.locator('pre').innerText())`. Решает ОТКАЗ B и все проверки чисел без обращения к сети |
| «CalcInput» | payload, отправляемый на сервер — оракул для расхождений §4 и для `removeAdditional` (можно сверить, что поле реально уехало) |
| «Draft JSON» | состояние анкеты — оракул для миграций и потерь данных (F-09) |
| «Модули» | `commercial`/`matching`/`calculations`/`meta`/`warnings` — быстрая проверка N-14 (гидравлика упала молча) |
| «POST /api/v1/calc» (`:154`) | **немедленный расчёт без debounce 700 мс и без dedup** (`useSurveyCalc.ts:132-136`) — убирает главный источник флейков и экономит ~0.7 с на каждое изменение |
| «Відкрити JSON» / «📤 Імпорт» | подготовка состояния (§8.2) |
| «На сервер» / «На сервер + розрахунок» | подготовка проекта под share и PDF (§8.4, §8.5) |
| «Hash #survey=» | генерация hash-ссылки без дублирования кодировщика (§8.1) — но упирается в Clipboard API (`surveyShare.ts:103-109`), нужен `context.grantPermissions(['clipboard-read','clipboard-write'])` |
| «Відкликати share» | очистка состояния между тестами |
| Project id в шапке панели (`:115-118`) | достать `projectId` без парсинга сети |

**Вердикт: DevPanel — самый дешёвый и самый сильный ускоритель E2E из имеющихся,
но с жёсткой оговоркой.**

- **Плюс:** на `npm run dev` доступен всем, без Clerk, без `/me`, без флагов. Кнопка
  «Report» полностью решает проблему оракула ОТКАЗА B **без единой правки продукта**,
  а кнопка «POST /api/v1/calc» убирает debounce/dedup как источник нестабильности.
  Экономия по сравнению с построением собственных оракулов — оценочно **20–35 ч**.
- **Минус 1:** это **не тот билд, который едет в production**. `import.meta.env.DEV`
  включает и другие ветки (`WarmFloorSection.tsx:122-129` рендерит дополнительный блок
  только в DEV, `DevToolsDock.tsx:19` монтирует React Query Devtools). Тесты против
  dev-сервера проверяют не production-артефакт.
- **Минус 2:** на staging нужен `role=admin`, а `GET /api/v1/me` при выключенном
  `PROJECTS_AUTH_ENABLED` — **НЕ ПРОВЕРЕНО**, что именно возвращает; в связке с N-28
  (`403 ADMIN_REQUIRED` при выключенном auth) вероятность получить `role=admin`
  в герметичном режиме низкая.
- **Минус 3:** DevPanel не монтируется на StartScreen — сценарии cold open им не покрыть.

**Рекомендация:** двухуровневый набор.
Уровень 1 (быстрый, против `npm run dev`, DevPanel как оракул) — основная масса
функциональных E2E, ~80 % кейсов.
Уровень 2 (против `vite build` + `preview`, только DOM-маркеры из §7) — «золотой»
smoke-набор из 6 сценариев §5.10, который и есть гарантия production-артефакта.
Уровень 2 **невозможен без маркеров** `data-calc-phase`/`data-source` (14–25 ч из §7).

### 8.4 Share-страница глазами клиента

**Механика.** Роут `/s/:shareToken` → `SharePresentationPage`
(`AppRouter.tsx:56`, `:96-103`). Данные — `GET /api/v1/public/shares/{token}` **без JWT**
(`services/publicShareApi.ts:21-32`), rate limit по IP (120 / 15 мин).
Состояния страницы:

| Состояние | Текст / DOM | Якорь |
|---|---|---|
| Загрузка | «Завантаження кошторису…» | `SharePresentationPage.tsx:79-84` |
| Ошибка / нет данных | `role="alert"` с текстом ошибки или «Кошторис не знайдено» | `:87-98` |
| Успех | `<h1>` = `brandUk.name`, подзаголовок «Фінансовий підсумок за розрахунком», кнопка «Завантажити PDF» (или «Завантаження…»), `FinancialSummaryTable`, аккордеоны оборудования, опционально `PublisherContactBlock` | `:101-120`, `docs/client-share-and-layers.md` |

**Что нужно для автоматизации.**
Токен нельзя выдумать — нужен реальный published-проект:
1. `POST /api/v1/projects` + `POST /api/v1/projects/{id}/calc` (или DevPanel
   «На сервер + розрахунок»), затем `POST /api/v1/projects/{id}/share`
   (`useSurveyProject.ts:331-333`);
2. Требуется JWT. Герметичный путь — HS256 через `AUTH_JWT_SECRET` + `PROJECTS_AUTH_ENABLED=true`,
   либо `VITE_PROJECTS_BEARER_TOKEN` на фронте (`vite-env.d.ts:21`). Оба — с оговоркой N-28.
3. **Условие публикации из UI:** `canPublishShare = Boolean(clientName.trim()) && hasFinancialReport && canRunCalc`
   (`useSurveyProject.ts:501-502`) — то есть кнопка «Посилання» активна только после
   успешного расчёта и с заполненным именем клиента.
4. Ссылка **уходит только в буфер обмена**, на экран не выводится
   (`useSurveyProject.ts:334-336`, `ShareLinkToast`) ⇒ тест должен либо читать clipboard
   (`context.grantPermissions(['clipboard-read'])`), либо перехватывать ответ
   `POST /api/v1/projects/{id}/share` через `page.waitForResponse` и брать `shareToken` оттуда.
   **Второй способ надёжнее.**

**Оценка хелпера подготовки share-состояния (API-путь, без UI): 4–8 ч**,
плюс зависимость от разрешения N-28.

### 8.5 Скачивание PDF (blob) — как ассертить в Playwright

**Механика.**
- Владелец: `GET /api/v1/projects/{id}/pdf?includeTechnical=0|1` с JWT →
  `res.blob()` → `downloadBlobFile` (`services/projectsApi.ts:270-291`).
- Публично: `GET /api/v1/public/shares/{token}/pdf` без JWT
  (`services/publicShareApi.ts:40-61`).
- Скачивание — **программный клик по временному `<a download>` с blob-URL**
  (`utils/downloadBlobFile.ts:9-21`); `URL.revokeObjectURL` отложен на 60 000 мс (`:18-20`).
- Имя файла — из `Content-Disposition` (`filenameFromContentDisposition`, `:29-45`),
  fallback `Кошторис_{projectId}.pdf` / `Кошторис.pdf`.
- **`window.open` не используется** — pop-up блокировщик не мешает
  (`docs/client-share-and-layers.md`).

**Как ассертить.**

```
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('menuitem', { name: 'Фінансовий підсумок (PDF)' }).click(),
]);
expect(download.suggestedFilename()).toMatch(/\.pdf$/);
const path = await download.path();          // либо download.saveAs(...)
// содержимое: первые 5 байт === '%PDF-'
```

Замечания:
- контекст должен быть с `acceptDownloads: true` (в Playwright это значение по умолчанию);
- blob-URL-скачивания в Chromium поддерживаются событием `download`;
- **`suggestedFilename()` содержит кириллицу** («Кошторис_…») — на файловой системе CI
  проверить кодировку `filename*=UTF-8''` в `Content-Disposition`;
- **у анонима события `download` НЕ будет вообще**: `printPdf` сначала вызывает
  `ensureProjectSaved()` (`useSurveyProject.ts:383`) → `POST /api/v1/projects` → 401 →
  `showErr` → текст в шапке (`Header.tsx:132-136`). Тест на F-06 должен ассертить
  `role="alert"`, а **не** ждать download (иначе — таймаут вместо осмысленного падения);
- ассертить содержимое PDF (числа сметы) в E2E не нужно — это работа отдельного
  backend-теста `renderEstimatePdf`; в E2E достаточно факта скачивания и магических байт.

**Оценка хелпера: 2–4 ч.**

### 8.6 Два таба и гонка черновика (находка U4)

**Механика.**
- Ключ один — `heatcalc:survey-draft:v1` (`surveyDraftStorage.ts:9`).
- Запись — безусловный `localStorage.setItem` (`:33-36`), без сравнения `savedAt`,
  без merge, без версионирования.
- **Подписки на событие `storage` нет ни одной** (проверено: `grep -rn "addEventListener('storage'" frontend/src` → 0).
- Debounce записи 400 мс (`useSurveyDraftPersistence.ts:14`), триггер — изменение
  `calcInputKey`/`clientName`/`projectId` (`:61`).
- Чтение — только на bootstrap (`useSurveyBootstrap.ts:38`, `:117`).

**Что нужно для автоматизации: ничего.** Кейс воспроизводится в Playwright сегодня:

```
const p1 = await context.newPage();  const p2 = await context.newPage();
// p1: задать площадь комнаты 20 → дождаться записи в localStorage
// p2: открыть /, задать площадь комнаты 30 → дождаться записи
// p1: reload → площадь = 30 (изменение p1 потеряно)
```

Единственная сложность — **детерминированное ожидание записи**:
`page.waitForFunction(() => JSON.parse(localStorage.getItem('heatcalc:survey-draft:v1')).rooms[0].areaM2 === 20)`.
Без этого тест флейкует на debounce 400 мс.

**Оценка кейса: 3–5 ч** (в основном на надёжные ожидания).
**Оценка починки F-10: 8–16 ч** (подтверждает U5).

### 8.7 Гонка пресетов с восстановлением черновика — детерминирована

Полная цепочка приведена в §7, F-09(б). Кратко:

| Шаг | Якорь |
|---|---|
| Пресеты грузятся только при `calcEnabled` | `routing/SurveyAppShell.tsx:29-31`, `:43` |
| Черновик применяется синхронно в `useLayoutEffect` | `hooks/useSurveyBootstrap.ts:79-99` |
| Эффект перезаписи толщины при первом появлении пресетов | `hooks/useRoomsOrchestration.ts:177-209` (ключевые строки `:184`, `:187`, `:190-191`, `:200-203`) |
| `options[0] === 200` для `wall_gas_concrete_d500` | `frontend/src/data/fallbackEnvelopePresets.ts:30` |
| Затираемый дефолт `300` | `surveySession/createDefaultSurveyDraft.ts:62` |

**Порядок событий фиксирован кодом, а не таймингом сети** — значит воспроизводится 100 %:
«заполнить анкету → F5 → проверить `#wallThicknessMm`».
Дополнительный, тот же по механике эффект: `useRoomsOrchestration.ts:95-127` подставляет
`floorPresets[0]`/`ceilingPresets[0]`/`roofPresets[0]` во все комнаты и в `objectMeta.roofPresetId`,
если текущего значения нет **в пришедшем списке**. То есть при загрузке черновика,
сделанного на другом наборе пресетов (другая среда / другой каталог), **пресеты ограждений
молча заменяются первыми попавшимися** — это более широкий класс потери данных, чем
описано в F-09.

**Оценка кейса E2E: 1–2 ч** (он тривиален).
**Оценка починки: 1–2 ч** (см. §7, F-09).

### 8.8 Прочие состояния, которые придётся готовить

| Состояние | Как войти | Сложность |
|---|---|---|
| `bootstrapMode === 'error'` | только через `retryBootstrap()` после сбоя resolve, таймаут 3 с (`useSurveyBootstrap.ts:19`, `:103-107`) | из UI недостижимо; нужен битый JSON в localStorage, который бросит **вне** `try` — маловероятно (`resolveInitialBootstrapSnapshot` ловит всё, `:44-46`). **Практически непокрываемо** |
| `uiPhase === 'error'` с сохранённым отчётом | успешный расчёт → испортить «Зовні, °C» = 50 → дождаться 400 | тривиально, ключевой кейс F-07 |
| Dedup-путь (`CALC_SKIP_DEDUP`) | изменить поле и вернуть обратно ⇒ payload совпал | тривиально; важно, потому что тест «ждать POST» здесь зависнет |
| Отчёт из проекта (`setReportFromProject`) | «Проєкти» → выбрать проект / расчёт (`useSurveyProject.ts:414-465`) | требует auth |
| Гидравлика упала молча (N-14) | нужен вход, ломающий pipeline гидравлики (`buildReport.js:650-679`) | **НЕ ПРОВЕРЕНО**, какой вход это вызывает — задача для R5/S1, не для R2 |
| Модалки отчётов (6 штук) | кнопка «Звіт з …» активна только при наличии данных (`hasXxxReportContent`) | после успешного расчёта тривиально |
| Cookie-баннер | появляется на каждом чистом контексте (`AppRouter.tsx:89`) | закрывать в `beforeEach`, иначе перекрывает низ экрана |
| Clerk (login/sign-up/projects) | lazy-загрузка SDK по маршруту (`auth/shouldLoadClerkForPath.ts`) | внешняя зависимость; для E2E либо `VITE_AUTH_REQUIRED=false`, либо JWKS-стаб (вариант R4) |

---

## 9. НЕ ПРОВЕРЕНО

1. **`ProtectedRoute` при `VITE_AUTH_REQUIRED=false`** — пропускает ли на `/projects`
   без Clerk-сессии. Не читал `frontend/src/auth/ProtectedRoute.tsx` и `authConfig.ts`.
   Критично для решения, покрывать ли `/projects` в E2E герметично.
2. **`GET /api/v1/me` при `PROJECTS_AUTH_ENABLED=false`** — какой `role` возвращает.
   От этого зависит доступность DevPanel на собранном staging-билде (§8.3, минус 2).
3. **Почему строки F-11 проходят `npm run verify:language-policy`** — не читал
   `frontend/scripts/verify*.mjs` и правила гейта.
4. **Какой пресет пола/потолка/кровли приходит первым в `GET /api/v1/presets/envelope`** —
   от этого зависит фактический дефолт `floorPresetId` во всех комнатах
   (`useRoomsOrchestration.ts:116-117`) и точная формулировка N-12.
5. **Точный сценарий потери «Ім'я клієнта»** при уходе на `/login` (§7, F-09а) —
   механизм правдоподобен, но порядок событий живьём не фиксировался.
6. **Поддержка `download`-события Playwright для blob-URL в конкретной версии** —
   Playwright в зависимостях нет (`_CONTEXT.md`), проверить нечем; описано по контракту
   API Playwright, а не по прогону.
7. **Содержимое `frontend/src/pages/ProjectsPage/ProjectsPage.tsx` и
   `components/ProjectsDialog`** — прочитаны только заголовки-назначения; поля и селекторы
   диалога проектов в §3 и §6 не разобраны построчно.
8. **`SharePresentationPage` ниже строки 120** — аккордеоны оборудования и технический
   блок не разобраны; в §6.3 оценка «7 атрибутов» для share-страницы приблизительная.
9. **`CatalogEquipmentReference` (шаг «Довідник даних»)** — прочитаны первые 60 строк;
   оценка «10 атрибутов» в §6.3 приблизительная.
10. **Влияние `removeAdditional: true` на реальный payload анкеты** — не сверял поле
    в поле `buildCalcRequestPayload` с закрытыми объектами схемы. Возможны поля,
    которые фронт шлёт, а сервер молча выбрасывает; это отдельная задача (сверка
    «CalcInput из DevPanel» с эхо входа в отчёте).
11. **Clerk development-ключи на проде** (открытый вопрос U5) — R2 не проверял.
