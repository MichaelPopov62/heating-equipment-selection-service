# R4 — Осуществимость герметичного прогона

Дата: 2026-08-23. Метод: чтение исходников без установки зависимостей (`node_modules` отсутствуют).
Ни один прогон кода не выполнялся, кроме `node -v`, `npm -v` и чтения lock-файлов.

## Сводка ответов

| # | Вопрос | Ответ | Обоснование в одну строку |
|---|--------|-------|---------------------------|
| 1 | Backend без MongoDB | **да, с оговоркой** | `index.js` не подключается к Mongo при старте; `calc`, `catalog`, `presets`, `health`, `system/invalidate` живут, всё под `mongoMiddleware` отдаёт `503 MONGODB_UNAVAILABLE` (`requireMongo.js:23-29`). |
| 2 | Тестовые JWT HS256 через прод-путь верификации | **да, с оговоркой** | Ветка HS256 живёт внутри того же `verifyAccessToken` (`verifyAccessToken.js:60-71`) и того же `runAuthPipeline`, но сервер физически не стартует с HS256 + включённой auth (`projectsAuthConfig.js:119-124` → `index.js:27-30`). |
| 3 | Обход Clerk в E2E | **да** | `VITE_PROJECTS_BEARER_TOKEN` (`projectsAuthToken.ts:37-41`), `VITE_AUTH_REQUIRED` (`authConfig.ts:13-15`), `PROJECTS_DEV_OWNER_ID` (`projectsAuthConfig.js:177-183`) — но `requireRole` в dev-режиме глушит **весь** admin API (`requireRole.js:21-28`). |
| 4 | Мок Nominatim / Meteostat без правок прод-кода | **да** | Оба модуля зовут **глобальный** `fetch` (`geocode.js:59`, `snipClimate.js:108,132`) → перехват `globalThis.fetch` через `node --import` работает без DI; базовые URL захардкожены (`geocode.js:9`, `snipClimate.js:10,17`). |
| 5 | Детерминизм каталога | **да, с оговоркой** | `CATALOG_SOURCE=file` + `test_data.json` даёт побайтово одинаковый вход; кэш сбрасывается программно `invalidateReferenceCache()` (`reference/public.js:5`); но порядок каталога `file` ≠ `mongo`, а компараторы без tie-break (`comparators.js:64-66`). |
| 6 | PDF в CI | **да** | В CI `npm ci` в `backend` качает bundled Chrome (нет `PUPPETEER_SKIP_DOWNLOAD`, нет `.puppeteerrc`), `renderPdfFromHtml.js:34-38` его находит; в Docker — системный `/usr/bin/chromium` (`Dockerfile:8,16`). |
| 7 | Совместимость версий Node | **да, с оговоркой** | Четыре разные версии в обиходе: CI 22.22.0, локально 26.7.0, Docker node:20, `frontend/package.json:6` требует `>=22.22.0 <23` — локальный Node формально нарушает engines; технических ESM-блокеров не найдено. |

---

## 1. Backend без MongoDB

### 1.1 Точка входа не трогает Mongo

`backend/src/index.js` не содержит ни `mongoose.connect`, ни импорта коннектора. Порядок старта:

- `index.js:26-30` — `assertAuthConfiguredForProduction()` + `assertAuthConfiguredWhenEnabled()`, при ошибке `process.exit(1)`;
- `index.js:124` — `await createRoutes()` (top-level await);
- `index.js:154-164` — прогрев кэша справочников: при `REFERENCE_WARMUP_BLOCK_STARTUP=true|1` — блокирующий, при ошибке `process.exit(1)` (`index.js:157-159`); иначе fire-and-forget с проглатыванием ошибки (`index.js:161-163`);
- `index.js:257` — `app.listen`.

Подключение к Mongo — **ленивое**, только из `ensureMongoReferenceConnection()` (`backend/src/utils/mongoReferenceConnection.js:24-43`), который возвращает `false` без ошибки, если `getMongoConnectionConfigOrNull()` вернул `null` (`mongoReferenceConnection.js:25-26`).

### 1.2 Что происходит при отсутствии `MONGODB_URI`

`getMongoConnectionConfigs()` (`mongoConnectionConfig.js:68-114`) собирает кандидатов из `MONGODB_URI`, `MONGODB_URI_FALLBACK` и квартета `MONGODB_USER/PASSWORD/URL/DB`. Пусто → `[]` → `getMongoConnectionConfigOrNull()` → `null`.

`requireMongoForProjects()` (`backend/src/projects/requireMongo.js:13-43`) сначала проверяет наличие конфигурации (`requireMongo.js:14-21`) и без неё сразу бросает `MONGODB_UNAVAILABLE / 503` (`requireMongo.js:23-29`) — то есть **без сетевых таймаутов**, мгновенно. Если конфиг есть, но БД недоступна — тот же 503, но после `serverSelectionTimeoutMS = 8000` (`mongoConnectionConfig.js:7,14-15`).

### 1.3 Матрица эндпоинтов без Mongo

| Эндпоинт | Якорь | Без Mongo |
|---|---|---|
| `GET /health`, `GET /api/health` | `routes.js:33-36` | 200 |
| `GET /`, `GET /api` | `routes.js:44`, `routes.js:67` | 200 |
| `GET /api/v1/catalog` | `routes.js:82-93` | 200 (через `getReferenceBundle`) |
| `GET /api/v1/presets/envelope` / `.../underfloor-heating/bases` / `.../flooring-finishes` / `.../underfloor-heating` | `routes.js:111,119,127,137` | 200 (константы из `src/data/`) |
| `GET /api/v1/presets/underfloor-heating/modes` | `routes.js:152-167` | 200 (bundle) |
| `POST /api/v1/system/invalidate-reference-cache` | `systemRoutes.js:28` | 200 при верном `X-System-Token`; 503 `SYSTEM_TOKEN_NOT_CONFIGURED` если `SYSTEM_INTERNAL_TOKEN` пуст (`systemRoutes.js:31-35`); 403 `SYSTEM_TOKEN_FORBIDDEN` (`systemRoutes.js:39-43`) |
| `POST /api/v1/calc` | `routes.js:196-206` | **200** |
| `GET/POST/PATCH/DELETE /api/v1/projects/**` | `projectsRoutes.js:128` (`router.use(..., mongoMiddleware, requireAuth)`) | **503 `MONGODB_UNAVAILABLE`** |
| `/api/v1/admin/**` | `adminRoutes.js:57` | **503 `MONGODB_UNAVAILABLE`** (mongoMiddleware стоит первым, до `requireRole`) |
| `GET /api/v1/public/shares/:token` и `/pdf` | `publicSharesRoutes.js:63,114` | **503 `MONGODB_UNAVAILABLE`** |
| `POST /api/v1/feedback` | `feedbackRoutes.js:37` | 400 при плохом теле (валидация раньше, `feedbackRoutes.js:31-35`), иначе **503** |
| `GET /api/v1/me` | `meRoutes.js:22-44` | 200 dev-профиль при выключенной auth (`meRoutes.js:32-38`, `serializeMeUser.js:32-41`); 401 `PROJECTS_AUTH_REQUIRED` при включённой (`optionalAuth` глотает 503 от `resolveUser` и пропускает как гостя — `optionalAuth.js:33-43`) |
| всё остальное | `routes.js:213-219` | 404 `NOT_FOUND` |

### 1.4 `POST /api/v1/calc` при `CATALOG_SOURCE=file` — да, работает

`runCalculation` (`backend/src/api/runCalculation.js:16-22`) = `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput()` → `buildReport()`. Ни одного обращения к Mongo.

`loadCatalog()` при `CATALOG_SOURCE=file` идёт в `loadCatalogJsonFromFile()` (`loadCatalog.js:354-357` → `177-194`), путь — `backend/test_data.json` либо `CATALOG_FILE_PATH`/`SEED_CATALOG_PATH` (`backend/scripts/utils/catalogPaths.js:16-25`).
Остальные справочники — `WATER_NORMS_SOURCE`, `APPLIANCES_SOURCE`, `RECOMMENDATIONS_SOURCE`, `UFH_PRESETS_SOURCE` (`loadWaterNorms.js:53`, `loadAppliances.js:46`, `loadRecommendations.js:50`, `loadUnderfloorHeatingPresets.js:52`), дефолт `auto`; в `auto` без Mongo-конфига сразу берётся файл без попытки коннекта (`loadReferenceCollection.js:55-62`). Файлы лежат в `backend/data/` (`appliances.json` 4.5 КБ, `recommendations.json` 36 КБ, `underfloor_heating_presets.json` 1.4 КБ, `water_norms.json` 1.9 КБ).

Важно: сам `CATALOG_SOURCE=auto` без Mongo-конфига тоже работает (`loadCatalog.js:359-371`), но лог засоряется `catalog.auto → mongo_unavailable_or_empty`. Для тестов ставить `CATALOG_SOURCE=file` явно.

**Дополнительно (важно для E2E):** при `CATALOG_SOURCE=file` и без `location` в теле запроса `POST /api/v1/calc` вообще не делает исходящих сетевых вызовов — климат вызывается только если `input.location` задан **и** `temps.outsideC` отсутствует (`buildReport.js:229`).

### 1.5 Что делать с проектами — рекомендация

Проекты, расчёты, share, feedback, users и admin API без Mongo не тестируются вообще (503 на входе). Три варианта:

| Вариант | За | Против |
|---|---|---|
| `mongodb-memory-server` | ноль внешних зависимостей в CI, изоляция на тест-файл, скорость | пакета в lock-файлах нет — надо ставить; совместимость с драйвером `mongodb@7.1.1` / `mongoose@9.5.0` **НЕ ПРОВЕРЕНА**; тянет бинарь mongod (кэш в CI) |
| Docker service в CI (`services: mongo:7`) + локальный `docker compose` | реальный mongod той же мажорной версии, что в проде | требует Docker локально; медленнее старт; параллельность тестов упирается в одну БД (лечится уникальным `MONGODB_DB` на воркер) |
| Отдельная удалённая тестовая БД (Atlas) | ничего не ставить | не герметично, сеть, флейки, гонки между CI-джобами — **отвергнуть** |

**Рекомендация: `mongodb-memory-server` как основной путь, docker-service как fallback.** Обоснование по коду:

- транзакции и replica-set фичи не используются — `grep` по `startSession|withTransaction|$search` в `backend/src` не дал ни одного попадания, значит standalone-инстанса достаточно;
- индексы обычные (`Project.js:31,47-49`), memory-server их создаст;
- `applyMongoFriendlyDnsForUri` для `mongodb://127.0.0.1:...` выходит сразу (`mongoDnsPreferPublic.js:20`) — глобальный `dns.setServers` не портит локальный коннект;
- **обязательный нюанс:** `normalizeMongoUri` бросает ошибку, если в URI нет имени БД и не задан `MONGODB_DB` (`mongoConnectionConfig.js:41-47`) — memory-server отдаёт URI вида `mongodb://127.0.0.1:PORT/`, поэтому в тестовом env надо ставить `MONGODB_DB` либо дописывать имя БД в URI;
- `normalizeMongoUri` принудительно добавляет `retryWrites=true&w=majority` (`mongoConnectionConfig.js:49-54`); поведение standalone-mongod с `w=majority` — **НЕ ПРОВЕРЕНО** (нужен прогон).

---

## 2. Тестовые JWT локально: HS256 — тот же код или обходной путь?

### Прямой ответ

**Верификация — тот же код, но собрать HTTP-тест авторизации на HS256 нельзя: сервер с такой конфигурацией не стартует.**

### 2.1 Что общего

Единая цепочка `runAuthPipeline` (`backend/src/auth/runAuthPipeline.js:13-17`): `verifyAccessToken` → `mapJwtPayload` → `resolveUser`. Её зовут и `requireAuth` (`requireAuth.js:31`), и `optionalAuth` (`optionalAuth.js:30`). Ветвление по алгоритму сидит **внутри** `verifyAccessToken`, ниже общего кода:

- `verifyAccessToken.js:43-50` — общая проверка `hasProjectsJwtConfig()`;
- `verifyAccessToken.js:52-53` — общий `resolveAuthJwtMode()` и `buildVerifyOptions()` (issuer/audience — одни и те же, `verifyAccessToken.js:29-36`);
- `verifyAccessToken.js:59` — `jose.jwtVerify(token, getRemoteJwks(), verifyOptions)` для JWKS;
- `verifyAccessToken.js:71` — `jose.jwtVerify(token, key, verifyOptions)` для HS256;
- `verifyAccessToken.js:80-97` — общий маппинг ошибок в `PROJECTS_AUTH_FORBIDDEN / 403`;
- `verifyAccessToken.js:99` — общий `return result.payload`.

Различается **только материал ключа**. `mapJwtPayload` (валидация `sub`, `email`, `email_verified`, `name`, резолв provider — `mapJwtPayload.js:96-117`), `resolveUser` (find-or-create в `users`, platform-admin sync — `resolveUser.js:37-95`), `attachRequestContext`, `requireRole`, IDOR-фильтры — общие и не знают об алгоритме.

Вывод: **claims-логика, mapping, materialization пользователя и авторизация тестируются HS256-токеном честно**. Проверка подписи RS256 и загрузка JWKS — нет.

### 2.2 Где HS256 упирается в стену

`validateAuthConfiguration` (`projectsAuthConfig.js:115-124`): при `mode === 'hs256'` и `production || authEnforced` добавляется ошибка «AUTH_JWT_SECRET — не для runtime». `assertAuthConfiguredWhenEnabled` (`projectsAuthConfig.js:155-166`) при `PROJECTS_AUTH_ENABLED=true` вызывает эту проверку и ставит `process.exitCode = 1`, а `index.js:28-30` делает `process.exit(1)`.

Плюс `hasConflictingJwtConfig()` (`projectsAuthConfig.js:37-41`) запрещает задавать `AUTH_JWKS_URI` и `AUTH_JWT_SECRET` одновременно.

Отсюда две единственные конфигурации:

- `AUTH_JWT_SECRET` + auth **выключена** → `isProjectsAuthRequired()` = false → `requireAuth` пропускает всех без проверки токена (`requireAuth.js:19-22`), т.е. HS256-токен **вообще не верифицируется** на HTTP-уровне;
- `AUTH_JWT_SECRET` + `PROJECTS_AUTH_ENABLED=true` → **процесс не стартует**.

Именно поэтому `backend/scripts/verifyAuthPipeline.js:44-50` перед прогоном ставит `NODE_ENV=test` и `delete process.env.PROJECTS_AUTH_ENABLED` — это in-process unit-тест, не HTTP. И `resolveUser` там пропускается, если Mongo не настроена (`verifyAuthPipeline.js:133-135`).

### 2.3 Практический вывод для плана тестов

| Уровень | HS256 | Оценка |
|---|---|---|
| Unit: `mapJwtPayload`, `resolveUser`, `authorizationPolicy`, `requireRole` | годится | тот же прод-код |
| Unit: `verifyAccessToken` — expired/aud/iss/подпись | годится частично | `jose.jwtVerify` тот же, но не проверяется RS256 + ремоут-JWKS (`verifyAccessToken.js:15-24`) |
| HTTP-интеграция с включённой auth (401/403/404 IDOR, admin gate) | **не годится** | сервер не стартует |

**Рекомендация:** для HTTP-тестов авторизации поднимать **локальный JWKS-стаб** — RS256-пара, генерируемая в тесте (`jose.generateKeyPair('RS256')`), крошечный http-сервер, отдающий `/.well-known/jwks.json`, и env `AUTH_JWKS_URI=http://127.0.0.1:PORT/.well-known/jwks.json`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_PROVIDER=clerk`, `PROJECTS_AUTH_ENABLED=true`. Это проходит **ровно тот же прод-путь** (`verifyAccessToken.js:58-59`), включая режим `jwks`, и не требует ни одной правки прод-кода. Ограничение: `remoteJwks` кэшируется на модуль (`verifyAccessToken.js:10,20-23`), поэтому порт стаба должен быть фиксирован на процесс.

---

## 3. Обход Clerk в E2E

### 3.1 Где читаются переменные и что они меняют

| Переменная | Где читается | Эффект |
|---|---|---|
| `VITE_AUTH_REQUIRED` | `frontend/src/auth/authConfig.ts:13-15` | `isAuthRequiredInFrontend()`; `!== 'true'` → `isAuthenticated: true` без сессии (`AuthProvider.tsx:96`, `PublicAuthProviderInner.tsx:33`) → `ProtectedRoute` пропускает (`ProtectedRoute.tsx:21-24`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `authConfig.ts:22-25`, `isClerkEnabled()` `authConfig.ts:30-32` | пусто → `AuthProvider` уходит в `LegacyAuthProviderInner` (`AuthProvider.tsx:34-36`), Clerk SDK не грузится вовсе (`ClerkLazyRoot.tsx:44`) |
| `VITE_PROJECTS_BEARER_TOKEN` | `frontend/src/services/projectsAuthToken.ts:37-41` | последний по приоритету источник Bearer: Clerk `getToken()` → `localStorage` → env (`projectsAuthToken.ts:24-41`); подставляется в заголовок в `projectsAuthHeaders.ts:11-14` |
| `PROJECTS_DEV_OWNER_ID` (backend) | `backend/src/auth/projectsAuthConfig.js:177-183` | 24-hex ObjectId владельца при отсутствии `req.user.id` (`projectsRoutes.js:81-87`); дефолт `000000000000000000000001` (`projectsAuthConfig.js:169`) |
| `PROJECTS_AUTH_ENABLED` (backend) | `projectsAuthConfig.js:24` | false → `requireAuth` пропускает всех (`requireAuth.js:19-22`), `optionalAuth` тоже (`optionalAuth.js:18-21`) |

Также есть чисто фронтовый обход через `localStorage['projectsApiBearerToken']` (`authConfig.ts:5,70-80`) — для Playwright это удобнее env, т.к. ставится per-context без пересборки бандла.

### 3.2 Ловушка: admin API недоступен в dev-режиме

`requireRole` (`backend/src/auth/requireRole.js:21-28`): если `!isProjectsAuthRequired()`, немедленно `403 ADMIN_REQUIRED` — **до** любой проверки роли. Это значит:

- `POST /api/v1/projects/import` (`projectsRoutes.js:244-247`, обёрнут в `requireRole('admin')`) — **не работает** в dev-обходе. Загрузчик фикстур `ProjectExportBundle v1`, названный в брифинге как готовый механизм подготовки состояния, в конфигурации «auth off + bearer-заглушка» отдаёт 403;
- весь `/api/v1/admin/**` (`adminRoutes.js:57`) — тоже 403.

**Следствие для плана:** сценарии, которым нужен импорт фикстур или admin API, обязаны идти через JWKS-стаб из §2.3 + `PLATFORM_ADMIN_EMAILS` с email тестового админа (`resolveUser.js:54,79-92`), а не через `VITE_PROJECTS_BEARER_TOKEN`.

### 3.3 Что остаётся непротестированным при обходе

При `VITE_CLERK_PUBLISHABLE_KEY` пустом Clerk SDK не грузится совсем, поэтому вне покрытия:

- лениво подгружаемый `ClerkLazyRoot` / `ClerkProviderWithRouter` и разделение чанков (`vite.config.ts:106,125-133`) — сам факт загрузки Clerk-чанка на `/login`;
- регистрация token-getter'а в `ClerkAuthProviderInner.tsx:46-73` и **получение токена по JWT-template** (`getToken({ template })`, `ClerkAuthProviderInner.tsx:54`) — включая самый частый прод-дефект: template без claim `email` → backend `mapJwtPayload.js:99-106` → 403 (текст ошибки: `frontend/src/i18n/uk/auth.ts:29`);
- silent refresh истёкшей сессии Clerk — код рефреша целиком внутри SDK;
- `logout` через `signOut()` (`ClerkAuthProviderInner.tsx:97-101`) — в legacy-провайдере это просто `localStorage.removeItem` (`AuthProvider.tsx:84-88`);
- реакция UI на истёкший/невалидный токен: `AccountBar.tsx:52-53` (`isUnauthorizedMeError(meError)`), редирект `useAuthRedirectAfterClerk.ts:17-19`;
- `ProtectedRoute` с реальным `returnTo` (`ProtectedRoute.tsx:22-23`) — при обходе ветка `isAuthRequired && !isAuthenticated` недостижима.

**Частично добираемо без Clerk:** истёкший/битый токен на backend полностью проверяется JWKS-стабом (§2.3) — включая `exp`, `aud`, `iss`, подпись. `ProtectedRoute` и `AccountBar` проверяются с `VITE_AUTH_REQUIRED=true` + пустым `localStorage` — редирект на `/login` сработает и без Clerk (`AuthProvider.tsx:34-36` → `LegacyAuthProviderInner`, `isAuthenticated = user != null`).

Остаётся принципиально непокрытым только сам Clerk-виджет логина и его refresh.

### 3.4 `@clerk/testing` — применим ли

В зависимостях: `@clerk/clerk-react@^5.61.9`, `@clerk/localizations@^4.13.7` (`frontend/package.json`). `@clerk/testing` **отсутствует** — проверено `grep` по всем четырём lock-файлам (0 совпадений по `vitest|playwright|jest`, `@clerk/testing` не значится).

Цена применения (оценка, точные API-детали пакета **НЕ ПРОВЕРЕНЫ** — `node_modules` не установлены):

- нужен реальный Clerk dev-инстанс и `CLERK_SECRET_KEY` в секретах CI → тесты перестают быть герметичными и зависят от аптайма Clerk;
- нужен настроенный JWT template `heatcalc-api` с claim `email` и `aud` (`authConfig.ts:35`, `.env.example` frontend) — иначе backend отдаёт 403;
- нужен тестовый пользователь с известным паролем; Clerk ограничивает частоту логинов.

**Рекомендация:** `@clerk/testing` — **не в основной пакет тестов**. Завести отдельный, необязательный, не блокирующий merge job `e2e:clerk-smoke` (1-3 сценария: логин → `/me` 200 → logout), гоняемый по расписанию или вручную, с секретами. Основной E2E-пакет — герметичный, через `VITE_AUTH_REQUIRED` + `localStorage` bearer + JWKS-стаб на backend. Обоснование: покрытие Clerk-виджета — это покрытие чужого SDK; ценность низкая, цена (нестабильность всего CI) высокая, при этом приоритет владельца — проходимость анкеты и расчётное ядро.

---

## 4. Моки Nominatim и Meteostat

### 4.1 Точные точки внедрения

| Файл:строка | Вызов | URL |
|---|---|---|
| `backend/src/climate/geocode.js:59` | `await fetch(url, { headers, signal })` | `https://nominatim.openstreetmap.org/search` — константа `geocode.js:9` |
| `backend/src/climate/snipClimate.js:108` | `await fetch(url, { headers: { accept: '*/*' }, signal })` внутри `fetchBuffer` | `https://bulk.meteostat.net/v2/stations/lite.json.gz` (`snipClimate.js:10`) и `https://data.meteostat.net/daily/${year}/${stationId}.csv.gz` (`snipClimate.js:17`) |
| `backend/src/climate/snipClimate.js:132` | `await fetch(url, { method: 'HEAD', ... })` внутри `headOk` | тот же `DAILY_CSV_GZ_URL` |

Больше исходящих `fetch` в `backend/src` нет (кроме JWKS в `jose`, `verifyAccessToken.js:21`).

### 4.2 DI / инъекция транспорта — нет

`fetch` вызывается **напрямую как глобаль**: ни импорта из `undici`, ни параметра-транспорта, ни фабрики. Функции `geocodeAddress(address)` (`geocode.js:42`) и `getDesignOutsideTempFromMeteostat({lat, lon})` (`snipClimate.js:267`) принимают только данные. Точки подмены на уровне модулей:

- фасад `getDesignOutsideTempC(location)` (`backend/src/climate/index.js:13-40`) — единственный потребитель обоих;
- вызывается ровно из одного места: `buildReport.js:231`.

### 4.3 Кэш ответов климата

- Meteostat stations: `stationsLiteCachePromise` — module-level промис-кэш (`snipClimate.js:19-20`, заполняется в `loadStationsLite`, `snipClimate.js:144-190`). **Без TTL, без экспортированного сброса, живёт до конца процесса.** Предзаполнить извне нельзя — переменная не экспортируется.
- Daily CSV по годам — **не кэшируются**, скачиваются на каждый запрос (`snipClimate.js:322-340`).
- Геокодинг — **кэша нет вообще** (`geocode.js`).
- Результат климата попадает в отчёт (`buildReport.js:755` — поле `climate`), но между запросами не переиспользуется.

Итог: предзаполнить кэш **нельзя**; перехватывать надо транспорт.

### 4.4 Вариант мока без правок прод-кода — есть

Поскольку оба модуля зовут **глобальный** `fetch`, достаточно подменить `globalThis.fetch` до импорта прод-модулей:

- **in-process тесты (vitest / node:test):** setup-файл, который ставит `globalThis.fetch = mockFetch` (или `vi.stubGlobal('fetch', ...)`). Ноль правок прод-кода, ноль новых рантайм-зависимостей;
- **E2E, где backend — отдельный процесс:** запускать его как `node --import ./tests/http-stub/preload.mjs src/index.js`. Preload-модуль подменяет `globalThis.fetch` до загрузки `src/index.js`. **Прод-код не меняется**, изменения нет даже в `package.json` прод-скриптов — команда живёт в конфиге тестов. Это ключевой аргумент против варианта с env-переопределением URL;
- **MSW (`msw/node` v2)** — работает через `@mswjs/interceptors`, тоже патчит глобальный `fetch`; удобнее по DX (декларативные handlers, `onUnhandledRequest: 'error'` ловит любые незамоканные исходящие). Требует новой devDependency;
- **`undici` MockAgent** — потребовал бы установки `undici` как прямой зависимости (в lock только `undici-types`, транзитивный тип-пакет). `setGlobalDispatcher` из внешнего `undici` влияет на встроенный `fetch` через общий well-known symbol, но это неявная связка версий. **Не рекомендую**;
- **локальный стаб-сервер + переопределение base URL через env** — потребовал бы правки прод-кода (см. ниже).

### 4.5 Захардкоженные URL — прямой ответ

Да, все три базовых URL захардкожены: `geocode.js:9` (`NOMINATIM_URL`), `snipClimate.js:10` (`STATIONS_LITE_GZ_URL`), `snipClimate.js:17` (`DAILY_CSV_GZ_URL`). Env-переопределения нет; настраиваются только таймауты (`GEOCODE_TIMEOUT_MS` `geocode.js:18`, `METEOSTAT_BULK_TIMEOUT_MS` `snipClimate.js:94`) и глубина истории (`METEOSTAT_YEARS` `snipClimate.js:268`).

Минимальная правка (**если** решат идти путём стаб-сервера): три константы → `process.env.X ?? '<текущее значение>'`. Дефолт сохраняется, прод-поведение не меняется. Но **эта правка не нужна** — вариант с `--import` preload закрывает задачу.

### 4.6 Объём фикстур

По коду `getDesignOutsideTempFromMeteostat` на один город:

1. один общий `stations/lite.json.gz` — **один файл на весь пакет тестов**, кэшируется на процесс (`snipClimate.js:144-190`). Для стаба его можно урезать до нескольких десятков станций: код только маппит `id/lat/lon` и считает haversine (`snipClimate.js:170-183`, `197-226`), формат — плоский массив объектов;
2. до 3 HEAD-проб последних лет (`snipClimate.js:300-310`) — ответ без тела, достаточно `{ ok: true }`;
3. `windowYears` = от `endYear - METEOSTAT_YEARS` до `endYear` включительно (`snipClimate.js:286-290`) → при `METEOSTAT_YEARS=10` это **11 файлов** `daily/{year}/{stationId}.csv.gz` на станцию (`snipClimate.js:322-340`).

Итого на один город: **1 (общий) + до 3 HEAD + 11 CSV.gz**. Плюс 1 JSON-ответ Nominatim (`geocode.js:94-106`, из него читаются только `lat`, `lon`, `display_name`).

Сколько городов: минимально достаточно **3** — тёплый юг, средняя полоса, холодный север Украины (разные `designOutsideTempC` → разные ветки подбора мощности). Для регрессии физики хватит.

Реальный размер `stations/lite.json.gz` и одного `daily/*.csv.gz` — **НЕ ПРОВЕРЕНО** (загрузка не выполнялась). Но фикстуры **не обязаны быть копией реальных ответов**: код парсит CSV сам (`parseDailyCsvTavg`, `snipClimate.js:232-252`, колонка `tavg` или `temp`) и считает минимальное 5-дневное скользящее среднее (`minRollingAverage`, `snipClimate.js:47-65`). Синтетический CSV на ~365 строк в год × 11 лет ≈ 4000 строк ≈ ~60 КБ несжатого текста на станцию, gzip — единицы КБ. Для 3 городов суммарно **менее 100 КБ фикстур**. Держать их лучше в несжатом виде и гзиповать в стабе на лету (`gunzipSync` в проде — `snipClimate.js:151,333`).

### 4.7 Хорошая новость для E2E

Фронтенд **никогда не отправляет `location`/`address`** в теле `POST /api/v1/calc`: `buildCalcRequestPayload.ts` не содержит поля `location` (проверено `grep 'location:'` по всему `frontend/src` — 0 попаданий), а `temps.outsideC` отправляется всегда, с дефолтом `-5` (`migrateDerivedState.ts:168`, `migrateSurveyDraft.ts:140`, `buildCalcRequestPayload.ts:199`). Условие входа в климат — `input.location && inputTemps?.outsideC == null` (`buildReport.js:229`) — при UI-прогоне не выполняется никогда.

**Следствие: браузерные E2E-сценарии герметичны без единого мока внешнего HTTP.** Моки Nominatim/Meteostat нужны только для прямых API-тестов, которые сознательно передают `location`.

---

## 5. Детерминизм каталога

### 5.1 Гарантия одинакового каталога

`CATALOG_SOURCE=file` + `CATALOG_FILE_PATH`, указывающий на файл в репозитории. Сейчас:

- `backend/test_data.json` в `.gitignore` (`.gitignore`, комментарий «Локальная копия каталога для seed / CATALOG_SOURCE=file»);
- в репозитории лежит `backend/test_data.json.example` (104 КБ);
- CI копирует `.example` → `test_data.json` (`.github/workflows/verify.yml:43-48`), локально это делает разработчик руками.

Рекомендация: тестовый env указывает `CATALOG_FILE_PATH=<repo>/backend/test_data.json.example` напрямую (`catalogPaths.js:17-23` принимает и абсолютный, и относительный от `backend/` путь). Тогда тесты не зависят от того, скопировал ли кто-то файл, и не ломаются от локальных правок `test_data.json`.

Полный набор env для детерминированного прогона: `CATALOG_SOURCE=file`, `WATER_NORMS_SOURCE=file`, `APPLIANCES_SOURCE=file`, `RECOMMENDATIONS_SOURCE=file`, `UFH_PRESETS_SOURCE=file` — иначе `auto` попытается Mongo и при её наличии (например, memory-server поднят для тестов проектов) молча возьмёт **другой** каталог (`loadReferenceCollection.js:54-77`, `loadCatalog.js:359-371`).

### 5.2 Сброс кэша между тестами — три способа, программный есть

| Способ | Якорь | Когда |
|---|---|---|
| **Программный** `invalidateReferenceCache()` / `invalidateAndWarmReferenceCache()` | экспортируются из `backend/src/reference/public.js:5`, реализация `configCache.js:103-118` | in-process тесты (vitest/node:test) — `beforeEach`. **Основной путь** |
| HTTP `POST /api/v1/system/invalidate-reference-cache` + `X-System-Token` | `systemRoutes.js:28-60` | E2E, где backend — отдельный процесс. Требует `SYSTEM_INTERNAL_TOKEN` в env сервера (`systemRoutes.js:31-35`) |
| Перезапуск процесса | — | только при смене env, влияющих на импорт-тайм (см. 5.4) |
| `REFERENCE_CACHE_TTL_MS` | `configCache.js:43-47`, дефолт 3 600 000 мс (`configCache.js:14`) | в тестах не крутить: длинный TTL — благо, кэш стабилен внутри прогона |

`invalidateReferenceCache()` бампает `cacheGeneration` (`configCache.js:104-106`), поэтому «висящий» параллельный refresh не перезапишет свежий снимок (`configCache.js:134-141`) — сброс безопасен даже под нагрузкой.

### 5.3 Зависимости от порядка ключей / сортировки — есть, одна значимая

`Array.prototype.sort` в V8 стабилен, поэтому равные элементы сохраняют порядок входа. Порядок входа задаётся источником:

- **file**: порядок массивов в `test_data.json` как есть;
- **mongo**: `Product.find({}).sort({ kind: 1, catalogKey: 1 })` (`loadCatalog.js:207`), затем перегруппировка `filter(kind === ...)` (`loadCatalog.js:214-240`) и разложение котлов на `doubleCircuit`/`singleCircuit` по `isDoubleCircuit` (`loadCatalog.js:246-249`).

Компараторы без tie-break:

- `compareBoilersByMaxPowerAsc` — только `powerKw.max` (`comparators.js:64-66`), применяется в `buildMatchingSortPools` (`matchingSortPools.js:34`);
- `compareWaterHeatersByMinVolumeAsc` — только минимальный объём вариантов (`comparators.js:75-77`, `matchingSortPools.js:35`);
- аналогичные многоключевые, но всё же конечные сортировки в `manifold.js:201,211,263,271`, `unibox.js:207`, `indirectWaterHeater.js:127`, `waterHeater.js:16,77`, `radiatorSizingHelpers.js:141`.

**Вывод:** внутри одного источника результат детерминирован. **Между `file` и `mongo` при равных ключах сортировки может выбраться другой SKU.** Для тестов это означает: (а) закрепить `CATALOG_SOURCE=file` во всех тестовых конфигурациях; (б) добавить в план явный кейс «одинаковый вход даёт одинаковый выбор оборудования из file и из mongo» как регресс-детектор на отсутствующие tie-break'и (P2).

Дополнительно детерминированы: `normalizedVariants.sort` по объёму (`validateCatalog.js:530`) и обход `Object.keys(item)` при валидации (`validateCatalog.js:1282`) — порядок ключей объекта из `JSON.parse` совпадает с порядком в файле, стабилен.

### 5.4 Прочие источники недетерминизма в ответе

- `meta.generatedAt: new Date().toISOString()` (`buildReport.js:737`) — **единственный** таймстемп в отчёте;
- `meta.referenceBundleLoadedAt` (`buildReport.js:745-747`) — производный от момента загрузки кэша;
- `Math.random` / `randomUUID` в `report`, `matching`, `hydraulics` — **не найдено** (`grep` дал 0 попаданий);
- `generateShareToken()` — `randomBytes(24)` (`shareToken.js:16`), недетерминирован, но это токен, а не расчёт.

Для золотых эталонов достаточно вырезать `meta.generatedAt` и `meta.referenceBundleLoadedAt`.

- **Rate limiters создаются на импорт-тайме**: `calcRateLimiter` и остальные — module-level константы (`rateLimiters.js:70-80`), а `isRateLimitDisabled()` вычисляется внутри `createLimiter` один раз (`rateLimiters.js:27`). Значит `RATE_LIMIT_DISABLED=true` **обязан** быть в env **до** импорта модуля; менять его между тестами внутри процесса бесполезно. И он игнорируется при `NODE_ENV=production` (`projectsAuthConfig.js:198`).

---

## 6. PDF в CI

### 6.1 Bundled Chrome vs системный Chromium — используются оба

Рендер: `backend/src/projects/renderPdfFromHtml.js`, запуск через `puppeteer-core` (`renderPdfFromHtml.js:7,76`). Разрешение исполняемого файла — `resolveBrowserExecutable()` (`renderPdfFromHtml.js:21-62`), приоритет:

1. `PDF_BROWSER_EXECUTABLE` — если задан и файла нет, сразу `PDF_BROWSER_MISSING / 503` (`renderPdfFromHtml.js:22-31`);
2. динамический `await import('puppeteer')` → `executablePath()` — **bundled Chrome** (`renderPdfFromHtml.js:34-41`);
3. список системных путей `/usr/bin/chromium`, `chromium-browser`, `google-chrome`, `google-chrome-stable`, два Windows-пути (`renderPdfFromHtml.js:43-53`);
4. иначе `PDF_BROWSER_MISSING / 503` (`renderPdfFromHtml.js:55-61`).

В `backend/package.json` **обе** зависимости: `puppeteer@^24.22.0` и `puppeteer-core@^24.22.0`. То есть:

- **прод/Docker** — системный Chromium: `Dockerfile:8` (`apt-get install chromium`), `Dockerfile:15-16` (`PUPPETEER_SKIP_DOWNLOAD=true`, `PDF_BROWSER_EXECUTABLE=/usr/bin/chromium`), то же в `backend/docker-compose.pdf.yml:13,16`;
- **CI сегодня** — bundled Chrome: `.github/workflows/verify.yml` не задаёт ни `PUPPETEER_SKIP_DOWNLOAD`, ни `PDF_BROWSER_EXECUTABLE`; `.puppeteerrc*` в репозитории **отсутствует** (проверено `find`). Значит `npm ci` в `backend` (`verify.yml:28-30`) скачивает Chrome, и `verify:project-pdf` рендерит настоящий PDF.

Это несоответствие прод/CI стоит зафиксировать в плане: в CI тестируется bundled Chrome, в проде работает Debian-овский `chromium`. Разные версии → разный рендер. Отдельный (не блокирующий) job на `backend/Dockerfile` был бы честнее — P2.

### 6.2 Оценка времени рендера

Замер невозможен без установки зависимостей. По коду — потолки:

- `PDF_RENDER_TIMEOUT_MS`, дефолт **30 000 мс** (`renderPdfFromHtml.js:13-16`), применяется к `puppeteer.launch` (`:85`), `page.setDefaultTimeout` (`:89`), `page.setContent` (`:90`) и `page.pdf` (`:93`);
- `page.setContent(html, { waitUntil: 'networkidle0' })` (`renderPdfFromHtml.js:90`) — ждёт 500 мс тишины сети; HTML статический (`buildEstimatePdfHtml`), внешних ресурсов не грузит, так что это ~фиксированные полсекунды;
- **браузер поднимается и закрывается на каждый PDF** (`renderPdfFromHtml.js:76`, `:119`) — нет переиспользования инстанса. Cold launch Chromium — основная статья расходов;
- `PDF_MAX_CONCURRENT`, дефолт **2** (`pdfRenderSemaphore.js:13-16`), ожидание слота `PDF_QUEUE_WAIT_MS`, дефолт **15 000 мс** (`pdfRenderSemaphore.js:8,23-26`), при превышении — `PDF_QUEUE_TIMEOUT / 503` (`pdfRenderSemaphore.js:72-78`).

Реалистичный порядок для одного PDF: **1-4 секунды** (launch + setContent + print). Это оценка по структуре кода, не замер — **фактическое время НЕ ПРОВЕРЕНО**.

Тестовый бюджет: один PDF-кейс на прогон, таймаут теста ≥ 60 с, `PDF_MAX_CONCURRENT=1` для предсказуемости, `PDF_QUEUE_WAIT_MS` побольше, если PDF-тестов несколько.

### 6.3 Что делать в CI, если браузера нет

`PDF_REQUIRE_BROWSER` **не влияет на прод-код** — он читается ровно в одном месте: `backend/scripts/verifyProjectPdf.js:144-146`. Логика скрипта: `PDF_BROWSER_MISSING` → печатает `SKIP` и продолжает (`verifyProjectPdf.js:133-136`); и только при `PDF_REQUIRE_BROWSER === '1'` этот SKIP превращается в FAIL.

Сейчас в CI `PDF_REQUIRE_BROWSER` не выставлен → пропажа браузера пройдёт **молча**.

**Рекомендация — три уровня:**

1. **Unit/интеграция (основной job):** `PDF_BROWSER_EXECUTABLE` не задавать, тесты HTML-генерации (`buildEstimatePdfHtml`) гонять всегда — они чистые и быстрые; тест реального рендера помечать как условный и **скипать** при `PDF_BROWSER_MISSING`. Это то, что делает текущий `verifyProjectPdf.js`.
2. **Отдельный job `pdf`** в том же workflow: `runs-on: ubuntu-latest`, шаг `npx puppeteer browsers install chrome` (или полагаться на автозагрузку при `npm ci`, как сейчас), env `PDF_REQUIRE_BROWSER=1`, `PDF_MAX_CONCURRENT=1`. Так пропажа браузера — красный билд, а не тихий SKIP. Обоснование выделения в отдельный job: загрузка Chrome ~150 МБ и не кэшируется `actions/setup-node` (он кэширует `~/.npm`, а не `~/.cache/puppeteer`) — не надо тормозить основной прогон; при желании добавить `actions/cache` на `~/.cache/puppeteer`.
3. **Ставить, а не скипать, в PDF-job.** Скипать — только в основном. Гонять PDF внутри Docker-образа (`backend/Dockerfile`) — опционально, P2, зато закрывает расхождение из §6.1.

---

## 7. Совместимость версий Node

### 7.1 Фактические версии

| Где | Версия | Якорь |
|---|---|---|
| Локально | **v26.7.0** (npm 11.19.0) | `node -v` в этой сессии |
| CI | **22.22.0** | `.github/workflows/verify.yml:16` |
| Docker (прод-образ backend) | **node:20-bookworm-slim** | `backend/Dockerfile:4` |
| `engines` — frontend | `>=22.22.0 <23` | `frontend/package.json:6` |
| `engines` — backend | **отсутствует** | `backend/package.json` |
| `engines` — shared | **отсутствует** | `shared/package.json` |
| `engines` — root | **отсутствует** | `package.json` |
| `.nvmrc` / `.node-version` / `.npmrc` | **отсутствуют** | `find` по репозиторию |

### 7.2 Расхождения и их влияние

**Значимые:**

1. **Локальный Node 26.7.0 нарушает `frontend/package.json:6` (`>=22.22.0 <23`).** `.npmrc` с `engine-strict=true` нет, поэтому npm ограничится warning'ом — установка пройдёт. Но это ровно та щель, где локальный `npm run verify` зелёный, а CI красный (или наоборот). **Первая же правка тестовой инфраструктуры — добавить `.nvmrc` с `22.22.0`** и синхронизировать `engines` во всех пакетах.
2. **Три разных Node в трёх средах** (20 / 22.22 / 26.7). Прод-образ на Node 20 — самая старая; `mongoose@9.5.0` и `mongodb@7.1.1` требуют `node >= 20.19.0` (из lock-файла), т.е. `node:20-bookworm-slim` проходит только потому, что тег резолвится в свежий 20.x. Запас нулевой. **Рекомендация: поднять `Dockerfile:4` до `node:22-bookworm-slim`** и совместить с CI — P1 (прод-паритет), но формально вне scope R4.
3. **Транзитивные `engines`** (из lock-файлов): `vite` и `@vitejs/plugin-react` — `^20.19.0 || >=22.12.0`; `eslint` — `^20.19.0 || ^22.13.0 || >=24` (**22.22.0 подходит, 23.x не подошёл бы**); `react-router` — `>=22.22.0` (ровно нижняя граница CI); `knip` — `>=18.18.0`. То есть CI-версия 22.22.0 выбрана не случайно, а как минимум, продиктованный `react-router@8.3.0`. Понижать нельзя.

**Не значимые (проверено):**

- **ESM.** Все три пакета `"type": "module"`. Top-level await используется (`index.js:124,155`) — поддерживается везде начиная с Node 14.8. Импортов JSON с `with { type: 'json' }` / `assert { type: 'json' }` — **ни одного** (`grep` по `backend/src`, `backend/scripts`, `frontend/scripts`, `shared`), значит нестабильная семантика import attributes между версиями проект не задевает. JSON читается через `fs.readFile` + `JSON.parse` (`loadCatalog.js:181,193`) и через `createRequire`-подобные паттерны не грузится.
- **`--experimental-*` флаги** — не используются нигде (`grep`, 0 попаданий).
- **Глобальный `fetch`** — стабилен с Node 21, доступен и в 20, и в 22, и в 26. Используется в `geocode.js:59`, `snipClimate.js:108,132`, `fuzz-calc.ts:89`. Разницы, влияющей на тесты, нет; **важно другое:** способ мока (подмена `globalThis.fetch`) от версии Node не зависит, в отличие от undici-MockAgent — ещё один аргумент за вариант из §4.4.
- **Встроенный `node:test`** — присутствует и стабилен в 22 и 26. Но в `node:test` до 22 нет некоторых удобств (mock timers/модулей в 22 — экспериментальные). Это учтено в выборе раннера ниже.
- **`tsx@4.23.5`** уже в devDependencies backend и root, используется для `npm run test:fuzz` — TypeScript-скрипты уже исполняются в этом репозитории на всех трёх Node.

### 7.3 Вердикт

Технических блокеров для тестов из-за версий Node нет. Единственный реальный риск — **дрейф локальной среды от CI** (26.7.0 против 22.22.0 при `engines <23`). Лечится `.nvmrc` + `engines` в каждом пакете; это дешевле, чем ловить плавающие расхождения в тестах.

---

## Рекомендованный стек

### Раннер unit / интеграционных тестов — **Vitest**

Почему не `node:test`: приоритет владельца #2 — «полное покрытие расчётного ядра и движка подбора». Это сотни табличных кейсов с золотыми эталонами. `node:test` не даёт snapshot-тестирования, покрытия «из коробки» без обвязки и параллельных воркеров с изоляцией env-переменных. Прогон должен уметь ставить `CATALOG_SOURCE=file`, `RATE_LIMIT_DISABLED=true`, `PROJECTS_AUTH_ENABLED` **до импорта модулей** (см. 5.4 — лимитеры фиксируются на импорт-тайме); vitest'овский `environment`/`setupFiles`/`isolate: true` (форк на файл) решает это штатно.

Почему не Jest: репозиторий целиком ESM (`"type": "module"` во всех пакетах), backend — `.js` с JSDoc и `checkJs`, frontend — TS + Vite 8. Jest в ESM требует `--experimental-vm-modules` и трансформеров; это прямой конфликт с §7 («никаких experimental-флагов сейчас нет»). Vitest переиспользует уже настроенный `frontend/vite.config.ts` (алиасы, `define: __APP_VERSION__` и др., `vite.config.ts:141-145`) — без него фронтовые компонентные тесты придётся конфигурировать заново.

Почему Vitest подходит backend'у, у которого Vite нет: vitest работает и с чистым Node-таргетом (`environment: 'node'`, `pool: 'forks'`), esbuild-трансформ нужен только для `.ts`-фикстур и `scripts/fuzz-calc.ts` — а он в проекте уже есть.

Оговорка: vitest тянет свой Vite. У backend Vite сейчас нет — это +1 крупная devDependency в `backend/`. Альтернатива, если это неприемлемо: `node:test` для backend + vitest для frontend. Тогда цена — два разных синтаксиса ассертов и два отчёта. **Рекомендую единый vitest**, обоснование выше.

### E2E — **Playwright**

- Приоритет #0 владельца — «проходимость анкеты», а корневой симптом (автор не смог заполнить свою анкету) требует **воспроизводимого прохождения многошагового мастера** из 11 шагов (`frontend/src/constants/surveySteps.ts`). Playwright'овские trace viewer + video + `--ui` дают разбор «где именно застрял» — это буквально формат артефакта, который нужен владельцу.
- Обход Clerk через `context.addInitScript` / `storageState` с `localStorage['projectsApiBearerToken']` (`authConfig.ts:5,70-80`) — штатный механизм Playwright, не требует пересборки бандла под каждый сценарий (в отличие от `VITE_PROJECTS_BEARER_TOKEN`, который зашивается в бандл на этапе build).
- `webServer` в конфиге поднимает backend и `vite preview` (или `vite dev` с уже настроенным proxy на `:3001` — `vite.config.ts:146-158`) одной командой.
- Мультибраузерность и headless в CI без Xvfb.
- Cypress отвергнут: нет multi-origin из коробки для hosted Clerk login (если позже понадобится clerk-smoke), нет параллелизма без платного Dashboard, и он навязывает собственный ассерт-стек поверх vitest'овского.

### Стратегия моков внешнего HTTP

**Двухуровневая, ноль правок прод-кода.**

1. **In-process (vitest):** setup-файл подменяет `globalThis.fetch`. Покрывает `geocode.js:59`, `snipClimate.js:108,132`. Политика: любой незамоканный исходящий запрос → бросить ошибку с URL (иначе тест «зелёный за счёт интернета»).
2. **E2E / отдельный процесс backend:** запуск как `node --import ./tests/http-stub/preload.mjs src/index.js`. Preload подменяет `globalThis.fetch` до загрузки прод-модулей. Команда живёт только в `playwright.config.ts` → прод-скрипты `package.json` не трогаем.
3. Фикстуры — рукописные (§4.6): 1 урезанный `stations lite` + по 11 синтетических daily-CSV на 3 станции + 3 ответа Nominatim. **< 100 КБ.**
4. MSW — допустимая замена п.1-2, если команда хочет декларативные handlers и `onUnhandledRequest: 'error'`. Не критично.
5. **`undici` MockAgent — не использовать** (неявная связка версий встроенного и внешнего undici).
6. Напоминание: браузерные E2E климат вообще не задевают (§4.7) — моки нужны только прямым API-тестам с `location`.

### Стратегия БД

- **Расчётное ядро, matching, гидравлика, финансовая смета, PDF-HTML, валидация** — **без Mongo вовсе**: `CATALOG_SOURCE=file` + прямой вызов `runCalculation()` / `buildReport()`. Самый быстрый и самый ценный пласт (приоритет владельца #2).
- **Проекты, расчёты, share, feedback, users, admin, IDOR** — **`mongodb-memory-server`**, один инстанс на воркер, `MONGODB_DB` уникальный на файл, `dropDatabase()` в `afterEach`. Обоснование в §1.5 (нет транзакций, нет Atlas Search, локальный URI не задевает DNS-хак).
- **Fallback**, если memory-server не подружится с `mongodb@7.1.1`: сервис `mongo:7` в CI + `docker compose` локально; переключение — одной переменной `MONGODB_URI`, никаких правок кода.
- **Загрузка фикстур проектов** — через `POST /api/v1/projects/import` (`ProjectExportBundle v1`, `docs/project-export-import.md`), но **обязательно** с включённой auth и admin-токеном (§3.2: `requireRole.js:21-28` даёт 403 при выключенной auth). Значит JWKS-стаб из §2.3 нужен не только для тестов авторизации, но и для подготовки состояния.

### Где это физически живёт в монорепо

```
backend/
  vitest.config.ts                 # НЕ попадает в tsconfig include (см. ниже)
  tests/
    setup/
      env.ts                       # CATALOG_SOURCE=file, RATE_LIMIT_DISABLED, MONGODB_DB…
      fetch-stub.ts                # подмена globalThis.fetch для in-process тестов
      mongo.ts                     # старт/стоп mongodb-memory-server
      jwks-stub.ts                 # RS256 keypair + http-сервер /.well-known/jwks.json
    fixtures/
      climate/                     # stations-lite.json, daily/<station>/<year>.csv, nominatim/*.json
      projects/                    # ProjectExportBundle v1 для /projects/import
      golden/                      # эталоны отчётов (без meta.generatedAt)
    unit/  integration/
  tests/http-stub/preload.mjs      # для `node --import` в E2E

frontend/
  vitest.config.ts
  tests/                           # компонентные / хуки

e2e/                               # корень репо, отдельный package.json
  playwright.config.ts
  tests/  fixtures/
```

**Ключевое требование — не сломать `npm run verify`.** Все тестовые каталоги вынесены **за пределы** `src/` и `scripts/`, потому что:

| Существующий гейт | Область | Почему `tests/` вне неё безопасен |
|---|---|---|
| `scripts/verifyNoTypeBypass.mjs` | `frontend/src`, `backend/src`, `backend/scripts`, `shared` (`verifyNoTypeBypass.mjs:13-18`) | `backend/tests`, `frontend/tests`, `e2e/` не сканируются → в тестах можно `as any` без падения гейта |
| backend `npm run lint` | `"src/**/*.js" "scripts/**/*.js"` (`backend/package.json`) | `tests/` не линтится |
| frontend `npm run lint` (`eslint .`) | правила применены к `files: ['src/**/*.{ts,tsx}']` (`frontend/eslint.config.js:23`) | `frontend/tests` попадает в обход, но без strictTypeChecked-правил |
| backend `npm run typecheck` | `include: src/**/*.js, scripts/**/*` (`backend/tsconfig.json`) | `tests/` и `vitest.config.ts` не типизируются — **следует добавить отдельный `tsconfig.tests.json`**, чтобы тесты всё же проверялись, но своей командой |
| frontend `verify:dead-code` (knip) | `project: ["src/**/*.{ts,tsx}"]` (`frontend/knip.json`) | **РИСК:** knip флагует неиспользуемые devDependencies. `vitest`, `@playwright/test` не будут видны из `src/**` → нужно добавить их в `ignoreDependencies` **или** прописать `entry` для `tests/**` |
| frontend `verify:report-colocation`, `verify:types-placement` | **НЕ ПРОВЕРЕНО** — область не читалась | перед добавлением тестов в `frontend/` проверить эти два скрипта |
| CI `verify.yml` | три `npm ci` + два `npm run verify` | новый job `test` и job `e2e` добавляются **рядом**, существующий `verify` не трогается |

Новые npm-скрипты: `backend: "test": "vitest run"`, `frontend: "test": "vitest run"`, root: `"test": "npm run test --prefix backend && npm run test --prefix frontend"`, `"test:e2e": "npm test --prefix e2e"`. **В `"verify"` их не вплетать** — иначе один флейки-E2E блокирует typecheck и lint. Отдельные CI-джобы.

---

## Требуемые правки продакшн-кода (минимум)

Ровно две, обе — не поведенческие. Всё остальное закрывается env и preload'ом.

### П1 (обязательная). Извлечь `createApp()` из `backend/src/index.js`

**Проблема.** `index.js` собирает Express, регистрирует middleware и **сразу** делает `app.listen` на верхнем уровне модуля (`index.js:43,257`). Экспорта `app` нет. Значит интеграционные HTTP-тесты (supertest) не могут импортировать приложение — только поднимать процесс и ходить по TCP: медленно, нельзя дёрнуть `invalidateReferenceCache()` из того же процесса (§5.2), нельзя подменить env между кейсами.

Собрать app в тесте самостоятельно из `createRoutes()` (`api/public.js:5`) можно, **но** централизованный обработчик ошибок `handleApiError` (`index.js:173-253`) — приватный. Его пришлось бы дублировать в тестах, и тесты начали бы проверять копию, а не прод-код: коды `PAYLOAD_TOO_LARGE`, `BAD_JSON`, `CALCULATION_DOCUMENT_TOO_LARGE` и сокрытие деталей 500 в production (`index.js:230-241`) поехали бы врозь от реальности.

**Правка.** Новый `backend/src/app.js`, экспортирующий `export async function createApp()` — вся сборка из `index.js:43-255` без изменений. `index.js` сжимается до загрузки env, assert'ов auth, `const app = await createApp()`, прогрева кэша и `app.listen`. Поведение прода идентично; риск — минимальный.

**Почему это минимально необходимо:** без неё либо (а) HTTP-тесты становятся process-based и теряют программный сброс кэша и подмену env — резко дороже и медленнее, либо (б) обработчик ошибок дублируется — тесты перестают отражать прод.

### П2 (условная, только если откажутся от preload-подхода). Env для базовых URL климата

Три захардкоженные константы (`geocode.js:9`, `snipClimate.js:10,17`) → `process.env.NOMINATIM_BASE_URL ?? '<текущее>'` и т.д. Дефолт сохраняется, прод-поведение не меняется.

**Рекомендую не делать.** Вариант `node --import preload.mjs` (§4.4) закрывает ту же задачу без единой строки в прод-коде.

### Не является правкой прод-кода, но нужно сделать

- `.nvmrc` = `22.22.0` и `engines` в `backend/`, `shared/`, root — синхронно с `frontend/package.json:6` (§7.2);
- `frontend/knip.json` — `ignoreDependencies` или `entry` для тестовых пакетов, иначе `verify:dead-code` покраснеет;
- в CI-джобе PDF выставить `PDF_REQUIRE_BROWSER=1`, чтобы пропажа браузера была FAIL, а не тихий SKIP (`verifyProjectPdf.js:144-146`).

### Рассмотрено и отвергнуто

- Ослабить `validateAuthConfiguration` (`projectsAuthConfig.js:119-124`), чтобы разрешить HS256 при включённой auth. **Нет.** Этот запрет — прод-защита от катастрофы (симметричный ключ вместо JWKS). JWKS-стаб даёт то же самое, честнее и без правки.
- Разрешить `POST /api/v1/projects/import` без admin-роли в dev. **Нет.** Ослабляет прод-контроль ради удобства тестов; JWKS-стаб решает штатно.
- Инъекция транспорта (DI) в `climate/*`. **Нет.** Подмена глобального `fetch` даёт то же покрытие без изменения сигнатур.

---

## НЕ ПРОВЕРЕНО

1. **Ни один тест/скрипт не запускался** — `node_modules` отсутствуют во всех пакетах. Все утверждения о поведении получены чтением исходников и lock-файлов.
2. **Совместимость `mongodb-memory-server` с `mongodb@7.1.1` / `mongoose@9.5.0`.** Версии драйвера взяты из `backend/package-lock.json`; сам memory-server в проекте отсутствует. Нужен прогон-пилот перед фиксацией стратегии БД.
3. **Поведение `w=majority` и `retryWrites=true` (принудительно добавляются `mongoConnectionConfig.js:49-54`) на standalone-инстансе.** Ожидаю, что пройдёт, но не проверял.
4. **Реальный размер и формат ответов Meteostat**: `stations/lite.json.gz` и `daily/{year}/{station}.csv.gz` — сеть не использовалась. Формат восстановлен по парсерам (`snipClimate.js:170-183`, `232-252`); фикстуры под них синтезируются, реальные ответы не нужны.
5. **Реальный размер ответа Nominatim** — по коду читаются только `lat`, `lon`, `display_name` (`geocode.js:98-106`).
6. **Фактическое время рендера PDF** — оценка §6.2 сделана по таймаутам и структуре кода, замера нет.
7. **Точный API `@clerk/testing`** и его совместимость с `@clerk/clerk-react@5.61.9` — пакет не установлен, документация не читалась.
8. **`frontend/scripts/verifyReportColocation.mjs` и `verifyTypesPlacement.mjs`** — область сканирования не читалась; перед размещением тестов внутри `frontend/` их надо проверить (в предложенной схеме тесты лежат в `frontend/tests/`, вне `src/`, поэтому риск низкий).
9. **`docs/qa/research/U1…U5`** на момент написания в репозитории отсутствуют (есть только `_CONTEXT.md` и `ux-screens/`) — на них не опирался.
10. **`docs/deploy/*.md`** на предмет фиксации версии Node на Render — grep по «version|22|20|engines» не дал попаданий; фактическая версия рантайма Render **не установлена**.
11. **Реальное поведение `jose.createRemoteJWKSet` с `http://` URL** (для локального JWKS-стаба) — по коду ограничений нет (`verifyAccessToken.js:21` принимает любой `new URL(...)`), но не проверено прогоном.
