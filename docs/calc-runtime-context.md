# CalcRuntimeContext — контекст расчёта

Единый **immutable** снимок справочников для одного вызова `POST /api/v1/calc` (или verify-скрипта). Все слои calc-пайплайна получают справочники **явно** через `ctx` (`configCache.js` + `toCalcRuntimeContext`).

---

## Composition root

```javascript
import { runCalculation } from './runCalculation.js';

const { input, report } = await runCalculation(body);
```

Внутри `runCalculation`: `getReferenceBundle()` → `toCalcRuntimeContext(bundle)` → `validateAndNormalizeInput(body, ctx)` → `buildReport({ input, ctx })`.

Verify-скрипты и фикстуры без HTTP собирают `ctx` вручную:

```javascript
import { getReferenceBundle, toCalcRuntimeContext } from '../reference/public.js';

const bundle = await getReferenceBundle();
const ctx = toCalcRuntimeContext(bundle);
const input = validateAndNormalizeInput(body, ctx);
const report = await buildReport({ input, ctx });
```

## Тип `CalcRuntimeContext`

Определён в `backend/src/types/shared-types.d.ts`:

| Поле | Назначение |
|------|------------|
| `catalog` | Номенклатура `products` |
| `waterNorms` | Нормы ГВС |
| `appliances` | Правила подбора по типам техники |
| `recommendations` | Тексты WARN_* / REC_* |
| `ufhPresets` | Режимы ТП (`underfloor_heating_presets`) |
| `sources` | Откуда загружен каждый справочник + `loadedAt` |

Фабрика: `backend/src/reference/toCalcRuntimeContext.js`  
Guard: `backend/src/reference/assertCalcRuntimeContext.js`

## Immutability

| Слой | Механизм | Зачем |
|------|----------|-------|
| `ReferenceBundle` в `configCache` | `deepFreeze(bundle)` при загрузке | `cachedBundle` общий между запросами |
| `CalcRuntimeContext` | shallow `Object.freeze(ctx)` + `Object.freeze(sources)` | запрет переприсвоения срезов на request |

Вложенные объекты защищены **deep freeze** bundle; ctx не клонирует данные — это **snapshot isolation**: долгоживущий расчёт удерживает снимок на момент `loadedAt`.

### Seed и актуальность кэша

`npm run seed` обновляет MongoDB. Чтобы **работающий API** сразу подхватил новые справочники:

1. Задайте **`SYSTEM_INTERNAL_TOKEN`** в `backend/.env` (одинаковый на API и в окружении seed).
2. Включите **`AUTO_INVALIDATE_CACHE=true`** (dev/staging) или используйте **`NODE_ENV=production`**.
3. После успешного seed скрипт вызывает **`POST /api/v1/system/invalidate-reference-cache`** (с eager reload).

Ручной сброс (API должен быть запущен):

```bash
curl -X POST http://127.0.0.1:3001/api/v1/system/invalidate-reference-cache \
  -H "X-System-Token: $SYSTEM_INTERNAL_TOKEN"
```

**Generation guard:** orphan refresh после invalidate не перезапишет свежий bundle (см. `cacheGeneration` в `configCache.js`). In-flight calc сохраняет свой `ctx` — snapshot isolation.

При нескольких репликах API webhook сбрасывает кэш **только на том инстансе**, куда попал запрос; для k8s — rollout или broadcast.

TTL (`REFERENCE_CACHE_TTL_MS`) остаётся fallback, если invalidate недоступен.

## Правила для разработчиков

### Оркестраторы — принимают `ctx` целиком

| Модуль | Сигнатура |
|--------|-----------|
| `validateAndNormalizeInput(body, ctx)` | validate |
| `buildReport({ input, ctx })` | report |
| `matchEquipment({ heatLoss, hotWater, heatingSystem, building, underfloorHeating?, hydraulics?, ctx })` | matching |
| `pickBoiler({ …расчётные поля…, ctx })` | matching/boiler |
| `attachIndirectBoilerCoupling(indirect, boiler, hotWater, ctx)` | matching |

Оркестратор сам распаковывает `ctx.catalog`, `ctx.appliances`, `ctx.recommendations` и т.д.

### Утилиты — точечные срезы

`utils/boilerMountingConstraints.js`, `utils/boilerMatchingByType.js`, `utils/apartmentMatching.js` — получают `mounting`, `boilerRules`, `apartmentClassification` явно из вызывающего оркестратора, **без** `CalcRuntimeContext`.

### Рекомендации — без глобального кэша

```javascript
import { pushRecommendation, resolveRecommendation } from '../recommendations/recommendationResolver.js';

pushRecommendation(warnings, resolvedList, ctx.recommendations, 'WARN_BOILER_UNDERPOWERED', vars);
resolveRecommendation(ctx.recommendations, 'REC_BOILER_OPTIMAL');
```

### Запрещено

- Импорт удалённых sync-модулей (`dhw/referenceCache.js`, `ufh/ufhPresetsCache.js`).
- `validateAndNormalizeInput(body)` без второго аргумента — ошибка (`assertCalcRuntimeContext`).
- `matchEquipment({ … })` без `ctx`.

ESLint (`backend/eslint.config.js`): `logic/`, `api/validate.js`, `utils/**`, `matching/**` — запрет legacy sync-кэшей.

## Единственный глобальный кэш

`backend/src/reference/configCache.js` — TTL bundle, `deepFreeze`, **`invalidateReferenceCache()`** / **`invalidateAndWarmReferenceCache()`** с **generation guard**. HTTP: **`POST /api/v1/system/invalidate-reference-cache`** (`X-System-Token`, реализация — `api/systemRoutes.js`). Barrel: `reference/public.js`.

Поведение кэша (не классический SWR «отдать stale и обновить в фоне»):

1. Пока `now − loadedAt < REFERENCE_CACHE_TTL_MS` — возвращается текущий `cachedBundle`.
2. После TTL — `await refreshReferenceCache()` (один общий `refreshInFlight`).
3. Если refresh упал, но старый bundle ещё есть — возвращается **stale fallback** (лог `referenceCache.refresh.failed`, `stale: true`).
4. После `invalidate*` orphan refresh с другим `cacheGeneration` **не** перезаписывает кэш (`referenceCache.refresh.discarded_stale`).

### Старт API (`index.js`)

- **`warmupReferenceCache()`** запускается **до** `listen` (не в callback), fire-and-forget по умолчанию — порт не ждёт Mongo.
- **`getReferenceBundle()`** на первом calc/catalog и warmup **делят один `refreshInFlight`** — параллельной двойной загрузки bundle нет.
- **`REFERENCE_WARMUP_BLOCK_STARTUP=true`** — `await warmupReferenceCache()` до bind порта; при ошибке процесс завершается (readiness для prod/k8s).
- Логи: `referenceCache.warmup.start` → `referenceCache.warmup.ok` | `referenceCache.warmup.failed`; успешная загрузка также пишет `referenceCache.loaded`.

## Модули `reference/`

Все файлы `backend/src/reference/` (таблица = диск):

| Путь | Назначение |
|------|------------|
| `reference/public.js` | Barrel: `getReferenceBundle`, `warmupReferenceCache`, `invalidateReferenceCache`, `invalidateAndWarmReferenceCache`, `toCalcRuntimeContext`, `assertCalcRuntimeContext` |
| `reference/configCache.js` | TTL-кэш `ReferenceBundle`, generation guard, warmup / get / invalidate |
| `reference/toCalcRuntimeContext.js` | Фабрика immutable `CalcRuntimeContext` из bundle |
| `reference/assertCalcRuntimeContext.js` | Guard: `ctx` обязателен (fail-fast без второго аргумента validate) |
| `reference/deepFreeze.js` | Рекурсивный `Object.freeze` bundle при загрузке |
| `reference/loadReferenceCollection.js` | Общий шаблон file \| mongo \| auto для справочных коллекций |

Смежные точки входа (вне `reference/`):

| Путь | Назначение |
|------|------------|
| `api/runCalculation.js` | Composition root HTTP calc |
| `api/systemRoutes.js` | `POST /api/v1/system/invalidate-reference-cache` |
| `api/validate.js` | `validateAndNormalizeInput(body, ctx)` |
| `scripts/fixtures/calcRuntimeContextFromFiles.js` | File-fixture `ctx` без Mongo для verify |

## Скрипты verify

```javascript
await warmupReferenceCache();
const ctx = toCalcRuntimeContext(await getReferenceBundle());
validateAndNormalizeInput(minimalBody(), ctx);
matchEquipment({ heatLoss, hotWater, heatingSystem, building, ctx });
```

Фикстуры без Mongo: `backend/scripts/fixtures/calcRuntimeContextFromFiles.js`.

```bash
cd backend && npm run verify:calc-runtime-context          # контракт ctx, file-fixture, fail без ctx
cd backend && npm run verify:reference-cache-invalidate    # invalidate + generation guard
```

## Связанные документы

- `Plan.md` § «Поток calc» — краткая схема пайплайна
- [`project-structure.md`](project-structure.md) § `backend/` — карта модулей
- [`hydraulics-pipeline.md`](hydraulics-pipeline.md) — downstream после matching (rules из `ctx.appliances`)
