<!-- Назначение: история готовности к деплою (verify gate, Mongo seed); актуальные инструкции — README и first-deploy. -->

# Pre-deploy baseline

История проверок готовности к деплою. **Актуальные инструкции:** [`README.md`](README.md), [`first-deploy.md`](first-deploy.md).

Дата первичной проверки: 2026-07-30.

---

## 1. Окружение проверки

```text
OS: Windows 10
Git branch: main
Node.js local: 20.19.2
npm local: 10.8.2
Node.js production gate / CI: 22.22.0
```

Frontend требует Node.js `>=22.22.0 <23`; CI зафиксирован на 22.22.0. В Vercel необходимо
выбрать совместимую Node.js 22 — см. [`vercel.md`](vercel.md).

---

## 2. Установка зависимостей

Выполнен чистый `npm ci` в корне, `shared/`, `backend/` и `frontend/`.

| Пакет | Результат |
|-------|-----------|
| root | успешно, 0 уязвимостей |
| shared | успешно, 0 уязвимостей |
| backend | успешно, npm сообщил 6 уязвимостей с учётом devDependencies |
| frontend | успешно на Node.js 22.22.0, 0 уязвимостей |

Production-only `npm audit --omit=dev`:

| Пакет | Результат |
|-------|-----------|
| backend | 5 уязвимостей: 1 low, 2 moderate, 2 high |
| frontend | 0 уязвимостей |

Backend audit: `body-parser`, `fast-uri`, `js-yaml`, `mongoose`, `qs`. Frontend audit — 0.

---

## 3. Полный quality gate

Перед запуском: локальная копия `backend/test_data.json` из `.example` (как CI).

```bash
npm run verify
```

Результат: exit 0 (~5 min). Проверены type bypass, language policy, shared/backend/frontend verify, build.

---

## 4. Frontend build

```text
Vite: 8.2.0
Modules transformed: 6660
Build time: 13.11 s
Размер frontend/dist: 980 KB
```

Основные чанки (gzip): index ~97 KB, react-dom ~56 KB, clerk ~45 KB.

---

## 5. HTTP-клиенты → `apiUrl()` (этап 2, 2026-07-30)

Статус: **завершён**.

- [`frontend/src/utils/apiUrl.ts`](../../frontend/src/utils/apiUrl.ts) — сборка URL из `VITE_API_BASE_URL`
- 22 вызова `fetch()` в 11 файлах `frontend/src/services/` переведены на `apiUrl()`
- Пустой `VITE_API_BASE_URL` → относительные пути + Vite proxy

```bash
npm run verify --prefix frontend   # OK
npm run verify                     # OK
```

Env на deploy: [`environments.md`](environments.md).

---

## 6. Runtime baseline (локально)

| Сценарий | HTTP | Время |
|----------|------|-------|
| `GET /health` | 200 | 0.062 s |
| calc с `outsideC` | 200 | 1.020 s |
| calc Kyiv + Meteostat | 200 | 1.834 s |
| admin SSE без JWT | 401 | 0.007 s |

PDF verify: `npm run verify:project-pdf` — OK (~10 s с Chromium).

Полный сетевой замер calc/PDF на **staging Render** — после деплоя ([`smoke-tests.md`](smoke-tests.md)).

---

## 7. Вывод этапа (2026-07-30)

Quality gate зелёный; calc менее 2 с, PDF verify ~10 с — job-архитектура не требуется.

Риски перед production:

1. Node.js 22.22+ на Vercel
2. Backend production audit findings
3. SSE с admin JWT на staging
4. Calc/PDF через реальный staging Render + MongoDB

---

## 8. Фаза C — MongoDB Atlas staging (2026-07-31)

Статус: **завершена** (`heatcalc_staging`).

| Параметр | Значение |
|----------|----------|
| Cluster | `cluster0.ddnqw2o.mongodb.net` |
| Staging DB | **`heatcalc_staging`** |
| Dev DB | `heating-selection-service` |
| Production DB | **`heatcalc_production`** — см. [`first-deploy.md`](first-deploy.md) § Production |

```bash
cd backend
npm run seed:mongo-db -- heatcalc_staging
npm run verify:mongo-db -- heatcalc_staging
npm run verify:seed-catalog
```

| Коллекция | Документов |
|-----------|------------|
| `products` | 126 |
| `water_norms` | 1 |
| `appliances` | 6 |
| `recommendations` | 38 |
| `underfloor_heating_presets` | 2 |

Критерии:

- [x] Atlas доступен
- [x] `heatcalc_staging` seeded
- [x] verify:mongo-db OK
- [x] verify:seed-catalog OK
- [ ] `heatcalc_production` — seed и smoke по [`first-deploy.md`](first-deploy.md) § Production

Platform admin: **`PLATFORM_ADMIN_EMAILS`** на Render — [`../auth.md`](../auth.md).

---

## 9. Фаза D — Clerk staging (в плане)

Origins + JWKS для Render env staging. Настройка: [`../auth.md`](../auth.md), шаг 2 в [`first-deploy.md`](first-deploy.md).

---

## 10. Фаза F — Production Mongo (отложено)

БД `heatcalc_production`, seed, production Render/Vercel — после стабильного staging smoke.

---

← [Деплой](README.md)
