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

**IDOR:** все запросы к проектам фильтруются по `req.user.id`; чужой `projectId` → `404 PROJECT_NOT_FOUND`.

---

## Защищённые и публичные маршруты

| Маршрут | Auth |
|---------|------|
| `GET/POST/PUT/DELETE /api/v1/projects/*` | JWT обязателен в production |
| `GET /api/v1/me` | JWT при auth enabled; dev без auth — синтетический профиль |
| `PATCH /api/v1/admin/users/{id}` | JWT + `role=admin` |
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
| `App.tsx` | `<ClerkProvider>` при `VITE_CLERK_PUBLISHABLE_KEY` |
| `auth/AuthProvider.tsx` | Clerk session; `getToken({ template })` — всегда JWT template (не session token) |
| `services/meApi.ts`, `parseMeResponse.ts` | `GET /api/v1/me` — профиль и tier с backend |
| `query/queries/useMeQuery.ts` | React Query профиля (`queryKeys.me`) |
| `components/AccountBar/` | «Увійти», email, badge tier, logout (данные из `/me`) |
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

`AUTH_JWKS_URI` и `AUTH_JWT_SECRET` **взаимоисключающие**.

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

## Миграция legacy `ownerId` (PR-6)

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

## Фаза 2 — Authorization (tier без лимитов, приоритет точности)

**Принцип:** полный точный calc, share и PDF **доступны на всех tier**. Подписка (`subscription`) — метка аккаунта для продукта и billing; **не** ограничивает точность расчёта и **не** блокирует share/PDF.

### Tier и role

| Поле Mongo / `req.user` | Значения | Назначение |
|-------------------------|----------|------------|
| `role` | `user` (default), `admin` | `admin` — служебный PATCH subscription/role |
| `subscription` | `free` (default), `pro`, `marketplace` | Аудитория: частные лица / профи / бренды |

Источник истины — MongoDB `users`, **не** JWT claims.

### Матрица доступа (MVP Фазы 2)

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

Bootstrap первого admin:

```bash
cd backend
npm run promote:user-admin -- --email user@example.com
```

Пользователь должен уже существовать в `users` (после login через Clerk).

### Модули

| Модуль | Назначение |
|--------|------------|
| `api/meRoutes.js` | `GET /api/v1/me` |
| `api/adminRoutes.js` | `PATCH /api/v1/admin/users/:id` |
| `auth/authorizationPolicy.js` | Нормализация role/subscription, `hasRole`, `canAccessAdmin` |
| `auth/requireRole.js` | Middleware admin gate |

---

## Verify и smoke-check

Перед merge — из **корня** репозитория:

```bash
npm run verify
```

Auth-специфичные скрипты:

```bash
# Документация auth (PR-8)
npm run verify:auth-docs

# Backend
cd backend && npm run verify:projects-auth
cd backend && npm run verify:user-model
cd backend && npm run verify:auth-pipeline
cd backend && npm run verify:auth-middleware
cd backend && npm run verify:authorization-policy
cd backend && npm run verify:authorization-middleware
cd backend && npm run verify:me-endpoint
cd backend && npm run verify:migrate-project-owner-ids

# Frontend
cd frontend && npm run verify:frontend-auth
cd frontend && npm run verify:frontend-me
```

Интеграционный smoke (ручной, Фаза 1):

1. Login через Clerk → `GET /api/v1/projects` с Bearer → 200
2. **Регистрация:** `/login` → «Зареєструватися» → `/sign-up` (форма создания аккаунта, не «аккаунт не найден») → после verify — редирект на `/`, `GET /api/v1/me` → 200
3. Create project → `ownerId` в Mongo = `users._id` текущего пользователя
4. Запрос чужого `projectId` → 404

### Smoke Phase 3 (ручной)

1. Login → `GET /api/v1/me` с Bearer → `{ role: "user", subscription: "free" }`
2. UI: badge **Free**, без блока контакта на share
3. `npm run promote:user-admin -- --email …` → `PATCH /api/v1/admin/users/{id}` `{ "subscription": "pro" }` → 200; UI badge **Pro**
4. Publish share → `/s/{token}` показывает `PublisherContactBlock` (email)
5. Owner PDF и public PDF — секция контакта
6. PATCH обратно на `free` → republish → контакт исчезает
7. Share + PDF на `free` — **нет 403** по subscription

---

## Фаза 3 — Frontend tier UX (без gating calc/share/PDF)

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

### Модули (PR-13…PR-15)

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

---

## Roadmap Фазы 1 (выполнено)

| PR | Содержание | Статус |
|----|------------|--------|
| PR-1 | Контракты, startup gate, OpenAPI | ✅ |
| PR-2 | Модель `User`, индексы | ✅ |
| PR-3 | JWT pipeline verify → map → resolve | ✅ |
| PR-4 | `requireAuth` / `optionalAuth` | ✅ |
| PR-5 | `projects.ownerId` → ObjectId ref User | ✅ |
| PR-6 | Миграция legacy ownerId | ✅ |
| PR-7 | Frontend Clerk SDK | ✅ |
| PR-8 | `docs/auth.md`, verify | ✅ |

## Roadmap Фазы 2 (PR-9…PR-12)

| PR | Содержание | Статус |
|----|------------|--------|
| PR-9 | Enum `UserRole` / `SubscriptionTier`, `authorizationPolicy.js` | ✅ |
| PR-10 | `requireRole`, коды authorization, `authErrors` | ✅ |
| PR-11 | Маршруты без subscription-gates; admin PATCH | ✅ |
| PR-12 | `GET /api/v1/me`, `promote:user-admin`, OpenAPI, verify | ✅ |

## Roadmap Фазы 3 (PR-13…PR-16)

| PR | Содержание | Статус |
|----|------------|--------|
| PR-13 | HTTP `/me` + React Query + invalidate кеша | ✅ |
| PR-14 | `AccountBar`, badge tier, «Увійти» в Header | ✅ |
| PR-15 | `publisherPresentation` в share/PDF (Pro/Marketplace) | ✅ |
| PR-16 | Verify + документация Phase 3 | ✅ |
