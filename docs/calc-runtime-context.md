# CalcRuntimeContext — контекст расчёта

Единый **immutable** снимок справочников для одного вызова `POST /api/v1/calc` (или verify-скрипта). Все слои calc-пайплайна получают справочники **явно** через `ctx`, без глобальных sync-кэшей.

---

## Проблема (историческая)

Раньше `validateAndNormalizeInput`, `calculateUnderfloorHeating` и matching читали глобальный sync-кэш (`referenceCache.js`, `ufhPresetsCache.js`, `recommendationResolver`). В HTTP-пути кэш прогревался через `getReferenceBundle()`, но при прямом вызове без прогрева — необработанное исключение или тихий сбой.

## Решение

**Composition root** HTTP calc (`backend/src/api/runCalculation.js`):

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
| `matchEquipment({ heatLoss, hotWater, heatingSystem, building, underfloorHeating, ctx })` | matching |
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

`backend/src/reference/configCache.js` — TTL bundle, `deepFreeze`, stale-while-revalidate, **`invalidateReferenceCache()`** / **`invalidateAndWarmReferenceCache()`** с **generation guard**. HTTP: **`POST /api/v1/system/invalidate-reference-cache`** (`X-System-Token`). Barrel: `reference/public.js`.

### Старт API (`index.js`)

- **`warmupReferenceCache()`** запускается **до** `listen` (не в callback), fire-and-forget по умолчанию — порт не ждёт Mongo.
- **`getReferenceBundle()`** на первом calc/catalog и warmup **делят один `refreshInFlight`** — параллельной двойной загрузки bundle нет.
- **`REFERENCE_WARMUP_BLOCK_STARTUP=true`** — `await warmupReferenceCache()` до bind порта; при ошибке процесс завершается (readiness для prod/k8s).
- Логи: `referenceCache.warmup.start` → `referenceCache.warmup.ok` | `referenceCache.warmup.failed`; успешная загрузка также пишет `referenceCache.loaded`.

## Скрипты verify

```javascript
await warmupReferenceCache();
const ctx = toCalcRuntimeContext(await getReferenceBundle());
validateAndNormalizeInput(minimalBody(), ctx);
matchEquipment({ heatLoss, hotWater, heatingSystem, building, ctx });
```

Фикстуры без Mongo: `backend/scripts/fixtures/calcRuntimeContextFromFiles.js`.

In-process проверка invalidate + generation guard:

```bash
cd backend && npm run verify:reference-cache-invalidate
```

## Связанные модули

- `backend/src/api/runCalculation.js` — composition root HTTP calc (POST /api/v1/calc, POST /api/v1/projects/:id/calc)
- `backend/src/reference/configCache.js` — TTL bundle + `deepFreeze`
- `backend/src/reference/public.js` — barrel: `getReferenceBundle`, `toCalcRuntimeContext`, `assertCalcRuntimeContext`
- `Plan.md` § «Поток расчёта» — диаграмма пайплайна

## Чеклист PR

- [ ] `grep` по `src/`: нет `getUfhPresets` / `getAppliances` / `set*Cache` / `referenceCache.js` / `ufhPresetsCache.js`
- [ ] `matchEquipment({ …, ctx })`, `pickBoiler({ …, ctx })`
- [ ] `pushRecommendation(…, ctx.recommendations, code, vars)`
- [ ] после seed / правки Mongo — invalidate webhook или `AUTO_INVALIDATE_CACHE`
- [ ] verify-скрипты передают `ctx`
- [ ] `.cursorrules` и OpenAPI descriptions согласованы
