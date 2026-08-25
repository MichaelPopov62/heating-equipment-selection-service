# A1 — Архитектура и границы слоёв

> Ось A1. Всё ниже получено чтением кода и запуском инструментов 23.08.2026 на ветке
> `qa/audit-and-persona-suite` (HEAD `8f6a35d`). Каждое утверждение — с якорем `file:line`.
> Где проверить не удалось — написано «НЕ ПРОВЕРЕНО».
> Сырьё: `docs/audit/raw/M1-static-metrics.md` (§1, §2, §4, §7, §11), `M2-repo-hygiene.md`.
> QA-находки не переоткрываются — только ссылки на ID.

---

## Главный вывод оси одной страницей

**Расчётное ядро чистое.** В `logic/`, `matching/`, `hydraulics/`, `report/` — **ноль** обращений к
`process.env`, **ноль** импортов mongoose/моделей, **ноль** касаний Express `req/res`
(проверено grep'ом по всем четырём каталогам, см. A1-03). Это означает, что главный вопрос оси —
«можно ли расчёт протестировать и вынести в очередь» — имеет ответ **да, почти без работы**.
Единственное препятствие — один сетевой вызов внутри `buildReport` (A1-11).

**Барьеры слоёв объявлены, но не работают** — и не по той причине, которую предполагал M1.
Правило `no-restricted-imports` не «освобождает 6 доменов из 7»: в плоском конфиге ESLint третий
блок конфигурации **заменяет** правило целиком ещё у трёх каталогов, включая `src/logic/**` —
самое сердце расчёта (A1-01, доказано `eslint --print-config`). При этом сам барьер описан
списком из 24 конкретных файлов и **не ловит ни одного** из 31 фактического обхода (A1-02).

**Опасное место — не бэкенд, а фронтенд.** Три хранилища состояния анкеты (localStorage-черновик,
React Query, сервер) без назначенного источника истины и без единой строки кода сверки. Это
структурная причина QA-находок о потере ввода (A1-04).

**SSOT-документ не врёт.** Из 222 файлов `backend/src` в `docs/project-structure.md` описаны
**222** (A1-13). Это редкость и это надо сохранить.

---

## 1. Соответствие заявленному

### Заявлено

`docs/project-structure.md:76` — «Cross-domain импорты в runtime — только через barrels `*/public.js`
(`api`, `catalog`, `hydraulics`, `matching`, `models`, `reference`, `report`). `scripts/` импортирует
internal напрямую.»

### Направление зависимостей: проверено

Заявленное `api → logic/matching/hydraulics → report` в коде **соблюдается**, с одной оговоркой:
`report` стоит не после, а **над** matching/hydraulics — `buildReport` их оркеструет
(`backend/src/report/buildReport.js:206-680`, 8 пронумерованных стадий, якоря `:226`, `:281`, `:292`,
`:323`, `:421`, `:517`, `:565`, `:618`). Фактический порядок:
`api → report → {logic, matching, hydraulics} → {catalog, reference, models}`.
Документ этот нюанс не фиксирует, но и не противоречит ему.

**Обращений «снизу вверх» — 8 из 31** (полный список в A1-02):
- `auth/authErrors.js:4`, `auth/requireAuth.js:11`, `auth/requireRole.js:8` → `api/sendErrorEnvelope.js`
- `projects/projectAccess.js:14`, `projects/validateProjectBody.js:9`,
  `projects/validateProjectImportBody.js:8`, `projects/validateProjectSurveyShape.js:7` → `api/errorCodes.js`
- `index.js:14` → `api/errorCodes.js`

Все восемь — за одним и тем же: за таблицей кодов ошибок и за форматтером конверта. Это не инверсия
слоёв, а **отсутствие места для кросс-слойных констант**. Ни `errorCodes.js`, ни `sendErrorEnvelope.js`
не являются HTTP-логикой: первый — плоский словарь строк, второй — чистая функция сериализации.
Они лежат в `api/` только исторически.

### Тянет ли доменная логика инфраструктуру внутрь себя — ГЛАВНЫЙ ВОПРОС ОСИ

Проверено (команда и результат в A1-03): **нет**.

| Каталог | `process.env` | mongoose / `models/*` | Express `req`/`res` | `fetch` / `fs` |
|---|---|---|---|---|
| `logic/` | 0 | 0 | 0 | 0 |
| `matching/` | 0 | 0 | 0 (единственное совпадение `req.toFixed` на `boiler.js:402` — локальная переменная «требуемая мощность») | 0 |
| `hydraulics/` | 0 | 0 | 0 | 0 |
| `report/` | 0 | 0 | 0 | 0 |
| `climate/` | 4 (`geocode.js:18,62`, `snipClimate.js:94,268`) | 0 | 0 | сетевые вызовы — **это адаптер, так и должно быть** |
| `catalog/` | 1 (`loadCatalog.js:338` — `CATALOG_SOURCE`) | косвенно | 0 | — |
| `dhw/`, `ufh/`, `recommendations/` | 0 | `load*.js` (4 файла) | 0 | `node:fs` в `load*.js` |

Единственные точки инфраструктуры внутри доменных папок — файлы, которые прямо называются
`loadAppliances.js`, `loadWaterNorms.js`, `loadUnderfloorHeatingPresets.js`,
`loadRecommendations.js`. Это адаптеры «Mongo или файл», ко-локированные со своим доменом:
`backend/src/dhw/loadAppliances.js:6-9`, `backend/src/ufh/loadUnderfloorHeatingPresets.js:5-8`.
Ко-локация вместо отдельного `infra/` — стилистический выбор, вреда нет.

**Практический смысл.** Вынести расчёт в очередь = взять `runCalculation.js` (23 строки),
заменить HTTP-обвязку на потребителя очереди. Ничего в `logic/`/`matching/`/`hydraulics/` трогать
не придётся. Единственное, что надо решить, — сетевой `getDesignOutsideTempC` внутри `buildReport`
(A1-11).

---

## 2. Находки

### [A1-01] Барьер `no-restricted-imports` выключен собственным конфигом у `logic/`, `matching/`, `utils/` — тихо, через механику flat-config

- **Ось:** A1 | **Категория:** ДОЛГ
- **Якорь:** `backend/eslint.config.js:23-33` (блок 2, `ignores`), `backend/eslint.config.js:93-110` (блок 3)
- **Что не так:**
  M1 (§4) написал, что конфиг «освобождает 6 из 7 барьерных доменов» через `ignores` на строках 26–33.
  Это верно только наполовину, и вторая половина хуже. В плоском конфиге ESLint правило в
  последующем блоке **не сливается** с предыдущим, а **заменяет** его целиком. Блок 3
  (`backend/eslint.config.js:93-110`) объявляет `files: ['src/logic/**', 'src/api/validate.js',
  'src/utils/**', 'src/matching/**']` и задаёт для них `no-restricted-imports` с **одной** группой
  (legacy-кэши). В результате шесть барьерных групп у этих каталогов исчезают.

  Проверено запуском `npx eslint --print-config` по одному файлу из каждого каталога `backend/src`:

  | Каталог | Групп в `no-restricted-imports` |
  |---|---|
  | `auth`, `climate`, `data`, `dhw`, `feedback`, `hydraulics`, `projects`, `recommendations`, `ufh` | **6** (барьер работает) |
  | `api`, `catalog`, `models`, `reference`, `report` | **0** (исключены явно, `:26-33`) |
  | **`logic`, `matching`, `utils`** | **1** (только legacy-кэш — барьер стёрт блоком 3) |

  Для `matching` это, скорее всего, сознательно: он перечислен и в `ignores` (`:28`), и в `files`
  блока 3 (`:95`) — автор знал, что барьер там не действует. А вот **`logic/` и `utils/` были под
  барьером в блоке 2 и потеряли его молча** — это чистый недосмотр механики flat-config.
- **Барьер выключен по недосмотру или сознательно?** Обе причины сразу.
  Исключение `api`/`catalog`/`matching`/`models`/`reference`/`report` (`:26-33`) — **сознательное и
  по существу правильное**: файл внутри домена обязан иметь право импортировать собственные
  internal-модули (`matching/index.js` → `matching/internal/*`). Ошибка — не в самом исключении,
  а в его **гранулярности**: один плоский `ignores` применён ко всем шести группам сразу, вместо
  «домен освобождён только от своей группы». Потеря барьера у `logic/` и `utils/` — **недосмотр**.
- **Сценарий вреда:** владелец через полгода правит `logic/warmFloorCalc.js` и, чтобы «быстро
  посмотреть цену», импортирует `models/Product.js` напрямую. Линтер молчит. Расчётное ядро
  получает зависимость от mongoose — то самое свойство, которое сегодня даёт возможность
  тестировать расчёт без БД и вынести его в очередь (см. A1-03). Свойство теряется без единого
  сигнала.
- **Сколько импортов придётся переписать, если барьер включить:** посчитано скриптом по всем 1573
  относительным импортам в `backend/src` (модель «каждый домен освобождён только от своей группы»):
  **ноль**. Ни один существующий импорт не нарушает шесть объявленных групп. Барьер можно
  включить правильно **бесплатно** — он ничего не сломает, потому что автор и так его соблюдает.
- **Стоимость починки:** 1–2 часа. Заменить один плоский `ignores` шестью блоками вида
  `{ files: ['src/**/*.js'], ignores: ['src/matching/**'], rules: { 'no-restricted-imports':
  [/* только группа matching */] } }`, а блок 3 переписать так, чтобы он **добавлял** группу
  legacy-кэшей к существующим, а не заменял их (в плоском конфиге — только копипастой полного
  набора групп; слияния опций правил в ESLint нет).
- **Если не чинить никогда:** барьер остаётся декорацией. Проект работает, но защита, за которую
  уже заплачено (6 групп с осмысленными русскими сообщениями), не срабатывает именно там,
  где нужнее всего — в расчётном ядре.
- **Риск самой починки:** нулевой на сегодняшнем коде (0 нарушений). Единственный риск — забыть,
  что блок 3 заменяет, а не дополняет, и повторно потерять барьер.

---

### [A1-02] Барьер описан списком из 24 файлов и не ловит ни одного из 31 фактического обхода `public.js`

- **Ось:** A1 | **Категория:** ДОЛГ
- **Якорь:** `backend/eslint.config.js:38-88` (шесть групп), артефакт подсчёта — скрипт по JSON-графу
- **Что не так:** правило перечисляет **конкретные пути файлов** (`**/matching/boiler.js`,
  `**/catalog/loadCatalog.js`, `**/report/buildReport.js`, …) — всего 24 записи. Всё, что не попало
  в список, импортировать можно свободно. Я пересчитал обходы сам, отделив runtime-импорты
  (`import … from`) от JSDoc-типов (`import('…/types.js')`, которые в рантайме не существуют):

  | | Кол-во |
  |---|---|
  | Всего кросс-доменных обращений мимо `public.js` (включая типы) | **192** |
  | Из них **runtime**-импортов | **31** (M1 насчитал 36, считая `.d.ts` — расхождение объяснимо) |
  | Из них ловится текущим правилом, даже если конфиг починить (A1-01) | **0** |

  Остальные 161 — `import('../catalog/types.js')` внутри JSDoc. Они стираются компилятором,
  рантайм-графа не образуют и **проблемой не являются**.

  Разбор 31 runtime-обхода по причинам:

  | Причина | Кол-во | Примеры | Что нужно |
  |---|---|---|---|
  | Символ **уже есть** в `public.js`, но импортируют напрямую | **9** | `report/buildReport.js:31`, `api/validate.js:32`, `matching/boiler.js:23`, `matching/index.js:25` → `reference/assertCalcRuntimeContext.js` (есть в `reference/public.js:7`); `logic/ufhLoopHydraulics.js:13`, `logic/ufhLoopGeometry.js:6`, `logic/ufhHydraulicsCircuit.js:5`, `matching/internal/pickRadiatorsCore.js:6-7` → `hydraulics/thermalLoadToFlow.js` / `resolveFlowDeltaTK.js` (есть в `hydraulics/public.js:9-10`) | правка пути импорта, 9 строк |
  | Нужна **одна строка реэкспорта** в barrel | **22** | `catalog/matchingSortPools.js` + `comparators.js` ← `matching/{boiler,waterHeater}.js:6-7` (3); `hydraulics/{pickPipe,pipeHydraulics}.js` ← `logic/ufhLoopHydraulics.js:6,8` (2); `matching/warmFloor.js` ← `report/buildReport.js:11` (1); `reference/loadReferenceCollection.js` ← `dhw`/`ufh`/`recommendations` (4); `models/{Appliance,WaterNorms,Recommendation,UnderfloorHeatingPreset}.js` ← те же загрузчики (4); `api/errorCodes.js` ← `index.js:14` + `projects/*` ×4 (5); `api/sendErrorEnvelope.js` ← `auth/*` ×3 (3) | +12 строк в barrel'ах, 22 правки путей |

  Заодно это **объясняет находку M1 §2.2 «барьеры частично мертвы»**: `reference/public.js:7`
  реэкспортирует `assertCalcRuntimeContext`, `hydraulics/public.js:9-10` — `thermalLoadToFlow` и
  `resolveFlowDeltaTK`, и knip считает их неиспользуемыми. Символы **живые**, просто все четыре
  потребителя ходят мимо barrel'а. Мёртвого кода тут нет — есть неиспользуемая дверь.
- **Сценарий вреда:** сегодня — почти никакого; фактический граф чистый. Вред отложенный: правило
  создаёт **ложное чувство защиты**. Владелец видит в конфиге барьер, верит, что при попытке
  протащить `catalog/` в `logic/` линтер остановит, и не проверяет это вручную. Не остановит.
- **Стоимость починки:** 3–5 часов вместе с A1-01. Переписать 6 групп с whitelist файлов на
  отрицание barrel'а, например `group: ['**/matching/**', '!**/matching/public.js']`, добавить
  12 реэкспортов, поправить 31 путь импорта, прогнать `npm run verify --prefix backend`.
- **Если не чинить никогда:** работает. Риск реализуется только при появлении второго разработчика
  или при возврате к коду через полгода.
- **Риск самой починки:** реальный и его надо назвать. Реэкспорт `pickPipe`/`pipeHydraulics` из
  `hydraulics/public.js` заставит `logic/ufhLoopHydraulics.js` тянуть **весь** barrel, включая
  `runHydraulicsPipeline`, `buildSnapshots`, `resolveSystemPumps`. Модульный граф уплотнится,
  время холодного старта вырастет, а `logic → hydraulics` из точечной зависимости станет
  зависимостью от всего домена. **Рекомендация: 9 «бесплатных» правок сделать, 22 остальных —
  не делать**, а вместо этого перенести `api/errorCodes.js` и `api/sendErrorEnvelope.js` в
  нейтральный `src/errors/` (это снимет 8 обращений «снизу вверх» разом и не создаст толстых
  barrel'ов).

---

### [A1-03] СИЛЬНАЯ СТОРОНА: расчётное ядро свободно от инфраструктуры — расчёт можно вынести в очередь почти без работы

- **Ось:** A1 | **Категория:** НЕ ТРОГАТЬ
- **Якорь:** `backend/src/logic/`, `backend/src/matching/`, `backend/src/hydraulics/`, `backend/src/report/`;
  проверка — `grep -rn "process\.env" logic/ matching/ hydraulics/ report/` → 0;
  `grep -rn "mongoose\|from '.*models/" logic/ matching/ hydraulics/ report/` → 0;
  `grep -rln "req\.\|res\.status\|res\.json" logic/ matching/ hydraulics/ report/` → 1 ложное
  срабатывание (`matching/boiler.js:402`, локальная переменная `req` = «требуемая мощность»)
- **Что хорошо:** это ответ на главный вопрос оси. Справочники приходят снаружи одним объектом
  `CalcRuntimeContext` (`backend/src/reference/toCalcRuntimeContext.js`, контракт проверяется
  `assertCalcRuntimeContext` на входе в `buildReport.js:207`, `matching/index.js:25`,
  `matching/boiler.js:23`, `api/validate.js:32`). Весь пайплайн — 23 строки
  (`backend/src/api/runCalculation.js:17-21`). Ни одна доменная функция не знает ни про Mongo,
  ни про Express, ни про env.
- **Что это даёт по деньгам:** (1) расчёт тестируется без БД — что и делают 52 verify-скрипта;
  (2) вынести расчёт в очередь = заменить HTTP-обвязку в `runCalculation.js` на потребителя,
  доменный код не трогать; (3) платный гейт вставляется на уровне роутов, а не внутри расчёта.
  Это ровно та архитектурная работа, которую обычно приходится делать задним числом за недели.
- **НЕ ТРОГАТЬ.** Не «выносить домен в отдельный пакет», не «делать порты и адаптеры» — уже сделано
  де-факто. Единственное, что стоит защитить, — включить барьер (A1-01), чтобы свойство не потерялось.

---

### [A1-04] Три хранилища состояния анкеты без источника истины — структурная причина «молча теряет введённое»

- **Ось:** A1 | **Категория:** **БЛОКЕР-A**
- **Якорь:** `frontend/src/hooks/useSurveyDraftPersistence.ts:14,48,58-60,61`;
  `frontend/src/surveySession/reduceSurveyMutation.ts:115-116`;
  `frontend/src/hooks/useSurveyProject.ts:119-128`;
  `frontend/src/services/surveyDraftStorage.ts:18-27,33-36`;
  `frontend/src/routing/SurveyAppShell.tsx:65-87`;
  `frontend/src/models`… (backend) `backend/src/models/Project.js:39` (`versionKey: false`)
- **QA:** это причина, а не новый симптом. Симптомы уже описаны: `N-07`, `N-30`, `N-31`, `N-42`
  (`docs/qa/research/_ORCH-NOTES.md:41,318,324,431`), `F-08`, `F-09`, `F-10`, `F-14`
  (`docs/qa/research/U5-ux-rootcause.md:93-96,113-116`), инциденты `#5`, `#6`, `#7`
  (`docs/qa/research/U4-ux-adversarial.md:311,329,344`). Не переоткрываю — объясняю механизм.
- **Что не так:** состояние анкеты живёт одновременно в трёх местах, и **ни одно не назначено
  источником истины**. Кода сверки не существует вовсе:
  - `savedAt` пишется (`frontend/src/utils/buildSurveyDraft.ts:47`) и переносится при миграции
    (`frontend/src/utils/migrateSurveyDraft.ts:125`), но **ни разу нигде не сравнивается** —
    единственные потребители — имя файла экспорта и текстовая сводка;
  - `schemaVersion` сравнивается ровно в одном месте (`migrateSurveyDraft.ts:56-68`) и это
    односторонний upgrade-гейт, не мерж;
  - `setQueryData` не используется нигде — оптимистичных апдейтов нет;
  - на бэкенде `Project` объявлен с **`versionKey: false`** (`backend/src/models/Project.js:39`),
    а `PUT /api/v1/projects/:id` шлёт только `{ clientName, survey }`
    (`frontend/src/services/projectsApi.ts:137-142`) — **без `If-Match`, без версии, без `updatedAt`**.
    То есть потерянное обновление не просто не обрабатывается — его **невозможно обнаружить**
    ни на клиенте, ни на сервере.

  Кто побеждает — зависит от того, какой эффект отработал последним:

  | Фаза | Побеждает | Якорь |
  |---|---|---|
  | Холодный старт `/` | **localStorage** (синхронно в инициализаторе `useState`) | `frontend/src/hooks/useSurveyBootstrap.ts:36-47` |
  | Во время работы | **React-состояние сессии**, localStorage — follower с лагом 400 мс | `frontend/src/surveySession/SurveySessionProvider.tsx:55` |
  | Открытие проекта | **сервер**, перезаписывает localStorage без сравнения | `frontend/src/hooks/useSurveyProject.ts:119-128` |
  | Отчёт | **сессия** (`gcTime: 0` — React Query отчёт не хранит) | `frontend/src/query/useSurveyCalc.ts:79` |
  | `clientName` / `projectId` | **`useState` в `SurveyAppRoot`**, сессия о них вообще не знает | `frontend/src/SurveyAppRoot.tsx:87-88` |
- **Сценарий вреда** (главный, воспроизводится за 3 клика):
  1. Монтажник правит площадь комнаты. Персист ставит таймер на 400 мс
     (`useSurveyDraftPersistence.ts:14,48`).
  2. Через 100 мс жмёт «Проєкти» → `navigate` (`SurveyAppRoot.tsx:212`).
  3. `SurveyAppRoot` размонтируется, cleanup **гасит таймер без флаша**
     (`useSurveyDraftPersistence.ts:58-60`) — **запись не произошла**.
  4. Возврат на `/` → `useSurveyBootstrap` читает localStorage → `DRAFT_LOADED` →
     в редьюсере `return structuredClone(mutation.draft)`
     (`reduceSurveyMutation.ts:115-116`) — **полная замена**. Пережившее навигацию актуальное
     состояние затирается устаревшим снимком.

  Правка потеряна дважды. Пользователь видит старое число и не получает ни ошибки, ни предупреждения.
  Хуже вариант 1-бис: если черновик не прошёл гейт `isPersistableSurveyDraft`
  (`frontend/src/services/surveyDraftStorage.ts:52-58`), в хранилище нет ничего →
  `SESSION_RESET` → `createEmptySurveyDraftSnapshot()` (`reduceSurveyMutation.ts:117-118`) →
  **вся работа стёрта, экран Start**.

  Отдельный путь с той же причиной: откат деплоя на предыдущую версию делает
  `storedVersion > SURVEY_DRAFT_SCHEMA_VERSION` (`migrateSurveyDraft.ts:56-61`), исключение ловится
  в `surveyDraftStorage.ts:21-26` и черновик **безвозвратно удаляется** (`:25`), в проде — молча
  (`:22` пишет в консоль только в DEV). Это не покрыто ни одной QA-находкой.
- **Стоимость починки (структурная правка, минимальная версия):** 8–14 часов.
  1. **Флаш на размонтирование и на `pagehide`** — cleanup в `useSurveyDraftPersistence.ts:58-60`
     должен записывать, а не только гасить таймер; плюс `window.addEventListener('pagehide', flush)`
     (сейчас подписок нет — grep по `beforeunload|pagehide|visibilitychange` даёт 0). ~2 ч.
     Это одна правка, снимающая ПУТИ 1 и 1-бис целиком.
  2. **`DRAFT_LOADED` перестаёт быть безусловной заменой**: сравнить `savedAt` входящего черновика
     с текущим в сессии и не откатывать назад (`reduceSurveyMutation.ts:115-116`). ~2 ч.
  3. **`schemaVersion` из будущего — не удалять, а сохранять под резервным ключом**
     (`surveyDraftStorage.ts:25`) и показать баннер. ~2 ч.
  4. **Подписка на `storage`** для двух вкладок — предупреждение, не мерж. ~2 ч.
  5. `try/catch` вокруг `setItem` (`surveyDraftStorage.ts:33-36`) — сейчас исключение вылетает из
     колбэка `setTimeout`, необработанное и невидимое, и черновик молча перестаёт сохраняться.
     В черновик при этом кладётся **весь `lastCalcReport`** (`SurveyAppRoot.tsx:122`), так что
     QuotaExceededError — не гипотеза. ~1 ч.
  6. На бэкенде: включить `versionKey` у `Project` и вернуть 409 при расхождении версии. ~3 ч.
     Пункты 1–2 дают ~80 % эффекта; 6 нужен до выхода на живых монтажников с несколькими
     устройствами.
- **Если не чинить никогда:** первый же монтажник, который вводит данные на объекте с телефона и
  переключается между экранами, потеряет работу и потеряет доверие. Это единственная находка A1,
  которую видит **конечный пользователь**, и она бьёт по вехе A (выпуск на живых монтажников).
- **Риск самой починки:** пункт 2 (сравнение `savedAt`) может «залипнуть» на старом черновике, если
  часы устройства сбиты — использовать монотонный счётчик мутаций, а не время.

---

### [A1-05] `surveySession/` — честный редьюсер, но не машина состояний; заявленный инвариант нарушается в четырёх местах

- **Ось:** A1 | **Категория:** ДОЛГ
- **Якорь:** `frontend/src/surveySession/types.ts:20,23,43-64`;
  `frontend/src/surveySession/reduceSurveyMutation.ts:16-127`;
  `frontend/src/surveySession/runSurveyMutationPipeline.ts:21-103`;
  `frontend/src/surveySession/SurveySessionProvider.tsx:121-125,143-151`;
  `frontend/src/AppSurveyContent.tsx:260,595`
- **Что есть хорошего:** закрытый union из 20 мутаций (`types.ts:43-64`), чистый `reduce` с
  exhaustiveness-guard (`reduceSurveyMutation.ts:123-126`), явный pipeline из 4 шагов
  (`runSurveyMutationPipeline.ts:25,26,64,77`). Для проекта такого возраста это выше среднего.
- **Что не так:** машины состояний нет — нет таблицы переходов, нет `transition(state, event)`,
  нет проверки «событие X недопустимо в фазе Y». Вместо неё два независимых enum-поля
  (`SurveyUiPhase` — `types.ts:20`; `AppBootstrapMode` — `types.ts:23`) и три теневых
  булевых/строковых поля (`draftInitializing`, `thermalRegimeTouched`, `calcInputKey` —
  `types.ts:69-78`), меняемые россыпью `if`-ов. Заявленный в шапках инвариант
  («все мутации через `dispatch` и единый pipeline» — `AppSurveyContent.tsx:3`,
  `SurveySessionProvider.tsx:3`) обходится:
  1. `setReportFromProject` мутирует сессию **мимо pipeline** (`SurveySessionProvider.tsx:143-151`),
     не пересчитывая `calcInputKey`. Следствие: отчёт для входа X показывается рядом с черновиком Y,
     и дедупликация расчёта (`frontend/src/query/useSurveyCalc.ts:70-72`) об этом не знает.
  2. `thermalRegimeTouchedRef` — снимок состояния сессии, взятый **только при монтировании**
     (`AppSurveyContent.tsx:260`) и никогда не синхронизируемый с
     `runSurveyMutationPipeline.ts:32-34`. Прямое следствие: при открытии сохранённого проекта
     эффект `AppSurveyContent.tsx:276-284` видит `false`, не выходит по guard'у `:277` и
     **молча заменяет сохранённый пользователем температурный график рекомендованным**.
     Это фронтенд-механизм симптома, который QA (`U5-ux-rootcause.md:134`) отнёс к бэкенду;
     бэкендовый путь (`backend/src/logic/heatingThermalRegimes.js:74-75`) существует независимо
     и **оба работают**.
  3. `clientName`/`projectId` живут в `useState` вне сессии (`SurveyAppRoot.tsx:87-88`),
     продублированы в `AppRoot.tsx:35-38` — четыре копии одного значения вместе с localStorage.
  4. `queueMicrotask` внутри updater-функции `setSession` (`SurveySessionProvider.tsx:121-125`) —
     побочный эффект планируется из тела редьюсера; в StrictMode/конкурентном режиме updater
     может быть вызван дважды → двойное планирование расчёта.
- **Сценарий вреда:** пункт 2 — боевой и воспроизводимый: пользователь сохранил проект с режимом
  55/45, открыл его завтра, получил 75/65 и другую смету, без единого сообщения.
- **Стоимость починки:** 2–3 часа за пункт 2 отдельно (убрать `useRef`, читать
  `sessionState.thermalRegimeTouched` напрямую) — это самая дешёвая правка с видимым эффектом
  во всей оси. Пункты 1, 3, 4 — 6–10 часов, ДОЛГ.
- **Если не чинить никогда:** пункт 2 — постоянный источник жалоб «оно само поменяло».
  Остальное — накапливающаяся стоимость каждой правки анкеты.
- **Риск самой починки:** пункт 2 изолирован (один `useRef` и один guard) — риск минимальный.
  Пункт 1 требует понимания, что делать с `calcInputKey` при загрузке отчёта с сервера.

---

### [A1-06] Контракт проверяется только на входе: 118 из 120 схем `components/schemas/` — документация, которую никто не сверяет с кодом

- **Ось:** A1 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/api/calcInputSchemaLoader.js:57,61`;
  `backend/src/hydraulics/pipelineSchemaLoader.js:22`; `openapi.yaml` (25 путей);
  `components/schemas/` — 120 файлов
- **QA:** реестр расхождений `R3-D1…R3-D18` уже составлен
  (`docs/qa/research/R3-api-contract.md:80-103`). **Не переоткрываю.** Ниже — архитектурная
  причина и механизм, который не даст им появиться снова.
- **Архитектурная причина, одной фразой:** контракт **исполняем на входе и декоративен на выходе**.
  - На входе он настоящий SSOT: `components/schemas/CalcInput.yaml` бандлится `$RefParser`'ом
    и компилируется в AJV прямо в рантайме (`calcInputSchemaLoader.js:57,61`,
    `backend/src/api/validate.js:243-244`). То же для `HydraulicsPipelineInput.yaml`
    (`pipelineSchemaLoader.js:22`). Разойтись физически не могут — это один артефакт.
    **Это очень хорошее решение, и это причина, почему в реестре R3 нет ни одного расхождения
    по телу запроса `/calc`.**
  - На выходе — ничего. Ни `CalcOkResponse.yaml`, ни `CalcReport.yaml`, ни `CommercialBomReport.yaml`,
    ни `ProjectDetail`/`FinancialBomLine` нигде в `backend/src` не загружаются
    (проверено: `grep -rn "components/schemas" backend/src` даёт **4 совпадения, все про
    `CalcInput` и `HydraulicsPipelineInput`**). Ни один verify-скрипт из 52 не валидирует
    произведённый отчёт против схемы ответа.
  - Отсюда ровно та форма расхождений, которую нашёл R3: **все 18 — про коды ответов, авторизацию
    и наличие путей, ни одного про тело запроса**. Это не совпадение, это прямое следствие
    того, где проходит граница исполняемости.
- **Автоматической сверки нет.** `express-openapi-validator` не установлен ни в `backend`,
  ни в `e2e` (проверено по `package.json`). Единственный близкий скрипт —
  `backend/scripts/verifyCalcInputSchema.js`, и он сверяет **один** enum (`room.type` против
  `CANONICAL_ROOM_TYPES`, `:20-38`).
- **Отдельный, ранее не зафиксированный риск в том же месте:** `adaptBundledSchemaForAjv`
  (`backend/src/api/calcInputSchemaLoader.js:26-47`) **патчит собранную схему в рантайме**,
  подменяя четыре enum'а константами из `shared/`: `room.type` (`:29-35`),
  `hotWaterBoilerPowerMatchingScheme` (`:38-40`), `thermalRegimePreset` (`:41-43`),
  `ufhPresetId` (`:44-46`). Это значит, что **опубликованный контракт и рантайм-схема — не одно и
  то же** в четырёх точках. Я сверил все четыре запуском (`$RefParser.dereference` по
  `components/schemas/CalcInput.yaml` против рантайм-констант): **сейчас все четыре совпадают**.
  Но verify-скрипт покрывает только один из четырёх, то есть три подмены не защищены ничем и
  разойдутся молча при первом же изменении `shared/heatingMatchingSchemes.js`,
  `shared/ufhModePresetIds.js` или `backend/src/logic/heatingThermalRegimes.js`.
- **Сценарий вреда:** дилер (веха B — «брать деньги») интегрируется по `openapi.yaml`, обрабатывает
  `CalcOkResponse`, получает поле, которого в схеме нет, или не получает объявленное. Разбираться
  будет владелец, вручную, по переписке.
- **Стоимость починки — механизм, который закроет и причину, и три незащищённые подмены:**
  - **Вариант A (рекомендуемый, 4–6 часов).** Новый `backend/scripts/verifyOpenApiContract.js`
    в существующую цепочку `npm run verify --prefix backend`. Он делает три вещи, все на уже
    имеющихся зависимостях (`ajv`, `@apidevtools/json-schema-ref-parser` — обе в `backend/package.json`):
    1. сверяет **все четыре** enum-подмены из `adaptBundledSchemaForAjv` (сейчас — одна);
    2. собирает список путей и методов из `openapi.yaml` и сверяет со списком, снятым со
       смонтированного Express-роутера (`router.stack`) — ловит R3-D12 и любой будущий
       недокументированный путь;
    3. прогоняет `runCalculation` на существующей фикстуре
       (`backend/scripts/testApartmentScheme2Payload.json`) и валидирует результат против
       `components/schemas/CalcOkResponse.yaml` — ловит расхождение схемы ответа.
    Мимо остаются коды ответов (R3-D2…D11) — их дешевле дописать в `openapi.yaml` руками один раз
    (2–3 часа) и держать под пунктом 2.
  - **Вариант B (`express-openapi-validator` с `validateResponses: true` в тестовом режиме),
    12–20 часов.** Даёт больше, но требует поднятого Mongo в CI и, по `R3-D18`, упирается в то,
    что при `PROJECTS_AUTH_ENABLED=false` `requireRole` отвечает 403 всем
    (`backend/src/auth/requireRole.js:21-28`) — то есть половина путей в тестовом контуре
    недостижима. **Не рекомендую до починки R3-D18.**
- **Если не чинить никогда:** контракт продолжит расходиться. Пока API потребляет только
  собственный фронтенд — цена нулевая. В момент появления первого внешнего интегратора
  (веха B) цена станет «неделя переписки на каждого».
- **Риск самой починки:** пункт 3 варианта A может оказаться красным сразу — тогда придётся
  сначала привести `CalcReport.yaml` в соответствие с фактом. Это работа, но она разовая и
  выявляет реальные расхождения, а не создаёт их.

---

### [A1-07] `api/validate.js` — не валидация, а доменный оркестратор: 15 точек мутации входа вокруг одной схемной фазы

- **Ось:** A1 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/api/validate.js:22-31,45,47,48-60` (импорты);
  `:260-379` (7 фаз); `:77-81` (опции AJV); `:768,776` (затирание warnings)
- **QA:** симптом «молча нормализует ввод» уже описан — реестр `R3-api-contract.md:385-434`
  (25 записей), находки `N-02`, `N-03`, `N-06`, `N-08`, `N-12`, `N-19`, `N-31`
  (`docs/qa/research/_ORCH-NOTES.md:15,20,37,45,88,159,323`), расхождения `R3-D13`, `R3-D14`,
  `R3-D15` (`docs/qa/research/R3-api-contract.md:96-98`), риски `RISK-API-06`, `RISK-API-14`
  (`docs/qa/research/S1-risk-register.md:257,265`). **Не переоткрываю.** Ниже — почему так вышло.
- **Где проходит граница:** её нет. Есть три перемешанных слоя:
  1. **до AJV** (`:263-268`) — вход мутируется **раньше**, чем схема его увидит: тип комнаты
     переписывается (`:213`), границы комнат безусловно перезаписываются (`:552-555`),
     `underfloorHeating` удаляется и пересобирается (`:399,404,410,490-497`). Схема потом валидирует
     **уже подменённые** данные;
  2. **AJV** (`:269-283`) — единственная честно схемная фаза, но `removeAdditional: true` (`:80`)
     делает её тоже мутирующей (тихо удаляет), а `useDefaults` **не передан** (`:77-81`) —
     объявленные в контракте дефолты не применяются (`R3-D14`);
  3. **после AJV** (`:288-378`) — 15 точек мутации плюс 28 доменных кодов ошибок.
- **Архитектурная причина, а не стиль:** `validate.js` физически лежит в `api/`, но импортирует
  **7 модулей из `logic/`** (`:22-25` `roomExteriorLayoutHeatLoss`, `:26` `heatingThermalRegimes`,
  `:27-30` `normalizeHeatingUfhPreset`, `:31` `normalizeUnderfloorDistribution`,
  `:45` `externalWallsValidate`, `:47` `ventilationReserve`, `:48-53` `apartmentStackBoundaries`),
  **2 из `data/`** (`:54-60`) и **1 из `reference/`** (`:32`), а также читает каталог через
  контекст (`ctx.appliances.byKind.boiler.mounting` — `:709`; `ctx.ufhPresets` — `:308`).
  Отсюда — жёсткая последовательность в пайплайне: справочники → контекст → валидация
  (`backend/src/api/runCalculation.js:17-19`). **Провалидировать анкету без прогретого bundle
  невозможно** — «валидация» не является чистой функцией входа. Это и есть цена того, что
  бизнес-нормализация переехала в API-слой.
- **Худшее следствие, механика:** `_normalizationWarnings` — **единственный канал**, через который
  пользователь вообще узнаёт о подмене своих данных (читается ровно в одном месте —
  `backend/src/matching/index.js:168-177`). В четырёх местах он корректно дополняется
  (`validate.js:156-158`, `:600-601`, `backend/src/logic/normalizeHeatingUfhPreset.js:73-76,97-101`),
  а в `validate.js:768` и `:776` — **присваивается**. Вызов стоит на `:361`, то есть **после**
  `:288-290` (предупреждения о типах комнат) и `:308-309` (ТП/термо-режим). Порядок гарантирует
  потерю: все ранее накопленные предупреждения исчезают. Это `N-08` / `RISK-API-06`.
- **Второе следствие:** `heatingThermalRegimes.js:74-75` безусловно перезаписывает `supplyC`/`returnC`
  пресетом на шаге `:306`, а проверка «`returnC ≥ supplyC`» стоит на `:337-347`. **306 < 337** —
  валидация недостижима, хотя объявлена в `openapi.yaml:450` и в
  `docs/calc-input-validation.md` (`R3-D15`).
- **Двойная нормализация — 6 подтверждённых случаев** (тот же смысл на двух слоях):
  `ventilationReserveMode` (`validate.js:615-617` и `logic/heatlossByRooms.js:184-186`);
  `radiatorEmitterPreference` (`logic/heatingThermalRegimes.js:86-88` и
  `matching/internal/pickRadiatorsCore.js:266`); `roomExteriorLayout` (записывается в input на
  `validate.js:367`, но `logic/heatlossByRooms.js:98` **пересчитывает заново**, а
  `matching/internal/resolveMicroLoadRadiatorStrategy.js:40` читает записанное — два источника
  истины на одно поле); композиция ТП (`validate.js:408` и `logic/warmFloorCalc.js:96-98`);
  температурный график — **три** слоя (`heatingThermalRegimes.js:74-75`, затем
  `matching/radiators.js:19-25`); границы комнат — продублированы в TS на фронтенде
  (`frontend/src/utils/apartmentStackBoundaries.ts:14,21,57`).
- **Сценарий вреда:** инженер задаёт 55/45 и площадь мебели. Оба значения подменяются, оба
  предупреждения об этом теряются (`:768`), смета уходит заказчику с другим оборудованием.
  Инженер узнаёт об этом на объекте.
- **Стоимость починки:**
  - **Дешёвая и почти вся выгода — 2–4 часа:** заменить присваивание на `pushNormalizationWarning`
    в `validate.js:768,776`. Одна строка × 2. Снимает `N-08` / `RISK-API-06` целиком.
  - **Средняя — 4–6 часов:** перенести вызов `:361` (`assertBoilerDhwSchemeCompatibility`)
    в конец фазы 7, чтобы кросс-проверки шли после всех нормализаций, и поднять проверку
    `returnC ≥ supplyC` **до** `:306`. Снимает `R3-D15`.
  - **Дорогая и НЕ рекомендуемая сейчас — 3–5 дней:** разрезать `validate.js` на
    `normalizeInput()` + `assertInput()` с явным журналом изменений. Выгода — тестируемость и
    честный «что я изменил» в ответе. Делать **только вместе** с задачей «показать ошибку у поля»,
    иначе разрез не окупится.
- **Если не чинить никогда:** каждая новая доменная проверка будет добавляться в тот же
  785-строчный файл и рискует встать не с той стороны от нормализации, как уже случилось с
  `HEATING_SYSTEM_INVALID`.
- **Риск самой починки:** перестановка вызовов в фазе 7 меняет наблюдаемое поведение
  (появятся предупреждения, которых раньше не было, и оживёт мёртвая проверка). Нужен прогон
  `backend/scripts/verifyCalcInputValidation.js` и e2e-персон до/после.

---

### [A1-08] Модель данных Mongo: 10 000 проектов ломают admin-список, а список без проекции ломается ещё раньше

- **Ось:** A1 | **Категория:** **БЛОКЕР-B** (пункт 1–2), ДОЛГ (остальное)
- **Якорь:** `backend/src/api/projectsRoutes.js:154-163`; `backend/src/models/Project.js:38,39,47-49`;
  `backend/src/projects/serializeProject.js:41-67,114-122`;
  `backend/src/projects/projectAccess.js:83-114,163-165`;
  `backend/src/utils/mongoConnectionConfig.js:12-17`;
  `backend/src/auth/projectsAuthConfig.js:204-215`

**Схемы и индексы (полный список).** Все `new Schema(` — только в `backend/src/models/`.

| Коллекция | Индексы | Якорь |
|---|---|---|
| `projects` | `_id`; `{shareToken:1}` unique+sparse; `{updatedAt:-1}`; `{clientName:1}`; `{ownerId:1,updatedAt:-1}` | `Project.js:31,47,48,49` |
| `calculations` | `_id`; `{projectId:1}`; `{projectId:1,createdAt:-1}` | `Calculation.js:31-36,48` |
| `users` | `_id`; `{authProvider:1,providerUserId:1}` unique; `{email:1}` | `User.js:54,55` |
| `feedback` | `_id` + 3 одиночных + 4 составных = **8** | `Feedback.js:11,12-18,25,37-40` |
| `products` | `_id`; `{kind:1,catalogKey:1}` unique | `models/productSchemas.js:33` |
| `water_norms` | **ни одного** | `models/WaterNorms.js` |

Три поля `Project` — `Schema.Types.Mixed` (`survey` `:24`, `lastCalcInput` `:26`,
`shareSnapshot` `:38`), то есть схема **не валидирует ничего** внутри них. `versionKey: false`
(`:39`) — оптимистической блокировки нет (см. A1-04).

**Сверка каждого запроса с индексами.** Горячий путь покрыт хорошо: `Calculation.findOne({projectId})
.sort({createdAt:-1})` (`projectsRoutes.js:296-298,672,752`) идёт по `{projectId:1,createdAt:-1}`;
`Calculation.find({projectId}).sort({createdAt:-1})` (`:587-591`) — тоже;
`Calculation.aggregate([{$match:{projectId:{$in:ids}}}])` (`:168-171`) — тоже;
`Project.findOne({shareToken}).select({...})` (`backend/src/api/publicSharesRoutes.js:73-78`) —
unique-индекс **и явная проекция**, единственное образцовое место.
Единственная сортировка по неиндексированным полям во всей кодовой базе —
`WaterNorms.findOne({isActive:true}).sort({schemaVersion:-1,updatedAt:-1})`
(`backend/src/dhw/loadWaterNorms.js:38-40`) на коллекции из одного документа. Безопасно.

**Размеры (реальный прогон `buildReport` на `backend/scripts/testApartmentScheme2Payload.json`,
3-комнатная квартира):**

| Объект | JSON | BSON |
|---|---|---|
| `calcInput` нормализованный | 2 730 B | — |
| `report` целиком | 39 736 B | — |
| документ `calculations` | — | **54 706 B** |
| `shareSnapshot` | 33 866 B | **43 608 B**, глубина вложенности **8** |

Рост ≈ **2–3 kB на комнату** (замерено на 3 комнатах: `radiators.byRoom` 742 B/комн.,
`heatLoss.rooms` 1 234 B/комн.). Дом на 20 комнат → `report` ≈ 80–120 kB.
**НЕ ПРОВЕРЕНО:** прямой замер на 20 комнатах (прогон отклонён валидатором геометрии),
экстраполяция линейная.

**Вес одного проекта.** Расчёты **не встраиваются** в `projects` — они в отдельной коллекции
(`Calculation.js:44`), поэтому документ проекта **не растёт с числом расчётов**. Типично
`~200 B + survey ~5 kB + lastCalcInput 2.7 kB + shareSnapshot 43.6 kB ≈ 52 kB`.
Худший случай по guard'ам: 512 000 симв. `survey`
(`backend/src/projects/documentSizeLimits.js:9` → `validateProjectSurveyShape.js:19`)
+ 512 000 симв. `lastCalcInput` (`documentSizeLimits.js:12`) + **`shareSnapshot` без всякого
лимита** → **до ~13 MB** при потолке Mongo 16 MB.

**Дыра в защите размеров.** `assertCalculationDocumentSize` (14 MB, `documentSizeLimits.js:15,64-73`)
стоит на `projectsRoutes.js:518` и `importProjectBundle.js:80` — то есть **только на
`calculations`**. Запись `shareSnapshot` в `projects` (`projectsRoutes.js:779-788`) и
`project.save()` (`:526`) не проверяются ничем. Аналога `assertProjectDocumentSize` в коде нет.
Последняя линия обороны — перехват `BSONObjectTooLarge` (`backend/src/index.js:204-209`), который
при публикации share вернёт клиенту **вводящий в заблуждение** код `CALCULATION_DOCUMENT_TOO_LARGE`.

**Квоты.** `PROJECTS_MAX_PER_OWNER` default **200** (`projectsAuthConfig.js:204-207`),
`PROJECTS_MAX_CALCULATIONS_PER_PROJECT` default **100** (`:212-215`); применяются в
`projectAccess.js:193-204` (409 `PROJECT_QUOTA_EXCEEDED`) и `:210-221` (409
`CALCULATION_QUOTA_EXCEEDED`). Квоты **одинаковы для всех tier** — прямое подтверждение тезиса из
`_CONTEXT.md` о том, что `subscription` сейчас метка без квот; это материал A6.
Верхняя оценка одной коллекции `calculations` на проект при квоте: 100 × 55 kB ≈ **5.5 MB**.

#### ЧТО ПРОИЗОЙДЁТ ПРИ 10 000 ПРОЕКТОВ — конкретно

**Обычного пользователя это не касается вовсе.** Квота 200 на владельца
(`projectsAuthConfig.js:206`) + индекс `{ownerId:1,updatedAt:-1}` (`Project.js:49`) дают и фильтр,
и сортировку из индекса. Хоть 10 000, хоть миллион документов в базе — его список не деградирует.

**Ломается admin-список `GET /api/v1/projects`, и ломается в три слоя.**

**(1) Первым — `Project.find(filter)` БЕЗ проекции (`projectsRoutes.js:161`). Это ломается
раньше 10 000 — достаточно ~100 крупных проектов на одной странице.**
`.select()` отсутствует, поэтому из Mongo вытягиваются **полные** документы — со `survey`,
`lastCalcInput` и `shareSnapshot`. А сериализатор `serializeProjectListItem`
(`serializeProject.js:41-67`) использует **пять** полей: `_id`, `clientName`, `label`,
`createdAt`, `updatedAt` (+`ownerId`). При `?limit=100` и «жирных» проектах это **до ~100 MB в heap
на один HTTP-запрос**. На Render free (сон, ограниченная память) это OOM-рестарт процесса.
*Починка: `.select({ clientName: 1, label: 1, ownerId: 1, createdAt: 1, updatedAt: 1 })` — одна
строка, ~30 минут. Самая дешёвая правка во всей оси относительно предотвращённого ущерба.*
Ровно та же ошибка — в `GET /projects/:id/calculations` (`projectsRoutes.js:587-591`): индекс
идеален, но проекции нет, и ради `summary` (поле, которое для этого и завели —
`Calculation.js:9-23`, отдаётся `serializeProject.js:114-122`) вытягивается 100 × 55 kB ≈ **5.5 MB**
полных отчётов. И в `findAccessibleProjectLean` (`projectAccess.js:163-165`) — весь документ
проекта, включая `shareSnapshot`, на **каждый** доступ к проекту.

**(2) Вторым — `Project.countDocuments(filter)` при `filter === {}` (`projectsRoutes.js:162`).**
Для админа без `?ownerId`/`?ownerEmail` фильтр пуст (проверено: `projectAccess.js:83-114`
возвращает `{}`). `countDocuments` (в отличие от `estimatedDocumentCount`) транслируется в
`$match`+`$group` и при пустом предикате читает **все документы**: 10 000 × ~52 kB =
**~520 MB прочитанных данных на каждый запрос списка**. Индекса, который это покрывает,
**не существует в принципе**. Working set вымывается, и следом деградирует
`User.findOne({authProvider, providerUserId})` (`backend/src/auth/resolveUser.js:48-51`) —
а он выполняется на **каждый** аутентифицированный запрос (`backend/src/auth/runAuthPipeline.js:16`),
без кэша.
*Починка: `estimatedDocumentCount()` при пустом фильтре, либо keyset-пагинация без `total` —
как уже правильно сделано для feedback (`backend/src/api/adminFeedbackRoutes.js:87-95`). 2–3 часа.*

**(3) Третьим — `?search=` (`projectsRoutes.js:154-158`).**
`$regex` **не заякорен** (`^` не добавляется) и case-insensitive (`$options:'i'`), поэтому границы
индекса `{clientName:1}` (`Project.js:48`) неприменимы. У планировщика два плана, оба плохие:
IXSCAN по `{updatedAt:-1}` + FETCH всех 10 000 документов, либо полный IXSCAN по `{clientName:1}`
+ **блокирующая сортировка над полными документами** (проекции-то нет) — а это лимит 32 MB.
На выделенных тирах Mongo ≥ 4.4 спиллится на диск, на shared-тирах Atlas (M0/M2/M5) падает с
`QueryExceededMemoryLimitNoDiskUseAllowed` (292). **Тариф кластера в `docs/deploy/*` не указан —
НЕ ПРОВЕРЕНО**, поэтому какой из двух исходов реализуется, сказать нельзя. Индекса, который
одновременно обслужит `$regex/i` и `sort:{updatedAt:-1}`, **не существует** — нужно нормализованное
поле `clientNameLower` + заякоренный regex, либо collation, либо Atlas Search.
Заодно: существующий `{clientName:1}` (`Project.js:48`) **не используется полезно ни одним запросом**
и является мёртвым весом на записи.

**Усугубляющий фактор — нечем прервать долгий скан.** В `mongoConnectionConfig.js:12-17` не заданы
`maxPoolSize`, `minPoolSize` и `socketTimeoutMS`, а `.maxTimeMS()` не используется **нигде**
в кодовой базе. Зависший COLLSCAN будет держать сокет и слот пула бессрочно.

**Прочее, найденное попутно** (ДОЛГ/КОСМЕТИКА):
`User.findOne({email:{$regex:/^…$/i}})` (`backend/src/projects/projectOwnerMeta.js:54-58`) —
полный скан `users`, при том что поле уже `lowercase: true` (`User.js:25`) и достаточно точного
сравнения; `assertCanCreateCalculation` внутри цикла импорта (`importProjectBundle.js:64`) — до 100
`countDocuments` на один импорт; избыточные индексы `{projectId:1}` (полный префикс составного,
`Calculation.js:35` vs `:48`) и одиночные `type`/`status` в `feedback` (`Feedback.js:11,17` vs `:38-40`);
`syncIndexes()` вызывается только для `Product` (`backend/scripts/seed.js:322`) — устаревшие индексы
на проде не удаляются никогда.

- **Стоимость починки блокирующей части:** проекции (3 места) — **1 час**; `countDocuments` для
  админа — 2–3 часа; guard размера `shareSnapshot` — 1–2 часа. Итого **полдня** снимает и OOM,
  и деградацию при 10 000 проектов.
- **Если не чинить никогда:** обычные пользователи не заметят никогда (квота 200 их защищает).
  Владелец получит падение своего же admin-экрана ровно в тот момент, когда сервис начнёт расти —
  то есть в худший из возможных.
- **Риск самой починки:** добавление `.select()` требует проверить, что `serializeProjectListItem`
  и `loadOwnerEmailByOwnerId` (`projectsRoutes.js:174`) не читают других полей. Проверено по коду:
  не читают.
- **НЕ ПРОВЕРЕНО:** реальные планы выполнения (`explain()`) — работающего экземпляра Mongo в
  окружении не было; тариф кластера Atlas; фактический размер поля `survey` на проде.

---

### [A1-09] Циклические зависимости: все три безвредны, разрывать не надо

- **Ось:** A1 | **Категория:** **НЕ ТРОГАТЬ**
- **Якорь:** `backend/src/catalog/types.d.ts:6` ↔ `backend/src/types/boiler-types.d.ts:6`;
  `backend/src/hydraulics/types.d.ts:6-7` ↔ `backend/src/types/shared-types.d.ts:6,957-960`;
  `frontend/src/utils/roomEnvelopeFields.ts:14-17` ↔ `frontend/src/utils/roomExteriorLayout.ts:7`
- **Правило `_CONTEXT.md` соблюдено: файлы открыты, не только список из madge.**

**Цикл 1 и 2 (backend) — только между `.d.ts`.** Обе стороны используют исключительно
`import type` (`catalog/types.d.ts:6`, `types/boiler-types.d.ts:6`, `hydraulics/types.d.ts:6-7`,
`types/shared-types.d.ts:6`). Такие импорты стираются компилятором, в рантайм-графе их нет,
TypeScript циклы типов допускает по определению. `tsc --noEmit` зелёный
(`docs/audit/artifacts/lint-typecheck.txt`). **Ломаться нечему** — ни порядка инициализации, ни
каскада при правке: правка `catalog/types.d.ts` и так вызывает пересборку `shared-types.d.ts`,
цикл тут ни при чём, это просто взаимная ссылка доменных словарей.
Единственная сопутствующая проблема — размер `types/shared-types.d.ts` (**1 702 строки**,
крупнейший файл проекта), но это вопрос A3, а не циклов.

**Цикл 3 (frontend) — единственный runtime-цикл во всём монорепо, и он тоже безвреден.**
`roomEnvelopeFields.ts:14-17` импортирует `{ inferRoomExteriorLayout, showSecondExternalWall }`,
а `roomExteriorLayout.ts:7` — `{ createDefaultExternalWall }`. Открыл оба файла и проверил
**точки использования**:
- `createDefaultExternalWall()` вызывается на `roomExteriorLayout.ts:143` — **внутри тела функции**;
- `inferRoomExteriorLayout(...)` вызывается на `roomEnvelopeFields.ts:131-132` — **внутри тела функции**;
- top-level `const`-инициализаторов, которые бы обращались к импортированному символу, ни в одном
  файле нет (`roomExteriorLayout.ts:11,13` — литералы `'стена в неотапливаемый коридор'` и
  `new Set([...])`, импортов не используют).

Значит **TDZ-опасности нет**: к моменту первого вызова оба модуля полностью инициализированы.
ESM-live-bindings это обслуживают штатно, vite собирает без предупреждений (сборка проходит за 3.3 с,
`docs/audit/artifacts/frontend-build.txt`).
- **Стоит ли разрывать:** нет. Разрыв потребует вынести `createDefaultExternalWall` в третий файл —
  правка ради галочки в отчёте линтера, с ненулевым риском задеть логику наружных стен, которая
  и так фигурирует в QA-инцидентах (`U4-ux-adversarial.md:329`). **Оставить.**
- **Что стоит сделать вместо разрыва (10 минут):** зафиксировать в `dependency-cruiser`/`madge`
  исключение с комментарием, чтобы будущий прогон линтера не порождал ту же дискуссию заново.
  Даже это — КОСМЕТИКА.

---

### [A1-10] God-модули: восемь из десяти трогать не надо, две функции — настоящие

- **Ось:** A1 | **Категория:** см. по строкам

Разобрал все десять из списка. Критерий из брифинга: разрез оправдан, только если без него нельзя
(а) протестировать, (б) вставить платный гейт, (в) безопасно менять.

| Файл | Строк | Ответственностей | Вердикт |
|---|---|---|---|
| `backend/src/catalog/validateCatalog.js` | 1568 | **1** (валидация каталога), реализованная **29 маленькими функциями** и **1 экспортом** (`:1497`) | **НЕ ТРОГАТЬ** |
| `backend/src/report/buildFinancialBom.js` | 725 | **1** (сборка сметы), 19 функций, 6 экспортов | **НЕ ТРОГАТЬ** |
| `backend/src/logic/ufhLoopHydraulics.js` | 1002 | **1** (гидравлика петель ТП), 20 функций, 7 экспортов | **НЕ ТРОГАТЬ** |
| `backend/src/api/projectsRoutes.js` | 880 | 5 (CRUD, расчёт, история, PDF, share) в 13 обработчиках | ДОЛГ, разрез не требуется |
| `frontend/src/components/RoomsForm/RoomAccordionItem.tsx` | 1029 | 1 (форма комнаты), **0 хуков** | КОСМЕТИКА |
| `backend/src/report/buildReport.js` | 771 | 1 (оркестрация пайплайна) в 8 стадиях | ДОЛГ (см. A1-11) |
| `backend/src/api/validate.js` | 785 | **3+** | ДОЛГ — разобран в A1-07 |
| `frontend/src/AppSurveyContent.tsx` | 762 | **13** | ДОЛГ, разрез оправдан |
| `backend/src/matching/internal/pickRadiatorsCore.js` | 949 | 1, но **641 строка в одной функции**, cx=195 | ДОЛГ, разрез оправдан |
| `backend/src/matching/boiler.js` | 1164 | 1, но **657 строк в одной функции**, cx=148 | ДОЛГ, разрез оправдан |

**Явно оставить как есть — и вот почему это не лень:**

- **`validateCatalog.js` (1568)** — файл длинный, но **плоский**: 29 top-level функций, каждая
  ~50–200 строк, одна на тип товара: `validateBoiler` (`:204`), `validateRadiator` (`:351`),
  `validateWaterHeater` (`:461`), `validatePipe` (`:556`), `validatePump` (`:740`),
  `validateIndirectWaterHeater` (`:879`), `validateManifold` (`:1004`), `validateBoilerManifold`
  (`:1120`), `validateUnibox` (`:1258`). Разрезать на 9 файлов — **механическая правка с нулевой
  выгодой**: тестируемость не меняется (функции и так изолированы), гейт вставлять некуда,
  менять уже безопасно. Единственный минус — размер файла в IDE. **Не трогать.**
- **`buildFinancialBom.js` (725)** — тот же случай: `pushBoiler` (`:175`), `pushWaterHeaters`
  (`:210`), `pushRadiators` (`:268`), `pushManifolds` (`:335`), `pushUniboxes` (`:429`),
  `pushHydraulics` (`:513`), `pushLaborAndConsumables` (`:612`) — маленькие чистые функции,
  добавляющие строки в смету. **Не трогать.** Отдельно для A6: именно `pushLaborAndConsumables`
  (`:612-665`) — то место, куда однажды ляжет наценка/комиссия дилера, и оно уже изолировано.
- **`ufhLoopHydraulics.js` (1002)** — 20 функций, самая длинная ~135 строк, 7 экспортов.
  Декомпозирован лучше среднего по проекту. **Не трогать.**
- **`RoomAccordionItem.tsx` (1029, из них 907 в одной функции)** — самый обманчивый пункт списка.
  Проверил: `grep -c "useState\|useMemo\|useCallback\|useEffect\|useRef"` → **0**. Это **чистый
  управляемый компонент**: всё состояние приходит в props, все изменения уходят через
  `onChange: Dispatch<SetStateAction<RoomFormValue[]>>` (`:69`). 907 строк — это ~13 размеченных
  комментариями секций JSX (`:309` Название, `:324` Тип, `:357` Этаж, `:378` Границы, `:426`
  Площадь, `:445` Высота, `:464` Положение, `:715` Потолок, `:764` Кровля, `:816` Наружные стены,
  `:870` Окна). Распутывать нечего — состояния нет. Разрез на 13 подкомпонентов безопасен и
  механичен, но **делать его сейчас незачем**; сделать при следующей содержательной правке формы.
  **КОСМЕТИКА.**
- **`projectsRoutes.js` (880)** — 13 обработчиков в одной фабрике `createProjectsRouter`
  (`:125-880`), в среднем ~45 строк на маршрут. Разрез на 4 файла (CRUD / calc / share / pdf)
  выглядит красиво, но проверка по критериям даёт «нет»: тестируется через HTTP в любом случае,
  а **платный гейт вставляется middleware'ом, файл резать для этого не нужно** — квоты уже живут
  снаружи, в `projects/projectAccess.js:193-221`, и вызываются из обработчиков.
  **Оставить; чинить в этом файле надо не размер, а проекции запросов (A1-08).**

**Где разрез действительно оправдан:**

- **`pickRadiators` (`matching/internal/pickRadiatorsCore.js:226-949`, 641 строка, cx=195)** и
  **`pickBoiler` (`matching/boiler.js:443-1099`, 657 строк, cx=148)**. Обе — сердце подбора,
  то есть сердце сметы, то есть сердце будущих денег. У `pickRadiators` внутри уже размечены
  фазы комментариями: подготовка комнат (`:461` `for (const room of ...)`),
  «Pass 1: голоса» (`:548`), «Pass 2: финальный sizing» (`:591`), проверка инварианта
  «один displayKind» (`:789`), рекомендации (`:855`), сборка ответа (`:901`).
  Критерий (а) выполняется наполовину: логика **покрыта** сквозными verify-скриптами
  (`verify:radiator-sections`, `verify:radiator-emitters`, `verify:radiator-emitter-kind`,
  `verify:micro-load-radiator`, `verify:radiator-connection`, `verify:mixed-radiator-ufh` —
  6 из 52 в цепочке `backend/package.json`), но **изолированно проверить «голосование за тип
  прибора» отдельно от «подбора секций» нельзя**, а это две разные бизнес-темы.
  Критерий (в) — cx=195 означает, что при правке невозможно удержать в голове все ветки.
  - **Рекомендация:** извлечь из `pickRadiators` две функции — «Pass 1 → выбор типа прибора» и
    «Pass 2 → sizing одной комнаты», обе с явным объектом-контекстом. **8–12 часов.**
    Аналогично `pickBoiler`: выделить «подбор каскада» (уже есть `pickBestCascade` `:67`) и
    «сборка proposal» (уже есть `buildProposalObject` `:326`) — там половина работы сделана.
  - **Делать не сейчас, а при следующей содержательной правке подбора.** Категория — **ДОЛГ**,
    не блокер: сегодня оно работает и покрыто сквозными проверками.
- **`AppSurveyContent.tsx` (762, из них 621 в одной функции)** — **13 разных ответственностей**
  в одном компоненте: адаптер `dispatch`→setState из 12 `useCallback` (`:145-239`), загрузка
  каталога (`:142-143`), навигация по шагам (`:150-153`, `:405-424`), **два бизнес-правила
  с авто-`dispatch`** (`:251-284` рекомендованный термо-режим, `:356-383` сброс схемы ГВС),
  оркестрация комнат (`:286-295`), быстрая оценка (`:297`), разбор отчёта на 15 подсекций
  (`:301-321`), рендер форм пяти шагов (`:435-748`), рендер отчёта (`:680-724`),
  **инлайн-клампинг температуры прямо в JSX** (`:536`), обвязка chrome (`:402`, `:758`),
  статус расчёта (`:388-398`). 25 вызовов хуков, 17 входящих props (9 из них — просто списки
  пресетов, протянутые насквозь через **4 уровня** компонентов), 22 props у одного ребёнка
  (`RecommendationsBlock`, `:681-704`).
  Мешает разрезу ровно одно: **`draftRef`** (`:136-140`) — общее замыкание, от которого зависят
  8 из 12 `useCallback`, заведённое из-за ручного reference-сравнения (`:161`, `:171`, `:182`)
  вместо мемоизации в редьюсере.
  - **Рекомендация (по убыванию выгоды):** два бизнес-правила (`:251-284`, `:356-383`) перенести
    в `migrateDerivedState` — им место в редьюсере, а не в компоненте, и это **заодно чинит
    механизм из A1-05, пункт 2**; сеттеры вынести в `useSurveyDraftSetters()`; рендер отчёта —
    в `SurveyResultsSection`. **10–16 часов**, категория **ДОЛГ**.
- **`buildReport` (`report/buildReport.js:206-711`, 506 строк, cx=256)** — самая сложная функция
  проекта, но по структуре это **линейный пронумерованный пайплайн** из 8 стадий
  (`:226` климат, `:281` теплопотери, `:292` ТП, `:323` ГВС, `:421` подбор, `:517` коллекторы,
  `:565` униboxes, `:618` гидравлика). Цикломатика 256 набирается не вложенностью, а сотнями
  `??`/`?.`/тернарников в дефолтинге. Резать пайплайн на «шаг = функция» можно, но каждая
  стадия читает 5–10 локальных переменных предыдущих — придётся заводить объект-аккумулятор,
  и выгода сомнительна. **Категория ДОЛГ, приоритет низкий.** Единственная точка, которую
  трогать стоит, — сетевой вызов внутри (A1-11) и мутация `input` (ниже).
- **Побочная находка в `buildReport`:** `input.building.temps = {...}` на `:274` — **отчётный слой
  мутирует вход вызывающего**. Это единственная мутация `input` в файле, но она усиливает
  проблему из A1-07 (нормализация размазана) и делает `buildReport` не-чистой функцией.
  Правка на 30 минут: клонировать `designTemps` вместо записи в `input`. **ДОЛГ.**

---

### [A1-11] Единственное, что мешает вынести расчёт в очередь, — один сетевой вызов внутри `buildReport`

- **Ось:** A1 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/report/buildReport.js:231` (`await getDesignOutsideTempC(input.location)`);
  `backend/src/climate/geocode.js:18,62`; `backend/src/climate/snipClimate.js:94,268`
- **Что не так:** во всём `buildReport` ровно два `await` (`:231` и `:630`). Второй —
  локальная AJV-валидация. Первый — **сетевой запрос к Nominatim и Meteostat** прямо посреди
  расчётного пайплайна. Это единственное место, где чистое ядро (A1-03) касается внешнего мира.
  Кэша у `climate/` нет: `grep -n "cache\|Cache\|Map("` по `climate/geocode.js` и `climate/index.js`
  — **ноль совпадений** (в отличие от справочников, у которых кэш есть —
  `backend/src/reference/configCache.js`).
- **Сценарий вреда:** сегодня — каждый расчёт с указанным адресом и без явного `temps.outsideC`
  ходит наружу; таймауты берутся из env (`geocode.js:18`, `snipClimate.js:94`). При недоступности
  Nominatim расчёт не падает (есть warning на `buildReport.js:232-236`), но время ответа
  растягивается. Завтра — при переносе расчёта в очередь придётся либо тащить сеть в воркер,
  либо всё равно разделять.
- **Стоимость починки:** 3–5 часов. Поднять `getDesignOutsideTempC` **на уровень выше**, в
  `backend/src/api/runCalculation.js` (23 строки), и передавать `designOutsideTempC` внутрь
  `buildReport` готовым числом. После этого `buildReport` становится **полностью синхронной чистой
  функцией** (второй `await` — локальный AJV, его тоже можно вынести), и «вынести расчёт в очередь»
  превращается в «вызвать три функции из воркера». Плюс появляется место для кэша геокодера
  (адрес → координаты меняются раз в никогда).
- **Если не чинить никогда:** очередь всё равно можно сделать, просто воркеру понадобится
  сетевой доступ и обработка таймаутов — то есть +1 источник отказа в фоне вместо в запросе.
- **Риск самой починки:** низкий, вызов один и его результат используется в двух местах
  (`:231`, `:243`).

---

### [A1-12] PDF рендерится синхронно внутри HTTP-запроса, семафор — в памяти процесса

- **Ось:** A1 | **Категория:** ДОЛГ (сегодня), **БЛОКЕР-B** при переходе на несколько инстансов
- **Якорь:** `backend/src/api/projectsRoutes.js:688` (`await renderEstimatePdf(...)` в обработчике);
  `backend/src/projects/pdfRenderSemaphore.js:8,13-15,36-38`
- **Что не так:** Puppeteer/Chromium запускается **внутри запроса**. Защита есть и она разумная —
  семафор с лимитом `PDF_MAX_CONCURRENT` (default **2**, `pdfRenderSemaphore.js:13-15`) и
  ожиданием `PDF_QUEUE_WAIT_MS` (default 15 с, `:8,23-26`) → 503 `PDF_QUEUE_TIMEOUT`.
  Но состояние семафора — **модульные переменные** `let active = 0` и `const waiters = []`
  (`:36-38`), то есть он работает **только в пределах одного процесса**.
- **Сценарий вреда:** пока backend — один инстанс Render free, всё корректно. В момент, когда
  владелец начнёт брать деньги за PDF (веха B) и поднимет второй инстанс или включит autoscale,
  два процесса независимо разрешат по 2 рендера = 4 Chromium одновременно, и оба упадут по памяти.
  При этом сам платный сценарий («5–15 $ за документ») **требует** предсказуемого времени ответа —
  а сейчас его нет: PDF конкурирует за тот же event loop, что и расчёты.
- **Стоимость починки:** правильная (вынести PDF в фоновую задачу с опросом статуса) — **3–5 дней**,
  и **делать её сейчас не надо**. Дешёвая страховка на сегодня — **1 час**: зафиксировать в
  `docs/deploy/*`, что backend обязан быть в одном экземпляре, пока семафор in-process.
- **Если не чинить никогда:** пока один инстанс — ничего. Проблема просыпается ровно вместе с
  масштабированием.
- **Риск самой починки:** отложенный PDF меняет UX (нужен экран ожидания) — это продуктовое
  решение, не техническое.

---

### [A1-13] СИЛЬНАЯ СТОРОНА + одно расхождение: SSOT-документ не врёт про `backend/`

- **Ось:** A1 | **Категория:** КОСМЕТИКА (расхождения), НЕ ТРОГАТЬ (сам документ)
- **Якорь:** `docs/project-structure.md` (840 строк); проверка — скрипт сверки с `git ls-files`
- **Проверено машинно, в обе стороны:**
  - **Из 222 отслеживаемых файлов `backend/src` в документе упомянуты 222.** Ноль пропусков.
  - **Ссылок документа на несуществующие пути `backend/src` — ноль.**
  - По всему репозиторию из ~330 упомянутых путей не нашлось соответствия у **трёх**, и все три —
    прозаические, а не ложные: `test_data.json` (`:110` — сам документ помечает его как
    gitignored), `HydraulicsProposal/` (`:680` — упомянут как **пример запрещённого** размещения,
    существовать и не должен), `types/reportParsing.ts` (`:717` — в разделе «кандидаты на будущий
    рефакторинг», то есть будущий файл).

  Для документа на 840 строк, написанного вручную и поддержанного через 126 коммитов, это
  исключительно высокая точность. **SSOT, который не врёт, — это актив; не трогать, поддерживать.**
- **Что в нём всё же разошлось (две записи, обе уже зафиксированы другими агентами):**
  - `docs/project-structure.md:6` ссылается на `.cursorrules`, которого нет в репозитории
    (`.gitignore:9`) — это **M2-02**, из-за него падает корневой `npm run verify`. Ссылаюсь, не переоткрываю.
  - `docs/project-structure.md:66` описывает `shared/surveyMutationKinds.ts` как живой модуль,
    при этом у него **ноль импортов** (M1 §2.4). Ссылаюсь, не переоткрываю; работа A2.
- **`Plan.md`** (91 строка) — честный индекс, дублирования таблиц нет, прямо об этом сказано
  (`Plan.md:22`). Пайплайн расчёта в `Plan.md:27` совпадает с кодом
  (`backend/src/api/runCalculation.js:17-21`) дословно. Претензий нет.

---

### [A1-14] `shared/` — не свалка, но контракт односторонний, а `.d.ts` не сверяется с `.js` ничем (доказано экспериментом)

- **Ось:** A1 | **Категория:** ДОЛГ (маленький), **НЕ ТРОГАТЬ** в части «переписать пары»
- **Якорь:** `shared/` (13 пар `.js`+`.d.ts` + 1 `.ts`); `shared/tsconfig.json`;
  `frontend/tsconfig.app.json` (`include`); `backend/tsconfig.json` (`include`)

**Направление зависимостей.** `shared` ни от кого не зависит: 25 модулей, **5 связей**, средний
fan-out 0.20 (M1 §4). Свалкой не стал — все 13 модулей это узкие enum'ы и пресеты предметной
области. Но «общий контракт BE↔FE» на деле **односторонний**: 5 из 13 модулей потребляются
только backend'ом, у `heatingMatchingSchemes.js` перекос 13 файлов backend против 1 frontend
(M1 §2.4). Это не дефект — это факт, который стоит знать, прежде чем считать `shared/` симметричным
контрактом.

**Расходились ли пары `.js`/`.d.ts` за историю.** Посчитал по `git log` для каждой из 13 пар
(коммиты, трогающие только `.js`, только `.d.ts`, и оба сразу):

| Модуль | вместе | только `.js` | только `.d.ts` |
|---|---|---|---|
| `heatingMatchingSchemes` | 1 | 1 | 0 |
| `heatingThermalRegimePresets` | 1 | 1 | 0 |
| `heatingThermalRegimeRecommendations` | 1 | 1 | 0 |
| `radiatorConnection` | 1 | 1 | 0 |
| `radiatorEmitterPreference` | 1 | 1 | 0 |
| `roomDesignAirTemp` | 0 | 1 | 1 |
| `roomTypeNormalization` | 1 | 2 | 0 |
| `ufhCircuitPresets` | 1 | 1 | 0 |
| `ufhDistributionPresets` | 1 | 1 | 1 |
| `ufhModePresetIds` | 0 | 2 | 1 |
| `ufhTerminalControl` | 1 | 0 | 0 |
| `waterHeaterFormContract` | 1 | 0 | 0 |

**Вывод из чисел: пары почти не расходились, потому что файлы почти не менялись** — 1–3 коммита
на модуль за два месяца. Это enum'ы, они стабильны по природе. Реальная частота ручной
синхронизации — примерно раз в полтора месяца на модуль.

**Но гейт, который должен ловить расхождение, его не ловит. Проверено экспериментом.**
Скопировал `shared/` в скрэтчпад, сломал `radiatorConnection.d.ts` двумя способами сразу —
расширил union (`'side' | 'bottom'` → `+ 'diagonal'`) и добавил экспорт-фантом
`export declare const THIS_DOES_NOT_EXIST_IN_JS: number;`. Затем:
- `npm run typecheck` в `shared/` (то есть `tsc -p tsconfig.json --noEmit`) → **EXIT=0, ни одной ошибки**;
- добавил файл-потребитель `consumer.ts`, импортирующий фантомный символ и присваивающий его
  `number` → **tsc снова молчит**;
- `node -e "import('./radiatorConnection.js')…"` → **`THIS_DOES_NOT_EXIST_IN_JS = undefined`**.

TypeScript **не сверяет** рукописный `.d.ts` с соседним `.js` — при резолве `./X.js` декларация
просто побеждает реализацию. Ни `checkJs: true` в `shared/tsconfig.json`, ни `strict`-профиль этого
не меняют.

**Стоит ли трогать пары — нет, и вот почему.** Соблазн «удалить `.d.ts`, оставить JSDoc в `.js`»
разбивается о `frontend/tsconfig.app.json`: его `include` — `["src", "../shared/**/*.d.ts",
"../shared/**/*.ts"]`, `allowJs` отсутствует, стоит `erasableSyntaxOnly`. Фронтенд **физически
не может** прочитать `.js` из `shared/`. Пары существуют не по недосмотру, а потому что это
единственный способ отдать типы в TS-проект, не включая `allowJs` во фронтенде.
Переписывать `shared/` на `.ts` с генерацией — это менять сборку двух пакетов ради 13 стабильных
enum'ов. **Не окупается. НЕ ТРОГАТЬ.**

**Что стоит сделать вместо этого — дешёвый сторож (1–2 часа).**
Скрипт `shared/scripts/verifyDeclarationParity.mjs`: для каждой пары импортировать `X.js` в
рантайме, взять `Object.keys(module)`, распарсить имена `export declare` / `export type` из
`X.d.ts` и сверить множества. Ловит опасный класс (фантомный или пропущенный экспорт → `undefined`
в рантайме), не ловит несовпадение типов — и этого достаточно. Подключить в цепочку
`npm run typecheck --prefix shared`.
- **Сценарий вреда без сторожа:** владелец переименовывает константу в `.js`, забывает `.d.ts`.
  Backend и frontend продолжают компилироваться (декларация врёт обоим), а в рантайме приходит
  `undefined` — и, поскольку это enum схемы подбора, «подбор молча выбирает не то».
  Такого случая в истории **не было**, но и защиты от него нет никакой.
- **Если не чинить никогда:** вероятность реализации низкая (файлы стабильны), цена реализации —
  высокая (молчаливый неверный подбор). Классическая позиция для дешёвого сторожа, а не рефакторинга.

---

## 3. НЕ ТРОГАТЬ

Эта секция — такой же результат аудита, как список проблем. Всё ниже **выглядит неправильно
или числится в списках инструментов, но чинить это сейчас не надо**: работает, риск правки выше выгоды.

| # | Что | Почему не трогать | Якорь |
|---|---|---|---|
| 1 | **Три «цикла» из madge** | Два из трёх — только между `.d.ts`, стираются компилятором. Третий (frontend) — ESM-цикл, обе стороны используются **внутри тел функций**, TDZ-опасности нет, сборка зелёная. Разрыв = правка ради галочки в отчёте линтера, в коде наружных стен, который уже фигурирует в QA-инцидентах | A1-09 |
| 2 | **`validateCatalog.js` 1568 строк** | 29 маленьких функций, по одной на тип товара, один экспорт. Разрез на 9 файлов ничего не улучшает: изолированы уже сейчас | A1-10 |
| 3 | **`buildFinancialBom.js` 725 строк** | То же: 19 чистых функций `push*`. Плюс это будущая точка наценки/комиссии, и она уже изолирована (`:612-665`) | A1-10 |
| 4 | **`ufhLoopHydraulics.js` 1002 строки** | 20 функций, 7 экспортов, самая длинная ~135 строк. Декомпозиция выше средней по проекту | A1-10 |
| 5 | **`RoomAccordionItem.tsx`, 907 строк в одной функции** | **Ноль хуков.** Чистый управляемый компонент, 13 размеченных секций JSX. Распутывать нечего — состояния внутри нет | A1-10 |
| 6 | **`projectsRoutes.js` 880 строк / 13 маршрутов** | Платный гейт вставляется middleware'ом, резать файл для этого не нужно; квоты уже снаружи (`projects/projectAccess.js:193-221`). Чинить в этом файле надо **проекции**, а не размер | A1-08, A1-10 |
| 7 | **Пары `X.js` + `X.d.ts` в `shared/`** | Фронтенд **физически не может** читать `.js` (`frontend/tsconfig.app.json` без `allowJs`). Пары — не недосмотр, а единственный способ отдать типы. За историю почти не расходились (1–3 коммита на модуль). Нужен дешёвый сторож, а не переписывание | A1-14 |
| 8 | **Ко-локация загрузчиков (`dhw/loadAppliances.js` и т.п.) внутри доменных папок** | Это адаптеры «Mongo или файл», названные честно. Выносить в `infra/` — перестановка ради схемы | A1-03 |
| 9 | **`report` оркеструет `matching`/`hydraulics`, а не идёт «после» них** | Фактический порядок логичен и работает; документ ему не противоречит | §1 |
| 10 | **`buildReport` cx=256** | Это **линейный** пайплайн из 8 стадий, а не клубок ветвлений; сложность набирается дефолтингом через `??`/`?.`. Резать — заводить объект-аккумулятор ради метрики | A1-10 |
| 11 | **In-process семафор PDF** | Пока backend в одном экземпляре — корректен и разумен. Проблема просыпается вместе с масштабированием, не раньше | A1-12 |
| 12 | **22 из 31 обхода `public.js`** | Их «починка» через реэкспорты сделает barrel'ы толстыми и потянет весь домен в модульный граф (`logic/` начнёт тащить `runHydraulicsPipeline`). Сделать 9 бесплатных правок, остальное — оставить | A1-02 |
| 13 | **`api/errorCodes.js` и `sendErrorEnvelope.js`, импортируемые «снизу вверх»** | Формально инверсия слоёв, по существу — плоский словарь и чистая функция. Если однажды тронуть — то переносом в `src/errors/`, а не барьером | §1, A1-02 |
| 14 | **Избыточные индексы `{projectId:1}` и одиночные `type`/`status` в feedback** | Стоят копейки на записи, удаление требует ручного `dropIndex` на проде без `syncIndexes()` — риск правки выше выгоды | A1-08 |
| 15 | **`docs/project-structure.md`** | 222 из 222 файлов `backend/src` описаны верно, ложных ссылок ноль. Это актив — поддерживать, не «упрощать» | A1-13 |

---

## 4. Сильные стороны

Не вежливость — факты с якорями.

1. **Расчётное ядро свободно от инфраструктуры.** `logic/`, `matching/`, `hydraulics/`, `report/` —
   ноль `process.env`, ноль mongoose, ноль Express. Справочники приходят снаружи одним объектом
   `CalcRuntimeContext`, контракт проверяется `assertCalcRuntimeContext` на входе в каждый крупный
   модуль (`report/buildReport.js:207`, `matching/index.js:25`, `matching/boiler.js:23`,
   `api/validate.js:32`). **Это самое ценное архитектурное свойство проекта** — оно и даёт
   тестируемость 52 verify-скриптами без БД, и делает вынос расчёта в очередь дешёвым (A1-03).
2. **Контракт входа исполняем, а не декоративен.** `components/schemas/CalcInput.yaml` — не картинка
   в документации, а **тот же самый артефакт**, который бандлится и компилируется в AJV в рантайме
   (`backend/src/api/calcInputSchemaLoader.js:57,61`). Разойтись с реализацией физически не может.
   Это ровно причина, почему в реестре из 18 расхождений R3 **нет ни одного про тело запроса**
   (A1-06).
3. **`docs/project-structure.md` не врёт.** 222 из 222 файлов `backend/src`, ноль висячих ссылок
   на `backend/src`. Для рукописного документа на 840 строк это редкость (A1-13).
4. **Барьеры слоёв не выдуманы задним числом.** 6 групп `no-restricted-imports` с осмысленными
   русскими сообщениями (`backend/eslint.config.js:38-88`), включая запрет на удалённые legacy-кэши
   (`:102-104`). И — что важнее — **фактический граф им соответствует**: если конфиг починить,
   нарушений будет **ноль** (A1-01). Автор соблюдает собственные правила даже там, где линтер
   их не проверяет.
5. **Расчёты вынесены в отдельную коллекцию.** `Calculation` с `collection: 'calculations'`
   (`backend/src/models/Calculation.js:44`), а не массив внутри `Project`. Это решение спасает от
   роста документа проекта с числом расчётов — самой типичной ошибки в подобных схемах (A1-08).
6. **Защита размеров документов продумана заранее**: три уровня — символьные лимиты на `survey`
   и `calcInput`, BSON-лимит 14 MB на документ расчёта, перехват `BSONObjectTooLarge`
   как последняя линия (`backend/src/projects/documentSizeLimits.js:9,12,15,64-73,81-87`).
   Дыра ровно одна — `shareSnapshot`.
7. **Пагинация feedback сделана правильно** — keyset по `{createdAt:-1,_id:-1}` с полным набором
   составных индексов (`backend/src/api/adminFeedbackRoutes.js:87-107`, `models/Feedback.js:37-40`),
   а не `skip`. Владелец знает, как надо; просто не применил это к `projects`.
8. **`publicSharesRoutes.js:73-78`** — единственный запрос с явной проекцией и unique-индексом.
   Образец, который надо распространить на остальные (A1-08).
9. **Семафор PDF существует и разумен** (`backend/src/projects/pdfRenderSemaphore.js`) — про защиту
   Node от пика Chromium подумали до того, как это выстрелило.
10. **`surveySession/` — честный редьюсер** с закрытым union из 20 мутаций и exhaustiveness-guard
    (`frontend/src/surveySession/reduceSurveyMutation.ts:123-126`). Для фронтенда такого возраста
    это выше среднего; проблема не в редьюсере, а в том, что вокруг него живут ещё два хранилища
    (A1-05).
11. **Whitelist в `buildShareSnapshot`** (`backend/src/projects/buildShareSnapshot.js:72-91`) —
    публичная ссылка отдаёт срез по явному списку ключей, а не весь отчёт. `survey`,
    `lastCalcInput` и `ownerId` наружу не попадают by design.

---

## 5. Что делать, по порядку (только A1)

| Приоритет | Что | Часы | Находка |
|---|---|---|---|
| 1 | `.select()` в трёх запросах списков — снимает риск OOM на admin-экране | **1** | A1-08 |
| 2 | Флаш черновика на размонтирование + `pagehide`; `DRAFT_LOADED` перестаёт быть безусловной заменой | **4** | A1-04 |
| 3 | `_normalizationWarnings` — `push` вместо присваивания (`validate.js:768,776`) | **2** | A1-07 |
| 4 | Убрать `thermalRegimeTouchedRef`, читать состояние сессии напрямую | **2** | A1-05 |
| 5 | `try/catch` вокруг `setItem`; `schemaVersion` из будущего — не удалять, а откладывать | **3** | A1-04 |
| 6 | `estimatedDocumentCount` для админского списка; guard размера `shareSnapshot` | **4** | A1-08 |
| 7 | Починить flat-config барьера (6 таргетных блоков) + 9 бесплатных правок путей импорта | **4** | A1-01, A1-02 |
| 8 | `verifyOpenApiContract.js`: 4 enum-подмены + список путей + валидация ответа по схеме | **5** | A1-06 |
| 9 | `verifyDeclarationParity.mjs` для 13 пар `shared/` | **2** | A1-14 |
| 10 | Поднять `getDesignOutsideTempC` из `buildReport` в `runCalculation` | **4** | A1-11 |
| 11 | `versionKey` у `Project` + 409 при расхождении версии (до выхода на несколько устройств) | **3** | A1-04 |
| — | **Итого до вехи A + подготовка к B** | **~34 часа** | |
| позже | Разрез `pickRadiators` / `pickBoiler` на фазы — при следующей содержательной правке подбора | 8–12 | A1-10 |
| позже | Разгрузка `AppSurveyContent` (правила → в редьюсер, сеттеры → в хук) | 10–16 | A1-10 |
| позже | PDF в фон, если появится второй инстанс | 3–5 дней | A1-12 |

---

## 6. Что НЕ проверено

- **Планы выполнения запросов (`explain()`)** — работающего экземпляра MongoDB в окружении не было.
  Все выводы о покрытии индексами сделаны сопоставлением фильтр/сортировка ↔ объявленные индексы.
- **Тариф кластера Atlas** (M0/M2/M10/…) не указан ни в одном файле `docs/deploy/*`. От него зависит,
  спиллится ли блокирующая сортировка на диск или падает с ошибкой 292 — то есть **форма** отказа
  из A1-08, пункт 3, неизвестна.
- **Реальный размер поля `survey`** на проде. Замерены `calcInput`, `report`, `shareSnapshot`
  прогоном кода; `survey` оценён.
- **Размер `report` для дома на 20+ комнат** — прямой прогон отклонён валидатором геометрии,
  использована линейная экстраполяция от замера на 3 комнатах.
- **Какой именно файл пропустил madge** во фронтенде (372 из 373) — M1 пометил это как
  НЕ ПРОВЕРЕНО, я на этом выводов не строил.
- **Поведение backend при откате `.d.ts`-фантома** проверено на копии `shared/` в скрэтчпаде;
  прямой эксперимент на `backend/` не ставился (продуктовый код read-only), но резолюция там
  та же (`backend/tsconfig.json` включает и `../shared/**/*.js`, и `../shared/**/*.d.ts`).

---

## 7. Инструменты и артефакты этой оси

Ничего не устанавливалось: использованы уже присутствующие `eslint@10.2.1` (`--print-config`),
`node`, `git`, `@apidevtools/json-schema-ref-parser` из `backend/node_modules`.
Собственные одноразовые скрипты (подсчёт обходов `public.js`, сверка `docs/project-structure.md`
с `git ls-files`, эксперимент с `.d.ts`) выполнялись в скрэтчпаде и **удалены за собой**;
продуктовый код и `package.json` не изменялись, `git status` содержит только `docs/audit/`.
