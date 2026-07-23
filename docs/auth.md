# Аутентификация (Фаза 1)

JWT-аутентификация для **API проектов** (`/api/v1/projects/*`) и опционально **feedback** (`POST /api/v1/feedback`).  
Публичные маршруты calc, catalog, presets, public shares — **без auth**.

Контракт OpenAPI: [`ProjectsBearerAuth`](../openapi.yaml) · REST проектов: [`projects-api.md`](projects-api.md) · Карта кода: [`project-structure.md`](project-structure.md).

---

## Цепочка identity

```text
Clerk SignIn (frontend)
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
| `POST /api/v1/feedback` | JWT опционален (`optionalAuth`) |
| `POST /api/v1/calc`, `GET /api/v1/catalog`, presets, `GET /health` | Нет |
| `GET /api/v1/public/shares/*` | Нет (read-only по `shareToken`) |

Frontend: guard только для `/projects` (`ProtectedRoute` + `VITE_AUTH_REQUIRED=true`). Анкета на `/` доступна без входа; сохранение на сервер требует JWT при включённой auth.

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
| `optionalAuth.js` | Опциональный JWT для feedback |
| `projectsAuthConfig.js` | Env, startup gate, dev owner ObjectId, квоты |
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
| `auth/AuthProvider.tsx` | Clerk session или legacy dev JWT |
| `services/projectsAuthToken.ts` | `getToken()` → localStorage → env fallback |
| `services/projectsAuthHeaders.ts` | async `Authorization: Bearer` |
| `pages/LoginPage/` | `<SignIn />` или dev textarea JWT |
| `components/AuthSessionBar/` | Email + logout на `/projects` |

Приоритет Bearer token:

1. Clerk `getToken({ template: VITE_CLERK_JWT_TEMPLATE })`
2. `localStorage` (`projectsApiBearerToken`)
3. `VITE_PROJECTS_BEARER_TOKEN` (dev/CI)

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
   - `aud` = значение `AUTH_AUDIENCE` на backend
   - claims: `sub`, `email` (обязательны для `mapJwtPayload`)
2. **Backend** `.env`: `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_PROVIDER=clerk`
3. **Frontend** `.env`: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_JWT_TEMPLATE=heatcalc-api`, `VITE_AUTH_REQUIRED=true`
4. CORS: `CORS_ORIGIN=https://your-app.example.com` при разных origin

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
| 503 | `MONGODB_UNAVAILABLE` | Mongo недоступна для `resolveUser` |

Схема: [`ProjectsAuthErrorCode.yaml`](../components/schemas/ProjectsAuthErrorCode.yaml).

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
cd backend && npm run verify:migrate-project-owner-ids

# Frontend
cd frontend && npm run verify:frontend-auth
```

Интеграционный smoke (ручной):

1. Login через Clerk → `GET /api/v1/projects` с Bearer → 200
2. Create project → `ownerId` в Mongo = `users._id` текущего пользователя
3. Запрос чужого `projectId` → 404

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

Фаза 2 (backlog): роли (`role`), подписки (`subscription`), authorization gates.
