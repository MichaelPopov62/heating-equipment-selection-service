# R3 — API-контракт и таксономия ошибок

> Все утверждения о поведении — с якорем `file:line`. Где проверить не удалось — «НЕ ПРОВЕРЕНО».
> Проверено чтением исходников; прогонов не было (`node_modules` не установлены, запрет из брифинга).

## Резюме

- В `openapi.yaml` **25 путей**; в коде дополнительно реализовано **4 недокументированных
  поверхности** (`GET /`, `GET /api`, `GET /api/health`, legacy-rewrite `/api/projects/*`),
  итого 29 адресуемых точек + catch-all `404 NOT_FOUND`.
- Форма конверта едина (`sendErrorEnvelope.js:17-23` + `index.js:243-252`), но **таксономия кодов
  размазана**: `errorCodes.js` объявляет только 6 кодов из ~60 фактически выбрасываемых.
- **P0-находка для главного симптома:** AJV-ошибка доходит до HTTP-ответа с полным `details[]`
  (`instancePath`), но **фронтенд выбрасывает `details` и `code`, оставляя только `message`**
  (`frontend/src/services/calc.ts:64-77`, `frontend/src/utils/apiError.ts:9-17`). Пользователь видит
  ровно строку «Некоректні вхідні дані» без указания поля. Показать ошибку у поля сейчас невозможно
  в принципе — не из-за бэкенда, а из-за клиента.
- **Молчаливая нормализация — массовая.** 17 мест, где вход пользователя меняется без уведомления.
  Худшие: `removeAdditional: true` (лишние поля тихо удаляются, а не отвергаются),
  перезапись `supplyC`/`returnC` пресетом (`heatingThermalRegimes.js:74-75`),
  затирание накопленных `_normalizationWarnings` (`validate.js:768,776`).
- **Расхождений OpenAPI ↔ код — 18.** Топ: `POST /api/v1/projects/import` в контракте описан как
  «любой JWT-пользователь», в коде — `requireRole('admin')` → 403 (`projectsRoutes.js:247`);
  429 не задокументирован ни для одного из шести rate-limited путей кроме двух;
  409 (квоты) не задокументирован там, где выбрасывается.
- **Блокер тестируемости:** при `PROJECTS_AUTH_ENABLED=false` (dev по умолчанию) `requireRole`
  отвечает **403 всем без исключения** (`requireRole.js:21-28`), а dev-профиль жёстко `role: 'user'`
  (`serializeMeUser.js:32-40`). Значит `/api/v1/admin/*` и загрузчик фикстур
  `POST /api/v1/projects/import` **недоступны в dev-режиме вообще**. План E2E, опирающийся на
  import-фикстуры (как предлагает брифинг), требует поднятого JWT-пути.

---

## 1. Реестр эндпоинтов

Rate limit: окно везде 15 мин, ключ — `user:<req.user.id>` при наличии, иначе IP
(`middleware/rateLimiters.js:14-20`). «—» = лимитера нет.

| # | Путь | Метод | Auth | Rate limit (лимитер / дефолт) | Успех | Ошибки (фактические) | Валидация тела | Расхождение с OpenAPI |
|---|------|-------|------|------------------------------|-------|----------------------|----------------|------------------------|
| 1 | `/health` | GET | публичный `routes.js:34` | — | 200 | — | нет | OpenAPI:19-31 объявляет `400`, недостижим |
| 2 | `/api/health` | GET | публичный `routes.js:36` | — | 200 | — | нет | **нет в OpenAPI** |
| 3 | `/` | GET | публичный `routes.js:44` | — | 200 | — | нет | **нет в OpenAPI** |
| 4 | `/api` | GET | публичный `routes.js:67` | — | 200 | — | нет | **нет в OpenAPI** |
| 5 | `/api/v1/system/invalidate-reference-cache` | POST | заголовок `X-System-Token` `systemRoutes.js:37-43` | — | 200 | 503 `SYSTEM_TOKEN_NOT_CONFIGURED` `:33`; 403 `SYSTEM_TOKEN_FORBIDDEN` `:41`; 500 через `next(err)` `:58` | нет | 500 не объявлен |
| 6 | `/api/v1/catalog` | GET | публичный `routes.js:82` | — | 200 | 500 (`next(err)` `:91`) | нет | объявлен `400`, недостижим; `500` не объявлен |
| 7 | `/api/v1/presets/envelope` | GET | публичный `routes.js:111` | — | 200 | — | нет | объявлен `400`, недостижим |
| 8 | `/api/v1/presets/underfloor-heating` | GET | публичный `routes.js:137` | — | 200 | — | нет | то же |
| 9 | `/api/v1/presets/underfloor-heating/bases` | GET | публичный `routes.js:119` | — | 200 | — | нет | то же |
| 10 | `/api/v1/presets/flooring-finishes` | GET | публичный `routes.js:127` | — | 200 | — | нет | то же |
| 11 | `/api/v1/presets/underfloor-heating/modes` | GET | публичный `routes.js:152` | — | 200 | 500 | нет | ок |
| 12 | `/api/v1/feedback` | POST | `optionalAuth` `feedbackRoutes.js:28` | `feedbackRateLimiter` 20 | 201 `:59` | 400 `FEEDBACK_*` (5 кодов) `:33`; 429 `FEEDBACK_RATE_LIMIT_EXCEEDED`; 503 `MONGODB_UNAVAILABLE` `:37` | `validateFeedbackBody.js:26-69` (ручная) | ок |
| 13 | `/api/v1/calc` | POST | **публичный** `routes.js:196` | `calcRateLimiter` prod 20 / dev 120 | 200 | 400 `VALIDATION_ERROR` + ~25 доменных кодов; 429 `CALC_RATE_LIMIT_EXCEEDED`; 500; 502 `GEOCODE_*`/`METEOSTAT_*`; 400 `BAD_JSON`; 413 `PAYLOAD_TOO_LARGE` | AJV `CalcInput.yaml` + 7 фаз `validate.js:260-379` | **429 не объявлен**; `BAD_JSON`/413 не объявлены |
| 14 | `/api/v1/projects` | GET | `requireAuth` `:128` | read 120 | 200 | 403 `ADMIN_REQUIRED` (ownerId/ownerEmail без admin) `:139`; 400 `VALIDATION_ERROR` (кривой query `ownerId`) `projectAccess.js:98-103`; 401; 503 | query `parseLimit` `:116-120` | 429 не объявлен |
| 15 | `/api/v1/projects` | POST | `requireAuth` | write 60 | 201 `:230` | 409 `PROJECT_QUOTA_EXCEEDED` `projectAccess.js:200`; 400 `VALIDATION_ERROR`; 413 `PAYLOAD_TOO_LARGE` `validateProjectSurveyShape.js:20`; 401/403/503 | `validateProjectCreateBody` `:215` | **409 не объявлен**, 429 не объявлен |
| 16 | `/api/v1/projects/import` | POST | `requireAuth` + **`requireRole('admin')`** `:247` | write 60 | 201 `:258` | **403 `ADMIN_REQUIRED`**; 400 `VALIDATION_ERROR`; 409; 413 | `validateProjectImportBody` `:251` | **403 не объявлен, admin-only не описан** |
| 17 | `/api/v1/projects/{id}` | GET | `requireAuth` (+IDOR-фильтр) | read 120 | 200 | 400 `VALIDATION_ERROR` (кривой ObjectId) `:281`; 404 `PROJECT_NOT_FOUND` `:287`; 401/403/503 | нет | **400/401/403 не объявлены**, 429 нет |
| 18 | `/api/v1/projects/{id}` | PUT | `requireAuth` | write 60 | 200 | 400 `:336`; 404 `:342,:359`; 413; 401/403/503 | `validateProjectUpdateBody` `:346` | 401/403/429 не объявлены |
| 19 | `/api/v1/projects/{id}` | DELETE | `requireAuth` | write 60 | 200 | 400 `:392`; 404 `:398,:407` | нет | 401/403/429 не объявлены |
| 20 | `/api/v1/projects/{id}/calc` | POST | `requireAuth` | `projectCalcRateLimiter` 15 | 200 `:543` | 400 `:450`, `CALC_INPUT_REQUIRED` `resolveProjectCalcInput.js:17,23,81`; 404 `:456`; 409 `CALCULATION_QUOTA_EXCEEDED` `:471`; 413 `CALC_INPUT_TOO_LARGE`/`CALCULATION_DOCUMENT_TOO_LARGE` `:518`; 502; 500 | AJV (тот же `runCalculation`) | **409 не объявлен**, 429 не объявлен |
| 21 | `/api/v1/projects/{id}/calculations` | GET | `requireAuth` | read 120 | 200 | 400 `:573`; 404 `:579` | нет | **400 не объявлен** |
| 22 | `/api/v1/projects/{projectId}/calculations/{calcId}` | GET | `requireAuth` | read 120 | 200 | 400 `:621`; **404 `PROJECT_NOT_FOUND` `:627`**; 404 `CALCULATION_NOT_FOUND` `:633` | нет | объявлен только `CALCULATION_NOT_FOUND` |
| 23 | `/api/v1/projects/{id}/pdf` | GET | `requireAuth` | read 120 | 200 `application/pdf` `:696-700` | 400 `PDF_REPORT_REQUIRED` `:674`; 404 `:668`; 503 `PDF_QUEUE_TIMEOUT`/`PDF_BROWSER_MISSING`; 400 `PDF_SNAPSHOT_REQUIRED`/`PDF_COMMERCIAL_REQUIRED` (из `buildEstimatePdfHtml.js:239,247`) | query `includeTechnical` | объявлен `PDF_COMMERCIAL_REQUIRED` — достижим только косвенно через рендер |
| 24 | `/api/v1/projects/{id}/share` | POST | `requireAuth` | write 60 | 200 `:812` | 400 `:722,:743`; 404 `:728,:748,:792`; 400 `SHARE_REPORT_REQUIRED` `:756`; 400 `SHARE_COMMERCIAL_REQUIRED` (`buildShareSnapshot.js:52`); 500 `INTERNAL_ERROR` `:799-803` | `calculationId` — ручная `:733-745` | 429 не объявлен |
| 25 | `/api/v1/projects/{id}/share` | DELETE | `requireAuth` | write 60 | 200 `:866` | 400 `:840`; 404 `:846` | нет | 400 не объявлен |
| 26 | `/api/v1/public/shares/{shareToken}` | GET | **публичный** `publicSharesRoutes.js:61` | public share 120 | 200 | 404 `SHARE_NOT_FOUND` `:69,:83`; 429; 503 | нет | ок |
| 27 | `/api/v1/public/shares/{shareToken}/pdf` | GET | **публичный** `:112` | public share 120 | 200 PDF | 404 `:120,:134`; 400 `PDF_COMMERCIAL_REQUIRED` `:139`; 429; 503 | нет | ок |
| 28 | `/api/v1/me` | GET | `optionalAuth` `meRoutes.js:22` | — | 200 (реальный или dev-профиль `:32-37`) | 401 `PROJECTS_AUTH_REQUIRED` `:40`; 403 `INVALID_USER_ROLE`/`INVALID_SUBSCRIPTION_TIER` | нет | ок |
| 29 | `/api/v1/admin/feedback` | GET | `requireAuth`+`requireRole('admin')` `adminRoutes.js:57` | — | 200 `:116` | 400 `VALIDATION_ERROR` `:69`; 401; 403 `ADMIN_REQUIRED`; 503 | query `parseAdminFeedbackListQuery` `:67` | ок |
| 30 | `/api/v1/admin/feedback/stream` | GET | то же | — | 200 SSE `:133-141` | 401/403/503 | нет | ок |
| 31 | `/api/v1/admin/feedback/{id}` | PATCH | то же | — | 200 `:213` | 400 `:179,:185`; 404 `FEEDBACK_NOT_FOUND` `:191,:203` | `parseAdminFeedbackPatchBody` `:183` | ок |
| 32 | `/api/v1/admin/users/{id}` | PATCH | то же `adminRoutes.js:65` | — | 200 `:97` | 400 `:69`; 404 `USER_NOT_FOUND` `:85`; 403 `INVALID_USER_ROLE` | `validateAdminUserPatchBody` `:73` | ок |
| — | любой другой путь | ANY | — | — | — | 404 `NOT_FOUND` `routes.js:213-219` | — | **не объявлен** |

Legacy-rewrite: `routes.js:176-182` переписывает `/api/projects*` → `/api/v1/projects*` до монтирования
роутера проектов. В OpenAPI отсутствует; поверхность полностью дублирует #14–25.

---

## 2. Расхождения OpenAPI ↔ реализация

| # | Расхождение | Якорь кода | Якорь OpenAPI | Оценка |
|---|-------------|-----------|---------------|--------|
| R3-D1 | `projects/import` — admin-only в коде, в контракте описано «ownerId — текущий JWT-пользователь», ответа 403 нет | `projectsRoutes.js:247` | `openapi.yaml:586-638` | **P1** — интегратор строит на ложном контракте |
| R3-D2 | `POST /api/v1/calc` имеет rate limit, но 429 не объявлен | `routes.js:196`, `rateLimiters.js:70-74` | `openapi.yaml:421-479` | P1 |
| R3-D3 | 429 не объявлен ни для одного пути `/api/v1/projects*` (6 путей под лимитерами) | `projectsRoutes.js:135,210,244,276,331,387,435,568,612,654,714,832` | `openapi.yaml:506-978` | P1 |
| R3-D4 | 409 `PROJECT_QUOTA_EXCEEDED` не объявлен для `POST /projects` | `projectAccess.js:193-204` | `openapi.yaml:548-585` | P1 |
| R3-D5 | 409 `CALCULATION_QUOTA_EXCEEDED` не объявлен для `POST /projects/{id}/calc` | `projectAccess.js:210-221` | `openapi.yaml:778-819` | P1 |
| R3-D6 | `GET /projects/{id}`, `/calculations`, `DELETE /share` — 400 на невалидный ObjectId не объявлен | `projectsRoutes.js:281,573,840` | `openapi.yaml:653-671,837-856,959-978` | P2 |
| R3-D7 | `GET /projects/{projectId}/calculations/{calcId}` может вернуть 404 `PROJECT_NOT_FOUND`, в контракте только `CALCULATION_NOT_FOUND` | `projectsRoutes.js:627` | `openapi.yaml:1089-1094` | P2 |
| R3-D8 | 401/403 auth-ответы объявлены только у `/projects` (list/create), но не у `{id}`-путей, хотя `requireAuth` общий | `projectsRoutes.js:128` | `openapi.yaml:639-978` | P2 |
| R3-D9 | `BAD_JSON` (400) и `PAYLOAD_TOO_LARGE` (413, `limit: '1mb'`) — глобальные, не объявлены нигде | `index.js:121,194-203` | — | P2 |
| R3-D10 | catch-all 404 `NOT_FOUND` не объявлен и кода нет в `ERROR_CODES` | `routes.js:213-219`, `errorCodes.js:6-15` | — | P2 |
| R3-D11 | `/health`, `/catalog`, `/presets/*` объявляют `400 Client error` — недостижимо | `routes.js:33,82,111,119,127,137` | `openapi.yaml:26,90,116,137,209,227` | P2 (шум в контракте) |
| R3-D12 | `GET /`, `GET /api`, `GET /api/health` и rewrite `/api/projects/*` реализованы, но не описаны | `routes.js:34,44,67,176-182` | — | P2 |
| R3-D13 | `CalcInput.yaml:137-140`: «`radiatorConnection` … Если не задано — нормализуется в side». Нормализация есть, но только когда объект `heatingSystem` присутствует; при полном отсутствии `heatingSystem` — не применяется | `heatingThermalRegimes.js:46,85` | `components/schemas/CalcInput.yaml:134-142` | **P1** — влияет на пул панельных радиаторов |
| R3-D14 | AJV-`default` (`radiatorConnection: side`, `radiatorEmitterPreference: auto`, `pipeSpacingMm: 150`, `furnitureOccupiedAreaM2: 0`, `ufhTerminalControl: collector`, `radiatorWiringSystemType: auto`, `underfloorDistributionPreset: auto`) **не применяются AJV** — в опциях нет `useDefaults` | `validate.js:77-81` | `CalcInput.yaml:137,146`; `RoomUnderfloorHeating.yaml:19,26,33`; `HydraulicsSurveyInput.yaml:23` | **P1** — контракт обещает дефолты, которых AJV не даёт |
| R3-D15 | `HEATING_SYSTEM_INVALID` («returnC ≥ supplyC») объявлен в OpenAPI и `docs/calc-input-validation.md`, но проверка стоит **после** перезаписи supply/return пресетом — практически недостижима | проверка `validate.js:337-347` vs перезапись `heatingThermalRegimes.js:74-75` (вызов `validate.js:306`) | `openapi.yaml:450` | **P1** — мёртвая валидация, документируется как рабочая |
| R3-D16 | `/projects/{id}/pdf`: объявлен `PDF_COMMERCIAL_REQUIRED`; в роуте выбрасывается только `PDF_REPORT_REQUIRED` | `projectsRoutes.js:674`; `buildEstimatePdfHtml.js:247` | `openapi.yaml:883-888` | P2 |
| R3-D17 | PDF-эндпоинты при ошибке отдают `application/json` ErrorEnvelope, хотя `200` описан как `application/pdf`; клиенту нужен разбор по Content-Type | `projectsRoutes.js:701`, `publicSharesRoutes.js:162` | `openapi.yaml:876-903` | P2 |
| R3-D18 | `503` для admin-путей объявлен как «MongoDB unavailable», но при `PROJECTS_AUTH_ENABLED=false` реальный ответ — **403** для всех | `requireRole.js:21-28` | `openapi.yaml:1179-1191` | **P0 для тестируемости** |

---

## 3. Матрица авторизации

Роли: **аноним** (без `Authorization`), **user-own** (владелец), **user-other** (чужой ресурс),
**admin** (`role=admin`, назначается по `PLATFORM_ADMIN_EMAILS` / `users.role`).
Матрица — для режима `PROJECTS_AUTH_ENABLED=true` (или `NODE_ENV=production`),
т.е. `isProjectsAuthRequired() === true` (`projectsAuthConfig.js:23-32`).

| Эндпоинт | аноним | user-own | user-other | admin | Якорь правила |
|----------|--------|----------|-----------|-------|---------------|
| `POST /api/v1/calc` | **200** | 200 | 200 | 200 | нет guard, `routes.js:196` |
| `GET /api/v1/catalog`, `/presets/*` | **200** | 200 | 200 | 200 | `routes.js:82,111,119,127,137,152` |
| `POST /api/v1/feedback` | **201** | 201 | 201 | 201 | `optionalAuth`, `feedbackRoutes.js:28`; `optionalAuth.js:23-26` пропускает без токена |
| `GET /api/v1/me` | **401** `PROJECTS_AUTH_REQUIRED` | 200 | n/a | 200 | `meRoutes.js:32-40` |
| `GET /api/v1/projects` | **401** | 200 (свои) | 200 (чужих не видит — фильтр по `ownerId`) | 200 (все) | `requireAuth` `projectsRoutes.js:128`; фильтр `projectAccess.js:78-81` |
| `GET /api/v1/projects?ownerId=…` | 401 | **403** `ADMIN_REQUIRED` | 403 | 200 | `projectAccess.js:55-69` → `projectsRoutes.js:137-141` |
| `POST /api/v1/projects` | 401 | 201 | n/a | 201 | `projectsRoutes.js:210` |
| `POST /api/v1/projects/import` | 401 | **403** `ADMIN_REQUIRED` | 403 | 201 | `requireRole('admin')` `projectsRoutes.js:247`; `requireRole.js:36-43` |
| `GET /api/v1/projects/{id}` | 401 | 200 | **404 `PROJECT_NOT_FOUND`** (не 403) | 200 + audit | `buildAccessibleProjectByIdFilter` `projectAccess.js:123-128` → `findAccessibleProjectLean:162-170` → `projectsRoutes.js:287` |
| `PUT /api/v1/projects/{id}` | 401 | 200 | **404** | 200 + audit | `projectsRoutes.js:340-344,352-361`; audit `:363` |
| `DELETE /api/v1/projects/{id}` | 401 | 200 | **404** | 200 + audit | `projectsRoutes.js:396-409`; audit `:411` |
| `POST /api/v1/projects/{id}/calc` | 401 | 200 | **404** | 200 + audit | `findAccessibleProjectDoc` `projectAccess.js:178-186` → `projectsRoutes.js:456`; audit `:524` |
| `GET /api/v1/projects/{id}/calculations` | 401 | 200 | **404** | 200 | `projectsRoutes.js:577-581` |
| `GET /api/v1/projects/{p}/calculations/{c}` | 401 | 200 | **404 `PROJECT_NOT_FOUND`** | 200 | `projectsRoutes.js:625-629`; сам расчёт дополнительно привязан к `projectId` `:631` |
| `GET /api/v1/projects/{id}/pdf` | 401 | 200 | **404** | 200 | `projectsRoutes.js:666-670` |
| `POST /api/v1/projects/{id}/share` | 401 | 200 | **404** | 200 + audit | `projectsRoutes.js:726-730`; audit `:777` |
| `DELETE /api/v1/projects/{id}/share` | 401 | 200 | **404** | 200 + audit | `projectsRoutes.js:844-848`; audit `:851` |
| `GET /api/v1/public/shares/{token}` | **200** (по знанию токена) | 200 | 200 | 200 | `publicSharesRoutes.js:61-103` — guard'ов нет |
| `GET /api/v1/public/shares/{token}/pdf` | **200** | 200 | 200 | 200 | `publicSharesRoutes.js:112-166` |
| `GET/PATCH /api/v1/admin/**` | 401 | **403 `ADMIN_REQUIRED`** | 403 | 200 | `adminRoutes.js:57` → `requireRole.js:30-43` |
| `POST /api/v1/system/invalidate-reference-cache` | 403 без `X-System-Token` | 403 | 403 | 403 (роль не учитывается) | `systemRoutes.js:37-43` — **JWT игнорируется, только shared secret** |

### 3.1 IDOR-правило: подтверждено

Утверждение брифинга («чужой `projectId` для `role=user` → `404 PROJECT_NOT_FOUND`, не 403») —
**верно**. Механизм: доступ реализован не проверкой после чтения, а **сужением Mongo-фильтра**:

- `buildAccessibleProjectByIdFilter(projectId, ownerId, req)` → `{ _id, ownerId }` для не-admin
  (`projectAccess.js:123-128`);
- запрос не находит документ → роут отвечает 404 `PROJECT_NOT_FOUND`
  (`projectsRoutes.js:287,342,398,456,579,627,668,728,846`).

Мутации дополнительно защищены **вторым** применением того же фильтра в
`findOneAndUpdate` / `findOneAndDelete` (`projectsRoutes.js:353,403,780,854`), т.е. TOCTOU-окно
между «прочитали» и «изменили» закрыто — это редкое и правильное решение, стоит зафиксировать
регрессионным тестом.

Тонкость для тестов: при **выключенной** auth `buildProjectOwnerFilter` расширяет фильтр до
`$or: [{ownerId}, {ownerId: {$exists:false}}, {ownerId: null}]` (`projectAccess.js:33-47`), т.е.
dev-владелец видит и «бесхозные» проекты. В проде эта ветка не активируется
(`isProjectsAuthRequired()` `projectsAuthConfig.js:23-32`).

### 3.2 Admin bypass: где и как логируется

- Определение админа: `isProjectsAdminRequest(req)` → `canAccessAdmin(req.user)` → `hasRole(user,'admin')`
  (`projectAccess.js:25-27`, `authorizationPolicy.js:76-87`).
- Bypass в фильтре по id: `{ _id: projectId }` без `ownerId` (`projectAccess.js:124-126`).
- Bypass в списке: пустой фильтр `{}` + опциональные `ownerId`/`ownerEmail`
  (`projectAccess.js:78-114`).
- Аудит cross-owner: `logAdminCrossOwnerProjectAccess` пишет
  `logger.info('projects.admin.cross_owner', …, { action, projectId, projectOwnerId, adminUserId })`
  (`projectAccess.js:137-154`). Вызовы: `read` — `projectAccess.js:167,183` (внутри
  `findAccessibleProject*`), `mutate` — `projectsRoutes.js:363,411,524,777,851`.
- Аудит листинга: `logger.info('projects.admin.list', …)` при `total > 0` (`projectsRoutes.js:190-197`).
- **Дыры аудита:** лог `cross_owner` подавляется, если у проекта нет `ownerId`
  (`projectAccess.js:145` — `if (!projectOwnerId …) return`), т.е. доступ админа к «бесхозным»
  проектам не аудируется. И для `GET /projects/{id}/pdf` (`projectsRoutes.js:666`) пишется только
  `read`-запись из `findAccessibleProjectLean`, а факт скачивания чужого PDF отдельной
  записи cross-owner не получает.

### 3.3 Где заявленное расходится с фактическим

1. **`requireRole` при выключенной auth даёт 403 всем** (`requireRole.js:21-28`). Ни один
   пользователь не может быть админом в dev. `buildDevMeUser()` жёстко `role: 'user'`
   (`serializeMeUser.js:32-40`). Следствие: `POST /api/v1/projects/import` — рекомендованный
   брифингом загрузчик фикстур — в dev-режиме недоступен. **P0 для плана E2E.**
2. **`requireAuth` при выключенной auth пропускает всех без токена** (`requireAuth.js:19-22`),
   и `ownerIdFromRequest` подставляет `PROJECTS_DEV_OWNER_ID` (`projectsRoutes.js:81-87`,
   `projectsAuthConfig.js:177-183`). То есть в dev вся матрица «аноним/user-own/user-other»
   схлопывается в одного владельца — **проверять IDOR в dev-режиме невозможно**, нужен
   `PROJECTS_AUTH_ENABLED=true` + HS256-токены.
3. **`optionalAuth` глотает невалидный токен** и продолжает как гость (`optionalAuth.js:33-44`).
   Для `/api/v1/me` это значит: протухший JWT при выключенной auth → 200 с dev-профилем, при
   включённой → 401. Двусмысленность для клиента.
4. **`/system/invalidate-reference-cache` не связан с JWT вообще** — админ без
   `SYSTEM_INTERNAL_TOKEN` получит 403 (`systemRoutes.js:41`). Роль там не проверяется.
5. `mapAuthErrorToResponse` схлопывает всё неизвестное в **403**, даже если ошибка по смыслу 500:
   `statusCode = known?.statusCode === 503 ? 503 : known?.statusCode === 401 ? 401 : 403`
   (`authErrors.js:14-15`). Внутренний сбой в auth-пайплайне маскируется под «доступ запрещён».

**НЕ ПРОВЕРЕНО:** фактическое присвоение `role=admin` из `PLATFORM_ADMIN_EMAILS` (модуль
`resolveUser.js` прочитан только в части `MONGODB_UNAVAILABLE`, `resolveUser.js:43`);
поведение при `users.role` с мусорным значением (`normalizeUserRole` бросает 403
`INVALID_USER_ROLE`, `authorizationPolicy.js:44-49` — но точка вызова на пути запроса не прослежена).

---

## 4. Таксономия ошибок

### 4.1 Объявленные в `errorCodes.js` (SSOT — 6 кодов)

| Код | HTTP | Когда | В OpenAPI | Понятный текст пользователю |
|-----|------|-------|-----------|------------------------------|
| `VALIDATION_ERROR` | 400 | AJV, тело, query, ObjectId | да (много мест) | «Некоректні вхідні дані» / контекстные укр. сообщения — **без указания поля** |
| `INTERNAL_ERROR` | 500 | prod-маскировка любой 500; явно `projectsRoutes.js:802` | да (`openapi.yaml:472-479`) | «Внутрішня помилка сервера» `index.js:231` |
| `PROJECT_NOT_FOUND` | 404 | не найден или чужой (IDOR) | да | «Проєкт не знайдено» |
| `CALCULATION_NOT_FOUND` | 404 | `projectsRoutes.js:633,748` | да | «Розрахунок не знайдено» |
| `USER_NOT_FOUND` | 404 | `adminRoutes.js:85` | да | «Користувача не знайдено» |
| `FEEDBACK_NOT_FOUND` | 404 | `adminFeedbackRoutes.js:191,203` | да | «Feedback не найден» — **русский текст в укр. UI**, нарушение `docs/language-policy.md` |

### 4.2 Фактически выбрасываемые вне `errorCodes.js`

Auth / authorization:

| Код | HTTP | Источник | В OpenAPI |
|-----|------|----------|-----------|
| `PROJECTS_AUTH_REQUIRED` | 401 | `requireAuth.js:26`, `requireRole.js:31`, `meRoutes.js:40` | да |
| `PROJECTS_AUTH_FORBIDDEN` | 403 | `mapJwtPayload.js:37,52,103`, `verifyAccessToken.js:94` | да |
| `PROJECTS_AUTH_NOT_CONFIGURED` | 503 | `verifyAccessToken.js:47,66,76` | да |
| `ADMIN_REQUIRED` | 403 | `requireRole.js:24,39`, `projectsRoutes.js:139` | да (кроме `import`) |
| `AUTHORIZATION_FORBIDDEN` | 403 | `authErrors.js:55` (fallback) | да (`AuthorizationErrorCode.yaml`) |
| `INVALID_USER_ROLE` | 403 | `authorizationPolicy.js:47` | да |
| `INVALID_SUBSCRIPTION_TIER` | 403 | `authorizationPolicy.js:66` | да |

Инфраструктура / транспорт:

| Код | HTTP | Источник | В OpenAPI |
|-----|------|----------|-----------|
| `MONGODB_UNAVAILABLE` | 503 | `requireMongo.js:24,34,37`, `resolveUser.js:43` | описан текстом, кода нет в enum |
| `BAD_JSON` | 400 | `index.js:199-203` | **нет** |
| `PAYLOAD_TOO_LARGE` | 413 | `index.js:194-198`, `validateProjectSurveyShape.js:20` | частично |
| `CALC_INPUT_TOO_LARGE` | 413 | `documentSizeLimits.js:41,44` | да (import, project calc) |
| `CALCULATION_DOCUMENT_TOO_LARGE` | 413 | `documentSizeLimits.js:69`, `index.js:204-209` | да |
| `NOT_FOUND` | 404 | `routes.js:217` | **нет** |
| `ERR` | 500 | `index.js:180` дефолт; в prod заменяется | **нет** |

Rate limit (все 429, `middleware/rateLimiters.js`):
`CALC_RATE_LIMIT_EXCEEDED` `:73`, `PROJECT_CALC_RATE_LIMIT_EXCEEDED` `:80`,
`PUBLIC_SHARE_RATE_LIMIT_EXCEEDED` `:102`, `FEEDBACK_RATE_LIMIT_EXCEEDED` `:109`,
и **`RATE_LIMIT_EXCEEDED`** (дефолт `:36`) для projects read/write — этот последний
**нигде не задокументирован** (`openapi.yaml` его не содержит).

Домен / бизнес:

| Код | HTTP | Источник | В OpenAPI |
|-----|------|----------|-----------|
| `PROJECT_QUOTA_EXCEEDED` | 409 | `projectAccess.js:200` | только у `import` |
| `CALCULATION_QUOTA_EXCEEDED` | 409 | `projectAccess.js:217` | только у `import` |
| `CALC_INPUT_REQUIRED` | 400 | `resolveProjectCalcInput.js:17,23,81` | да |
| `PDF_REPORT_REQUIRED` | 400 | `projectsRoutes.js:674` | да |
| `PDF_COMMERCIAL_REQUIRED` | 400 | `publicSharesRoutes.js:139`, `buildEstimatePdfHtml.js:247` | да |
| `PDF_SNAPSHOT_REQUIRED` | 400 | `buildEstimatePdfHtml.js:239` | **нет** |
| `PDF_BROWSER_MISSING` | 503 | `renderPdfFromHtml.js:28,60` | описан текстом |
| `PDF_QUEUE_TIMEOUT` | 503 | `pdfRenderSemaphore.js:73-77` | **нет** |
| `SHARE_REPORT_REQUIRED` | 400 | `projectsRoutes.js:756`, `buildShareSnapshot.js:43` | да |
| `SHARE_COMMERCIAL_REQUIRED` | 400 | `buildShareSnapshot.js:52` | да |
| `SHARE_NOT_FOUND` | 404 | `publicSharesRoutes.js:69,83,120,134` | да |
| `SYSTEM_TOKEN_NOT_CONFIGURED` | 503 | `systemRoutes.js:33` | да |
| `SYSTEM_TOKEN_FORBIDDEN` | 403 | `systemRoutes.js:41` | да |
| `FEEDBACK_INVALID_BODY` / `_INVALID_TYPE` / `_MESSAGE_REQUIRED` / `_EMAIL_REQUIRED` / `_EMAIL_INVALID` | 400 | `validateFeedbackBody.js:28,34,39,44,47` | описаны обобщённо |

Расчётные (все 400, доходят до `POST /api/v1/calc` и `POST /projects/{id}/calc`):

`ROOM_TYPE_INVALID` `validate.js:201`; `HOT_WATER_LEGACY_FIELD` `validate.js:228,236`;
`HEATING_SYSTEM_INVALID` `validate.js:342`; `HOT_WATER_TEMPS_INVALID` `validate.js:354`;
`UNDERFLOOR_HEATING_BASE_INVALID` `:416`; `UNDERFLOOR_HEATING_FINISH_INVALID` `:421`;
`UNDERFLOOR_HEATING_PIPE_SPACING_INVALID` `:434,:440`;
`UNDERFLOOR_HEATING_FURNITURE_AREA_INVALID` `:455,:468`;
`UNDERFLOOR_HEATING_TERMINAL_INVALID` `:480`; `ENVELOPE_FLOOR_PRESET_MIXED_WITH_UFH` `:516`;
`VENTILATION_LEGACY_FIELD` `:639`; `BOILER_PLACEMENT_REQUIRED` `:690`;
`BOILER_ROOM_METRICS_INCOMPLETE` `:703`; `BOILER_ROOM_VOLUME_INVALID` `:720`;
`UFH_PRESET_INVALID` `normalizeHeatingUfhPreset.js:29`, `warmFloorCalc.js:72`;
`EXTERNAL_WALLS_PRESET_REQUIRED` / `_INVALID_PRESET` / `_FACADE_SYSTEM` / `_INSULATION_REQUIRED` /
`_INSULATION_THICKNESS` / `_INSULATION_PRESET` / `_SFTK_INSULATION` / `_VENTILATED_INSULATION` /
`_WALL_THICKNESS` — `externalWallsValidate.js:29,35,48,64,71,79,88,96,105,113`;
`ENVELOPE_WALL_INSULATION_PRESET` `:123`; `ENVELOPE_UVALUE_MISSING` `heatlossByRooms.js:144`;
`UNKNOWN_ROOM` `heatlossByRooms.js:110`; `ROOM_EXTERIOR_LAYOUT_WALLS` `roomExteriorLayoutHeatLoss.js:202`;
`HYDRAULICS_PIPELINE_INPUT_INVALID` `validatePipelineInput.js:39`, `crossValidatePipelineInput.js:108`;
`INSIDE_TEMP_REQUIRED` / `OUTSIDE_TEMP_REQUIRED` `buildReport.js:248,255`;
`MANIFOLD_INTERNAL` `buildReport.js:535`.

`openapi.yaml:444-458` перечисляет из них только 5 кодов явно + шаблон `EXTERNAL_WALLS_*`.
**Более 20 доменных кодов 400 не задокументированы.**

### 4.3 Мёртвые и полумёртвые коды

| Код | Статус | Обоснование |
|-----|--------|-------------|
| `HEATING_SYSTEM_INVALID` | **практически мёртвый** | Проверка `validate.js:337-347` идёт после безусловной перезаписи `supplyC`/`returnC` из пресета (`heatingThermalRegimes.js:70-79`, вызов `validate.js:306`). Достижим лишь в узкой ветке `heatingEmittersMode='ufh_only'` без `ufhPresetId='ufh_only'` |
| `UFH_MODE_FINISH_MISMATCH` | **мёртвый** | Заявлен в `docs/calc-input-validation.md:19` (фаза 6b, `assertUfhModeFinishCompatibility`); в `backend/src` такой функции/кода нет |
| `VALIDATION_FAILED` | legacy-алиас | `index.js:182-184` переводит в `VALIDATION_ERROR`; в текущем коде источников нет |
| `ERR` | недостижим для клиента | `index.js:180` → всегда заменяется на `INTERNAL_ERROR` в ветке 500 (`:230-237`) |
| `RATE_LIMIT_EXCEEDED` | живой, но не документирован | `rateLimiters.js:36`, применяется к projects read/write |
| `AUTHORIZATION_FORBIDDEN` | почти мёртвый | `authErrors.js:53-55` — fallback, а оба вызова `respondAuthorizationError` уже передают `code: 'ADMIN_REQUIRED'` (`requireRole.js:24,39`) |
| `INSIDE_TEMP_REQUIRED` | достижим только при отсутствии AJV-required | `CalcInput.yaml` не делает `building.temps` обязательным (`:33` required = `[rooms, envelopeElements]`), поэтому это «второй эшелон» — но сообщение уже в `buildReport`, а не в `validate` |

### 4.4 Ошибки мимо конверта

| Место | Что происходит | Оценка |
|-------|----------------|--------|
| `adminFeedbackRoutes.js:133-168` (SSE) | Заголовки отправлены (`res.flushHeaders() :141`); любая последующая ошибка в `res.write` из подписки (`:145`) или в heartbeat (`:148`) не проходит через `handleApiError` — а если пройдёт, `res.status().json()` (`index.js:249`) даст `ERR_HTTP_HEADERS_SENT` | P2 |
| `projectsRoutes.js:696-700`, `publicSharesRoutes.js:157-161` | После `res.status(200)` и `setHeader` ошибка в `res.send(pdf.buffer)` уже не конвертируема | P2 |
| `projectsRoutes.js:696` | `res.status(200)` выставляется **до** `res.send`; при исключении между ними ответ уходит с 200 и пустым телом | P2 |
| `index.js:238-241` | Для `statusCode > 500` (502/503) `err.message` уходит клиенту дословно — включая тексты внешних сервисов (Nominatim/Meteostat/Mongo). Потенциальная утечка внутренних деталей | **P1 (безопасность)** |
| `authErrors.js:33-35` | При 401/403 клиенту отдаётся `err.message` как есть — тексты из `jose`/JWKS на английском | P2 |

---

## 5. Валидация CalcInput

Пайплайн: `runCalculation.js:16-22` → `validateAndNormalizeInput(rawBody, ctx)` `validate.js:260-379`.
Схема: `components/schemas/CalcInput.yaml`, собирается `$RefParser.bundle`
(`calcInputSchemaLoader.js:54-65`), затем **патчится в рантайме** (`:26-47`): enum `room.type`
заменяется на `CANONICAL_ROOM_TYPES`, enum'ы `hotWaterBoilerPowerMatchingScheme`,
`thermalRegimePreset`, `ufhPresetId` — на значения из `shared/*`. Схема кэшируется на процесс (`:19,55`).

AJV-опции — **`{ allErrors: true, coerceTypes: false, removeAdditional: true }`**
(`validate.js:77-81`). `useDefaults` **не задан**. `strict` не задан (AJV 8 по умолчанию
`strict: true` в логах — НЕ ПРОВЕРЕНО, сборка не запускалась).

### 5.1 Обязательные поля

| Уровень | `required` | Якорь |
|---------|-----------|-------|
| корень `CalcInput` | `building` | `CalcInput.yaml:3` |
| `building` | `rooms`, `envelopeElements` | `CalcInput.yaml:33` |
| `building.rooms` | массив, `minItems: 1` | `CalcInput.yaml:51` |
| `building.rooms[]` | `id`, `name`, `type`, `floor`, `topBoundary`, `bottomBoundary`, `areaM2`, `heightM` | `CalcInput.yaml:55` |
| `building.envelopeElements` | массив, `minItems: 1` | `CalcInput.yaml:112-113` |
| `building.envelopeElements[]` | `roomId`, `construction`, `areaM2` | `EnvelopeElementInput.yaml:3` |
| `building.objectMeta` (если передан) | `objectType`, `floors`, `roomsCount`, `externalWalls` | `BuildingObjectMeta.yaml:3` |
| `building.objectMeta.externalWalls` | `presetId` | `BuildingObjectMeta.yaml:64` |
| `building.temps` (если передан) | `insideC` | `CalcInput.yaml:38` |
| `temps` (legacy, если передан) | `insideC` | `CalcInput.yaml:19` |
| `building.rooms[].underfloorHeating` (если передан) | `enabled`, `basePresetId`, `finishMaterialId` | `RoomUnderfloorHeating.yaml:3` |

Ключевая ловушка для проходимости анкеты: **`building.objectMeta` формально необязателен**
(`CalcInput.yaml:33`), но без него не будет `externalWalls`, и расчёт свалится позже —
`ENVELOPE_UVALUE_MISSING` (`heatlossByRooms.js:144`) или `EXTERNAL_WALLS_PRESET_REQUIRED`
(`externalWallsValidate.js:29`). Аналогично **`building.temps` необязателен**, а `buildReport.js:247-259`
требует `insideC`/`outsideC` (последний может прийти из климата). То есть **обязательность
разнесена между схемой и рантаймом** — ошибка приходит на другом этапе и с другим кодом,
чем ожидает клиент.

`heatingSystem`, `hotWater`, `hydraulics`, `location` — целиком необязательны
(`CalcInput.yaml:122,205,239,5`).

### 5.2 Дефолты

**AJV `default` не работает** — в опциях нет `useDefaults` (`validate.js:77-81`). Все объявленные
в схеме `default` — декоративны:

| Поле | `default` в схеме | Применяется реально? | Чем |
|------|-------------------|----------------------|-----|
| `heatingSystem.radiatorConnection` | `side` (`CalcInput.yaml:137`) | да, **но только если объект `heatingSystem` присутствует** | `heatingThermalRegimes.js:85` (ранний `return` на `:46`) |
| `heatingSystem.radiatorEmitterPreference` | `auto` (`CalcInput.yaml:146`) | так же | `heatingThermalRegimes.js:86-88` |
| `rooms[].underfloorHeating.pipeSpacingMm` | `150` (`RoomUnderfloorHeating.yaml:26`) | да, кодом | `validate.js:430` |
| `rooms[].underfloorHeating.furnitureOccupiedAreaM2` | `0` (`:19`) | да, кодом | `validate.js:448` |
| `rooms[].underfloorHeating.ufhTerminalControl` | `collector` (`:33`) | да, кодом (+ форс `collector` при площади > 20 м²) | `validate.js:485-488`, `shared/ufhTerminalControl.js:24-30` |
| `hydraulics.radiatorWiringSystemType` | `auto` (`HydraulicsSurveyInput.yaml:23`) | **НЕ ПРОВЕРЕНО** — точка применения в `hydraulics/*` не прослежена | — |
| `heatingSystem.underfloorDistributionPreset` | `auto` (описание `CalcInput.yaml:192`) | да, кодом | `normalizeUnderfloorDistribution.js:24` |

Дефолты, задаваемые только кодом (в схеме не объявлены):

| Поле | Дефолт | Якорь |
|------|--------|-------|
| `hotWater.coldWaterDesignSeason` | `winter` | `validate.js:294-296` |
| `heatingSystem.thermalRegimePreset` | по схеме/типу объекта (квартира 55/45, дом 75/65) | `heatingThermalRegimes.js:57-67` |
| `heatingSystem.supplyC` / `returnC` | из пресета, иначе 75/65 | `heatingThermalRegimes.js:70-83` |
| `heatingSystem.insideC` | из `building.temps.insideC` | `heatingThermalRegimes.js:48-55` |
| `heatingSystem.radiatorReferenceDeltaT` | `p.defaultRadiatorReferenceDeltaT` | `heatingThermalRegimes.js:76-78` |
| `heatingSystem.hotWaterBoilerPowerMatchingScheme` | `HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[0]` при отсутствии | `validate.js:742-746` |
| `objectMeta.ventilationReserveMode` | `natural` (любое не-`recuperation` → `natural`) | `ventilationReserve.js:18-21` через `validate.js:615-617` |
| `objectMeta.apartmentStackPosition` | `middle_floor` | `apartmentStackBoundaries.js:27-33` через `validate.js:541` |
| `objectMeta.boilerPlacementZone` (дом) | `kitchen` | `validate.js:681-683` |
| `rooms[].bottomBoundary` (дом) | по этажу | `validate.js:562-564` |

**Что произойдёт, если поле не прислать:** для полей из таблицы выше — тихая подстановка
(см. 5.3). Для `required` — 400 `VALIDATION_ERROR` с AJV-сообщением
`must have required property '<name>'` (английским) и `instancePath` родительского узла.

### 5.3 Молчаливая нормализация (реестр)

**Критично.** Ни одно из этих изменений не отражается в HTTP-ответе как «мы поменяли ваш ввод»,
кроме частично попадающих в `heatingSystem._normalizationWarnings` → `report.warnings`
(и то — с потерями, см. N-17).

| # | Что подменяется | Механика | Якорь | Уведомление |
|---|-----------------|----------|-------|-------------|
| N-1 | **Любое поле, не описанное в схеме** | `removeAdditional: true` + `additionalProperties: false` на всех уровнях → поле **удаляется молча**, ошибки нет | `validate.js:80`; `CalcInput.yaml:2,7,18,32,37,54,118,124,207,228`; `BuildingObjectMeta.yaml:2,63`; `EnvelopeElementInput.yaml:2`; `RoomUnderfloorHeating.yaml:2`; `HydraulicsSurveyInput.yaml:5` | **нет** |
| N-2 | `supplyC` / `returnC` пользователя | Безусловно перезаписываются значениями пресета `thermalRegimePreset` | `heatingThermalRegimes.js:74-75` | **нет** |
| N-3 | `thermalRegimePreset` | Если не валиден и не «только ТП» — подставляется дефолт по схеме/типу объекта | `heatingThermalRegimes.js:57-67` | **нет** |
| N-4 | `radiatorReferenceDeltaT` | Подставляется из пресета, если `null` | `heatingThermalRegimes.js:76-78` | **нет** |
| N-5 | `radiatorConnection` | Любое неизвестное значение → `side` (не 400!) | `radiatorConnection.js:33-35` ← `heatingThermalRegimes.js:85` | **нет** |
| N-6 | `radiatorEmitterPreference` | Любое неизвестное → `auto` | `radiatorEmitterPreference.js:57-61` ← `heatingThermalRegimes.js:86-88` | **нет** |
| N-7 | `ufhPresetId='ufh_only'` | Форсирует `waterUnderfloorHeating=true`, `heatingEmittersMode='ufh_only'`, `supplyC`/`returnC` из пресета и `thermalRegimePreset='condensing_dt30_55_45'` | `normalizeHeatingUfhPreset.js:33,44-51` | частично (warnings `:66-70`) |
| N-8 | `underfloorDistributionPreset` | Неизвестное → `auto`; при выключенном ТП — **удаляется** | `normalizeUnderfloorDistribution.js:17-25` | **нет** |
| N-9 | `objectMeta.ventilationReserveMode` | Всё, кроме `recuperation`, → `natural` (включая опечатки) | `ventilationReserve.js:18-21` | **нет** |
| N-10 | `objectMeta.apartmentStackPosition` | Невалидное → `middle_floor` | `apartmentStackBoundaries.js:27-33` | **нет** |
| N-11 | `rooms[].bottomBoundary` / `topBoundary` (квартира) | **Полностью перезаписываются** выводом из `apartmentStackPosition` и этажа; `topBoundary='roof'` — единственное исключение | `validate.js:539-557` | **нет** |
| N-12 | `rooms[].bottomBoundary` (дом) | Не `heated`/`unheated` → default по этажу | `validate.js:560-565` | **нет** |
| N-13 | `rooms[].floor` при выводе границ | Клампится `Math.max(1, Math.min(3, trunc(Number(floor) || 1)))` — но только для расчёта границ, само поле не меняется | `validate.js:545-546` | **нет** |
| N-14 | `rooms[].underfloorHeating` | Удаляется целиком, если ТП выключен глобально, `enabled !== true`, или композиция не резолвится | `validate.js:398-412` | **нет** |
| N-15 | `underfloorHeating.ufhTerminalControl` | `unibox` при площади > 20 м² молча → `collector` | `shared/ufhTerminalControl.js:24-30` ← `validate.js:485` | **нет** |
| N-16 | `underfloorHeating` объект | Пересобирается: `furnitureOccupiedAreaM2 === 0` и `ufhTerminalControl === 'collector'` **выбрасываются из объекта** | `validate.js:490-497` | **нет** |
| N-17 | `heatingSystem._normalizationWarnings` | При схеме «1К+БКН» для квартиры массив **перезаписывается**, а не дополняется → предупреждения о нормализации типов комнат и о режиме ТП **теряются** | `validate.js:768,776` (клоббер) против `validate.js:288-290`, `normalizeHeatingUfhPreset.js:72-77` (накопление) | **баг: уведомление теряется** |
| N-18 | `hotWaterBoilerPowerMatchingScheme` | Для квартиры схема `singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw` молча заменяется на max-combi | `validate.js:766-780` | да, warning (но см. N-17) |
| N-19 | `objectMeta` поля | Для квартиры удаляются `boilerPlacementZone`, `boilerRoomAreaM2`, `ceilingHeightM`, `indirectDhwSpaceAvailable=false`; для дома — `apartmentStackPosition`, `indirectDhwSpaceAvailable` | `validate.js:668-679` | **нет** |
| N-20 | `location.address`, `rooms[].id/name/type`, `envelopeElements[].roomId/name/construction/material/presetId` | `trim` + удаление `<`/`>` | `validate.js:314-333`, `sanitizeString.js` | **нет** |
| N-21 | `rooms[].type` | Синонимы (`kitchen`→`кухня` и т.п.), NFKC-нормализация, снятие zero-width, регистронезависимое сопоставление | `validate.js:130-143,169-217` | да, warning `:207-211` (но см. N-17) |
| N-22 | `hotWater.coldWaterDesignSeason` | `null`/отсутствие → `winter` | `validate.js:293-297` | **нет** |
| N-23 | `temps` (legacy корневой) | Копируется в `building.temps`, если того нет | `validate.js:301-303` | **нет** |
| N-24 | `heatingSystem.insideC` | Подставляется из `building.temps.insideC` | `heatingThermalRegimes.js:48-55` | **нет** |
| N-25 | POST `/projects/{id}/calc`, `source='body'` | Из тела вырезаются `survey` и `calcInput`, остальное трактуется как CalcInput | `resolveProjectCalcInput.js:61` | **нет** |

**Вердикт по молчаливой нормализации:** режим строгий по типам (`coerceTypes: false`),
но **радикально нестрогий по значениям** — enum-подобные поля вне схемы (`radiatorConnection`,
`ventilationReserveMode`, `apartmentStackPosition`, `underfloorDistributionPreset`) не отвергаются,
а тихо заменяются дефолтом; поля вне схемы тихо удаляются; `supplyC`/`returnC` пользователя
переопределяются пресетом. Для QA это означает: **«200 OK» не гарантирует, что расчёт сделан
по тем данным, что отправил пользователь.** Любой E2E-тест на числа обязан сверять
`report.meta` / эхо входа, а не только код ответа. Нужен отдельный класс тестов
«вход → нормализованный вход» (снапшот `input` из `runCalculation.js:21`, который на
project-пути сохраняется в `lastCalcInput`, `projectsRoutes.js:525`).

Ещё один эффект N-1 + N-17: нормализованный `input` записывается в `project.lastCalcInput`
(`projectsRoutes.js:525`) вместе с `_normalizationWarnings` и `_apartmentIndirectDhwStorage`
(`validate.js:158,782`) — при следующем расчёте «from lastCalcInput» эти служебные поля
**молча удаляются** `removeAdditional`, т.е. round-trip не идемпотентен по предупреждениям.

### 5.4 Форма ошибки валидации и пригодность для показа у поля

**Что реально уходит на фронт:**

```
HTTP 400
{
  "ok": false,
  "error": {
    "message": "Некоректні вхідні дані",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "details": [ { instancePath, schemaPath, keyword, params, message }, … ]
  }
}
```

Сборка: `throwAppError('Некоректні вхідні дані', VALIDATION_ERROR, details)` `validate.js:282`,
где `details = validateInput.errors ?? []` `validate.js:272` (**весь** массив; усечение до 5
применяется только к логу `validate.js:273-281`); далее `index.js:190` кладёт его в конверт
`index.js:243-247`. Схема ответа: `components/schemas/ErrorEnvelope.yaml` (`details` — `oneOf`
массив/объект, `additionalProperties: true`).

**Достаточно ли информации, чтобы показать ошибку у конкретного поля?**

| Критерий | Ответ | Обоснование |
|----------|-------|-------------|
| Есть ли путь к полю в ответе? | **Да**, `instancePath` — JSON Pointer вида `/building/rooms/0/areaM2` | `allErrors: true` `validate.js:78`; AJV кладёт `instancePath` в каждую ошибку |
| Все ли ошибки, а не первая? | Да (`allErrors: true`) | `validate.js:78` |
| Для `required` указано имя поля? | Да, но в `params.missingProperty`, а `instancePath` указывает на **родителя** (`/building/rooms/0`) | стандарт AJV |
| Язык сообщений | **Английский** — `ajv-i18n`/`ajv-errors` не подключены | `backend/package.json:87-101` — только `ajv` |
| Доходит ли `details` до UI? | **НЕТ** | `frontend/src/services/calc.ts:64-77` берёт только `data.error.message`; `frontend/src/utils/apiError.ts:9-17` — то же для projects-путей; `frontend/src/services/projectsApi.ts:36-38` |
| Доходит ли `error.code`? | **НЕТ** | те же места |
| Есть ли в UI хоть один потребитель `instancePath`? | **НЕТ** | `grep -rn "instancePath" frontend/src` → 0 совпадений |
| Есть ли маппинг `instancePath` → поле анкеты? | **НЕТ** | такого модуля в `frontend/src` не найдено |

**Вывод (P0, прямая связь с главным симптомом).**
Бэкенд отдаёт машиночитаемую, полную и адресную диагностику. Фронтенд её уничтожает на входе:
`postCalc` конструирует `new Error(msg)` из одного лишь `error.message`, где `msg` для AJV-ошибки —
константа «Некоректні вхідні дані». Пользователь (в том числе автор продукта) получает
**одну и ту же безадресную строку на любую из десятков возможных схемных ошибок**, без указания
шага анкеты, комнаты и поля. Это исчерпывающе объясняет «не смог заполнить собственную анкету».

Дополнительные усугубляющие факторы:
1. Доменные 400-коды (`ROOM_TYPE_INVALID`, `BOILER_ROOM_VOLUME_INVALID`, `EXTERNAL_WALLS_*`, …)
   несут **осмысленные украинские тексты** с указанием `roomId` — они дойдут до пользователя,
   потому что там `message` информативен. А самая частая ошибка (AJV) — наоборот, безадресна.
   Асимметрия: чем более «базовая» ошибка, тем меньше информации у пользователя.
2. Ошибки из `buildReport` (`INSIDE_TEMP_REQUIRED`, `ENVELOPE_UVALUE_MISSING`, `UNKNOWN_ROOM`)
   приходят после AJV, т.е. пользователь может исправить всё, что показала схема, и всё равно
   получить 400 на следующем этапе.
3. `/api/v1/calc` вызывается автопересчётом при заполнении анкеты (см. дефолт лимита dev 120
   «чтобы автопересчёт не упирался в 429», `rateLimiters.js:64-67`) — значит эти безадресные
   400 сыплются в процессе заполнения, а не только по нажатию «Рассчитать».

**Минимально необходимое (для плана, не для реализации здесь):** контракт-тест «каждый
`VALIDATION_ERROR` содержит непустой `details[]` с `instancePath`», плюс UI-тест «сообщение об
ошибке содержит человекочитаемое имя поля/шага». Оба сейчас упадут.

---

## 6. Rate limits (фактические)

Источник — `backend/src/api/middleware/rateLimiters.js`, библиотека `express-rate-limit@^8.2.1`
(`backend/package.json:94`).

| Лимитер | Путь(и) | Окно | Лимит по умолчанию | ENV-override | Код при 429 |
|---------|---------|------|--------------------|--------------|-------------|
| `calcRateLimiter` `:70-74` | `POST /api/v1/calc` | 15 мин | **prod 20 / не-prod 120** `:65-67` | `RATE_LIMIT_CALC_PER_15M` | `CALC_RATE_LIMIT_EXCEEDED` |
| `projectCalcRateLimiter` `:77-81` | `POST /api/v1/projects/:id/calc` | 15 мин | 15 | `RATE_LIMIT_PROJECT_CALC_PER_15M` | `PROJECT_CALC_RATE_LIMIT_EXCEEDED` |
| `projectsWriteRateLimiter` `:84-87` | POST/PUT/DELETE projects, `import`, share publish/revoke | 15 мин | 60 | `RATE_LIMIT_PROJECTS_WRITE_PER_15M` | **`RATE_LIMIT_EXCEEDED`** (дефолт `:36`) |
| `projectsReadRateLimiter` `:90-93` | GET projects/{id}/calculations/pdf | 15 мин | 120 | `RATE_LIMIT_PROJECTS_READ_PER_15M` | `RATE_LIMIT_EXCEEDED` |
| `publicShareReadRateLimiter` `:99-103` | `GET /public/shares/{token}` и `/pdf` | 15 мин | 120 | `RATE_LIMIT_PUBLIC_SHARE_PER_15M` | `PUBLIC_SHARE_RATE_LIMIT_EXCEEDED` |
| `feedbackRateLimiter` `:106-110` | `POST /api/v1/feedback` | 15 мин | 20 | `RATE_LIMIT_FEEDBACK_PER_15M` | `FEEDBACK_RATE_LIMIT_EXCEEDED` |

Значения из брифинга подтверждены кодом полностью.

**Ключ.** `resolveRateLimitKey` `:14-20`: `user:<req.user.id>` если есть, иначе
`ipKeyGenerator(req.ip ?? '127.0.0.1')`. Практическое следствие: у `POST /api/v1/calc`
(`routes.js:196`) **нет auth-middleware вообще**, поэтому `req.user` всегда `undefined` →
ключ всегда IP. То же для `/public/shares/*`. Для `/api/v1/feedback` лимитер стоит **перед**
`optionalAuth` (`feedbackRoutes.js:28`) → тоже всегда IP. Для projects-путей `requireAuth`
монтируется на `router.use('/api/v1/projects', …)` (`projectsRoutes.js:128`) раньше per-route
лимитеров, поэтому там ключ — `user:<id>` (при включённой auth) или dev-IP.

**Ответ при превышении** (`:44-50`): `sendErrorEnvelope(res, { statusCode: 429,
message: 'Забагато запитів', code })` — стандартный ErrorEnvelope, без `details`.

**`Retry-After`.** Кастомный `handler` его не ставит. Заголовок должен добавляться самой
библиотекой, поскольку `standardHeaders: true` (`:41`). Косвенное подтверждение из кода проекта:
`backend/scripts/fuzz-calc.ts:43-53` читает `retry-after`, а при его отсутствии — `ratelimit-reset`,
и `:100` — `ratelimit-remaining`. **Не проверено напрямую** (нет `node_modules`); также не проверено,
какой draft заголовков отдаёт v8 при `standardHeaders: true` (в v8 дефолт мог сместиться на
`draft-8`, где вместо `RateLimit-Remaining` идёт комбинированный `RateLimit`) — это надо
зафиксировать первым же интеграционным тестом. `legacyHeaders: false` (`:42`) → `X-RateLimit-*` нет.

**Отключение в тестах.** `isRateLimitDisabled()` (`projectsAuthConfig.js:197-199`):
`!isProductionRuntime() && process.env.RATE_LIMIT_DISABLED === 'true'`. При `true`
`createLimiter` возвращает pass-through `(_req,_res,next)=>next()` (`rateLimiters.js:27-34`).
Две ловушки для тестового харнесса:

1. **В `NODE_ENV=production` отключить лимиты нельзя** — флаг игнорируется. Тесты против
   prod-подобной сборки будут упираться в 20 запросов/15 мин на `/calc`.
2. **Лимитеры создаются на уровне модуля** (`rateLimiters.js:70,77,84,90,99,106`), т.е. решение
   «отключён/включён» и все числа читаются **один раз при импорте**. Менять `RATE_LIMIT_*` или
   `RATE_LIMIT_DISABLED` из теста в рантайме бессмысленно — нужен перезапуск процесса
   или `vi.resetModules()`-эквивалент. Это надо заложить в архитектуру тестов.
3. Счётчики — in-memory (store по умолчанию), поэтому изолируются перезапуском процесса, но
   **разделяются между тест-кейсами в одном процессе**.

---

## 7. НЕ ПРОВЕРЕНО

1. Точный набор заголовков `express-rate-limit@8` при `standardHeaders: true` (draft-6 vs draft-8)
   и гарантия `Retry-After` — библиотека не установлена, вывод сделан по коду-потребителю
   `backend/scripts/fuzz-calc.ts:43-53`.
2. Поддержка устаревшей опции `max` (вместо `limit`) в v8 — `rateLimiters.js:40` использует `max`.
   Если v8 её удалила, **все лимиты молча становятся дефолтными библиотечными**. Проверить первым делом.
3. AJV 8 `strict`-режим: не задан явно (`validate.js:77-81`); реакция на `deprecated`, `example`,
   `description` в схемах и на `$ref`-бандл `$RefParser` — не проверялась запуском.
4. Применение `HydraulicsSurveyInput.radiatorWiringSystemType default: auto` — точка нормализации
   в `backend/src/hydraulics/*` не найдена.
5. Присвоение `role=admin` из `PLATFORM_ADMIN_EMAILS`: `resolveUser.js` прочитан частично
   (`:43`), полная цепочка `mapJwtPayload → resolveUser → users.role` не прослежена.
6. Реальные HTTP-коды и тела — ни один запрос не выполнялся; вся таблица построена статически.
7. `PROJECT_QUOTA_EXCEEDED`/`CALCULATION_QUOTA_EXCEEDED` (`projectAccess.js:200,217`) — статус 409
   выставляется, но `index.js:238-241` для `statusCode > 500` особый; для 409 путь обычный. Не
   проверено, что Mongoose-ошибка уникальности не перехватит раньше.
8. Поведение SSE `/api/v1/admin/feedback/stream` при ошибке после `flushHeaders`
   (`adminFeedbackRoutes.js:141`) — только статический анализ.
9. Действительно ли `express.json({ limit: '1mb' })` (`index.js:121`) срабатывает раньше
   rate-лимитера для `/api/v1/calc` (порядок middleware предполагает «да», но не выполнено).
10. `.cursorrules` — отсутствует в репозитории (подтверждено брифингом), контракт-документа нет.
