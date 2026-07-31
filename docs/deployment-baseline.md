# Baseline перед подготовкой деплоя

Дата проверки: 2026-07-30.

Статус: этапы 1 и 2 завершены; фаза C (MongoDB staging) завершена; HTTP-клиенты переведены на `apiUrl()`.

## 1. Окружение проверки

```text
OS: Windows 10
Git branch: main
Node.js local: 20.19.2
npm local: 10.8.2
Node.js production gate / CI: 22.22.0
```

Frontend требует Node.js `>=22.22.0 <23`; CI зафиксирован на 22.22.0. Локальный
frontend gate дополнительно выполнен через Node.js 22.22.0. В Vercel необходимо
выбрать совместимую Node.js 22 до production deployment.

## 2. Установка зависимостей

Выполнен чистый `npm ci` в корне, `shared/`, `backend/` и `frontend/`.

| Пакет | Результат |
|---|---|
| root | успешно, 0 уязвимостей |
| shared | успешно, 0 уязвимостей |
| backend | успешно, npm сообщил 6 уязвимостей с учётом devDependencies |
| frontend | успешно на Node.js 22.22.0, 0 уязвимостей |

Production-only `npm audit --omit=dev`:

| Пакет | Результат |
|---|---|
| backend | 5 уязвимостей: 1 low, 2 moderate, 2 high |
| frontend | 0 уязвимостей |

Backend audit указывает на `body-parser`, `fast-uri`, `js-yaml`, `mongoose` и `qs`.
Frontend переведён с `react-router-dom@7.18.1` на исправленный `react-router@8.3.0`;
импорты перенесены на public API `react-router`. Безопасные обновления build-зависимостей
выполнены через `npm audit fix`. Полный и production-only frontend audit возвращают
0 уязвимостей.

## 3. Полный quality gate

Перед запуском создана локальная игнорируемая копия
`backend/test_data.json` из `backend/test_data.json.example`, как это делает CI.

Выполнено:

```bash
npm run verify
```

Контрольный повторный запуск выполнен после чистой установки зависимостей.
Результат: успешно, exit code 0, контрольный regression-запуск после обновления
React Router — около 4 минут 57 секунд.

Проверены:

- запрет обходов типизации;
- документация и языковая политика;
- shared typecheck;
- backend lint, typecheck и verify-скрипты;
- frontend lint, strict typecheck и dead-code gate;
- production build;
- frontend verify-скрипты.

## 4. Frontend build

```text
Vite: 8.2.0
Modules transformed: 6660
Build time: 13.11 s
Размер frontend/dist: 980 KB
```

Основные чанки:

| Chunk | Raw | Gzip |
|---|---:|---:|
| основной `index` | 390.26 KB | 97.37 KB |
| `react-dom` | 178.24 KB | 56.31 KB |
| `clerk` | 171.39 KB | 44.76 KB |
| `router` | 37.22 KB | 13.46 KB |
| `query` | 30.56 KB | 9.41 KB |
| основной CSS | 75.73 KB | 12.89 KB |

## 5. Инвентаризация HTTP-клиентов

В `frontend/src/services/` найдено 22 вызова `fetch()` в 11 файлах:

- `adminFeedbackApi.ts` — 2;
- `adminFeedbackStream.ts` — 1;
- `calc.ts` — 1;
- `catalog.ts` — 1;
- `envelopePresets.ts` — 1;
- `feedbackApi.ts` — 1;
- `meApi.ts` — 1;
- `projectsApi.ts` — 10;
- `publicShareApi.ts` — 2;
- `ufhModePresets.ts` — 1;
- `underfloorHeatingPresets.ts` — 1.

Все вызовы используют относительные `/api/...`. Это подтверждает объём следующего
этапа: единый `apiUrl()` должен покрыть все 22 вызова.

## 6. Runtime baseline

Локальный Express API запущен на `http://127.0.0.1:3001`.

| Сценарий | HTTP | Время |
|---|---:|---:|
| `GET /health` | 200 | 0.062 s |
| calc с заданной `outsideC` | 200 | 1.020 s |
| calc с адресом Kyiv и Meteostat | 200 | 1.834 s |
| admin SSE без JWT | 401 | 0.007 s |

SSE-поток не измерен полностью: без действующего admin JWT endpoint ожидаемо
отклонил запрос до открытия потока.

Проверка PDF:

```text
Команда: npm run verify:project-pdf
Результат: успешно
Размер PDF fixture: 101761 bytes
Общее время verify: 10.149 s
```

Это время включает запуск verify-скрипта и Chromium, поэтому не является чистым
временем одного HTTP PDF-запроса. Полный сетевой замер выполняется на staging.

## 7. Вывод этапа

Исходный quality gate зелёный, локальные calc и PDF работают. Текущие измерения
не требуют асинхронной job-архитектуры: контрольный calc с Meteostat занял менее
2 секунд, а PDF verify — около 10 секунд. После staging-деплоя измерения необходимо
повторить.

Перед production остаются отдельные риски:

1. настроить Node.js 22.22+ для Vercel; CI уже зафиксирован на 22.22.0;
2. устранить или принять только backend production dependency audit findings;
3. проверить SSE с admin JWT;
4. измерить calc и PDF через реальные staging Render и MongoDB.

Следующий этап не должен менять бизнес-логику: добавить единый
`VITE_API_BASE_URL` / `apiUrl()` и покрыть им HTTP-клиенты.

## 8. Этап 2 — единый `apiUrl()` (2026-07-30)

Статус: завершён.

### Реализация

- Добавлен `frontend/src/utils/apiUrl.ts` — сборка URL из `VITE_API_BASE_URL` и пути `/api/...`.
- Пустой `VITE_API_BASE_URL` сохраняет относительные пути и Vite proxy на `localhost:3001`.
- Тип `VITE_API_BASE_URL` добавлен в `frontend/src/vite-env.d.ts`.
- Все 22 вызова `fetch()` в 11 файлах `frontend/src/services/` переведены на `apiUrl()`.

| Файл | Вызовов |
|---|---:|
| `projectsApi.ts` | 10 |
| `adminFeedbackApi.ts` | 2 |
| `publicShareApi.ts` | 2 |
| `calc.ts` | 1 |
| `catalog.ts` | 1 |
| `meApi.ts` | 1 |
| `feedbackApi.ts` | 1 |
| `adminFeedbackStream.ts` | 1 |
| `envelopePresets.ts` | 1 |
| `ufhModePresets.ts` | 1 |
| `underfloorHeatingPresets.ts` | 1 |

Grep-аудит: прямых `fetch('/api/...')` в `frontend/src/` не осталось.

### Проверки

```bash
npm run verify --prefix frontend   # OK, ~2.6 min
npm run verify                     # OK, exit 0, ~4.8 min
```

Обновлён `frontend/scripts/verifyAdminFeedback.mjs` — проверка SSE-потока через `apiUrl()`.

Production build: Vite 8.2.0, 6661 модуль, ~3.3 s; основной chunk `index` 390.48 KB (gzip 97.46 KB).

### Вывод этапа 2

Frontend готов к деплою на Vercel с прямым вызовом Render API: достаточно задать
`VITE_API_BASE_URL` в переменных окружения Vercel (staging/production — см.
`docs/deployment-architecture.md`). Локальная разработка без изменений.

Следующий этап: настройка Vercel/Render проектов, CORS на backend и smoke-тесты
по staging URL.

## 9. Фаза C — MongoDB Atlas staging (2026-07-31)

Статус: завершена (staging БД `heatcalc_staging`).

### Инфраструктура

| Параметр | Значение |
|---|---|
| Провайдер | MongoDB Atlas (существующий cluster) |
| Cluster | `cluster0.ddnqw2o.mongodb.net` |
| Staging DB | **`heatcalc_staging`** |
| Dev DB (локальный `.env`) | `heating-selection-service` — **не изменялась** |
| Production DB | `heatcalc_production` — **фаза F** (не выполнялась) |

### Seed и verify

```bash
cd backend
npm run seed:mongo-db -- heatcalc_staging
npm run verify:mongo-db -- heatcalc_staging
npm run verify:seed-catalog
```

Скрипты `seedMongoDatabase.mjs` / `verifyMongoDatabase.mjs` берут credentials из
`backend/.env` и подменяют только имя БД в URI (секреты не передаются в CLI).

### Результат seed (heatcalc_staging)

| Коллекция | Документов |
|---|---:|
| `products` | 126 |
| `water_norms` | 1 |
| `appliances` | 6 |
| `recommendations` | 38 |
| `underfloor_heating_presets` | 2 |

**products by kind:** boiler 24, radiator 13, waterHeater 5, pipe 30, pump 15,
indirectWaterHeater 13, manifold 14, boilerManifold 3, unibox 9.

Post-seed smoke `loadCatalog(mongo)` — OK (126 позиций, round-trip validateAndNormalizeCatalog).

`verify:mongo-db` — `ok: true`, errors: [].

### Критерии завершения фазы C (staging)

- [x] Atlas cluster доступен
- [x] БД `heatcalc_staging` создана и заполнена
- [x] `npm run seed:mongo-db -- heatcalc_staging` — exit 0
- [x] `verify:mongo-db` — все обязательные коллекции ≥ minCount
- [x] `verify:seed-catalog` — OK
- [ ] БД `heatcalc_production` — отложено до фазы F

### Вывод фазы C

Staging MongoDB готова для Render (`MONGODB_URI=.../heatcalc_staging`).
Следующая фаза по плану: **D — Clerk staging** (origins + JWKS для Render env).
