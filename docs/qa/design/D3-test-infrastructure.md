# D3 — Инфраструктура тестирования

Дата: 2026-08-23. Автор: D3 (Staff QA Engineer).
Метод: чтение исходников. **Ни один прогон не выполнялся** — `node_modules` отсутствуют во всех
пакетах, зависимости не устанавливались, код продукта не менялся.
Все утверждения о коде — с якорем `path:line`. Где проверить не удалось — помечено «НЕ ПРОВЕРЕНО».

Опирается на: `_ORCH-NOTES.md` (N-09, N-15, N-28, N-32, N-33), `R4-test-infra-feasibility.md`,
`R2-e2e-surface.md` (§6, §8.3), `R6-fixtures-and-data.md` (§3, §4), `R3-api-contract.md` (§3, §6),
`S1-risk-register.md` (§2.10 INFRA).

---

## Резюме

| Слой | Инструмент | Решающее свойство **этого** проекта |
|---|---|---|
| Раннер unit/интеграции | **Vitest** (backend + frontend, отдельные конфиги) | env фиксируется **до импорта модулей** (`test.env` + `pool: 'forks'`, `isolate: true`) — обязательно, потому что rate-лимитеры создаются на импорт-тайме (`rateLimiters.js:70-110`, `createLimiter` зовёт `isRateLimitDisabled()` один раз, `:27`); репозиторий целиком ESM (`"type": "module"` во всех четырёх `package.json`) без `--experimental-*` флагов; frontend уже на Vite 8 и переиспользует `vite.config.ts` |
| HTTP-клиент интеграционных тестов | **встроенный `fetch` против `createApp()` + `server.listen(0)`** — без `supertest` | ноль новых зависимостей (важно для `verify:dead-code`/knip), и тот же процесс ⇒ доступен `invalidateReferenceCache()` (`reference/public.js:5`) |
| E2E | **Playwright** | trace viewer / video — буквально тот артефакт, который нужен под приоритет владельца #0 «проходимость анкеты»; `addInitScript` кладёт Bearer в `localStorage` без пересборки бандла (`authConfig.ts:5,70-80`); `vite preview` уже проксирует `/api` (`vite.config.ts:159-169`) ⇒ уровень «прод-артефакт» достижим |
| БД | **`mongodb-memory-server`**, fallback — сервис `mongo:7` в CI | транзакций/Atlas Search в коде нет (`grep startSession|withTransaction|$search` по `backend/src` → 0, R4 §1.5); переключение — одной `MONGODB_URI`, без правок кода. **Совместимость с `mongoose@9.5.0` не проверена — нужен пилот** |
| Каталог | `CATALOG_SOURCE=file` + `CATALOG_FILE_PATH` → `backend/test_data.json.example` | побайтовый детерминизм; `test_data.json` в `.gitignore`, поэтому целимся в `.example` напрямую |
| Мок внешнего HTTP | подмена `globalThis.fetch`: setup-файл (in-process) / `node --import preload.mjs` (E2E) | `geocode.js:59`, `snipClimate.js:108,132` зовут **глобальный** `fetch`, DI нет, URL захардкожены (`geocode.js:9`, `snipClimate.js:10,17`) ⇒ ноль правок прод-кода |
| Мок Clerk | **локальный JWKS-стаб (RS256 + `/.well-known/jwks.json`)** | единственный путь: HS256 в рантайме роняет процесс (`projectsAuthConfig.js:155-166` → `index.js:27-30`, N-33); стаб идёт по прод-ветке `verifyAccessToken.js:58-59` |
| Фикстуры | `ProjectExportBundle v1` через `POST /api/v1/projects/import` + генератор `fixtures:build` | импорт **не пересчитывает** отчёт (`importProjectBundle.js:2-3`) ⇒ состояние заморожено и не зависит от сети |
| PDF | отдельный CI-job, `PDF_REQUIRE_BROWSER=1` | иначе пропажа браузера — тихий `SKIP` (`verifyProjectPdf.js:133-136,144-146`) |
| Покрытие | `@vitest/coverage-v8`, ratchet-порог | v8-провайдер не требует инструментации исходников |

**Суммарная оценка инфраструктуры: 70–118 ч (≈ 9–15 рабочих дней одного инженера).**
Плюс зависимости, не принадлежащие D3, но без которых E2E не поедет:
`data-testid` ≈ 16–30 ч и DOM-маркеры фаз расчёта ≈ 14–25 ч (обе — R2 §6.3, §7),
наполнение FIX-01…FIX-13 доменным содержимым — работа D2/R6.
**С зависимостями: 100–173 ч.**

---

## 1. Инструменты и размещение в монорепо

### 1.1 Раннер unit/интеграционных тестов — Vitest

**Почему не `node:test`.** Три конкретных требования этого проекта, которых у `node:test` нет
из коробки:

1. **Env до импорта.** `calcRateLimiter` и пять его собратьев — module-level константы
   (`rateLimiters.js:69-110`), а `isRateLimitDisabled()` (`projectsAuthConfig.js:196-198`)
   вычисляется внутри `createLimiter` **один раз** (`rateLimiters.js:27`). Значит
   `RATE_LIMIT_DISABLED`, `CATALOG_SOURCE`, `PROJECTS_AUTH_ENABLED`, `AUTH_JWKS_URI` обязаны
   стоять до первого `import`. Vitest даёт `test.env` (применяется к процессу воркера
   до загрузки тестового модуля) + `setupFiles` + `pool: 'forks'` с `isolate: true` (свежий
   процесс на файл). В `node:test` это делается вручную обёртками-раннерами.
2. **Табличные кейсы и snapshot.** Приоритет владельца #2 — «полное покрытие расчётного ядра
   и движка подбора»: сотни кейсов с золотыми эталонами отчёта. `toMatchSnapshot` /
   `toMatchFileSnapshot` и `describe.each` — штатные; на `node:test` это своя обвязка.
3. **Покрытие.** `@vitest/coverage-v8` даёт lcov без инструментации; `node --experimental-test-coverage`
   на Node 22 ещё экспериментален, а по R4 §7.2 в проекте принципиально нет `--experimental-*`.

**Почему не Jest.** Все четыре пакета — `"type": "module"`; backend — `.js` с JSDoc и
`checkJs: true` (`backend/tsconfig.json`), frontend — TS + Vite 8. Jest в ESM требует
`--experimental-vm-modules` и трансформеров — прямое нарушение «никаких экспериментальных
флагов». Vitest переиспользует `frontend/vite.config.ts` целиком: алиасы, `define:
__APP_VERSION__/__APP_BUILD_DATE__/__APP_BUILD_ID__` (`vite.config.ts:141-145`) — без этого
компонентные тесты падают на неопределённых глобалах.

**Цена.** У backend Vite сейчас нет — vitest тянет его как транзитивную зависимость
(+1 крупная devDependency в `backend/`). Принимаем: альтернатива (`node:test` на backend +
vitest на frontend) даёт два синтаксиса ассертов, два отчёта и две конфигурации покрытия
на монорепо из трёх пакетов — дороже в поддержке, чем один Vite в devDependencies.

**Версия Node.** Матрица в CI: обязательный `22.22.0` (прод-паритет, диктуется
`react-router@8.3.0` с `engines: >=22.22.0`, R4 §7.2) + необязательный `26.7.0`
(`continue-on-error: true`) — ловит дрейф локальной среды разработчика, у которого сейчас
26.7.0 при `frontend/package.json:6` = `>=22.22.0 <23`.

### 1.2 E2E — Playwright

- **Оракул уже есть и он бесплатный.** DevPanel на `vite dev` доступен без авторизации
  (`isDevToolsEnabled.ts:10-12,31`), кнопка «Report» кладёт полный `calcReport` в `<pre>`
  (`DevPanel.tsx:172-181`), кнопка «POST /api/v1/calc» (`:154`) обходит debounce 700 мс и
  dedup (`useSurveyCalc.ts:132-136`). Это снимает главный источник флейков и главную проблему
  оракула ОТКАЗА B. Playwright умеет `JSON.parse(await locator.innerText())` без обвязки.
- **Обход Clerk без пересборки.** `context.addInitScript` ставит
  `localStorage['projectsApiBearerToken']` (`authConfig.ts:5,70-80`) — per-context,
  в отличие от `VITE_PROJECTS_BEARER_TOKEN`, который зашивается в бандл на этапе build
  (`projectsAuthToken.ts:37-41`).
- **`webServer`** поднимает backend (с preload-стабом) и `vite preview` одной командой;
  `preview.proxy['/api'] → http://localhost:3001` уже настроен (`vite.config.ts:159-169`),
  то есть прод-артефакт тестируется без отдельного реверс-прокси.
- **Cypress отвергнут:** нет multi-origin из коробки (понадобится, если позже добавим
  clerk-smoke на hosted-логин), нет параллелизма без платного Dashboard, навязывает свой
  ассерт-стек поверх vitest'овского.

**Двухуровневая схема E2E (из R2 §8.3):**

| Уровень | Против чего | Оракул | Доля кейсов |
|---|---|---|---|
| L1 «быстрый» | `vite dev` + backend | DevPanel `Report`/`CalcInput`/`Draft JSON` | ~80 % функциональных |
| L2 «золотой smoke» | `vite build` + `vite preview` | только DOM-маркеры и тексты UI | 6 сценариев из R2 §5.10 |

L1 проверяет **не тот бандл**, что едет в прод (`import.meta.env.DEV` включает и другие ветки:
`WarmFloorSection.tsx:122-129`, `DevToolsDock.tsx:19`). Поэтому L2 обязателен и он же — то,
что блокирует мерж. L2 невозможен без DOM-маркеров (R2 §7, RISK-INFRA-11/13).

### 1.3 Где физически живут тесты

```
/
  .nvmrc                                  # 22.22.0
  .github/workflows/{verify,test,e2e,nightly}.yml
  backend/
    vitest.config.ts                      # основной проект: unit + integration
    vitest.ratelimit.config.ts            # отдельный проект: лимиты и prod-маскирование ошибок
    tsconfig.tests.json                   # checkJs для tests/, отдельной командой
    tests/
      setup/            env.js  fetch-stub.js  mongo.js  jwks-stub.js  reference-cache.js
      preload/          fetch-stub.preload.mjs         # для `node --import` в E2E
      helpers/          createTestServer.js  issueToken.js  importFixture.js
      fixtures/
        climate/        stations-lite.json  nominatim/*.json  daily/<stationId>/<year>.csv
        inputs/         FIX-01.calcInput.json … FIX-13.calcInput.json
        projects/       FIX-01-<slug>.r1.bundle.json …
        golden/         FIX-01.report.json …
        MANIFEST.json
      unit/**/*.test.js
      integration/**/*.test.js
  frontend/
    vitest.config.ts
    tests/
      setup/            testing-library.ts
      unit/**/*.test.ts                    # чистые утилиты, миграции черновика
      component/**/*.test.tsx              # формы шагов
  e2e/
    package.json                           # собственный, чтобы @playwright/test не висел в frontend
    playwright.config.ts
    global-setup.ts                        # JWKS-стаб, фикстуры, storageState
    tests/**/*.spec.ts
    fixtures/  helpers/
```

**Конвенции именования.**
- Backend-тесты — `.test.js` **с JSDoc**, не `.ts`: тот же стиль, что весь `backend/src`,
  и типизируются тем же `checkJs`. Не появляется второй язык внутри пакета.
- Frontend — `.test.ts` / `.test.tsx`.
- Playwright — `.spec.ts`. Разные расширения нужны, чтобы `vitest` не подхватил E2E:
  `include` вида `tests/**/*.test.*` физически не пересекается с `e2e/**/*.spec.ts`.
- Имя файла = имя тестируемого модуля: `matching/boiler.test.js` рядом по смыслу с
  `src/matching/boiler.js`, но физически в `tests/unit/matching/`.
- Идентификатор кейса из TEST_PLAN идёт первым словом в `it()`: `it('CALC-017: …')` —
  чтобы отчёт CI сшивался с планом.

### 1.4 Сосуществование с `npm run verify` — и постепенное вытеснение

**Правило №1: `npm run verify` не трогаем вообще.** Ни одного нового звена в цепочках
`backend/package.json:13`, `frontend/package.json:29`, корневой `package.json:"verify"`.
Причина: сейчас это единственный приёмочный гейт; вплетение туда E2E означает, что один
флейк блокирует `lint` и `typecheck`.

**Правило №2: тесты живут вне зон сканирования всех существующих гейтов.** Проверено:

| Гейт | Область сканирования | Якорь | `tests/` затронут? |
|---|---|---|---|
| `verify:type-bypass` | `frontend/src`, `backend/src`, `backend/scripts`, `shared` | `scripts/verifyNoTypeBypass.mjs:13-18` | **нет** |
| backend `lint` | `"src/**/*.js" "scripts/**/*.js"` | `backend/package.json:9` | **нет** |
| backend `typecheck` | `include: src/**/*.js, scripts/**/*` | `backend/tsconfig.json:16-24` | **нет** (нужен отдельный `tsconfig.tests.json`) |
| frontend `lint` (`eslint .`) | strict-правила в блоке `files: ['src/**/*.{ts,tsx}']` | `frontend/eslint.config.js:23` | формально линтится, но **без** `strictTypeChecked` |
| frontend `typecheck` (`tsc -b`) | `tsconfig.app.json: include ["src", …]`, `tsconfig.node.json: include ["vite.config.ts","eslint.config.js"]` | — | **нет** |
| `verify:report-colocation` | `frontend/src` | `verifyReportColocation.mjs:11` (`srcRoot = ../src`) | **нет** — снимаю пометку «НЕ ПРОВЕРЕНО» из R4 §НЕ ПРОВЕРЕНО п.8 |
| `verify:types-placement` | `frontend/src` | `verifyTypesPlacement.mjs:11` (`srcRoot = ../src`) | **нет** — то же |
| `verify:dead-code` (knip) | `project: ["src/**/*.{ts,tsx}"]` | `frontend/knip.json:3` | **ДА, риск — см. ниже** |

**Правило №3: knip.** `verify:dead-code` гоняется как
`knip --treat-config-hints-as-errors` (`frontend/package.json:20`). Добавление `vitest`,
`@vitest/coverage-v8`, `@testing-library/react` в `frontend/devDependencies` даст
«Unused devDependencies», потому что из `src/**` они не видны. Два пути:

- **A (рекомендуемый).** Расширить `frontend/knip.json`: `project` → `["src/**/*.{ts,tsx}",
  "tests/**/*.{ts,tsx}"]`, `entry` → добавить `"tests/**/*.test.{ts,tsx}"` и
  `"vitest.config.ts"`. Knip имеет собственный плагин vitest и, увидев `vitest.config.ts`,
  сам считает `vitest` использованным. Плюс: тестовый код заодно попадает под
  проверку мёртвого кода. Минус: knip начнёт ругаться на неиспользуемые экспорты хелперов —
  лечится `ignoreExportsUsedInFile` (уже стоит, `knip.json:4`) и точечным `entry` для
  `tests/helpers/**`.
- **B (запасной).** `ignoreDependencies: [..., "vitest", "@vitest/coverage-v8", …]`.
  **Осторожно:** `--treat-config-hints-as-errors` превращает в ошибку и подсказку
  «unused item in ignoreDependencies», то есть список придётся держать точным.
- `@playwright/test` в `frontend/` **не появляется вообще** — он живёт в `e2e/package.json`,
  который knip не сканирует. Это и есть причина вынести E2E в отдельный пакет.

**НЕ ПРОВЕРЕНО:** фактическое поведение knip 5 с расширенным `project` — требует прогона
после установки зависимостей. Заложить 1–2 ч на подгонку.

**Правило №4: новые npm-скрипты — рядом, не внутри.**

```
backend:  "test": "vitest run",  "test:watch": "vitest",
          "test:coverage": "vitest run --coverage",
          "test:ratelimit": "vitest run -c vitest.ratelimit.config.ts",
          "typecheck:tests": "tsc -p tsconfig.tests.json --noEmit",
          "fixtures:build": "node tests/tools/buildFixtures.js"
frontend: "test": "vitest run",  "test:coverage": "vitest run --coverage"
root:     "test": "npm test --prefix backend && npm test --prefix frontend",
          "test:e2e": "npm test --prefix e2e"
```

**Правило №5: политика вытеснения verify-скриптов.** Сейчас их 68, реально исполняются 61
(N-32; из 68 три — мёртвый груз: `verifyRoomExteriorLayoutHeatLoss.js` без npm-записи,
`verify:projects-admin-access` и `verify:mongo-db` вне цепочки, N-15). Вытеснение — не «удалили
и переписали», а формальная процедура:

1. Заводится `docs/qa/verify-migration.md` — таблица `verify-скрипт → тест-файл(ы) →
   покрытые инварианты → дата снятия → PR`.
2. Скрипт снимается из цепочки **только** когда все его `assert` перенесены в `it()` и
   тест зелёный в CI минимум на 5 прогонах. До этого гоняются оба — двойная работа
   осознанная и временная.
3. Перенос механический: скрипты уже написаны на `node:assert/strict`
   (`verifyLanguagePolicy.mjs:6`, `verifyReportColocation.mjs:6`, `verifyTypesPlacement.mjs:6`
   и остальные) — `assert.ok(...)` → `expect(...).toBe(true)` либо остаётся `assert` внутри
   `it()`, vitest это принимает. Средняя цена одного скрипта — **0.5–1.5 ч**.
4. **Порядок вытеснения по доходности:**
   - **первыми** — три мёртвых скрипта (их вообще никто не гоняет, а
     `verifyRoomExteriorLayoutHeatLoss.js` по R1 содержателен — числовая проверка теплопотерь
     через ограждения);
   - **вторыми** — доменные ассерт-скрипты расчётного ядра (`verify:financial-bom`,
     `verify:hydraulics-pipeline`, `verify:manifold-matching`, `verify:unibox-matching`,
     `verify:room-design-air-temp`): у них уже есть кейсы, им не хватает только табличности
     и пер-кейсового отчёта;
   - **третьими** — auth-скрипты (`verify:auth-pipeline` и соседи): они in-process unit,
     а после появления JWKS-стаба их можно поднять до честных HTTP-тестов, то есть перенос
     ещё и **увеличивает** покрытие;
   - **последними, и, возможно, никогда** — «структурные» скрипты, которые читают файлы
     регулярками (`verify:report-colocation`, `verify:types-placement`, `verify:seo`,
     `verify:language-policy`). Это архитектурные линтеры, а не тесты; им место в `verify`,
     не в vitest. Их **не вытесняем** — это осознанное решение, а не недоделка.
5. Целевое состояние через 2–3 месяца: в `verify` остаются lint, typecheck, knip, build и
   ~12–15 структурных линтеров; ~45 доменных скриптов заменены на vitest-сьюты с покрытием.

---

## 2. Изоляция, БД, состояние, параллелизм

### 2.1 Поднятие backend: правка `createApp()`

**Проблема (подтверждена чтением).** `backend/src/index.js` собирает Express на верхнем
уровне модуля: `const app = express()` (`index.js:43`), затем middleware, `await createRoutes()`
(`:124`), прогрев кэша (`:154-164`), `app.use(handleApiError)` (`:255`) и
`const server = app.listen(PORT, '0.0.0.0', …)` (`:257`). Экспорта `app` нет вообще.
Плюс на самом верху — `assertAuthConfiguredForProduction(); assertAuthConfiguredWhenEnabled();
if (process.exitCode === 1) process.exit(1);` (`:26-30`), то есть простой `import` модуля
в тесте может убить процесс раннера.

Собрать app в тесте вручную из `createRoutes()` (`api/public.js:5`) можно, но
`handleApiError` — приватная функция модуля (`index.js:173-253`), не экспортируется. В ней
живут: маскирование деталей 500 в production, `PAYLOAD_TOO_LARGE`, `BAD_JSON`,
`CALCULATION_DOCUMENT_TOO_LARGE` (`isMongoBsonObjectTooLargeError`, импорт `:20`). Дублировать
её в тестах — значит тестировать копию: коды поедут врозь от прод-реальности в первом же
рефакторинге.

**Правка П1.** Новый `backend/src/app.js` с `export async function createApp()`, куда
переезжает **без изменений** содержимое `index.js:32-255` (обработчики `unhandledRejection`
оставить в `index.js` — это свойство процесса, не приложения). `index.js` сжимается до:
загрузка `.env` → два `assert*` + `process.exit(1)` → `const app = await createApp()` →
`app.listen` → `server.on('error')`.

**Почему это минимально необходимо.** Без неё остаются только два варианта, оба хуже:
(а) process-based HTTP-тесты — теряется программный `invalidateReferenceCache()`
(`reference/public.js:5`), теряется подмена env между кейсами, каждый файл платит ~1–2 с
за старт процесса; (б) дублирование `handleApiError` — тесты перестают отражать прод.

**Что правка НЕ меняет:** порядок middleware, поведение `app.listen`, ассерты auth-конфигурации
(они остаются в `index.js`, до `createApp()`). Поведение прода идентично.
**Оценка: 3–6 ч** включая прогон `npm run verify` в backend.

**Как тест им пользуется** (псевдокод, не код):
```
const app = await createApp()
const server = app.listen(0, '127.0.0.1')      // эфемерный порт
const base = `http://127.0.0.1:${server.address().port}`
// … fetch(`${base}/api/v1/calc`, …) — встроенный fetch, без supertest
afterAll(() => new Promise(r => server.close(r)))
```
`listen(0)` вместо фиксированного порта снимает конфликт между параллельными воркерами.
`supertest` сознательно не берём: это новая зависимость ради синтаксического сахара, а
`fetch` в проекте уже используется повсеместно.

### 2.2 Стратегия БД

**Выбор: `mongodb-memory-server` основной, docker `mongo:7` — fallback.**

За memory-server:
- герметичность: в CI не нужен `services:`-блок и docker локально; разработчик запускает
  тесты сразу после `npm ci`;
- изоляция по процессу: при `pool: 'forks'` каждый тестовый файл получает свой mongod
  на своём порту — никаких гонок между файлами вообще;
- фичи replica-set не нужны: `grep startSession|withTransaction|$search` по `backend/src`
  даёт 0 (R4 §1.5) — хватает standalone;
- индексы в моделях обычные (`Project.js:31,47-49`), memory-server их создаст;
- `applyMongoFriendlyDnsForUri` для `mongodb://127.0.0.1:…` выходит сразу
  (`mongoDnsPreferPublic.js:20`) — глобальный `dns.setServers` локальный коннект не портит.

Против docker `mongo:7`: требует Docker локально (у части разработчиков его нет), стартует
дольше, и параллельность упирается в один инстанс — приходится городить уникальный
`MONGODB_DB` на воркер, то есть ту же изоляцию, но хуже.

**Два обязательных нюанса, оба из кода:**
1. `normalizeMongoUri` бросает ошибку, если в URI нет имени БД и не задан `MONGODB_DB`
   (`mongoConnectionConfig.js:41-47`), а memory-server отдаёт `mongodb://127.0.0.1:PORT/`.
   ⇒ setup обязан ставить `MONGODB_DB=heatcalc_test` **или** дописывать имя в URI.
2. `normalizeMongoUri` принудительно добавляет `retryWrites=true&w=majority`
   (`mongoConnectionConfig.js:49-54`). Поведение standalone-mongod с `w=majority` —
   **НЕ ПРОВЕРЕНО**. Ожидается, что пройдёт (standalone трактует majority как w:1), но это
   **пункт №1 пилота**.

**Пилот (обязателен до фиксации, 4–8 ч):** поставить `mongodb-memory-server`, поднять один
инстанс, выполнить `Project.create` + `Calculation.create` + `find` + `dropDatabase` через
`mongoose@9.5.0`. Красный пилот ⇒ переключаемся на docker-сервис одной переменной
`MONGODB_URI`, без единой правки кода. Это и есть страховка RISK-INFRA-16.

**Какие тесты вообще без Mongo.** Расчётное ядро, matching, гидравлика, финансовая смета,
HTML для PDF, валидация — прямым вызовом `runCalculation()` / `buildReport()` при
`CATALOG_SOURCE=file`. `runCalculation` (`api/runCalculation.js:16-22`) не обращается к Mongo
ни разу. Это самый быстрый и самый ценный пласт (приоритет владельца #2) — он не должен
платить за БД.

### 2.3 Сброс состояния между тестами

| Что | Как сбрасывается | Когда |
|---|---|---|
| Кэш справочников (in-process) | `invalidateReferenceCache()` / `invalidateAndWarmReferenceCache()` из `reference/public.js:5` | `beforeEach` **только** в файлах, меняющих источник справочников. `cacheGeneration` бампается (`configCache.js:103-118`), поэтому «висящий» refresh не перезапишет свежий снимок — сброс безопасен |
| Кэш справочников (E2E, чужой процесс) | `POST /api/v1/system/invalidate-reference-cache` с заголовком `X-System-Token` (`systemRoutes.js:28-60`) | между сьютами, меняющими каталог. Требует `SYSTEM_INTERNAL_TOKEN` в env сервера, иначе `503 SYSTEM_TOKEN_NOT_CONFIGURED` (`systemRoutes.js:31-35`) |
| `REFERENCE_CACHE_TTL_MS` | не трогаем (дефолт 3 600 000 мс, `configCache.js:14`) | длинный TTL — благо: кэш стабилен внутри прогона |
| Mongo | `dropDatabase()` в `afterEach` для пишущих файлов; читающие сьюты сидируются один раз в `beforeAll` | всегда |
| Проекты, созданные через API | `DELETE /api/v1/projects/:id` (`projectsRoutes.js:387`) в teardown | E2E. **Обязательно:** квоты 200 проектов/владелец и 100 расчётов/проект (`projectAccess.js:193-217`) — сьют без teardown упрётся в `409 PROJECT_QUOTA_EXCEEDED` |
| Store rate-лимитеров | **не сбрасывается никак** — только новый процесс | см. 2.5 |
| `remoteJwks` в `verifyAccessToken.js:10` | module-level, живёт до конца процесса | ⇒ один keypair и один порт стаба на процесс |
| `stationsLiteCachePromise` (`snipClimate.js:19-20`) | **не экспортирован, без TTL, до конца процесса** | ⇒ климат-тесты изолируются файлом (свой форк), предзаполнить кэш нельзя, перехватывается транспорт |
| Frontend `localStorage` (`heatcalc:survey-draft:v1`) | свежий `browser.newContext()` на тест | Playwright, по умолчанию |

### 2.4 Параллелизм и его границы

| Сьют | Пул | Параллельность | Ограничение |
|---|---|---|---|
| Чистый расчёт (`tests/unit/**`, без Mongo) | `forks`, `isolate: true` | по числу CPU | нет общего состояния; каждый форк держит свой reference-кэш |
| Интеграция HTTP + Mongo | `forks`, `isolate: true` | `maxForks = min(cpus, 4)` | свой mongod и свой JWKS-стаб на форк; порты эфемерные (`listen(0)`) |
| Rate-limit / prod-маскирование ошибок | отдельный конфиг | `fileParallelism: false` | env фиксируется на импорт-тайме, `NODE_ENV=production` меняет поведение всего процесса |
| Playwright L1 | воркеры Playwright | 2–4 локально, **1–2 в CI** | общий backend-процесс: общая Mongo, общий store лимитеров, общий reference-кэш |
| Playwright L2 (smoke) | — | 1 | «золотой» набор, важна воспроизводимость, не скорость |

**Границы, которые нельзя перейти:**
- Playwright-воркеры делят **один** backend. Значит: (а) `RATE_LIMIT_DISABLED=true` обязателен,
  иначе автопересчёт с дебаунсом 700 мс съест dev-лимит 120/15 мин (`rateLimiters.js:64-74`)
  за несколько параллельных прогонов анкеты — это RISK-PERF-05 в миниатюре; (б) каждый
  воркер работает со своим `clientName` с уникальным префиксом, чтобы `GET /api/v1/projects`
  не видел чужие; (в) сценарии, инвалидирующие reference-кэш, помечаются
  `test.describe.serial` и не идут параллельно ни с чем.
- Тесты, требующие `NODE_ENV=production` (маскирование деталей 500 в `index.js:230-241`),
  живут **в отдельном конфиге и отдельном job**: `isRateLimitDisabled()` возвращает false
  при production (`projectsAuthConfig.js:196-198`), то есть в этом процессе лимиты живые.

### 2.5 Изоляция rate-лимитеров — точный рецепт

Факт: лимитер выбирается **на импорт-тайме** (`rateLimiters.js:27` внутри `createLimiter`,
вызовы `:69-110`), и `isRateLimitDisabled()` = `!isProductionRuntime() && RATE_LIMIT_DISABLED === 'true'`
(`projectsAuthConfig.js:196-198`). Отсюда три правила:

1. **По умолчанию во всех тестовых конфигурациях:** `RATE_LIMIT_DISABLED=true` и
   `NODE_ENV=test` в `test.env` — то есть до импорта. Менять между кейсами внутри процесса
   **бесполезно**, значение уже зафиксировано в замыкании.
2. **Тесты самих лимитов** (429, `CALC_RATE_LIMIT_EXCEEDED`, ключ `user:` vs IP —
   `resolveRateLimitKey`, `rateLimiters.js:14-20`) идут в `vitest.ratelimit.config.ts`:
   `NODE_ENV=test`, `RATE_LIMIT_DISABLED` **не задан**, а лимиты опущены до проверяемых
   значений через env: `RATE_LIMIT_CALC_PER_15M=3`, `RATE_LIMIT_PROJECTS_WRITE_PER_15M=3`
   и т. д. (`envLimit`, `rateLimiters.js:58-62`). Это честнее, чем `NODE_ENV=production`:
   не тащит за собой маскирование ошибок и HSTS.
3. **Store не сбрасывается.** Один файл = один процесс = один свежий store. Два кейса на
   один лимитер в одном файле обязаны учитывать счётчик друг друга либо разводиться по
   разным ключам (разные `user:` в токене — самый простой способ).

---

## 3. Моки: климат и Clerk (JWKS-стаб)

### 3.1 Где вообще нужны моки климата

**N-09 закрывает браузерные E2E.** Геокодирование запускается только при
`if (input.location && inputTemps?.outsideC == null)` (`buildReport.js:229`), а фронт всегда
шлёт `outsideC` (`buildCalcRequestPayload.ts:198-199`) и никогда не шлёт `location`. Поля
«Місто» в анкете нет. ⇒ **браузерные E2E герметичны by construction, моки внешнего HTTP
им не нужны.**

Но R5 нашёл в этом же коде дефекты, значит покрытие нужно на уровне unit/API:
- `snipClimate.js:342` — расчётная температура берётся как минимум 5-дневного скользящего
  среднего по среднесуточным (`minRollingAverage(allTavg, 5)`), а не как пятидневка
  обеспеченностью 0.92;
- `snipClimate.js:248-250` — `const n = Number(v); if (Number.isFinite(n)) out.push(n)`;
  `Number('') === 0`, то есть пустая ячейка CSV даёт настоящий 0 °C в ряду.

### 3.2 Механизм подмены

Оба модуля зовут **глобальный** `fetch`: `geocode.js:59`, `snipClimate.js:108` (`fetchBuffer`),
`snipClimate.js:132` (`headOk`). DI нет, URL — константы `geocode.js:9`, `snipClimate.js:10,17`.
Больше исходящих `fetch` в `backend/src` нет, кроме JWKS внутри `jose`.

- **In-process (vitest):** `setupFiles` → `tests/setup/fetch-stub.js` подменяет
  `globalThis.fetch` **до** импорта прод-модулей.
- **E2E (backend — отдельный процесс):** запуск как
  `node --import ./tests/preload/fetch-stub.preload.mjs src/index.js`. Preload грузится
  раньше `src/index.js`. **Прод-код и прод-скрипты `package.json` не меняются** — команда
  живёт в `playwright.config.ts` (`webServer.command`).
- **Критично:** стаб держит ссылку на настоящий `fetch` и **пропускает** запросы к
  `127.0.0.1` / `localhost` (это наш собственный тест-клиент и JWKS-стаб). Внешний хост:
  есть фикстура → отдаём; нет → **бросаем ошибку с URL**. Молчаливый passthrough в интернет
  запрещён — иначе тест зелёный за счёт чужого аптайма.
- **MSW (`msw/node` v2)** — допустимая замена (декларативные handlers,
  `onUnhandledRequest: 'error'`), но это +1 зависимость ради DX. Начинаем без неё.
- **`undici` MockAgent — не использовать:** потребует `undici` прямой зависимостью (в lock
  только транзитивный `undici-types`), а связка внешнего и встроенного undici неявная.

### 3.3 Какие фикстуры записать

**Города — четыре плюс два негативных.** Три «рабочих» покрывают разные ветки подбора
мощности, четвёртый нужен под баг `Number('')`:

| Фикстура | Что кодирует | Зачем |
|---|---|---|
| `odesa` (юг) | тёплая зима | верхняя граница `designOutsideTempC` |
| `kyiv` (центр) | средняя полоса | базовый кейс, эталон против ручного расчёта |
| `sumy` (северо-восток) | холодная зима | нижняя граница; ловит N-09 (дефолт −5 °C против реальных −19…−23) |
| `gapcity` | CSV с **пустыми** ячейками `tavg` | регресс на `snipClimate.js:248` — ожидание: 0 °C **не** попадает в ряд |
| `nostation` | координаты вдали от станций | `502 METEOSTAT_NO_STATION` (`snipClimate.js:279-283`) |
| `notfound` | Nominatim вернул пустой массив | ветка ошибки геокодинга |

**Состав на один город** (выведен из кода `getDesignOutsideTempFromMeteostat`,
`snipClimate.js:267-350`):
1. один **общий** `stations-lite.json` на весь пакет — код читает только `id/lat/lon` и
   считает haversine (`snipClimate.js:170-183,197-226`). Урезаем до ~30 станций;
2. до 3 HEAD-проб последних лет (`snipClimate.js:300-310`) — телo не нужно, достаточно `ok: true`;
3. `windowYears` = `METEOSTAT_YEARS` + 1 файл (`:286-290`), при `METEOSTAT_YEARS=10` — **11**
   CSV `daily/{year}/{stationId}.csv.gz` (`:322-340`);
4. один JSON-ответ Nominatim (читаются только `lat`, `lon`, `display_name`, `geocode.js:98-106`).

**Как хранить.** Фикстуры **несжатые**, стаб гзипует на лету (прод делает `gunzipSync`,
`snipClimate.js:151,333`) — это даёт читаемый git-diff. Путь:
`backend/tests/fixtures/climate/{stations-lite.json | nominatim/<slug>.json |
daily/<stationId>/<year>.csv}`. Размер: ~365 строк × 11 лет × 4 станции ≈ 16 000 строк,
**< 300 КБ несжатого текста** — приемлемо для репозитория.

**Ключевое требование к содержимому.** Ряды **синтетические и аналитически заданные**:
генератор `fixtures:climate` строит температурный ряд с **известной наперёд** минимальной
5-дневкой (например, базовая синусоида плюс вставленное «холодное окно» ровно из 5 дней
с заданным средним). Тогда ожидаемое значение теста вычисляется на бумаге, а не берётся
«что вернул код». **Иначе golden закрепит баг из R5, а не поймает его.** Отдельным кейсом
фиксируем расхождение «минимум 5-дневки по среднесуточным» против «пятидневки обеспеченностью
0.92» — как `it.fails` или как явно документированный ожидаемый-неверный результат со ссылкой
на дефект.

### 3.4 Что делать при изменении контракта внешнего API

Фикстура не умеет заметить, что реальный Meteostat сменил колонку. Ответ — **nightly-проба,
не блокирующая merge**:

- job `climate-contract-probe` (schedule, `continue-on-error: true`) ходит в реальный
  Nominatim (1 адрес) и Meteostat (`stations/lite.json.gz` + один `daily/*.csv.gz`);
- проверяет **форму**, не значения: у Nominatim присутствуют `lat`, `lon`, `display_name`;
  у stations-lite — массив объектов с `id`/`lat`/`lon`; у CSV — заголовок содержит колонку
  `tavg` или `temp` (`parseDailyCsvTavg`, `snipClimate.js:232-252` ищет именно их);
- расхождение → job падает жёлтым и открывает issue. Фикстуры чинятся руками, потому что
  автоматическая перезапись фикстур из интернета — это ровно тот способ, которым тест
  «самоисцеляется» и перестаёт что-либо ловить;
- проба **никогда** не входит в PR-пайплайн: сеть в блокирующем гейте недопустима.

### 3.5 JWKS-стаб для Clerk

**Почему только он.** `assertAuthConfiguredWhenEnabled()` при `PROJECTS_AUTH_ENABLED=true` и
режиме `hs256` ставит `process.exitCode = 1` (`projectsAuthConfig.js:155-166`), а `index.js:27-30`
делает `process.exit(1)`. Обход «HS256 в рантайме» не стартует (N-33). При выключенной auth
`requireRole` отдаёт `403 ADMIN_REQUIRED` **до** проверки роли (`requireRole.js:21-28`), то
есть `POST /api/v1/projects/import` и весь `/api/v1/admin/**` недоступны (N-28).
Остаётся один легальный путь: режим `jwks` с локальным issuer.

**Что стаб генерирует.**
- `jose.generateKeyPair('RS256', { extractable: true })` — основная пара; вторая пара
  «чужого» издателя для негативных кейсов.
- Публичный ключ экспортируется как JWK, дополняется `kid` (стабильный, например
  `test-key-1`), `use: 'sig'`, `alg: 'RS256'`.
- HTTP-сервер `http.createServer`, отвечающий на `GET /.well-known/jwks.json` телом
  `{"keys":[<jwk>]}` с `content-type: application/json`. Слушает `127.0.0.1`.

**Как сервер его находит** (env, ставятся до любого импорта прод-модулей):

| Переменная | Значение | Зачем |
|---|---|---|
| `PROJECTS_AUTH_ENABLED` | `true` | иначе `requireRole` → 403 (`requireRole.js:21-28`) |
| `AUTH_JWKS_URI` | `http://127.0.0.1:<port>/.well-known/jwks.json` | `getRemoteJwks()` (`verifyAccessToken.js:16-23`) |
| `AUTH_ISSUER` | `https://jwks-stub.test` | `buildVerifyOptions()` (`verifyAccessToken.js:29-34`) |
| `AUTH_AUDIENCE` | `heatcalc-api` | там же; совпадает с фронтовым дефолтом (`authConfig.ts:35`) |
| `AUTH_PROVIDER` | `clerk` | `resolveProviderFromPayload` иначе кидает 403 (`mapJwtPayload.js:33-38`) |
| `AUTH_JWT_SECRET` | **не задавать** | `hasConflictingJwtConfig()` запрещает пару JWKS+secret (`projectsAuthConfig.js:37-41`) |
| `PLATFORM_ADMIN_EMAILS` | `admin@heatcalc.test` | `resolveUser` при создании ставит `role: 'admin'` (`resolveUser.js:53-64`) и синхронизирует существующего (`:79-92`) |
| `SYSTEM_INTERNAL_TOKEN` | любой | для HTTP-инвалидации кэша |

**Порт.** `remoteJwks` кэшируется на модуль (`verifyAccessToken.js:9-10,20-23`) — значит порт
менять внутри процесса нельзя. Два режима:
- **vitest:** стаб поднимается в `setupFiles` на `listen(0)`, фактический порт читается и
  подставляется в `AUTH_JWKS_URI` **до** импорта тестового модуля (а значит до первого
  вызова `getRemoteJwks()`). Каждый форк — свой порт, коллизий нет.
- **Playwright:** стаб поднимается в `globalSetup` на **фиксированном** порту (например
  34011), тот же URL уходит в env backend-процесса через `webServer.env`.

**Как выдаются токены (фабрика `issueToken`).** `new jose.SignJWT(claims)` с
`{ alg: 'RS256', kid }`, `setIssuer` / `setAudience` / `setIssuedAt` / `setExpirationTime`,
подпись приватным ключом. Обязательные claims выведены из `mapJwtPayload.js`:
`sub` (иначе 403, `:45-56`), `email` (иначе 403, `:98-106`), опционально `email_verified: true`
(`:73`), `name` (`:79-84`) либо `given_name`/`family_name` (`:86-89`).

| Персона | `sub` | `email` | Роль | Для чего |
|---|---|---|---|---|
| `USER_A` | `user_a` | `a@heatcalc.test` | user | основной владелец проектов |
| `USER_B` | `user_b` | `b@heatcalc.test` | user | **IDOR**: чужой `projectId` → `404 PROJECT_NOT_FOUND` |
| `ADMIN` | `admin_1` | `admin@heatcalc.test` | admin (через `PLATFORM_ADMIN_EMAILS`) | `POST /projects/import`, `/api/v1/admin/**`, admin bypass |

Пользователей **не нужно предварительно создавать в Mongo**: `resolveUser` делает
find-or-create (`resolveUser.js:47-76`) и сразу ставит `role: 'admin'`, если email в allowlist.
Это закрывает открытый вопрос R6 §6.6.

**Негативные токены (все — одной фабрикой, меняется один параметр):** истёкший
(`setExpirationTime('-1m')`), чужой `aud`, чужой `iss`, подпись второй парой ключей,
без `email`, без `sub`, `alg: none`. Все ожидания — `403 PROJECTS_AUTH_FORBIDDEN`
(`verifyAccessToken.js:80-97`), кроме отсутствия заголовка → `401 PROJECTS_AUTH_REQUIRED`
(`requireRole.js:30-33`).

**Для E2E** токен долгоживущий (`exp` 8 ч), кладётся в
`localStorage['projectsApiBearerToken']` через `addInitScript` — иначе истечёт в середине
длинного прогона анкеты.

**Что стаб НЕ покрывает** (осознанно, R4 §3.3): виджет логина Clerk, `getToken({ template })`
(`ClerkAuthProviderInner.tsx:54`) — включая самый частый прод-дефект «template без claim
`email`», silent refresh, `signOut()`. Для этого — отдельный **необязательный** job
`e2e:clerk-smoke` (1–3 сценария, реальный dev-инстанс, секреты, по расписанию, не блокирует
merge). Покрывать чужой SDK ценой нестабильности всего CI нельзя.

**НЕ ПРОВЕРЕНО:** поведение `jose.createRemoteJWKSet` с `http://`-URL. По коду ограничений
нет (`verifyAccessToken.js:21` принимает любой `new URL(...)`), но прогона не было —
**пункт №2 пилота**. Если `jose` потребует https, стаб поднимается на самоподписанном TLS
с `NODE_EXTRA_CA_CERTS` (+2–4 ч).

---

## 4. Фикстуры и сиды

### 4.1 Два уровня фикстур, разделённые физически

- `backend/tests/fixtures/inputs/FIX-<NN>.calcInput.json` — **чистый вход** для unit-тестов
  ядра. Работает без Mongo и без HTTP.
- `backend/tests/fixtures/projects/FIX-<NN>-<slug>.r<R>.bundle.json` — `ProjectExportBundle v1`
  для E2E/проектных сценариев.
- `backend/tests/fixtures/golden/FIX-<NN>.report.json` — эталон отчёта.

Разделение обязательное: 80 % ценности (расчётное ядро) не должно зависеть от базы.

**Жёсткое правило для всех входов (RISK-INFRA-17):** каждый `calcInput` **обязан** задавать
`building.temps.outsideC` и **не должен** содержать `location`. Иначе срабатывает условие
`buildReport.js:229` и тест уходит в сеть. Это проверяется отдельным guard-тестом по всем
файлам `inputs/`.

### 4.2 Генератор `fixtures:build`

Одна npm-задача в `backend`, шаги (по R6 §4.4):
1. читает `inputs/FIX-<NN>.calcInput.json`;
2. поднимает `getReferenceBundle()` при `CATALOG_SOURCE=file` и
   `CATALOG_FILE_PATH=<repo>/backend/test_data.json.example` — целимся в `.example`, а не в
   gitignored `test_data.json`, чтобы генерация не зависела от того, скопировал ли кто-то файл;
   плюс `WATER_NORMS_SOURCE=file`, `APPLIANCES_SOURCE=file`, `RECOMMENDATIONS_SOURCE=file`,
   `UFH_PRESETS_SOURCE=file` — иначе `auto` при поднятой memory-server молча возьмёт **другой**
   каталог (`loadReferenceCollection.js:54-77`);
3. гоняет `buildReport({ input, ctx })` **в процессе**, без HTTP и без сети;
4. собирает бандл по форме `ProjectExportBundle v1`: `exportSchemaVersion: 1`,
   **фиксированный** `exportedAt` (не `new Date()` — иначе бандл меняется каждый прогон и
   не годится для golden-диффа), `project.survey` = соответствующий SurveyDraft v4,
   `calculations: [{ calcInput, report, summary, sourceCreatedAt }]`;
5. вырезает из golden-отчёта два недетерминированных поля — `meta.generatedAt`
   (`buildReport.js:737`) и `meta.referenceBundleLoadedAt` (`buildReport.js:745-747`).
   Больше источников недетерминизма в отчёте нет: `Math.random`/`randomUUID` в
   `report`/`matching`/`hydraulics` не встречаются (R4 §5.4);
6. пишет файлы детерминированно: стабильная сортировка ключей, фиксированное округление,
   `\n` в конце.

`fixtures:build --check` (для CI) регенерирует во временную папку и падает при отличии от
закоммиченного — это и есть golden-тест расчётного ядра, где diff бандлов в PR = ревью
изменения физики.

### 4.3 Загрузчик через `POST /api/v1/projects/import`

Путь: `router.post('/api/v1/projects/import', projectsWriteRateLimiter, requireRole('admin'), …)`
(`projectsRoutes.js:244-247`). Требует ADMIN-токен из §3.5. Ответ `201` с
`{ ok, project, calculationsImported }`; `project.id` — вход для всех последующих шагов.

**Свойство, ради которого он и берётся:** импорт **не пересчитывает** отчёт
(`importProjectBundle.js:2-3`) — состояние заморожено, не зависит ни от сети, ни от текущего
каталога, ни от Meteostat.

**Ловушка владения.** `ownerId = ownerIdFromRequest(req)` (`projectsRoutes.js:250`,
реализация `:81-87`) — то есть импортированный проект принадлежит **админу**. Отсюда
разделение путей подготовки состояния:

| Что нужно | Как готовим |
|---|---|
| Admin-owned золотой проект (share, PDF, регресс отчёта) | `POST /projects/import` под ADMIN |
| User-owned проект «как у живого пользователя» | обычный путь `POST /api/v1/projects` + `POST /api/v1/projects/{id}/calc` под USER_A |
| IDOR-кейс | USER_A создаёт свой проект обычным путём, USER_B запрашивает → `404 PROJECT_NOT_FOUND` |
| Контракт самого импорта | отдельная группа тестов на коды из R6 §4.2: `UNSUPPORTED_EXPORT_VERSION`, `PAYLOAD_TOO_LARGE`, `CALC_INPUT_TOO_LARGE`, `CALCULATION_DOCUMENT_TOO_LARGE`, `PROJECT_QUOTA_EXCEEDED`, legacy-ветка без `exportSchemaVersion` |

**Чистка.** `DELETE /api/v1/projects/:id` (`projectsRoutes.js:387`) в teardown по сохранённому
`projectId`; для интеграционных сьютов — `dropDatabase()`. Помнить про квоты
`PROJECTS_MAX_PER_OWNER` = 200 и `PROJECTS_MAX_CALCULATIONS_PER_PROJECT` = 100
(`projectAccess.js:193-217`).

### 4.4 Версионирование при изменении формата отчёта

Проблема (N-29 + R6 §4.2): импорт валидирует `calcInput` и `report` **только как «это объект»**
(`validateProjectImportBody.js:70-75`); `exportedAt` не проверяется; `schemaVersion` каталога
игнорируется полностью (0 совпадений в `validateCatalog.js`). Значит устаревший бандл будет
молча загружаться и молча расходиться с реальностью.

Механизм из трёх частей:
1. **Ревизия в имени файла:** `FIX-01-house-radiators.r1.bundle.json`, где `r<N>` — ревизия
   схемы отчёта. Bump ревизии — явный, руками, в PR.
2. **`fixtures/MANIFEST.json`** со списком `{ fixtureId, reportRevision, catalogSha,
   generatedWith: { node, appVersion } }`, где `catalogSha` — SHA-256
   `backend/test_data.json.example`. Отдельный тест-guard сверяет текущий SHA каталога с
   записанным и **падает жёлтым** (в nightly, не в PR), если каталог изменился, а бандлы — нет.
3. **Гуард на дрейф:** тест сравнивает `PROJECT_EXPORT_SCHEMA_VERSION` из двух независимых
   объявлений — `frontend/src/types/projectExport.ts:10` и
   `backend/src/projects/projectExportConstants.js`. Классический источник рассинхрона,
   guard дешёвый.
4. **Обратная совместимость:** в наборе постоянно живут один намеренно старый бандл `v1` и
   один legacy-`heatcalc-*.json` без `exportSchemaVersion` (ветка
   `normalizeLegacySurveyImport.js:14-24`) — чтобы bump до `v2` не сломал существующие
   выгрузки пользователей.
5. **Каталог:** отдельный guard-тест «`schemaVersion` каталога читается» — сейчас файл с
   `schemaVersion: 99` пройдёт валидацию; жёлтый guard «`generatedAt` не старше N месяцев»
   (сейчас каталогу 4 месяца) — тоже жёлтый, чтобы не блокировать CI по календарю.

### 4.5 Детерминированный каталог и tie-break

`CATALOG_SOURCE=file` фиксируется во **всех** тестовых конфигурациях. Обоснование —
компараторы без tie-break: `compareBoilersByMaxPowerAsc` сортирует только по `powerKw.max`
(`comparators.js:64-66`, применяется в `matchingSortPools.js:34`),
`compareWaterHeatersByMinVolumeAsc` — только по минимальному объёму (`comparators.js:75-77`).
`Array.prototype.sort` в V8 стабилен, поэтому при равных ключах побеждает порядок входа, а
порядок входа у `file` (как в JSON) и у `mongo`
(`Product.find({}).sort({ kind: 1, catalogKey: 1 })`, `loadCatalog.js:207`) **разный**.

Отсюда:
- внутри одного источника результат детерминирован — этого достаточно для всех сьютов;
- отдельный кейс P2 «одинаковый вход даёт одинаковый SKU из `file` и из `mongo`» —
  регресс-детектор на отсутствующие tie-break;
- ассерты **на абсолютные суммы сметы запрещены** вне golden-фикстур с зафиксированным
  `catalogSha`. Ассертим инварианты: `laborTotalUah === round(equipmentTotalUah × 0.40)`,
  `consumablesTotalUah === round(equipmentTotalUah × 0.15)`,
  `grandTotalUah === equipment + labor + consumables` (`buildFinancialBom.js:13-14,711-718`).

---

## 5. PDF в CI

### 5.1 Расхождение прод/CI — фиксируем и покрываем

`resolveBrowserExecutable()` (`renderPdfFromHtml.js:21-62`) выбирает по приоритету:
`PDF_BROWSER_EXECUTABLE` → `await import('puppeteer').executablePath()` (bundled Chrome) →
системные пути → `503 PDF_BROWSER_MISSING`.

- **прод/Docker** — системный Chromium: `Dockerfile:8` (`apt-get install chromium`),
  `Dockerfile:15-16` (`PUPPETEER_SKIP_DOWNLOAD=true`, `PDF_BROWSER_EXECUTABLE=/usr/bin/chromium`);
- **CI сегодня** — bundled Chrome: `verify.yml` не задаёт ни `PUPPETEER_SKIP_DOWNLOAD`, ни
  `PDF_BROWSER_EXECUTABLE`, `.puppeteerrc*` в репозитории нет ⇒ `npm ci` в `backend`
  качает Chrome. Разные версии — разный рендер.

**Решение:** PR-job гоняет bundled Chrome (быстро, стабильно), а nightly-job
`docker-pdf-parity` собирает `backend/Dockerfile` и гоняет тот же PDF-тест **внутри образа**
с `PDF_BROWSER_EXECUTABLE=/usr/bin/chromium`. Расхождение перестаёт быть слепым пятном,
но не тормозит каждый PR. Приоритет P2.

### 5.2 Тихий SKIP — чинится одной переменной

`PDF_REQUIRE_BROWSER` читается **ровно в одном месте** — `verifyProjectPdf.js:144-146`.
Логика скрипта: `PDF_BROWSER_MISSING` → печатает `SKIP` и продолжает (`:133-136`), и только
при `PDF_REQUIRE_BROWSER === '1'` SKIP становится FAIL. Сейчас переменная в CI не выставлена ⇒
**пропажа браузера проходит молча**. В новом PDF-job она выставляется обязательно.

### 5.3 Три уровня PDF-тестов

1. **Чистые (в основном unit-job, всегда):** `buildEstimatePdfHtml` — генерация HTML,
   экранирование, локаль, наличие/отсутствие технического раздела. Быстро, без браузера.
2. **Реальный рендер (отдельный job `pdf`):** `PDF_REQUIRE_BROWSER=1`, `PDF_MAX_CONCURRENT=1`.
   Кейсы: владелец `GET /api/v1/projects/{id}/pdf`, публичный
   `GET /api/v1/public/shares/{token}/pdf`, `includeTechnical=0|1`, и **отрицательный**:
   `PDF_QUEUE_WAIT_MS` опущен до ~200 мс при `PDF_MAX_CONCURRENT=1` ⇒ два параллельных
   запроса дают детерминированный `503 PDF_QUEUE_TIMEOUT` (`pdfRenderSemaphore.js:72-78`).
3. **Docker-паритет (nightly, P2):** см. 5.1.

### 5.4 Сколько это стоит

По коду (замера не было — **НЕ ПРОВЕРЕНО**): браузер поднимается и закрывается **на каждый
PDF** (`renderPdfFromHtml.js:76,119`), пула нет; `page.setContent(html, { waitUntil:
'networkidle0' })` (`:90`) — ~0.5 с фиксированной тишины сети на статическом HTML;
`PDF_RENDER_TIMEOUT_MS` = 30 000 (`:13-16`). Реалистичный порядок — **1–4 с на один PDF**.

Бюджет job'а: checkout + `npm ci` в backend (с загрузкой Chrome ~150 МБ; кэшируется
`actions/cache` на `~/.cache/puppeteer` — `actions/setup-node` кэширует `~/.npm`, а не его)
+ старт memory-server + 4–5 PDF-кейсов ≈ **4–6 мин**, из них сам рендер — 10–20 с.
**Отдельный job — да**: 150 МБ загрузки не должны тормозить unit-прогон, а падение
PDF-job не должно смешиваться с падением расчётного ядра. Таймаут теста ≥ 60 с.

---

## 6. Пайплайн CI и черновик изменений в `.github/workflows/`

### 6.1 Что есть сейчас и что сломано

`.github/workflows/verify.yml` — **один** job `verify` на `ubuntu-latest`, node `22.22.0`,
три `npm ci` (shared/backend/frontend), затем ровно четыре шага:
`node scripts/verifyNoTypeBypass.mjs`, `npm run typecheck` в shared, копирование
`test_data.json.example` → `test_data.json`, `npm run verify` в backend, `npm run verify`
во frontend.

**N-32:** корневого `npm ci` нет, и **4 из 5 корневых verify не гоняются**:
`verify:auth-docs`, `verify:deploy-docs`, `verify:backend-docs`, **`verify:language-policy`**
(корневой `package.json:"verify"`). Отсутствие языкового гейта — прямое объяснение русских
вкраплений в украинском UI («Комната 1», «Без имени», «Точки водоразбора», «Магистраль»),
которые независимо видели U1, U2 и U4. **Это чинится первым, до всех тестов, и стоит ~1 ч.**

### 6.2 Слои

| Слой | Что гоняется | Бюджет | Блокирует |
|---|---|---|---|
| **pre-commit** (локально) | `eslint` по изменённым файлам; `vitest related --run` по изменённым | **≤ 30 с** | локальный коммит |
| **PR** | root-gates (5 корневых verify) · backend-verify · frontend-verify · unit (матрица) · integration · e2e-smoke (L2, 6 сценариев) · pdf | **≤ 12–15 мин** wall-clock при параллельных job | **мерж** |
| **nightly** (cron) | e2e-full (все браузеры × вьюпорты, L1+L2) · fuzz-calc (после починки N-16) · climate-contract-probe · docker-pdf-parity · fixtures-drift (`--check` + `catalogSha`) · quarantine-rerun (×10) | **≤ 45 мин** | ничего; падение → issue |
| **pre-release** (tag / ручной) | всё из nightly + golden-diff всех FIX-01…13 + smoke против staging (`docs/deploy/smoke-tests.md`) + clerk-smoke (реальный dev-инстанс, секреты) | **≤ 60 мин** | релиз |

**pre-commit без новых зависимостей:** `.githooks/pre-commit` в репозитории +
`git config core.hooksPath .githooks` в README. `husky`/`lint-staged` не ставим — это две
devDependency и ещё один повод для knip.

### 6.3 Черновик изменений в `.github/workflows/` (описанием)

**Файл 1 — `verify.yml`, переработать.** Сейчас монолитный job; разбивается на три
параллельных:

- **job `root-gates`** (новый). `npm ci` в корне (сейчас его нет вовсе), затем
  `verify:type-bypass`, `verify:auth-docs`, `verify:deploy-docs`, `verify:backend-docs`,
  **`verify:language-policy`**, `verify:shared`. Это закрытие N-32/RISK-INFRA-05.
  Бюджет ~2–3 мин. **Обязательный check в branch protection.**
- **job `backend-verify`.** Как сейчас: `npm ci` в shared+backend, копирование каталога,
  `npm run verify --prefix backend` (50 скриптов). Добавить шаг `npm run typecheck:tests`.
  Бюджет ~5–8 мин.
- **job `frontend-verify`.** `npm ci` в shared+frontend, `npm run verify --prefix frontend`
  (включает `build`). **Новое:** `actions/upload-artifact` с `frontend/dist` — чтобы
  e2e-job не пересобирал фронт второй раз.
  Бюджет ~5–8 мин.

Общее для всех трёх: `actions/setup-node@v4` с `node-version: 22.22.0` и существующим
`cache-dependency-path` (добавить корневой `package-lock.json`), `concurrency`-группа по
`github.ref` с `cancel-in-progress: true`.

**Файл 2 — `test.yml`, новый.**

- **job `unit`** — матрица `package: [backend, frontend] × node: [22.22.0, 26.7.0]`,
  где `26.7.0` помечен `continue-on-error: true` (ловит дрейф локальной среды, но не
  блокирует). Шаги: `npm ci`, копирование каталога (для backend), `npm test`,
  `upload-artifact` с lcov. Бюджет 2–4 мин.
- **job `integration`** — только node `22.22.0`. `mongodb-memory-server` (кэш `~/.cache/mongodb-binaries`
  через `actions/cache`), JWKS-стаб поднимается внутри тестов. Env: `CATALOG_SOURCE=file`,
  `CATALOG_FILE_PATH`, `RATE_LIMIT_DISABLED=true`, `SYSTEM_INTERNAL_TOKEN`,
  `PLATFORM_ADMIN_EMAILS`. Бюджет 4–6 мин.
- **job `ratelimit`** — `npm run test:ratelimit`, `fileParallelism: false`. Бюджет ~1 мин.
  Отдельный job, потому что env-профиль несовместим с остальными.
- **job `pdf`** — `needs: []`, env `PDF_REQUIRE_BROWSER=1`, `PDF_MAX_CONCURRENT=1`;
  `actions/cache` на `~/.cache/puppeteer`. Бюджет 4–6 мин.

**Файл 3 — `e2e.yml`, новый.**

- **job `e2e-smoke`** — `needs: [frontend-verify]` (кросс-workflow зависимость реализуется
  либо переносом `frontend-verify` в этот же workflow, либо `workflow_run`; проще —
  собрать фронт прямо здесь и оставить артефакт как оптимизацию на потом).
  Шаги: `download-artifact` с `dist` → `npx playwright install --with-deps chromium` →
  `webServer` поднимает backend через `node --import tests/preload/fetch-stub.preload.mjs
  src/index.js` и `vite preview` → `playwright test --grep-invert @quarantine --project=chromium`.
  Артефакты: `playwright-report/`, `test-results/` (trace/screenshot/video), retention 14 дней.
  Бюджет 6–10 мин. **Обязательный check.**
- **job `e2e-quarantine`** — `--grep @quarantine`, `continue-on-error: true`, не обязательный
  check. Нужен, чтобы карантинные тесты не гнили молча.

**Файл 4 — `nightly.yml`, новый.** `on: schedule` (ежедневно) + `workflow_dispatch`.
Jobs: `e2e-full` (матрица `browser: [chromium, firefox, webkit]`),
`fuzz` (`npm run test:fuzz` с фиксированным seed и бюджетом 30 мин — **после** починки N-16,
иначе он зелёный по построению), `climate-contract-probe` (`continue-on-error: true`),
`docker-pdf-parity` (`docker build backend/` + PDF внутри образа),
`fixtures-drift` (`fixtures:build --check` + сверка `catalogSha` с `MANIFEST.json`),
`quarantine-rerun` (карантин ×10, отчёт по проценту падений).

**Матрица — где именно.** Только в `unit` (package × node) и в `e2e-full` (browser).
В `integration`, `pdf`, `e2e-smoke` матрицы нет: там дорогой setup, а вариативность не даёт
нового сигнала.

**Обязательные checks в branch protection:** `root-gates`, `backend-verify`,
`frontend-verify`, `unit (backend, 22.22.0)`, `unit (frontend, 22.22.0)`, `integration`,
`ratelimit`, `pdf`, `e2e-smoke`. Всё остальное — информационное.

### 6.4 Артефакты

| Артефакт | Откуда | Политика |
|---|---|---|
| Playwright trace | `trace: 'on-first-retry'` | загружается только при падении, retention 14 дней |
| Скриншоты | `screenshot: 'only-on-failure'` | там же |
| Видео | `video: 'retain-on-failure'` | там же; на PR — только для `e2e-smoke` |
| HTML-отчёт Playwright | всегда | retention 14 дней |
| Покрытие (lcov + json-summary) | `@vitest/coverage-v8` | загружается всегда; **ratchet-политика**: порог = достигнутое минус 0.5 п.п., поднимается автоматически при росте. Жёстких абсолютных порогов на старте нет — иначе первый же PR упрётся в стену |
| Диффы golden-фикстур | `fixtures:build --check` | при расхождении — актуальный отчёт как артефакт для скачивания |
| `frontend/dist` | `frontend-verify` | вход для e2e |

### 6.5 Политика quarantine

- **Вход:** тест падает ≥ 2 раза за 7 дней без изменений в покрываемом им коде. Решение
  принимает дежурный, не автор PR.
- **Механика:** тег `@quarantine` в названии кейса. PR-job гоняет `--grep-invert @quarantine`,
  отдельный неблокирующий job — `--grep @quarantine`.
- **Учёт:** запись в `docs/qa/quarantine.md` — id кейса, дата, гипотеза, владелец,
  **дедлайн 10 рабочих дней**.
- **Выход:** починен (и зелёный 10 прогонов в nightly) либо удалён. Висеть бессрочно нельзя —
  карантин без дедлайна превращается в свалку и обесценивает сам сигнал.
- **Retries:** в CI `retries: 1`, локально `0`. Прохождение с retry считается флейком и
  учитывается в nightly-счётчике, даже если job зелёный.
- **Потолок:** > 5 % кейсов в карантине — стоп-сигнал, работа над новыми тестами
  приостанавливается до расчистки.

---

## 7. Требуемые правки продакшн-кода (минимум, с обоснованием каждой)

### П1 (обязательная). Извлечь `createApp()` из `backend/src/index.js` в `backend/src/app.js`
- **Почему.** `const app = express()` на верхнем уровне (`index.js:43`) + `app.listen`
  (`:257`) + приватный `handleApiError` (`:173-253`). Без правки HTTP-тесты становятся
  process-based (теряется программный `invalidateReferenceCache()` и подмена env), либо
  обработчик ошибок дублируется в тестах и тесты проверяют копию.
- **Объём.** Перенос `index.js:32-255` без изменений; `index.js` оставляет `.env`,
  `assertAuthConfigured*` + `process.exit(1)` (`:26-30`), `unhandledRejection` (`:32-38`),
  `await createApp()`, `app.listen`, `server.on('error')`.
- **Риск.** Минимальный, поведение прода идентично. Проверяется существующим
  `npm run verify` в backend.
- **Оценка: 3–6 ч.**

### П2 (обязательная, не прод-код). `.nvmrc` + `engines`
- `.nvmrc` = `22.22.0`; `engines: { node: ">=22.22.0 <23" }` в `backend/`, `shared/` и
  корневом `package.json` — синхронно с `frontend/package.json:6`.
- **Почему.** Локально сейчас Node 26.7.0 при `engines <23` во frontend; `.npmrc` с
  `engine-strict` нет, npm ограничится warning'ом. Это ровно та щель, где локально зелено,
  а CI красный. **Оценка: 1–2 ч.**

### П3 (обязательная, не прод-код). `frontend/knip.json`
- Расширить `project`/`entry` под `tests/**` (вариант A из §1.4) либо `ignoreDependencies`
  (вариант B). Иначе `verify:dead-code` покраснеет на первой же новой devDependency.
- **Оценка: 1–2 ч**, плюс до 2 ч на подгонку после первого прогона (**НЕ ПРОВЕРЕНО**).

### П4 (обязательная, не прод-код). CI: `PDF_REQUIRE_BROWSER=1` в PDF-job
- Без неё пропажа браузера — тихий `SKIP` (`verifyProjectPdf.js:133-136,144-146`).
- **Оценка: 0.5 ч.**

### П5 (обязательная, не прод-код). CI: корневой `npm ci` + 5 корневых verify
- Закрытие N-32. Возвращает в CI гейт языковой политики.
- **Оценка: 1 ч.**

### П6 (не D3, но блокирует E2E). `data-testid` и DOM-маркеры
- `grep data-testid frontend/src` → 0; единственный data-атрибут — `data-survey-step`
  (5 вхождений, `SurveyStepLink.tsx:25`). Минимальный набор ≈ 105 атрибутов в ~10 файлах
  (R2 §6.3) — **16–30 ч**; маркеры фаз расчёта `data-calc-phase`/`data-source`/`data-error-code`
  (R2 §7) — **14–25 ч**.
- **Порядок критичен:** правки F-11 («убрать жаргон и русские вкрапления») сломают все
  текстовые ассерты. Значит `data-testid` ставится **до** работ по F-01…F-12, а не после
  (RISK-INFRA-19).
- Правки чисто аддитивные, поведение не меняют.

### Рассмотрено и отвергнуто
- **Ослабить `validateAuthConfiguration`, чтобы разрешить HS256 при включённой auth**
  (`projectsAuthConfig.js:119-124`). Нет: это прод-защита от симметричного ключа вместо JWKS.
  JWKS-стаб даёт то же покрытие честнее и без правки.
- **Разрешить `POST /api/v1/projects/import` без admin-роли в dev** (`requireRole.js:21-28`).
  Нет: ослабление прод-контроля ради удобства тестов.
- **Env для базовых URL климата** (`geocode.js:9`, `snipClimate.js:10,17`). Нет:
  `node --import preload.mjs` закрывает ту же задачу без единой строки в прод-коде.
- **DI транспорта в `climate/*`.** Нет: подмена глобального `fetch` даёт то же покрытие
  без изменения сигнатур.
- **`supertest`.** Нет: `createApp()` + `listen(0)` + встроенный `fetch` дают то же самое
  без новой зависимости и без нового повода для knip.

---

## 8. Оценка трудозатрат по пунктам

| # | Блок | Состав | Оценка |
|---|---|---|---|
| 1 | Инструменты и размещение | 2 конфига vitest + `vitest.ratelimit.config.ts` + `playwright.config.ts` + `e2e/package.json`; `tsconfig.tests.json`; npm-скрипты; `.nvmrc`/`engines` (П2); `knip.json` (П3); прогон `npm run verify` и подгонка | **8–14 ч** |
| 2 | Изоляция, БД, состояние | П1 `createApp()` (3–6); `mongodb-memory-server` + **пилот совместимости** (4–8); хелперы сброса кэша и teardown (2–3); настройка параллелизма и профилей env (2–3) | **11–20 ч** |
| 3 | Моки климата и Clerk | `fetch-stub` + `preload.mjs` с allowlist localhost (3–5); генератор климат-фикстур с аналитически заданными рядами + 4+2 города (5–9); JWKS-стаб + фабрика токенов + 7 негативных кейсов (4–8, **+2–4 если `jose` откажет на `http://`**); `climate-contract-probe` (2–3) | **14–25 ч** |
| 4 | Фикстуры и сиды | `fixtures:build` + `--check` (8–12); `MANIFEST.json` + guard на `catalogSha`/двойной `PROJECT_EXPORT_SCHEMA_VERSION` (3–4); хелпер `importFixture` + teardown с учётом квот (2–3); версионирование и legacy-бандлы (2–3). **Без доменного наполнения FIX-01…13 — это D2/R6** | **15–22 ч** |
| 5 | PDF в CI | job + кэш `~/.cache/puppeteer` + `PDF_REQUIRE_BROWSER=1` (2–3); детерминированный кейс `PDF_QUEUE_TIMEOUT` (1–2); nightly docker-паритет (1–3) | **4–8 ч** |
| 6 | Пайплайн CI | разбивка `verify.yml` на 3 job + корневой `npm ci` и 5 verify, П4/П5 (3–5); `test.yml` (3–5); `e2e.yml` + артефакты (2–4); `nightly.yml` (2–4); branch protection, quarantine-процесс и `docs/qa/quarantine.md` (2–3) | **12–21 ч** |
| — | Резерв на неизвестные (три пилота: memory-server, `jose` + http JWKS, knip) | | **6–8 ч** |
| | **ИТОГО инфраструктура** | | **70–118 ч** |
| — | Зависимости вне D3 | `data-testid` 16–30 ч; DOM-маркеры 14–25 ч; наполнение FIX-01…13 — оценивает D2 | **+30–55 ч** |
| | **ИТОГО с зависимостями** | | **100–173 ч** |

### Что реально закрывается за первую неделю (~40 ч)

Приоритет — **сначала починить то, что уже сломано, потом строить новое**.

1. **День 1 (6–8 ч).** П5: корневой `npm ci` + 5 корневых verify в CI, включая
   `verify:language-policy` (N-32). П2: `.nvmrc` + `engines`. П4: `PDF_REQUIRE_BROWSER=1`.
   Разбивка `verify.yml` на три параллельных job.
   *Ценность сразу, без единого теста: языковой гейт возвращается в CI, PDF перестаёт
   молча скипаться, время PR-прогона падает примерно вдвое за счёт параллельности.*
2. **День 2 (6–8 ч).** П1 `createApp()` + прогон `npm run verify`. Конфиги vitest в backend,
   `tsconfig.tests.json`, П3 knip. Первые 5–8 конвертированных кейсов из мёртвых
   verify-скриптов (`verifyRoomExteriorLayoutHeatLoss.js` первым — он вообще никогда не
   запускался).
3. **День 3 (8 ч).** `fetch-stub` + `preload.mjs`. **Пилот `mongodb-memory-server`**
   (решение «memory-server или docker» принимается здесь и больше не пересматривается).
   Job `unit` в `test.yml` с матрицей node.
4. **День 4 (8 ч).** **JWKS-стаб**, фабрика токенов, три персоны, 7 негативных кейсов.
   Первые HTTP-тесты авторизации: 401/403/404-IDOR/admin-gate. Job `integration`.
   *Это разблокирует `POST /api/v1/projects/import` как загрузчик фикстур — самый ценный
   результат недели.*
5. **День 5 (8 ч).** Job `pdf`. Каркас `fixtures:build` + одна сквозная фикстура FIX-01
   от `calcInput` до бандла и обратно. `docs/qa/verify-migration.md` с процедурой вытеснения.

**К концу первой недели есть:** зелёный PR-пайплайн из 6 job с восстановленным языковым
гейтом, работающий раннер, герметичная авторизация через JWKS, рабочий загрузчик фикстур
и первый golden-эталон.

**Что первой неделей не закрывается и почему:**
- **Playwright и любые E2E** — упираются в `data-testid` и DOM-маркеры (30–55 ч чужой
  работы). Ставить E2E на текстовые ассерты до правок F-11 бессмысленно: план исправления
  проходимости сам их сломает (RISK-INFRA-19).
- **Полный набор FIX-01…13** — 13 доменных объектов, это работа D2 и предметного эксперта,
  а не инфраструктуры.
- **Климат-фикстуры целиком** — 4 города × 11 лет требуют генератора с аналитически
  проверяемыми рядами; сделать «лишь бы было» здесь хуже, чем не сделать, потому что
  фикстура-из-кода закрепит найденные R5 дефекты как эталон.
- **Вытеснение 45 verify-скриптов** — фоновая работа на 2–3 месяца по 0.5–1.5 ч на скрипт,
  и она обязана идти после того, как раннер и CI устоялись.

---

## 9. НЕ ПРОВЕРЕНО (требует пилота до фиксации решений)

1. **Ни один тест/скрипт не запускался** — `node_modules` отсутствуют во всех пакетах.
   Всё получено чтением исходников.
2. **`mongodb-memory-server` × `mongoose@9.5.0` / `mongodb@7.1.1`** — совместимость;
   и поведение `w=majority` + `retryWrites=true`, которые `normalizeMongoUri` навязывает
   принудительно (`mongoConnectionConfig.js:49-54`), на standalone-mongod.
3. **`jose.createRemoteJWKSet` с `http://`-URL** — по коду ограничений нет
   (`verifyAccessToken.js:21`), но не проверено.
4. **knip 5 с расширенным `project`/`entry`** и `--treat-config-hints-as-errors`.
5. **Фактическое время рендера PDF** — оценка 1–4 с сделана по таймаутам и структуре кода.
6. **Реальный формат ответов Meteostat и Nominatim** — сеть не использовалась; формат
   восстановлен по парсерам (`snipClimate.js:170-183,232-252`, `geocode.js:98-106`).
   Именно поэтому нужен `climate-contract-probe` (§3.4).
7. **Фактическое время прогона `npm run verify`** в backend/frontend — бюджеты CI в §6.2
   оценочные, уточняются после первого прогона нового пайплайна.
8. **`@clerk/testing`** — пакет не установлен, API не читалось; в основной пакет тестов
   не входит по решению §3.5.
