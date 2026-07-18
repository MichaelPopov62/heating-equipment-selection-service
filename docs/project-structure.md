# Карта структуры проекта

Навигатор по папкам и ключевым entrypoints. **Не** дублирует статус MVP и подробные таблицы из [`Plan.md`](../Plan.md) — там статус задач и развёрнутые списки модулей; здесь — «куда смотреть».

Правила кода и бизнес-контекст: [`.cursorrules`](../.cursorrules).  
Контракт API: [`openapi.yaml`](../openapi.yaml).  
Типобезопасность / verify gate: [`type-safety.md`](type-safety.md).

В заголовке большинства исходников есть блок «Назначение / Описание».

---

## Дерево верхнего уровня

```text
.
├── openapi.yaml / components/schemas/   # REST-контракт
├── shared/                              # общие константы BE↔FE
├── backend/                             # Express API + calc
├── frontend/                            # React + Vite UI
├── docs/                                # документация доменов
├── scripts/                             # root verify helpers
├── .github/workflows/                   # CI
├── tsconfig.strict-base.json            # общий strict TS
├── package.json                         # обёртки npm run …
└── Plan.md / .cursorrules / README.md
```

| Путь | Назначение |
|------|------------|
| `openapi.yaml` | Источник правды REST (пути, схемы тел/ответов) |
| `components/schemas/` | Фрагменты OpenAPI (`CalcInput`, отчёт, …) — `$ref` из yaml |
| `shared/` | Контракты, общие для backend и frontend (схемы ГВС, режимы, типы комнат) |
| `backend/` | Node.js + Express: calc, matching, Mongo, seed, verify |
| `frontend/` | React + TS + React Query: анкета и отчёт |
| `docs/` | Тематические гайды (не код) |
| `scripts/verifyNoTypeBypass.mjs` | Gate: запрет `any` / `@ts-ignore` / unsafe eslint-disable |
| `.github/workflows/verify.yml` | CI: bypass → shared → backend → frontend → build |
| `tsconfig.strict-base.json` | Общий strict-профиль для shared / backend / frontend |
| `package.json` (корень) | `npm run verify`, `dev:full`, prefix-скрипты |
| `Plan.md` | Статус MVP + детальная структура + roadmap |
| `.cursorrules` | Политика модулей, бизнес-правила, стек |

---

## `shared/` — общие контракты

Парные `.js` + `.d.ts` (или `.ts`). Проверка: `cd shared && npm run typecheck`.

| Модуль | Назначение |
|--------|------------|
| `heatingMatchingSchemes.*` | Enum схем котла↔ГВС |
| `heatingThermalRegimePresets.*` | 75/65, 55/45, … |
| `roomTypeNormalization.*` | Канонические типы комнат + synonym/legacy |
| `roomDesignAirTemp.*` | Расчётная T воздуха (санузел и др.) |
| `radiatorConnection.*` / `radiatorEmitterPreference.*` | Подводка / preference излучателя |
| `ufhCircuitPresets.*` / `ufhDistributionPresets.*` / `ufhModePresetIds.*` / `ufhTerminalControl.*` | Пресеты и режимы ТП |
| `waterHeaterFormContract.*` | Контракт формы ГВС |
| `surveyMutationKinds.ts` | Виды мутаций анкеты (общие имена) |

---

## `backend/` — API и расчётное ядро

Точка входа: `src/index.js`. Публичные barrels: `*/public.js` (импорты между доменами только через них).

### `backend/src/`

| Папка / файл | Назначение |
|--------------|------------|
| `index.js` | Express, CORS, Helmet, requestId, error handler |
| `api/` | Роуты `/api/v1/*`, AJV, `runCalculation`, projects/system |
| `auth/` | JWT / gate для `/api/v1/projects` |
| `logic/` | Теплопотери, стены, ГВС MVP, ТП (`warmFloorCalc`, `ufh*`) |
| `hydraulics/` | Pure Pipeline: граф → трубы → насосы → proposal |
| `matching/` | Котёл, радиаторы, ВН, БКН, manifolds, uniboxes |
| `catalog/` | `loadCatalog` / `validateCatalog` (Mongo \| file \| auto) |
| `dhw/` | water_norms, appliances, формулы водоснабжения |
| `ufh/` | Загрузка/валидация Mongo-пресетов ТП modes |
| `reference/` | TTL bundle справочников + `toCalcRuntimeContext` |
| `recommendations/` | Тексты `REC_*` / `WARN_*` |
| `report/` | `buildReport` — сборка JSON-отчёта |
| `climate/` | Nominatim + Meteostat bulk |
| `models/` | Mongoose (runtime: `public.js` → Product/Project/…) |
| `projects/` | CRUD проектов, summary, размер документов |
| `data/` | Локальные пресеты ТП (base assembly, finishes) — не Mongo |
| `utils/` | Логер, Mongo URI, монтаж котла, `createAppError`, … |
| `types/` | `shared-types.d.ts`, `boiler-types.d.ts`, Express augment |

Детальные строки по ключевым файлам logic/matching/hydraulics — в [`Plan.md`](../Plan.md) § `backend/`.

Домены в отдельных доках: [`hydraulics-pipeline.md`](hydraulics-pipeline.md), [`manifold-matching.md`](manifold-matching.md), [`unibox-matching.md`](unibox-matching.md), [`calc-runtime-context.md`](calc-runtime-context.md).

### `backend/data/` и каталог

| Путь | Назначение |
|------|------------|
| `data/water_norms.json` | Нормы ГВС (seed → Mongo `water_norms`) |
| `data/appliances.json` | Правила техники (не номенклатура) |
| `data/recommendations.json` | Тексты рекомендаций |
| `test_data.json.example` | Эталон каталога products (в git) |
| `test_data.json` | Локальная копия каталога (gitignore; для seed / file mode) |

### `backend/scripts/`

| Группа | Назначение |
|--------|------------|
| `seed.js` + `seedReferenceData.js` | Запись products + reference в Mongo |
| `verify*.js` | Domain-гейты (`npm run verify:*`); входят в `npm run verify` |
| `fuzz-calc.ts` | Ручной fuzz POST `/api/v1/calc` (`npm run test:fuzz`; нужен поднятый API) |
| `fixtures/` | Хелперы assert/фикстур для verify-скриптов |
| `utils/` | Пути каталога, seed-normalize, invalidate cache |

Список отдельных `verify:*` и что они покрывают — в `backend/package.json` и [`Plan.md`](../Plan.md).

---

## `frontend/` — UI анкеты

Точка входа: `src/main.tsx` → `QueryProvider` → `App`.

| Папка | Назначение |
|-------|------------|
| `src/App.tsx` / `AppSurveyContent.tsx` | Корень UI: справочники + шаги анкеты + отчёт |
| `src/surveySession/` | Клиентский state анкеты: `dispatch` → pipeline → calc |
| `src/query/` | React Query: справочники, calc, проекты |
| `src/services/` | HTTP-клиенты (fetch) для queryFn/mutationFn |
| `src/hooks/` | Оркестрация UI; `useSurveyStepNavigation` — переход на шаг из сайдбара |
| `src/components/` | Формы и блоки отчёта; `HotWaterReport/`, `SurveyNavigation/SurveyStepLink` |
| `src/constants/` | SSOT шагов анкеты (`SURVEY_STEPS`: Объект → Тёплый пол → Помещения → …), типы комнат, compat-id |
| `src/types/` | DTO/view-модели UI |
| `src/utils/` | Парсеры отчёта, миграции черновика, лейблы, guards |
| `src/data/fallback*.ts` | Офлайн-fallback справочников |
| `src/styles/` | CSS-переменные / общие стили |
| `scripts/verifySurveySessionPipeline.mjs` | Verify pipeline сессии |
| `knip.json` | Dead-code (`--treat-config-hints-as-errors`; без blanket-`ignore` migrate) |

Подробные таблицы `query/`, `surveySession/`, `hooks/` — [`Plan.md`](../Plan.md) § `frontend/` и [`frontend-calc-runner.md`](frontend-calc-runner.md), [`frontend-query-inventory.md`](frontend-query-inventory.md), [`survey-draft.md`](survey-draft.md).

---

## `docs/` — тематическая документация

| Документ | Тема |
|----------|------|
| [`type-safety.md`](type-safety.md) | Strict TS / checkJs / ESLint / CI |
| [`frontend-calc-runner.md`](frontend-calc-runner.md) | SurveySession + React Query + calc |
| [`frontend-query-inventory.md`](frontend-query-inventory.md) | Инвентарь query/mutations |
| [`survey-draft.md`](survey-draft.md) | Черновик анкеты v4, compat, verify |
| [`projects-api.md`](projects-api.md) | REST проектов и расчётов |
| [`calc-runtime-context.md`](calc-runtime-context.md) | DI справочников в calc |
| [`calc-input-validation.md`](calc-input-validation.md) | Валидация CalcInput |
| [`room-exterior-layout.md`](room-exterior-layout.md) | Угол / фасад / коридор |
| [`hydraulics-pipeline.md`](hydraulics-pipeline.md) | Pipeline гидравлики |
| [`manifold-matching.md`](manifold-matching.md) / [`unibox-matching.md`](unibox-matching.md) | Коллекторы / унибоксы |
| [`ufh-presets-mongo.md`](ufh-presets-mongo.md) | Пресеты режимов ТП |
| [`heating-schemes-thermal-regime.md`](heating-schemes-thermal-regime.md) | Схемы котла и режимы |
| [`water-heater-form.md`](water-heater-form.md) | Форма ГВС |
| остальные `radiator-*.md`, `ufh-*.md`, checklists | Узкие домены / чеклисты тестов |

---

## Как читать код дальше

1. HTTP → `backend/src/api/` → `runCalculation` → `report/buildReport` → `matching/`.
2. UI мутация → `surveySession/runSurveyMutationPipeline` → `useSurveyCalc` → `services/calc.ts`.
3. Контракт полей → `openapi.yaml` + `backend/src/types/shared-types.d.ts`.
4. Перед merge → из корня `npm run verify` (см. [`type-safety.md`](type-safety.md)).
