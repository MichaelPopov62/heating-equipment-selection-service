# Карта модулей проекта

Правила backend/frontend — [`.cursorrules`](.cursorrules). HTTP-контракт — [`openapi.yaml`](openapi.yaml).  
**Дерево папок и entrypoints (SSOT)** — [`docs/project-structure.md`](docs/project-structure.md).  
Backend quick start — [`backend/README.md`](backend/README.md).

---

## Корень репозитория

| Путь | Назначение |
|------|------------|
| `openapi.yaml` / `components/schemas/` | Контракт REST API |
| `shared/` | Общие константы backend и frontend |
| `backend/` | Node.js + Express: calc, matching, Mongo, seed, verify, PDF |
| `frontend/` | React + Vite + TypeScript + React Query |
| `docs/` | Доменная документация |
| `docs/deploy/` | Деплой Vercel + Render |
| `scripts/` | Корневые verify-скрипты |
| `Plan.md` / `README.md` / `.cursorrules` | Индекс, quick start, правила |

Детали структуры `backend/` и `frontend/` — только в [`docs/project-structure.md`](docs/project-structure.md) (без дублирования таблиц здесь).

---

## Поток calc

**HTTP:** `runCalculation(body)` в `api/runCalculation.js` → `getReferenceBundle()` → `toCalcRuntimeContext()` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })`.

**Bundle:** `catalog`, `waterNorms`, `appliances`, `recommendations`, `ufhPresets`. Invalidate: `POST /api/v1/system/invalidate-reference-cache`.

**Пресеты UI (вне bundle):** `GET /api/v1/presets/envelope`; `GET /api/v1/presets/underfloor-heating` (+ `/bases`, `/flooring-finishes`, `/modes`).

Подробнее: [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md), [`docs/hydraulics-pipeline.md`](docs/hydraulics-pipeline.md).

---

## Деплой

| Документ | Тема |
|----------|------|
| [`docs/deploy/README.md`](docs/deploy/README.md) | Hub: Vercel + Render |
| [`docs/deploy/architecture.md`](docs/deploy/architecture.md) | Схема, границы платформ |
| [`docs/deploy/environments.md`](docs/deploy/environments.md) | URL, Mongo, Clerk, CORS, env |
| [`docs/deploy/vercel.md`](docs/deploy/vercel.md) | Vercel build, `vercel.json`, `VITE_*` |
| [`docs/deploy/render.md`](docs/deploy/render.md) | Render Web Service, backend env, seed |
| [`docs/deploy/first-deploy.md`](docs/deploy/first-deploy.md) | Runbook «с нуля» |
| [`docs/deploy/smoke-tests.md`](docs/deploy/smoke-tests.md) | Acceptance после деплоя |

Verify: `npm run verify:deploy-docs`.

---

## Доменная документация

| Документ | Тема |
|----------|------|
| [`docs/project-structure.md`](docs/project-structure.md) | Дерево папок, слои, именование |
| [`docs/auth.md`](docs/auth.md) | JWT, Clerk, tier, `/me` |
| [`docs/feedback-admin.md`](docs/feedback-admin.md) | Admin feedback REST/SSE |
| [`docs/projects-api.md`](docs/projects-api.md) | CRUD, share, PDF |
| [`docs/project-pdf.md`](docs/project-pdf.md) | Серверный PDF |
| [`docs/client-share-and-layers.md`](docs/client-share-and-layers.md) | Клиент vs Dev, share |
| [`docs/calc-input-validation.md`](docs/calc-input-validation.md) | Валидация CalcInput |
| [`docs/calc-runtime-context.md`](docs/calc-runtime-context.md) | CalcRuntimeContext, bundle |
| [`docs/language-policy.md`](docs/language-policy.md) | UA user-facing тексты |
| [`docs/type-safety.md`](docs/type-safety.md) | Strict TS / checkJs / CI |
| [`docs/frontend-calc-runner.md`](docs/frontend-calc-runner.md) | SurveySession, React Query, calc |
| [`docs/survey-draft.md`](docs/survey-draft.md) | SurveyDraft v4, localStorage |
| [`docs/start-state.md`](docs/start-state.md) | Start Screen, bootstrap |
| [`docs/hydraulics-pipeline.md`](docs/hydraulics-pipeline.md) | Гидравлика |
| [`docs/ufh-presets-mongo.md`](docs/ufh-presets-mongo.md) | Режимы ТП |
| [`docs/ufh-test-checklist.md`](docs/ufh-test-checklist.md) | Ручной чеклист ТП |
| [`docs/manifold-matching.md`](docs/manifold-matching.md) | Коллекторы |
| [`docs/unibox-matching.md`](docs/unibox-matching.md) | Унибоксы |
| [`docs/financial-summary.md`](docs/financial-summary.md) | `report.commercial` |
| [`docs/room-exterior-layout.md`](docs/room-exterior-layout.md) | Положение комнаты |
| [`docs/room-design-air-temp.md`](docs/room-design-air-temp.md) | Расчётная T воздуха |

---

## Тестирование

```bash
npm run verify                    # из корня
cd backend && npm run verify      # backend gate
cd frontend && npm run verify     # frontend gate
```

Группы `verify:*` backend — [`docs/project-structure.md`](docs/project-structure.md) § Verify.  
Smoke calc — Test Quickstart в [`.cursorrules`](.cursorrules). Auth — [`docs/auth.md`](docs/auth.md) § Verify.
