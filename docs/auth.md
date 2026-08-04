# Аутентификация и авторизация

JWT-аутентификация для **API проектов** (`/api/v1/projects/*`), профиля **`GET /api/v1/me`**, admin API и опционально **feedback** (`POST /api/v1/feedback`).  
Публичные маршруты calc, catalog, presets, public shares — **без auth**.

Контракт OpenAPI: [`ProjectsBearerAuth`](../openapi.yaml) · REST проектов: [`projects-api.md`](projects-api.md) · Карта кода: [`project-structure.md`](project-structure.md).

---

## Цепочка identity

```text
Clerk SignIn / SignUp (frontend)
  → getToken({ template }) → Authorization: Bearer <JWT>
    → backend: verifyAccessToken (JOSE + JWKS)
      → mapJwtPayload → AuthIdentity (sub, email, provider)
        → resolveUser → MongoDB users (find/create)
          → attachRequestContext → req.user.id (= users._id)
            → projects.ownerId (ObjectId ref User)
```

| Слой | Поле | Назначение |
|------|------|------------|
| JWT | `sub` | Ключ IdP; **не** пишется в `projects.ownerId` |
| MongoDB `users` | `providerUserId` | = JWT `sub`; unique с `authProvider` |
| MongoDB `users` | `_id` | Системный пользователь |
| `req.user` | `id` | String(`users._id`) — для фильтров и rate limit |
| MongoDB `projects` | `ownerId` | ObjectId ref `User` |

**IDOR (role=user):** запросы к проектам фильтруются по `req.user.id`; чужой `projectId` → `404 PROJECT_NOT_FOUND`.

**Admin bypass (role=admin):** platform/delegated admin видит и изменяет **любой** проект (`GET/PUT/DELETE /api/v1/projects/*`, calc, PDF, share). Список `GET /api/v1/projects` без фильтра — все проекты; опционально `?ownerId=` / `?ownerEmail=`. В ответе list/detail — `ownerId`, `ownerEmail`. Cross-owner доступ логируется (`projects.admin.cross_owner`, `projects.admin.list`). Модули: `projects/projectAccess.js`, `projects/projectOwnerMeta.js`. Verify: `npm run verify:projects-admin-access`.

---

## Защищённые и публичные маршруты

| Маршрут | Auth |
|---------|------|
| `GET/POST/PUT/DELETE /api/v1/projects/*` | JWT обязателен в production |
| `GET /api/v1/me` | JWT при auth enabled; dev без auth — синтетический профиль |
| `PATCH /api/v1/admin/users/{id}` | JWT + `role=admin` |
| `GET/PATCH /api/v1/admin/feedback*` | JWT + `role=admin`; список, статусы и SSE |
| `POST /api/v1/feedback` | JWT опционален (`optionalAuth`) |
| `POST /api/v1/calc`, `GET /api/v1/catalog`, presets, `GET /health` | Нет |
| `GET /api/v1/public/shares/*` | Нет (read-only по `shareToken`) |

Frontend: guard только для `/projects` (`ProtectedRoute` + `VITE_AUTH_REQUIRED=true`). Анкета на `/` доступна без входа; на start/survey/projects — `AccountBar` («Увійти» или профиль из `/me`). Сохранение на сервер требует JWT при включённой auth.

---

## Backend

Точка входа pipeline: `backend/src/auth/runAuthPipeline.js`.

| Модуль | Назначение |
|--------|------------|
| `verifyAccessToken.js` | JOSE + JWKS (Clerk/Auth0 RS256/ES256) или HS256 (unit-тесты) |
| `mapJwtPayload.js` | Verified payload → `AuthIdentity` (`sub`, `email` обязательны) |
| `resolveUser.js` | find/create `users` по `(authProvider, providerUserId)` |
| `attachRequestContext.js` | `req.user`, ip, userAgent |
| `requireAuth.js` | Обязательный JWT для projects router |
| `optionalAuth.js` | Опциональный JWT для feedback и `/me` |
| `requireRole.js` | Authorization gate по `req.user.role` (admin API) |
| `authorizationPolicy.js` | SSOT: `UserRole`, `SubscriptionTier`, нормализация |
| `serializeMeUser.js` | Сериализация `GET /api/v1/me` |
| `projectsAuthConfig.js` | Env, startup gate, dev owner ObjectId, safety caps |
| `authErrors.js` | Единые ответы 401/403/503 |

Startup gate (`backend/src/index.js`):

- `NODE_ENV=production` → полная конфигурация Clerk JWKS, иначе `exit 1`
- `PROJECTS_AUTH_ENABLED=true` в dev → JWKS обязателен (HS256 только для verify-скриптов)

Типы: `backend/src/types/auth.d.ts`, `shared-types.d.ts` (`UserMongoDoc`, `ProjectMongoDoc.ownerId`).

---

## Frontend

| Модуль | Назначение |
|--------|------------|
| `App.tsx` / `ClerkProviderWithRouter.tsx` | Router и Clerk provider при `VITE_CLERK_PUBLISHABLE_KEY` |
| `routing/AppRouter.tsx` / `ProtectedRoute.tsx` | Guard маршрута `/projects`; `/` остаётся публичным |
| `auth/AuthProvider.tsx` | Clerk session; `getToken({ template })` — всегда JWT template (не session token) |
| `services/meApi.ts`, `parseMeResponse.ts` | `GET /api/v1/me` — профиль и tier с backend |
| `query/queries/useMeQuery.ts` | React Query профиля (`queryKeys.me`) |
| `components/AccountBar/` | «Увійти», email, badge tier, admin-ссылка; «Вийти з акаунта» завершает сессию (данные из `/me`) |
| `components/SubscriptionTierBadge/` | Badge `free` / `pro` / `marketplace` |
| `components/PublisherContactBlock/` | Контакт публикатора на `/s/{token}` (Pro/Marketplace) |
| `services/projectsAuthToken.ts` | `getToken()` → localStorage → env fallback |
| `services/projectsAuthHeaders.ts` | async `Authorization: Bearer` |
| `pages/LoginPage/` | `<SignIn />` (`/login/*`) или dev textarea JWT |
| `pages/SignUpPage/` | `<SignUp />` (`/sign-up/*`); `signUpUrl` / `signInUrl` — см. ниже |
| `components/Header/` | `accountSlot`, hint под «Посилання» для pro/marketplace |

Приоритет Bearer token:

1. Clerk `getToken({ template: VITE_CLERK_JWT_TEMPLATE })`
2. `localStorage` (`projectsApiBearerToken`)
3. `VITE_PROJECTS_BEARER_TOKEN` (dev/CI)

### Clerk UI-маршруты (SPA)

| Путь React Router | Компонент Clerk | Назначение |
|-------------------|-----------------|------------|
| `/login/*` | `<SignIn path="/login" signUpUrl="/sign-up" />` | Вход |
| `/sign-up/*` | `<SignUp path="/sign-up" signInUrl="/login" />` | Регистрация |

Суффикс `/*` обязателен: Clerk path-routing использует подпути (`/sign-up/verify-email-address` и т.д.).  
**Не** задавайте `signUpUrl={paths.login}` — регистрация не откроется.

### Локализация и стили Clerk UI

| Модуль | Назначение |
|--------|------------|
| `frontend/src/i18n/clerkUkLocalization.ts` | SSOT: merge `ukUA` + override `unstable__errors` и строк sign-in/sign-up (FAPI errors → украинский, без English fallback) |
| `frontend/src/i18n/clerkAppearance.ts` | **SSOT стилей Clerk** — `variables` + `elements` для `ClerkProvider` (поля, пароль, OAuth, backdrop) |
| `frontend/src/components/ClerkAuthWidget/` | Только layout-оболочка (`.shell`: фон, min-height, border); **без** override классов Clerk |
| `frontend/src/i18n/uk/auth.ts` | Подсказки под виджетом: `loginClerkHint`, `signUpPasswordHint` |
| `frontend/src/styles/clerkGlobal.css` | Минимум: CSS-переменные Clerk + fallback `modalBackdrop` (portal на `body`) |

`ClerkProviderWithRouter` получает **единственный** `appearance={clerkAppearance}` и `localization={clerkUkLocalization}`.  
`<SignIn />` / `<SignUp />` **не** дублируют `appearance` — тема наследуется от провайдера.

#### Clerk appearance (SSOT) — правила

1. **Все** стили SignIn/SignUp (padding полей, «глаз» пароля, центрирование label, OAuth, spinner, фон карточки) — только в `clerkAppearance.ts` через ключи `elements.*` (класс `cl-formFieldInput` → `formFieldInput`).
2. **Запрещено** дублировать те же правила в `clerkGlobal.css`, `ClerkAuthWidget.module.css` или инъекцией CSS/JS (`MutationObserver`, inline `setProperty`).
3. **`!important` в Clerk-стилях не использовать.** Допустимый минимум — только в **не-Clerk** CSS проекта, если иначе нельзя перебить сторонний виджет (сейчас Clerk обходится без `!important`).
4. `clerkGlobal.css` — только `--clerk-color-*` и fallback portal backdrop; не править поля формы и OAuth. Mask-icon GitHub: **один** ключ `socialButtonsProviderIcon__github` с `light-dark(#08060d, #f3f4f6)` и `backgroundColor` (= `--text-h` из `index.css`; `variables.colorForeground` и `var(--text-h)` у Emotion до mask-icon не доходят). Без `providerIcon__github`, CSS-fallback и `@clerk/themes`.
5. После изменения UI — ручной smoke (email, password + «глаз», sign-up) и `npm run verify:frontend-auth`.

Редирект после успешного sign-in/sign-up — **только** через React Router (`useAuthRedirectAfterClerk` + `navigate(returnTo)`); `fallbackRedirectUrl` у `<SignIn />` / `<SignUp />` не используется. `ClerkProviderWithRouter` передаёт `routerPush` / `routerReplace` — без `window.location` reload после входа.

После изменения ключей ошибок — прогнать QA-матрицу sign-in/sign-up (неверный email, неверный пароль, sign-up &lt; 8 символов) и `npm run verify:frontend-auth`.

---

## Переменные окружения

### Backend (`backend/.env`)

| Переменная | Обязательность | Описание |
|------------|----------------|----------|
| `AUTH_JWKS_URI` | production / `PROJECTS_AUTH_ENABLED` | JWKS URL Clerk (`/.well-known/jwks.json`) |
| `AUTH_ISSUER` | с JWKS | Issuer JWT (Clerk domain) |
| `AUTH_AUDIENCE` | с JWKS | Audience JWT template (= `aud` в токене) |
| `AUTH_PROVIDER` | production / auth enabled | `clerk` \| `auth0` |
| `PROJECTS_AUTH_ENABLED` | опционально | `true` — auth в dev |
| `AUTH_JWT_SECRET` | только verify | HS256 для `verify:auth-pipeline`; **не** с JWKS |
| `PROJECTS_DEV_OWNER_ID` | опционально | Hex ObjectId dev-владельца (default `000…001`) |
| `PROJECTS_MAX_PER_OWNER` | опционально | Safety cap проектов на владельца (default **200** в коде) |
| `PROJECTS_MAX_CALCULATIONS_PER_PROJECT` | опционально | Safety cap расчётов на проект (default **100** в коде) |
| `AUTH_ISSUER_PROVIDER_MAP` | опционально | JSON `{ "https://iss": "clerk" }` без `AUTH_PROVIDER` |
| `PLATFORM_ADMIN_EMAILS` | staging / production | Comma-separated emails platform admin; **один список на все Render API**; см. [Platform admin](#platform-admin) |

`AUTH_JWKS_URI` и `AUTH_JWT_SECRET` **взаимоисключающие**.

`PLATFORM_ADMIN_EMAILS` — **только backend** (Render / `backend/.env`); **не** задавать на Vercel.

### Frontend (`frontend/.env`)

| Переменная | Описание |
|------------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key → включает SDK |
| `VITE_CLERK_JWT_TEMPLATE` | Имя JWT template (audience = `AUTH_AUDIENCE`) |
| `VITE_AUTH_REQUIRED` | `true` — guard `/projects` |
| `VITE_PROJECTS_BEARER_TOKEN` | Dev Bearer без Clerk UI |

---

## Настройка Clerk (production)

1. **Clerk Dashboard** → Application → JWT Templates → создать template (например `heatcalc-api`):
   - **Name** = `heatcalc-api` (или своё; то же значение в `VITE_CLERK_JWT_TEMPLATE`)
   - **`aud` (Audience)** = значение `AUTH_AUDIENCE` на backend (например `heatcalc-api`)
   - **Claims (JSON)** — обязательно claim `email` (без него backend → 403 «JWT без claim email»):

```json
{
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.email_verified}}"
}
```

   - `sub` Clerk добавляет автоматически
2. **Backend** `.env`: `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE=heatcalc-api`, `AUTH_PROVIDER=clerk`, `PROJECTS_AUTH_ENABLED=true` (dev)
3. **Frontend** `.env`: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_JWT_TEMPLATE=heatcalc-api`, `VITE_AUTH_REQUIRED=true`
   - Frontend **всегда** вызывает `getToken({ template })` (дефолт `heatcalc-api`, если env не задан)
4. **Clerk Dashboard** → Paths (или Redirect URLs): `http://localhost:5173`, `http://localhost:5173/*` для dev; production origin — в allowed list
5. **Clerk Dashboard** → User & Authentication: Sign-up и Email (или OAuth) **включены**
6. CORS: `CORS_ORIGIN=https://your-app.example.com` при разных origin

**Проверка после настройки:** в браузере после login `GET /api/v1/me` → 200; в Console (DevTools) не должно быть `[auth] JWT template … без claim email`.

---

## Режимы локальной разработки

| Режим | Backend | Frontend |
|-------|---------|----------|
| **Dev по умолчанию** | auth выключен; dev ObjectId `000…001` | auth выключен; projects без Bearer |
| **Dev + Clerk** | `PROJECTS_AUTH_ENABLED=true` + JWKS env | Clerk keys + `VITE_AUTH_REQUIRED=true` |
| **Dev + manual JWT** | `PROJECTS_AUTH_ENABLED=true` + JWKS | `/login` textarea или `VITE_PROJECTS_BEARER_TOKEN` |
| **Production** | `NODE_ENV=production` | Clerk + `VITE_AUTH_REQUIRED=true` |

`POST /api/v1/calc` остаётся без auth во всех режимах.

---

## Миграция ownerId

После перехода на `ObjectId ref User` старые проекты с `ownerId = "dev-local"` или JWT `sub` (string) мигрируются скриптом:

```bash
cd backend
npm run migrate:project-owner-ids          # dry-run
npm run migrate:project-owner-ids -- --apply
```

Подробности: [`projects-api.md` § Миграция](projects-api.md#миграция-legacy-ownerid-pr-6).

---

## Коды ошибок auth

| HTTP | Код | Когда |
|------|-----|-------|
| 401 | `PROJECTS_AUTH_REQUIRED` | Нет `Authorization: Bearer` |
| 403 | `PROJECTS_AUTH_FORBIDDEN` | JWT невалиден / нет `sub` или `email` |
| 403 | `ADMIN_REQUIRED` | Admin API без `role=admin` |
| 403 | `INVALID_USER_ROLE` | Недопустимое значение `users.role` |
| 403 | `INVALID_SUBSCRIPTION_TIER` | Недопустимое значение `users.subscription` |
| 503 | `MONGODB_UNAVAILABLE` | Mongo недоступна для `resolveUser` |

Схемы: [`ProjectsAuthErrorCode.yaml`](../components/schemas/ProjectsAuthErrorCode.yaml), [`AuthorizationErrorCode.yaml`](../components/schemas/AuthorizationErrorCode.yaml).

---

## Authorization (tier и role)

**Принцип:** полный точный calc, share и PDF **доступны на всех tier**. Подписка (`subscription`) — метка аккаунта для продукта и billing; **не** ограничивает точность расчёта и **не** блокирует share/PDF.

### Tier и role

| Поле Mongo / `req.user` | Значения | Назначение |
|-------------------------|----------|------------|
| `role` | `user` (default), `admin` | `admin` — admin API, «Звернення», DevPanel (staging) |
| `subscription` | `free` (default), `pro`, `marketplace` | Аудитория: частные лица / профи / бренды |

**Источник `role`:**

| Тип admin | SSOT | Поведение |
|-----------|------|-----------|
| **Platform admin** | `PLATFORM_ADMIN_EMAILS` (backend env) | При login email из JWT ∈ списка → `role=admin` (sync в Mongo в `resolveUser`) |
| **Delegated admin** | MongoDB `users.role` | Назначение через `PATCH /api/v1/admin/users/{id}` существующим admin |

JWT claims **не** задают `role` напрямую; email в JWT используется только для сопоставления с allowlist.

### Матрица доступа

| Возможность | free | pro | marketplace |
|-------------|------|-----|-------------|
| Полный calc (теплопотери, matching) | ✅ | ✅ | ✅ |
| CRUD проектов, save calc | ✅ | ✅ | ✅ |
| Share publish | ✅ | ✅ | ✅ |
| PDF (owner) | ✅ | ✅ | ✅ |

**Authorization gates по subscription в Phase 2 не применяются.** Единственный role-gate — admin API.

### Safety caps (инфраструктура, не тариф)

`PROJECTS_MAX_PER_OWNER` (default 200) и `PROJECTS_MAX_CALCULATIONS_PER_PROJECT` (default 100) — защита MongoDB от злоупотребления; **одинаково для всех tier**. См. [`projects-api.md`](projects-api.md).

### API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/me` | Профиль: `id`, `email`, `role`, `subscription` |
| PATCH | `/api/v1/admin/users/{id}` | Admin: `{ role?, subscription? }` |
| GET | `/api/v1/admin/feedback` | Admin: список обращений с cursor pagination |
| PATCH | `/api/v1/admin/feedback/{id}` | Admin: статус `new` / `read` / `resolved` |
| GET | `/api/v1/admin/feedback/stream` | Admin: авторизованный SSE-поток новых обращений |

### Platform admin

SSOT — **`PLATFORM_ADMIN_EMAILS`** на **Render** (staging и production: **одинаковый** список) и в **`backend/.env`** локально.

```env
PLATFORM_ADMIN_EMAILS=popov1ms@i.ua,romantikzizni@gmail.com
```

**Цепочка:** Clerk JWT (`email` claim) → `resolveUser` → если email ∈ allowlist → `users.role=admin` (create или sync) → `GET /api/v1/me` → UI «Звернення», admin API, DevPanel на staging.

**Acceptance (обязательно после deploy или изменения списка):**

1. Login на целевом frontend (staging / production) через Clerk **этого** окружения.
2. `GET /api/v1/me` → `"role": "admin"`, email из allowlist.
3. UI: ссылка **«Звернення»**; на staging Dev — при `VITE_DEV_TOOLS=1` + `VITE_APP_ENV=staging`.

Platform admin **не синхронизируется между MongoDB автоматически** — синхронизируется **список env** на Render-сервисах. Имена БД (`heatcalc_staging`, `heatcalc_production`, dev `heating-selection-service`) на allowlist не влияют.

**Ops runbook (Render deploy, acceptance):** [`deployment-architecture.md`](deployment-architecture.md) §10.

Модуль: `auth/platformAdminAllowlist.js`; sync: `auth/resolveUser.js`.

### Delegated admin

Назначение admin **другому** пользователю (не из platform allowlist) — только существующим admin:

```http
PATCH /api/v1/admin/users/{id}
Authorization: Bearer <JWT admin>
Content-Type: application/json

{ "role": "admin" }
```

`{id}` — `_id` из `GET /api/v1/me` назначаемого пользователя на **том же** окружении.

### Legacy bootstrap (`promote:user-admin`)

Dev / break-glass без platform allowlist; **не** заменяет `PLATFORM_ADMIN_EMAILS` на deploy.

```bash
cd backend
# Для staging/production укажите целевую БД (как seed:mongo-db):
# npm run seed:mongo-db -- heatcalc_staging  — паттерн URI
npm run promote:user-admin -- --email user@example.com
```

Пользователь должен уже существовать в `users` **целевой** БД (после login через Clerk). Сверьте `id` в stdout с `GET /api/v1/me`. Предпочтительный путь на deploy — **platform allowlist**, не promote.

### Модули

| Модуль | Назначение |
|--------|------------|
| `api/meRoutes.js` | `GET /api/v1/me` |
| `api/adminRoutes.js` | Управление пользователями и административный feedback API |
| `auth/authorizationPolicy.js` | Нормализация role/subscription, `hasRole`, `canAccessAdmin` |
| `auth/platformAdminAllowlist.js` | Парсинг `PLATFORM_ADMIN_EMAILS`, `isPlatformAdminEmail` |
| `auth/resolveUser.js` | Materialize user; platform admin sync в Mongo |
| `auth/requireRole.js` | Middleware admin gate |

---

## Verify и smoke-check

Перед merge — из **корня** репозитория:

```bash
npm run verify
```

Auth-специфичные скрипты:

```bash
# Документация auth
npm run verify:auth-docs

# Backend
cd backend && npm run verify:projects-auth
cd backend && npm run verify:user-model
cd backend && npm run verify:auth-pipeline
cd backend && npm run verify:platform-admin
cd backend && npm run verify:auth-middleware
cd backend && npm run verify:authorization-policy
cd backend && npm run verify:authorization-middleware
cd backend && npm run verify:me-endpoint
cd backend && npm run verify:migrate-project-owner-ids

# Frontend
cd frontend && npm run verify:frontend-auth
cd frontend && npm run verify:frontend-me
```

Интеграционный smoke:

1. Login через Clerk → `GET /api/v1/projects` с Bearer → 200
2. **Регистрация:** `/login` → «Зареєструватися» → `/sign-up` → после verify — редирект на `/`, `GET /api/v1/me` → 200
3. Create project → `ownerId` в Mongo = `users._id` текущего пользователя
4. Запрос чужого `projectId` → 404

### Smoke tier UX

1. Login → `GET /api/v1/me` с Bearer → `{ role: "user", subscription: "free" }` (или `role: "admin"` если email ∈ `PLATFORM_ADMIN_EMAILS`)
2. UI: badge **Free**, без блока контакта на share
3. `PATCH /api/v1/admin/users/{id}` `{ "subscription": "pro" }` (JWT admin) → 200; UI badge **Pro**
4. Publish share → `/s/{token}` показывает `PublisherContactBlock` (email)
5. Owner PDF и public PDF — секция контакта
6. PATCH обратно на `free` → republish → контакт исчезает
7. Share + PDF на `free` — **нет 403** по subscription

---

## Frontend tier UX

**Принцип:** tier влияет только на **отображение в UI** и embed контакта в share snapshot; **не** блокирует calc, publish share или PDF.

### Что tier даёт в UI

| Возможность | free | pro | marketplace |
|-------------|------|-----|-------------|
| Полный calc, share, PDF | ✅ | ✅ | ✅ |
| `AccountBar`: «Увійти» / email + badge | ✅ | ✅ | ✅ |
| Badge tier из `GET /api/v1/me` | Free | Pro | Marketplace |
| Hint под «Посилання» в Header | — | ✅ | ✅ |
| `publisherPresentation` в share snapshot | — | ✅ | ✅ |
| Блок контакта на `/s/{token}` и в PDF | — | ✅ | ✅ |

**Нет subscription-gates:** `POST /api/v1/calc`, `POST …/share`, `GET …/pdf` не проверяют `subscription`.

### Модули tier UX

| Слой | Модуль | Назначение |
|------|--------|------------|
| Frontend | `services/meApi.ts`, `parseMeResponse.ts` | HTTP + strict-parse `/me` |
| Frontend | `query/queries/useMeQuery.ts` | React Query; `enabled` = `isMeQueryEnabled` (Clerk `isLoaded` + JWT getter) |
| Frontend | `components/AccountBar/` | Единая панель сессии |
| Frontend | `components/SubscriptionTierBadge/` | Badge tier |
| Frontend | `components/PublisherContactBlock/` | Контакт на public share |
| Frontend | `services/parsePublicShare.ts` | Парсинг `publisherPresentation` |
| Backend | `projects/buildPublisherPresentation.js` | Контакт из `req.user` при publish/PDF |
| Backend | `projects/buildShareSnapshot.js` | Optional `publisherPresentation` в snapshot |
| OpenAPI | `SharePublisherPresentation.yaml` | `{ tier, contactEmail, contactName? }` |

Подробнее share/PDF: [`client-share-and-layers.md`](client-share-and-layers.md), REST: [`projects-api.md`](projects-api.md).
