# A3 — Качество кода и стоимость сопровождения

> Агент A3. Ось: **качество кода и стоимость сопровождения**.
> Ветка `qa/audit-and-persona-suite`, HEAD `8f6a35d`, дата 23.08.2026.
> Опровергнутую фактуру (TODO/FIXME, копипаста, `as any`) **не переоткрываю** — см. `_CONTEXT.md:191-230`.
>
> **Инструменты, поставленные мной:** `type-coverage@2` (**не завёлся**: падает на
> `ts.SyntaxKind undefined` — `type-coverage-core` несовместим с typescript 6.0.3, которым собран проект).
> Заменён на **собственные скрипты на TypeScript Compiler API** (`ts.createProgram` + `checker`
> из `backend/node_modules/typescript`), которые считают долю выражений с типом `any` напрямую —
> это ровно то, что меряет type-coverage, но на «родном» компиляторе проекта.
> Временные файлы: `backend/tsconfig.audit-a3.json`, `frontend/tsconfig.audit-a3.json`,
> `shared/tsconfig.audit-a3.json` — **созданы и удалены** (проверено `ls`). `package.json` не изменялись.
> Продуктовый код не менялся: эксперимент §1.3 выполнен на **копии** дерева в скрэтчпаде.

---

## Ответ на главные вопросы оси — коротко

1. **Типобезопасность реальна?** На frontend — да, безоговорочно (**99.3 %** выражений типизированы).
   На backend — **96.5 %**, и это хорошо, но оставшиеся 3.5 % (**1712 выражений**) сидят
   **не случайно, а именно в расчётно-денежном ядре**, и они **невидимы**: тип печатается в IDE
   правильным именем, а внутри — `any`. Причина одна, механическая, чинится за часы.
2. **Что из сложного опасно?** `pickBoiler`, `pickRadiators`, `calculateUnderfloorHeating` — да.
   `buildReport` — **нет** (это оркестратор, а не логика; его cx=256 — симптом находки A3-01).
   `RoomAccordionItem`, `AppSurveyContent`, `validateCatalog` — **не трогать**.
3. **Сколько дней новому разработчику?** **8 рабочих дней** до первого осмысленного изменения
   в расчётном ядре, из них ~1 день теряется на неработающий `npm run verify`. См. §6.

---

## 1. Реальная типобезопасность: заявленное проверено на прочность

### 1.1 Сначала — то, что подтвердилось. Гейт не обманывают

Я проверил **все** способы обхода из задания. Найдено:

| Паттерн обхода | Найдено | Якорь / способ проверки |
|---|---|---|
| `/** @type {*} */`, `@param {*}`, `@returns {*}` | **0** | `git grep -nE '@(type\|param\|returns?\|prop\|property)\s*\{\*\}'` по backend, frontend, shared, scripts, e2e |
| `Object` / `object` / `{}` / `Function` как тип в JSDoc | **0** | `git grep -nE '@(type\|param\|returns?\|property)\s*\{\s*(Object\|object\|Function\|\{\})\s*\}'` |
| `Record<string, any>`, `Array<any>`, `any[]`, `Promise<any>` | **0** | `git grep -nE '(Record<[^>]*\bany\b\|Array<any>\|\bany\[\]\|Promise<any>)'` |
| `as unknown as` (двойной каст) | **0** | `git grep -nE 'as\s+unknown\s+as'` |
| `@ts-expect-error` в коде | **0** | есть только 2 упоминания в текстах: `docs/type-safety.md:41`, `e2e/TESTIDS.md:160` |
| `@ts-nocheck` в коде | **0** | упоминания только в `docs/type-safety.md:40` и в самом гейте |
| `eslint-disable` во всём продуктовом коде | **2** | `frontend/src/components/RoomsForm/RoomsForm.tsx:65`, `frontend/src/hooks/useRoomsOrchestration.ts:57` — обе с объяснением на той же строке; третья в `e2e/specs/personas.spec.ts:181` (`no-console`) |
| Implicit any в параметрах JS | **0** | `noImplicitAny: true` + `checkJs: true` его ловят; `tsc --noEmit` даёт 0 ошибок |
| Файлы, выведенные из-под проверки через `exclude` | **нет вредных** | `backend/tsconfig.json:22` и `shared/tsconfig.json` исключают только `node_modules`/`dist` |

**Вывод: заявление `docs/type-safety.md` о запрете `any` соблюдается буквально и без хитростей.**
Это надо сказать владельцу прямо — я искал обход десятью способами и не нашёл ни одного.

### 1.2 Строгость конфигов — выше рынка

`tsconfig.strict-base.json:2-14` — общая база для всех трёх пакетов:
`strict`, `noImplicitAny`, **`noUncheckedIndexedAccess`**, **`exactOptionalPropertyTypes`**,
`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`,
`verbatimModuleSyntax`, `isolatedModules`.

Два последних из выделенных включают редко — они дают много шума и их обычно отключают первыми.
Здесь они включены и код под ними компилируется чисто. `backend/tsconfig.json:10-11` —
`allowJs` + **`checkJs`**, `include` покрывает `src/**/*.js`, `src/**/*.d.ts`, `scripts/**`
и `../shared/**` (`backend/tsconfig.json:14-21`). Дыр в покрытии `include` нет.

**Единственная реальная дыра покрытия — не в `exclude`, а в отсутствии tsconfig вообще:**

| Каталог | Строк | Под `tsc`? | Под гейтом `verifyNoTypeBypass`? |
|---|---|---|---|
| `backend/src`, `backend/scripts`, `shared`, `frontend/src` | — | да | да |
| `frontend/scripts` (12 файлов) | 1 233 | **нет** (`frontend/tsconfig.node.json:14` включает только `vite.config.ts` и `eslint.config.js`) | **нет** |
| `e2e` (7 файлов) | 1 372 | нет `tsconfig.json` в `e2e/` вообще | **нет** |
| `scripts/` (корень, 6 файлов) | 1 115 | **нет** | **нет** (гейт себя не проверяет) |

Проверено: `any`-паттернов в этих трёх каталогах фактически **0**, так что вреда сегодня нет.
Но 3 720 строк инструментального кода живут вне обоих гейтов.

### 1.3 ГЛАВНОЕ: типы в расчётном ядре печатаются правильно, а работают как `any`

Это самая существенная находка оси. Она не про «плохой стиль» — она про то, что
**система типов показывает разработчику имя типа, которого на самом деле не проверяет**.

**Измерение.** Скриптом на Compiler API я посчитал долю выражений, у которых установлен флаг
`ts.TypeFlags.Any` (метод type-coverage, но на компиляторе проекта):

| Пакет | Выражений проверено | С типом `any` | Покрытие |
|---|---|---|---|
| `frontend/src` (без JSX-интринсиков) | 37 764 | **266** | **99.30 %** |
| `backend/src` | 48 597 | **1 712** | **96.48 %** |

*(Оговорка о честности измерения: первый прогон по frontend дал 91 %, но он засчитывал имена
JSX-тегов и атрибутов — это артефакт метода, а не код. После исключения JSX — 99.3 %.
Я не выношу владельцу число, которое сам же считаю недостоверным.)*

**Где именно сидят 1712 `any` в backend — это не равномерный шум:**

| `any` | из выражений | Файл |
|---|---|---|
| **227** | 1 398 | `backend/src/report/buildFinancialBom.js` — **коммерческая смета** |
| **204** | 1 468 | `backend/src/report/buildReport.js` — **корень расчёта** |
| **196** | 1 777 | `backend/src/api/projectsRoutes.js` |
| 111 | 815 | `backend/src/catalog/loadCatalog.js` |
| 99 | 1 570 | `backend/src/matching/boiler.js` |
| 78 | 339 | `backend/src/matching/enrichProposalBundlePrice.js` — **цена комплекта** |

Всего `any` встречается в **61 файле из 205**.

**Причина — одна и механическая.** В рукописных `.d.ts` backend'а **26 ссылок на типы записаны
без расширения `.js`**, чего требует `moduleResolution: nodenext`. TypeScript такую ссылку
не резолвит и молча подставляет `any`. Ошибку он при этом **не показывает**, потому что
`tsconfig.strict-base.json:12` содержит **`skipLibCheck: true`**, а все эти файлы — `.d.ts`,
то есть для `tsc` они «библиотечные» и не проверяются вовсе.

Полный список 26 битых ссылок (плюс 7 статических `import type ... from '...'` без расширения):

- `backend/src/types/shared-types.d.ts` — строки `198, 199, 200, 201, 736, 845, 855, 957, 958, 959, 960, 962, 981, 997, 1005, 1059, 1067, 1252, 1265, 1360` (20 шт.) и статические `:6, :11, :19`
- `backend/src/types/boiler-types.d.ts:3, :136`, статический `:6`
- `backend/src/hydraulics/types.d.ts:3, :569`, статические `:6, :7`
- `backend/src/logic/ufhLoopHydraulics.types.d.ts:29, :55`
- `backend/src/catalog/types.d.ts` статический `:6`

**Почему это опаснее обычного `any`.** Прямой замер типов через checker
(`ts.TypeFlags.Any` против `checker.typeToString`):

```
interface CalcRuntimeContext        (backend/src/types/shared-types.d.ts:197)
    catalog       печатается как: NormalizedCatalog          | ANY внутри: ДА
    waterNorms    печатается как: any                        | ANY внутри: да
    appliances    печатается как: any                        | ANY внутри: да
interface MatchingReport            (shared-types.d.ts:1078)
    boiler        печатается как: any                        | ANY внутри: да
interface HydraulicsMatchingReport  (shared-types.d.ts:944)
    proposal      печатается как: any                        | ANY внутри: да
    pump          печатается как: any                        | ANY внутри: да
```

Строка `catalog` — самая показательная. Разработчик наводит курсор, видит **`NormalizedCatalog`**,
получает автодополнение по полям — и **не получает никакой проверки**. Весь каталог
(SKU, цены) проходит через ядро как `any` под именем типизированной структуры.

**Что это значит на практике — конкретное место (смета).**
`backend/src/report/buildFinancialBom.js:513-566`, функция `pushHydraulics`. Замер типов:

```
  513  matching  : MatchingReport | undefined     <- типизировано корректно
  514  proposal  : any                            <- уже any
  519  group     : any
  524  pl        : any
  550  pump      : any
  552  pump.pumpSource / .catalogPumpId / .model / .price : any
```

То есть: `matching` типизирован, но **первое же обращение `matching.hydraulics.proposal`
обнуляет типизацию**, и дальше строки сметы — цена насоса, цена трубы, модель — собираются
из полностью непроверяемых данных.

**Сценарий вреда (не гипотетический класс, а реальный механизм):** переименование поля
`price` → `priceUah` в объекте предложения гидравлики. `tsc` промолчит (это `any`),
ESLint промолчит (на backend нет type-aware правил, M1 §12.3), 50 backend verify-скриптов
промолчат (`buildFinancialBom` покрыт `verifyFinancialBom.js`, но он не знает о новом поле).
Результат: `typeof pump.price === 'number'` даёт `false` → `price = null` → **строка сметы
уходит клиенту с нулевой ценой**, HTTP 200, никаких предупреждений.

### 1.4 Доказательство, что дыра реальна: я её закрыл и посмотрел, что вылезло

На **копии** дерева (скрэтчпад, продуктовый код не тронут) я добавил `.js` к 26 спецификаторам
и запустил штатный `tsc`.

- До: `tsc -p backend/tsconfig.json --noEmit` → **0 ошибок**.
- После: **4 ошибки**, все — настоящие.

```
src/matching/enrichProposalBundlePrice.js(33,25): TS2339: Property 'brand' does not exist
                                                  on type 'WaterHeaterCatalogItemNormalized'.
src/matching/enrichProposalBundlePrice.js(33,56): TS2339: то же
src/matching/enrichProposalBundlePrice.js(34,27): TS2339: то же
src/logic/ufhLoopHydraulics.js(979,5):            TS2322: несовместимость optional-полей
                                                  (следствие exactOptionalPropertyTypes)
```

**Первые три — живой дефект, а не шум.** `backend/src/matching/enrichProposalBundlePrice.js:32-34`:

```js
    ...(typeof selected.brand === 'string' && selected.brand.trim()
      ? { brand: selected.brand.trim() }
      : {}),
```

Проверено по данным и по валидатору:
- тип `WaterHeaterCatalogItemNormalized` (`backend/src/catalog/types.d.ts:131-139`) поля `brand` **не имеет**;
- `validateWaterHeater` (`backend/src/catalog/validateCatalog.js:461-548`) `brand` **не заполняет**
  (в отличие от 5 других валидаторов, где `brand` обязателен — `validateCatalog.js:572, 758, 1018, 1134, 1304`);
- в каталоге `backend/test_data.json.example` у `products.waterHeaters` — **5 позиций, у 0 из них есть `brand`**.

Итого: ветка мертва всегда, бренд электробойлера **никогда не попадает в строку комплекта**
коммерческого предложения. Ошибка тихая и денежная — ровно тот класс, который QA описал как
«не падает и почти всегда врёт». Один битый спецификатор в `.d.ts` прятал её месяцами.

### 1.5 Тот же дефект в `shared/` — контракт BE↔FE

`shared/waterHeaterFormContract.d.ts:5` импортирует тип, которого нет:

```ts
import type { HotWaterBoilerPowerMatchingScheme } from './heatingMatchingSchemes.js';
```

`shared/heatingMatchingSchemes.d.ts` экспортирует только константы (`:5, :13-17, :19`),
типа `HotWaterBoilerPowerMatchingScheme` среди них **нет**. Проверено запуском `tsc` с
`skipLibCheck: false` — ошибка `TS2305` воспроизводится **и в `shared`, и во `frontend`**:

```
../shared/waterHeaterFormContract.d.ts(5,15): error TS2305:
  Module '"./heatingMatchingSchemes.js"' has no exported member 'HotWaterBoilerPowerMatchingScheme'.
```

Следствие: `WaterHeaterFormContractValue.hotWaterBoilerPowerMatchingScheme`
(`shared/waterHeaterFormContract.d.ts:8`) — это `any | string`, то есть `any`.
Поле, которое выбирает **схему связки «котёл — ГВС»** (пять вариантов, напрямую влияющих
на подбираемую мощность котла), не проверяется ни на одной стороне контракта.

**Важно для оценки frontend:** это **единственная** ошибка, которую даёт `skipLibCheck: false`
на `frontend/tsconfig.app.json` и на `shared/tsconfig.json`. Frontend и shared в остальном чисты
полностью. Дыра — только в рукописных `.d.ts` backend'а.

### 1.6 Сам гейт `scripts/verifyNoTypeBypass.mjs` — что он не ловит

Прочитан целиком. Это 10 построчных регулярок (`:42-53`) по 4 корням (`:13-18`).
Он делает ровно то, что заявлено, и делает это честно. Но он **построчный текстовый**, поэтому
не видит ничего из перечисленного ниже:

1. **Тихий `any` из §1.3** — 1712 выражений. Это не текст, это результат вывода типов. Регуляркой не ловится в принципе.
2. **JSDoc-касты `/** @type {X} */ (значение)`** — **218 штук в `backend/src`**, ещё **7 в `shared`**.
   Это полный эквивалент `as X` в TS: непроверяемое утверждение типа. Гейт их не считает нарушением
   (и правильно — они законны), но их **никто не считает вообще**.
   Топ: `catalog/validateCatalog.js` — 35, `api/validate.js` — 26, `catalog/loadCatalog.js` — 16,
   `matching/internal/pickRadiatorsCore.js` — 8, `projects/serializeProject.js` — 7.
   Примеры на границе доверия: `catalog/validateCatalog.js:1552` — весь массив `waterHeaters`
   объявляется нормализованным одним кастом; `report/buildReport.js:714` — каст `Record<string, unknown>`
   обратно в `HeatingSystemInput` после `delete` служебных полей.
3. **`as X` во frontend — 86 штук** (`grep -rnE ' as [A-Z]' frontend/src`, минус `as const`).
   Из них честно опасные — приведение сырого JSON к доменному типу без рантайм-проверки:
   `frontend/src/types/projectExport.ts:68` `serverSurveyRaw as SurveyDraft`,
   `frontend/src/utils/migrateSurveyDraft.ts:90, 95, 106, 115, 197`.
   *(Оговорка о методе: первый прогон `git grep -nE '\bas\s+[A-Z]'` дал 0 — `git grep` не понимает
   `\b`/`\s` в этом режиме. Я перепроверил обычным `grep -rnE` и исправил. Число 86 — по второму.)*
4. **`@ts-expect-error`** — в списке паттернов гейта (`:42-53`) его **нет**. Сегодня их 0,
   но ESLint-правило `ban-ts-comment` у frontend его **разрешает** с описанием
   (`docs/type-safety.md:41`), а на backend type-aware ESLint нет вообще. Дверь открыта, счётчика нет.
5. **Строка-амнистия.** `scripts/verifyNoTypeBypass.mjs:65`:
   ```js
   if (/без\s+any|without\s+any|no\s+any|запрет\s+any/i.test(line)) continue;
   ```
   Любая строка, содержащая «без any», **пропускается целиком**, вместе с настоящим нарушением
   на ней же. Сегодня клауза срабатывает на 3 безобидных docstring
   (`frontend/src/utils/jsonGuards.ts:3`, `frontend/src/services/parseAdminFeedback.ts:2`,
   `frontend/src/services/parseMeResponse.ts:2`) — злоупотреблений нет.
   Но `const x = /** @type {any} */ (y); // без any` пройдёт гейт.
6. **Каталоги вне охвата** — `frontend/scripts`, `e2e`, `scripts/` (см. таблицу §1.2), 3 720 строк.

### 1.7 Насколько JSDoc-типизация backend даёт реальную защиту — прямой ответ

**Даёт, и существенно бóльшую, чем принято ожидать от JS.** 96.5 % выражений типизированы,
`checkJs` включён по-настоящему, `strict`-набор выше рыночного, `tsc` **реально гоняется в CI**
(`.github/workflows/verify.yml:39-41, :50-52` — «Shared typecheck» и «Backend verify» присутствуют
как шаги; отсутствуют только 4 из 5 **корневых** скриптов). Это не декорация.

**Но защита имеет ровно одну форму отказа, и она системная:** тип, объявленный через ссылку
на другой модуль в рукописном `.d.ts`, может молча стать `any`, продолжая **отображаться
под своим именем**. Разработчик не может это заметить ни глазами, ни IDE, ни `tsc`.
И распределение потерь — худшее из возможных: `buildFinancialBom` (смета), `buildReport` (ядро),
`enrichProposalBundlePrice` (цена комплекта).

Соответствие «JSDoc описывает одно, а данные другие» я искал предметно и нашёл в двух местах:
`enrichProposalBundlePrice.js:33-34` (§1.4, `brand` не существует) и
`shared/waterHeaterFormContract.d.ts:8` (§1.5, схема ГВС не типизирована).
Оба найдены не чтением наугад, а **включением проверки** — что и есть рекомендуемое действие.

**Рекомендация принципиально не про «перейти на TS».** Переход на TS здесь ничего бы не исправил:
битые спецификаторы в `.d.ts` сломались бы точно так же. Лечится тремя точечными шагами — см. A3-01.

---

## 2. Сложность: что опасно, а что просто длинное

M1 дал числа (`M1-static-metrics.md:410-449`). Я прочитал топ-функции и разобрал,
**из чего именно** складывается их цикломатика — потому что cx=256 у оркестратора
и cx=148 у функции с 28 порогами подбора означают совершенно разные вещи.

Разложение (посчитано по телу каждой функции):

| Функция | cx | Строк | `if` | циклы | тернарник `?` | `??` | `?.` | `&&`/`\|\|` | арифм. |
|---|---|---|---|---|---|---|---|---|---|
| `buildReport` | 256 | 507 | **19** | **0** | 89 | **70** | **126** | 18 | 19 |
| `pickRadiators` | 195 | 642 | **36** | **7** | 64 | 41 | 29 | 29 | 20 |
| `pickBoiler` | 148 | 658 | **41** | 0 | 33 | 13 | 12 | **41** | 26 |
| `calculateUnderfloorHeating` | 83 | 323 | 18 | 1 | 20 | 9 | 19 | 9 | 16 |
| `RoomAccordionItem` | 70 | 908 | **4** | 0 | 60 | 13 | 17 | 16 | — |
| — только JSX-часть (`:269-997`) | — | 729 | **2** | 0 | 34 | 1 | 1 | 9 | — |
| `AppSurveyContent` | — | 622 | 11 | 0 | 18 | 1 | 1 | 17 | — |

### 2.1 ОПАСНЫЕ — доменные расчёты, где ошибка тихая и денежная

**`pickBoiler` — `backend/src/matching/boiler.js:443-1100`, cx=148, 658 строк.**
41 `if` + 41 логических оператора + 26 арифметических операций — это **настоящая ветвящаяся
доменная логика**, а не защитный код. Здесь живут пороги подбора мощности котла.
QA уже описал цену ошибки: `docs/qa/design/D2-engine-coverage.md:118` — «`matching/boiler.js` —
1164 строки, **28 порогов, ни один verify не импортирует**», и там же со ссылкой на R6 §2.1:
`requiredKw` для схемы по умолчанию **не зависит от теплопотерь вообще** (9 кВт и 40 кВт дают
одинаковый котёл). Это главный кандидат оси.

**`pickRadiators` — `backend/src/matching/internal/pickRadiatorsCore.js:226-867`, cx=195, 642 строки.**
36 `if` + **7 циклов** — единственная функция в топе с реальной вложенной итерацией
(перебор пула радиаторов × комнат). 176 операторов (M1 §7). Опасна тем же: тихая арифметика подбора секций.

**`calculateUnderfloorHeating` — `backend/src/logic/warmFloorCalc.js:38-360`, cx=83.**
Меньше и компактнее, но это физика ТП.

### 2.2 ТЕРПИМЫЕ — длинные, но линейные. Длина ≠ опасность

Скажу это прямо, потому что иначе владелец потратит недели не туда.

**`buildReport` (cx=256) — НЕ опасная функция, вопреки первому месту в рейтинге.**
Доказательство в разложении: **19 `if` и 0 циклов на 507 строк**. Ветвлений почти нет.
Цикломатику в 256 создают **126 `?.` + 70 `??` + 89 тернарников** — это не логика,
а **защитное разыменование и подстановка значений по умолчанию**. Функция читается сверху вниз
как список шагов пайплайна с комментариями-нумерацией (`// 4b) Підбір колекторів`,
`// 5) Гідравліка Pure Pipeline` — `buildReport.js:517, :618`).

Более того: **эта защитная плотность — прямое следствие находки A3-01.** Когда `ctx.catalog`,
`matching.boiler` и `matching.hydraulics.proposal` являются `any` (§1.3), компилятор не может
подтвердить ни одно поле, и единственная доступная разработчику стратегия — писать `?.` и `?? null`
на каждом шаге. **Почините типы — и половина цикломатики `buildReport` исчезнет сама,
без единой правки логики.** Резать `buildReport` на части сейчас — значит зафиксировать
защитный шум в новых границах.

**`RoomAccordionItem` (907 строк, cx=70) — НЕ ТРОГАТЬ, и это не компромисс.**
Замер: **0 хуков** (`useState/useMemo/useCallback/useEffect/useRef` — ноль), `return (` начинается
на `RoomAccordionItem.tsx:269`, то есть **729 из 908 строк — сплошной JSX**, в котором всего
**2 `if` и 34 тернарника** (условный рендер полей формы). Это плоская разметка длинной формы
комнаты. Состояния нет, побочных эффектов нет, ошибка здесь громкая (поле не отрисовалось),
а не тихая. Разрезание такого файла — чистый риск без выгоды.

**`AppSurveyContent` (622 строки)** — 11 `if`, 18 тернарников, композиция секций анкеты. То же самое.

**`validateCatalog.js` (1568 строк)** — длинный, но это **последовательность независимых
валидаторов** по типам оборудования (`validateBoiler`, `validateWaterHeater`, `validateUnibox`…),
каждый со своим `ctx`. Ровно тот случай, когда длина файла — свойство предметной области
(126 SKU, 7 категорий), а не запущенность. Два самодубля внутри файла (M1 §3, группа 3)
трогать тоже не надо — они в разных валидаторах и разъедутся при первом же изменении требований.

### 2.3 Про правило сложности в ESLint

Правил `complexity` / `max-lines-per-function` / `max-depth` / `max-params` нет ни в одном
конфиге (M1 §12.3, подтверждаю). Ставить их сейчас **порогом на весь код нельзя** — 235 функций
станут красными в первый же день, и гейт отключат. Единственная работающая форма —
храповик: правило `warn` c порогом выше текущего максимума, опускаемое по мере работы. См. A3-07.

---

## 3. Обработка ошибок

### 3.1 Конверт ошибок — дисциплина соблюдена

Проверено сплошным обходом `backend/src/api/**`.
- `backend/src/api/sendErrorEnvelope.js:17-24` — единая форма `{ ok: false, error: { message, code, statusCode } }`.
- `backend/src/api/errorCodes.js:6` — `ERROR_CODES`, 6 канонических кодов.
- `backend/src/utils/createAppError.js:11, :26` — `createAppError` / `throwAppError`.
- Глобальный 4-аргументный обработчик: `backend/src/index.js:173`, зарегистрирован последним — `backend/src/index.js:255`.
- **Сырых `res.status(4xx/5xx).json(...)` в обход конверта в `backend/src/api/**` — ноль.**
  44 места вызывают `sendErrorEnvelope`, 26 route-хендлеров делают `next(err)`.

Два реальных изъяна, оба узкие:
1. `backend/src/index.js:249` — глобальный обработчик собирает конверт **вручную**, не переиспользуя
   `sendErrorEnvelope`. Дублирование формы в двух местах: разъедется при изменении конверта.
2. **Нет guard'а `res.headersSent`** перед `res.status().json()` в `index.js:249`. Для PDF-маршрутов,
   где тело уже начали слать (`backend/src/api/projectsRoutes.js:700`,
   `backend/src/api/publicSharesRoutes.js:161` — `res.send(pdf.buffer)`), ошибка после начала ответа
   даст `ERR_HTTP_HEADERS_SENT` вместо аккуратного завершения.
3. SSE-маршрут `backend/src/api/adminFeedbackRoutes.js:133-168` — не async, заголовки уже отданы,
   `try/catch` нет; исключение в heartbeat `setInterval` (`:148`) до Express не доходит вообще.

### 3.2 Проглоченные исключения: это ПАТТЕРН, а не единичный случай

Обойдён каждый `catch` в `backend/src` — всего **61**.

| Категория | Кол-во |
|---|---|
| (а) пустой `catch {}` | 7 |
| (б) `catch` → `return null / false` | 2 |
| (в) **подстановка значения по умолчанию и продолжение выполнения** | **10** |
| (г) залогировал и продолжил | 3 |
| (д) корректно преобразовал / пробросил | **39** |

**39 из 61 — правильные.** Это хорошее соотношение, и его надо признать.

Но категория (в) — **архитектурный паттерн «soft-fail», сознательно применённый минимум
в четырёх доменах**, и он объясняет находку QA:

1. **Гидравлика** — `backend/src/report/buildReport.js:622-681`. Тот самый случай.
   В `catch (hydErr)` подставляется `matching.hydraulics.proposal` с `pipeLines: []`,
   `pipeSegments: []`, `pumps: []`, `estimatedPipesPrice: 0`, `estimatedTotalPrice: 0`
   (`buildReport.js:666-679`), выполнение продолжается с `buildReport.js:682`,
   и `backend/src/api/routes.js:202` отвечает **`res.status(200).json({ ok: true, report })`**.
2. **Коллекторы** — `buildReport.js:517-543`, комментарий автора прямым текстом:
   `// 4b) Підбір колекторів — soft-fail: не валимо весь report`. Плюс второй слой того же
   в `backend/src/matching/manifold.js:89`.
3. **Справочники** — `backend/src/reference/configCache.js:144` → `return cachedBundle;`
   (см. A3-10), `backend/src/reference/loadReferenceCollection.js:68` и
   `backend/src/catalog/loadCatalog.js:363` — молчаливый откат Mongo → файл.
4. **Радиаторы/унибоксы** — деградированные формы без исключения:
   `backend/src/matching/radiators.js:66`, `backend/src/matching/unibox.js:320`.

**Что здесь на самом деле не так — и чего НЕ надо делать.**
Сам soft-fail **правильный**: валить весь расчёт из-за одного модуля хуже. И реализован он
аккуратно — с логом, с `warnings.push(...)`, с `unavailableReason` (`buildReport.js:676`).
Это не «проглатывание в тишине», автор о проблеме думал.

Дефект в другом: **у деградации нет машиночитаемого признака на верхнем уровне ответа**.
Проверено чтением `interface CalcReport` (`backend/src/types/shared-types.d.ts:1335-1376`):
поля `degraded` / `status` / `partial` **нет**. Единственные сигналы — свободный текст в
`report.warnings[]` и `proposal.unavailableReason` глубоко внутри. Клиент, PDF-рендер и
будущий платный API не могут отличить полную смету от сметы без труб **программно**.

Хуже: деградированный отчёт **сохраняется в базу** —
`backend/src/api/projectsRoutes.js:519` `await Calculation.create(calculationDocPayload)` — и потом
раздаётся через PDF и публичные share-ссылки как обычный результат.

Отдельно — **несогласованность философии отказа в одном и том же запросе**:

| Этап | Якорь | Отказ → |
|---|---|---|
| Климат / геокодирование | `buildReport.js:231` (вне try) | **502**, расчёт прерван |
| Нет температур | `buildReport.js:248, :255` | **400**, прерван |
| Коллекторы | `buildReport.js:529` | **200**, пустой BOM коллекторов |
| **Гидравлика** | `buildReport.js:650` | **200**, `pipeLines: []`, цена 0 |
| Справочники (Mongo) | `configCache.js:144` | **200**, устаревший каталог |

Недоступность Nominatim роняет весь расчёт в 502, а отказ гидравлики отдаёт 200 с неполной сметой.
Правило одно должно быть, а их два.

### 3.3 Необработанные промисы и жизненный цикл процесса

| Обработчик | Есть? | Якорь |
|---|---|---|
| `process.on('unhandledRejection')` | **есть** | `backend/src/index.js:33` — логирует, `process.exit` не делает (осознанно, комментарий `:32`) |
| `process.on('uncaughtException')` | **НЕТ** | — |
| `process.on('SIGTERM')` / `SIGINT'` | **НЕТ** | — |
| graceful shutdown (`server.close`, закрытие Mongo) | **НЕТ** | — |

Последствие в связке с Render (деплой = перезапуск контейнера): запрос в полёте обрывается
без слива, семафор рендера PDF (`backend/src/projects/pdfRenderSemaphore.js`) не освобождается,
соединения Mongo не закрываются. Для одиночного бесплатного инстанса это терпимо,
но при переходе на платный тариф с несколькими инстансами станет заметно. Пересекается с осью A5 —
**не переоткрываю, фиксирую как факт для A5.**

### 3.4 Недоступность Mongo и внешних API

**MongoDB.**
- Таймауты подключения заданы: `backend/src/utils/mongoConnectionConfig.js:7, :14-15` —
  `serverSelectionTimeoutMS` и `connectTimeoutMS` = 8 с. Это хорошо.
- **Но `socketTimeoutMS` и `maxTimeMS` не заданы нигде** (проверено grep'ом по `backend/src` — 0 совпадений).
  Запрос при отвалившемся соединении буферизуется 10 с (дефолт mongoose) и падает ошибкой
  **без `statusCode`** → `backend/src/index.js:179` подставляет **500 `INTERNAL_ERROR`**
  с затёртым сообщением `'Внутрішня помилка сервера'` (`index.js:230-237`).
  То есть «база моргнула» и «баг в коде» выглядят для владельца **одинаково**.
- Приложение **стартует без Mongo** — `mongoose.connect` при старте не вызывается,
  прогрев кэша не блокирует (`backend/src/index.js:161`), справочники падают на файлы.
  `POST /api/v1/calc` работает полностью. Это осознанное и хорошее решение.
- Отказ при подключении на защищённых маршрутах отдаёт корректный **503 `MONGODB_UNAVAILABLE`**
  (`backend/src/projects/requireMongo.js:34`).

**Nominatim (геокодирование)** — `backend/src/climate/geocode.js`: таймаут 8 с с `AbortController`
(`:10, :53-54`), `clearTimeout` в `finally` (`:85`), отказ → честный **502**
(`:73` `GEOCODE_TIMEOUT`, `:83, :90` `GEOCODE_FAILED`). Ретраев и кэша нет.
Одна щель: `const data = await resp.json();` (`:94`) не обёрнут — битое тело даст 500 вместо 502.

**Meteostat (климат)** — `backend/src/climate/snipClimate.js`. Здесь **не «тихо врёт», а «вешается»**:
- таймауты на каждый запрос есть (`:104` 15 с, `:129` 8 с, оба с `AbortController`);
- **но общего бюджета на операцию нет**: цикл перебирает до 20 станций (`:210`, `:293`),
  на каждой — 3 HEAD-пробы и до 10 годовых CSV (`:268`). Худший случай ≈ **20 × (3×8 с + 10×15 с) ≈ 50 минут**
  до ответа. Общего `AbortSignal` нет.
- `snipClimate.js:327` — `} catch { continue; }` **без лога**: сетевой сбой года неотличим
  от «за этот год данных нет». Это (а)-категория в самом чувствительном месте.
- `stationsLiteCachePromise` (`:20, :145`) **не сбрасывается при отказе** — один неудачный старт
  отравляет кэш промиса **на весь срок жизни процесса**: каждый следующий расчёт переиспользует
  отклонённый промис. Латентный баг «сломалось один раз — сломано навсегда до перезапуска».

---

## 4. Логирование

### 4.1 Что есть

`backend/src/utils/logger.js` — 71 строка, свой, без библиотеки
(проверено: `morgan`/`winston`/`pino`/`bunyan` в зависимостях нет).

| Свойство | Состояние | Якорь |
|---|---|---|
| Уровни | 4: `debug/info/warn/error` | `logger.js:9-14` |
| Уровень из env | `LOG_LEVEL`, дефолт `info` | `logger.js:22, :25` |
| Timestamp | ISO 8601 UTC на каждой строке | `logger.js:36-38, :47` |
| requestId | есть, но **только если вызывающий передал `meta.requestId`** | `logger.js:45-48` |
| Формат | **простой текст**, не JSON; доп. аргументы уходят в `console.*` как есть | `logger.js:60` |
| Редактирование PII | **есть отдельный модуль-хелпер** | `backend/src/projects/projectChangeMeta.js:1-3` |

Всего **114 вызовов логгера в 31 файле** (info 71, warn 30, debug 7, error 6).
Сырых `console.*` в прикладном коде — **0** (4 вызова только внутри самого логгера, `logger.js:67-70`).
Мимо логгера пишут 8 вызовов `process.stdout/stderr.write` — все на старте процесса
(`backend/src/index.js:258, :260, :271, :278`, `backend/src/auth/projectsAuthConfig.js:144, :146, :161, :163`),
один из них с явным комментарием, что так задумано (`index.js:259`).

### 4.2 Утечка персональных данных — почти чисто, но одна дыра есть

**Сначала главное: гигиена PII здесь заметно лучше среднего, и это надо признать.**
Существует специальный модуль «безопасных срезов» `backend/src/projects/projectChangeMeta.js`
(докстринг `:1-3` — «безопасные срезы survey и lastCalcInput без дампа полного JSON в лог»),
и он **реально используется**:
- `projectChangeMeta.js:32-60` `surveyAuditMeta` → только `{present, bytes, schemaVersion, currentStep, roomsCount}`;
- `projectChangeMeta.js:69-97` `calcInputAuditMeta` → только `{present, objectType, roomsCount, insideC, hasLocation}`;
- `projectChangeMeta.js:106-113` `projectPatchFields` → **имена полей, никогда значения**.

Проверено сплошным обходом всех 114 вызовов: **email, телефон, имя клиента, название проекта,
полное тело запроса, полный survey, полный calcInput, значение JWT — не логируются нигде.**
`backend/src/api/feedbackRoutes.js:52` логирует `hasEmail: Boolean(...)` — булево вместо адреса.
Лог запроса `backend/src/index.js:106, :110-114` — только `{method, path, statusCode, ms}`,
без query, тела, заголовков и IP.

**Единственная настоящая утечка — точные координаты объекта, на уровне `info`:**

| Якорь | Строка |
|---|---|
| `backend/src/climate/snipClimate.js:274` | `logger.info('climate.meteostat.stations.start', null, { lat, lon, years })` |
| `backend/src/climate/snipClimate.js:278` | `logger.warn('climate.meteostat.stations.none', null, { lat, lon })` |
| `backend/src/climate/geocode.js:100` | `logger.info('climate.geocode.ok', null, { lat, lon })` |

Ирония в том, что **сам адрес защищён сознательно**: `backend/src/climate/geocode.js:45` пишет
`{ hasAddress: true }`, `backend/src/report/buildReport.js:230` — `{ hasLocation: true }`.
То есть автор думал про адрес и закрыл его, а координаты — более точный идентификатор дома —
остались открытыми в соседней функции. С учётом того, что **репозиторий публичный**
(`_CONTEXT.md:167`) и логи Render читаемы, это надо закрыть: правка на 15 минут.

Пограничное, но не нарушение: `ownerId`/`userId`/`projectId` логируются на уровне `info`
(15 мест, в основном `backend/src/api/projectsRoutes.js:195-863`) — это псевдонимные
идентификаторы, соединяемые с коллекцией `users`, где лежит email. Для аудита доступа они нужны;
удалять не советую. `backend/src/api/publicSharesRoutes.js:92, :151` пишут `token.slice(0, 6)` —
осознанное усечение, не утечка.

Отдельно, не лог, но рядом: `backend/src/api/feedbackRoutes.js:41-43` сохраняет `clientIp`
в Mongo рядом с `email` и `name` (`backend/src/models/Feedback.js:20, :21, :26`) — хранилище PII
без видимой политики хранения. Это территория A5, фиксирую и передаю.

### 4.3 «В понедельник напишут: смета неправильная, вчера в 15:40» — прямой ответ

**Ответ разный для двух путей, и это ключевое, что надо сказать владельцу.**

**Путь 1 — анонимный `POST /api/v1/calc`: НЕТ, восстановить невозможно.**

| Вопрос | Ответ | Якорь |
|---|---|---|
| Вход расчёта логируется? | **НЕТ** | `backend/src/api/routes.js:199` — `logger.debug('calc.request.start', logMeta)` без полезной нагрузки, и это `debug`, **подавленный при дефолтном `LOG_LEVEL=info`** (`logger.js:22, :31`) |
| Вход сохраняется в БД? | **НЕТ** | `backend/src/api/runCalculation.js:16-22` возвращает `{input, report}`, а `routes.js:200` берёт **только `report`** и выбрасывает `input` |
| Отчёт сохраняется? | **НЕТ** | `routes.js:200-202` — отчёт уходит клиенту и теряется. `Calculation.create` есть только в двух местах, оба проектные: `projectsRoutes.js:519`, `importProjectBundle.js:81` |
| requestId связывает лог с запросом? | **Частично** | генерируется в `backend/src/index.js:99-100`, есть в `api.request`/`api.response`/`api.error` (`:106, :110-114, :224`), **но клиенту не возвращается** — нет заголовка `X-Request-Id`, и в `ErrorEnvelope` (`index.js:242-250`) его нет. Пользователь не может назвать номер. |
| Timestamp есть? | **ДА** | `logger.js:36-38, :47`, миллисекунды, UTC |
| Штамп версии? | **Частично, и здесь бесполезен** | см. ниже |

От инцидента в 15:40 останутся ровно две строки — `api.request` и `api.response`
(метод, путь, статус, длительность) — плюс, по иронии, координаты дома из `snipClimate.js:274`.
**Ни комнат, ни площадей, ни цен, ни выбранного котла.**

Есть и вторая ловушка: доменные логи (`backend/src/report/buildReport.js:290` `totalWatts`,
`:729` `grandTotalUah`, `backend/src/matching/boiler.js:1087`) **на уровне `info` и срабатывают**,
но вызываются с `meta = null` (например `buildReport.js:224` — `logger.info('report.build.start', null)`),
то есть **без requestId**. При двух одновременных расчётах их невозможно сопоставить с запросом.

**Путь 2 — расчёт внутри проекта (авторизованный): ДА, и это сделано хорошо.**

`backend/src/models/Calculation.js:38-39` — `calcInput` и `report` целиком (`Schema.Types.Mixed`),
плюс сводка KPI (`:11-23`: `heatLossKw`, `boilerRequiredKw`, `boilerModel`, `insideTempC`,
`outsideTempC`, `warningsCount`) и `createdAt` (`:42`). Запись — `projectsRoutes.js:512-519`.
Владелец находит документ по `createdAt` + `projectId` и **воспроизводит расчёт точно**,
включая цены, потому что `commercial.lines` лежат внутри сохранённого `report`.

**Чего не хватает (для обоих путей):**
`report.meta` (`buildReport.js:735-753`) содержит `catalogSource: 'file' | 'mongo'` и
`schemaVersion: 1` — **литерал, который никогда не повышался**. Ревизии каталога, версии
приложения и git sha там нет: `grep -rn "APP_VERSION|GIT_SHA|COMMIT_SHA|RENDER_GIT" backend/src` — **0**.
Коллекция `products` перезаписывается на месте через `npm run seed`, истории цен нет.
Значит на вопрос «изменился ли алгоритм или каталог между тогда и сейчас» ответить нельзя никогда.

**Куда идут логи в проде:** только stdout/stderr (`logger.js:67-70`),
`backend/Dockerfile:29` — `CMD ["node", "src/index.js"]` без драйвера логов.
`render.yaml` в репозитории **отсутствует**; в `docs/deploy/render.md:60` документирована ровно одна
строка про логи — `LOG_LEVEL`. Агрегации, дренажа, Sentry — **нет**. Политика хранения —
**НЕ ПРОВЕРЕНО** (в репозитории нигде не описана; фактически это дефолт Render, где логи
теряются при передеплое и холодном старте).

**Итог: «вчерашние» логи, скорее всего, уже недоступны.** Поэтому правильный вывод —
не «логировать больше», а **сохранять вход анонимного расчёта** (или честно отвечать, что по
анонимным расчётам разбор невозможен) и **штамповать git sha + ревизию каталога в `report.meta`**.

---

## 5. Единообразие

### 5.1 Смешение языков — масштаб посчитан

Метод: файлы с кириллицей, затем разделение по маркерным буквам —
русские `ы э ъ ё`, украинские `і ї є ґ`.

| Каталог | Файлов | С кириллицей | Только RU | Только UA | **И то и другое** | Неоднозначные* |
|---|---:|---:|---:|---:|---:|---:|
| `backend/src` | 222 | **222 (100 %)** | 101 | 20 | 73 | 28 |
| `frontend/src` | 365 | 352 (96 %) | 135 | 67 | 86 | 64 |
| `shared` | 28 | 24 (86 %) | 16 | 0 | 8 | 0 |
| `backend/scripts` | 69 | 69 (100 %) | 47 | 1 | 13 | 8 |
| `e2e` | 11 | 10 (91 %) | 2 | 0 | 8 | 0 |
| `scripts` (корень) | 6 | 6 (100 %) | 3 | 1 | 2 | 0 |
| **Итого** | **701** | **683 (97 %)** | **304** | **89** | **190** | **100** |

\* содержат кириллицу, но без маркеров (например `котел` — пишется одинаково).

Примерно половина кириллицы — комментарии и JSDoc (в `backend/src` 1 518 из 2 574 кириллических
строк — комментарии, 59 %), а их языковая политика **прямо освобождает**
(`docs/language-policy.md` §3, строка «Коментарі / JSDoc … dev-only»).

**Стоимость приведения комментариев к одному языку:** 190 файлов со смешением + 304 русских —
это буквально несколько недель механической работы с риском внести опечатки в JSDoc,
от которых зависят типы (`checkJs`). **Выгода — ноль:** компилятор язык комментариев не читает,
а автор — единственный разработчик и понимает оба.

**Вывод, который надо разрешить владельцу: это `КОСМЕТИКА`. Не делать.**
Если когда-нибудь появится второй разработчик — приводить к одному языку **по мере касания файлов**,
никогда специальной кампанией.

### 5.2 Пользовательские сообщения — а вот это НЕ косметика

Политика (`docs/language-policy.md` §1) требует 100 % украинского в user-facing тексте,
и в §9 заявлено `[x] 100 % user-facing текст — українська`. **Это не так.**

Найдено **~24 русских пользовательских строки**. Самое важное — они сосредоточены
в непереведённом модуле `feedback` и достигают клиента через HTTP:

| Якорь | Строка | Как доходит |
|---|---|---|
| `backend/src/api/adminFeedbackRoutes.js:179` | `'Некорректный id feedback'` | 400 → `error.message` |
| `backend/src/api/adminFeedbackRoutes.js:191, :203` | `'Feedback не найден'` | 404 через `sendErrorEnvelope` |
| `backend/src/feedback/adminFeedback.js:64, :112, :119, :125, :131, :137, :157, :166, :199` | 9 строк вида `'limit должен быть целым числом от 1 до 100'` | 400 через `respondValidationError` |
| `backend/src/logic/warmFloorCalc.js:67` | `'Неизвестный ufhPresetId "…" в расчёте ТП.'` | **400, `UFH_PRESET_INVALID`** |
| `backend/src/logic/normalizeHeatingUfhPreset.js:25` | `'Неизвестный ufhPresetId "…"'` | то же |

Проверено чтением обработчика: для любого статуса **кроме 500** сообщение уходит клиенту дословно —
`backend/src/index.js:186-188` (`clientMessage = err.message`) и `:243` (`errorBody = { message, ... }`);
затирается только 500 (`index.js:229-231`). Для `warmFloorCalc.js:70-72` статус выставлен **400**,
значит русский текст видит пользователь.

Плюс 2 русские строки в `report.warnings[]`, которые попадают в UI **и в PDF**:
`backend/src/matching/radiatorSizingHelpers.js:211-213` («Высота прибора … превышает допустимую под окном…»),
и смешанная строка `backend/src/hydraulics/pickPump.js:206` — украинское предложение с русской
единицей `м³/ч` (правильная форма `м³/год` использована в соседнем файле
`backend/src/hydraulics/buildHydraulicsProposal.js:306`).

Плюс 8 русских подписей во frontend, в т.ч. `frontend/src/hooks/useCalcReport.ts:89, :98`
(`'не требуется'`, `'эконом: … / эффективный: …'`), `frontend/src/data/fallbackUnderfloorHeatingPresets.ts:24, :28, :32, :36`,
`frontend/src/utils/parsers/parseHydraulicsProposalFromReport.ts:63` (`'Циркуляционный насос'`).

Корректно освобождённое политикой §3/§5 и **не** посчитанное нарушением: значения enum
и подстроки-матчеры (`'наружная стена'`, `'котельная'`, `'кровл'`, `'Электричество'`) —
это данные, а не текст, их трогать нельзя, иначе поедет сопоставление.

### 5.3 Гейт `verifyLanguagePolicy.mjs` не способен это поймать

Запущен: `node scripts/verifyLanguagePolicy.mjs` → **`verifyLanguagePolicy: OK`, exit 0**,
при живых 24 нарушениях выше. Причина — в устройстве самого скрипта:

1. **Детектор — 6 захардкоженных регулярок** (`scripts/verifyLanguagePolicy.mjs:82-88`),
   из которых **5 — дословные строки из прошлых багов** (`Выберите|Заполните`,
   `Контур отопления|тёплого пола`, `керамогранит|линолеум для ТП|ламинат, LVT`, …).
   Обобщённая только одна — наличие буквы `ё`, а она есть в меньшинстве русских слов.
   Гейт по построению **не может** найти русское сообщение, которого ещё не видел.
2. **Слепые зоны по каталогам** (`:164-166`): покрыты `frontend/src` (только `.ts`/`.tsx`),
   `shared`, `backend/src` (только `.js`). Не покрыты `backend/scripts`, `e2e`, `scripts`,
   `backend/data/*.json`, `components/schemas`, CSS; `.d.ts` пропускаются (`:100`).
3. **Сплошные амнистии для `backend/src`** (`:108-112`):
   ```js
   if (/throw new Error|new Error\(|errors\.push\(/.test(line)) continue;
   if (/\/auth\/|validateCatalog|validateWaterNorms|validateAppliances|assertCalc/.test(rel)) continue;
   if (/resolveExternalWallUValue:|Неизвестный ufhPresetId|AUTH_PROVIDER|Архитектурная ошибка/.test(line)) continue;
   ```
   Первая строка выключает проверку **на всех строках, где создаётся ошибка** — то есть ровно там,
   где живут пользовательские сообщения об ошибках. Третья **поимённо прощает**
   `Неизвестный ufhPresetId` — строку, которая, как показано выше, уходит клиенту с кодом **400**.
4. И, наконец, гейт **всё равно не запускается**: он 5-й в корневой цепочке, а она обрывается
   крэшем на 4-м шаге (`verifyBackendDocs.mjs`, см. M2/M1 §12.1), и в CI из корневых скриптов
   запускается только `verifyNoTypeBypass.mjs` (`.github/workflows/verify.yml:36-37`).

Дополнительно: сам документ политики частично написан по-русски
(`docs/language-policy.md` §11 — «Если `CATALOG_SOURCE=mongo`: после обновления JSON-эталонов…»).

### 5.4 Именование и форматирование

**Именование — единственное измерение, где всё чисто на 100 %.**

| Проверка | Результат |
|---|---|
| Кириллические идентификаторы в `backend/src`, `frontend/src`, `shared` | **0** (все совпадения — комментарий `backend/src/catalog/manifoldSeriesGeometry.js:16` и файлы внутри `node_modules`) |
| Транслитерированные идентификаторы | **0** |
| `snake_case` в объявлениях `backend/src` | **0** |
| `snake_case` в объявлениях `frontend/src` | **0** |

`snake_case` встречается только как **ключи данных** (`water_norms`, `underfloor_heating_presets`,
`indirect_wall`, `wall_gas_concrete_d500`) — имена коллекций Mongo и id каталога, конвенция
осознанная, внутренне непротиворечивая и освобождённая политикой §3.
**Смешение языков — целиком в прозе, никогда в структуре кода.** Это важный сигнал:
код структурно однороден, разноязычны только комментарии и тексты.

**Prettier — настроен и не применяется.** Проверено запуском в режиме проверки (без записи):

| Цель | Файлов было бы переформатировано | Всего | Доля |
|---|---:|---:|---:|
| `backend/src/**/*.js` | **152** | 212 | 72 % |
| `frontend/src/**/*.{ts,tsx}` | **202** | 291 | 69 % |
| **Итого** | **354** | 503 | **70 %** |

`.prettierrc` в корне (`semi`, `singleQuote`, `trailingComma: all`, `printWidth: 80`),
`.prettierignore` нет, `prettier` **не значится ни в одном из 5 `package.json`**
(проверено grep'ом — 0 совпадений), husky нет, lint-staged нет, в CI нет.
То есть 70 % дерева нарушает собственный конфиг проекта. Единообразие держится
на стилистическом подмножестве ESLint и ни на чём больше.

**Это тоже `КОСМЕТИКА` — но с одной оговоркой:** запускать `prettier --write` на 354 файла
**нельзя сейчас**. Это переформатирует ровно те файлы расчётного ядра, для которых ещё нет
тестов, и сделает любой `git diff`/`git blame` по ним нечитаемым — а история и так плохая
(61 % коммитов «add changed <файл>», M2). Либо удалить `.prettierrc`, либо включить
одновременно с появлением golden-тестов (D2, слой В), и одним отдельным коммитом.

---

## 6. ГЛАВНЫЙ ВОПРОС ОСИ: сколько дней постороннему разработчику до первого осмысленного изменения в расчётном ядре

**Ответ: 8 рабочих дней.** Обоснование по частям — что читать, где споткнётся, что защитит.

### 6.1 Что придётся прочесть (измерено, не оценено)

Транзитивное замыкание импортов от `backend/src/report/buildReport.js` (по графу madge из
`docs/audit/artifacts/graph-backend.json`): **104 модуля, 18 840 строк** — это и есть
поверхность чтения для правки в ядре. Плюс `backend/src/types/shared-types.d.ts` — 1 703 строки,
самый большой файл проекта, через который проходят все типы.

Крупнейшее в замыкании: `matching/boiler.js` 1165, `logic/ufhLoopHydraulics.js` 1003,
`matching/internal/pickRadiatorsCore.js` 950, `report/buildReport.js` 772, `report/buildFinancialBom.js` 726.

Документация: `docs/project-structure.md` 840 строк (SSOT дерева), `Plan.md` 91, `README.md` 64,
`docs/type-safety.md` 58 — итого ~1 050 строк обязательного чтения. (QA-документы — ещё 23 000 строк,
но они не нужны для правки.)

### 6.2 Где он споткнётся — конкретно

1. **День 1, `npm run verify` падает у него сразу и всегда.** Крэш `ENOENT` на `.cursorrules`
   (`scripts/verifyBackendDocs.mjs:60`, M1 §12.1 / M2) — не «FAIL с сообщением», а голый стектрейс.
   Новый человек **не знает, что так у всех**, и по умолчанию решит, что криво поставил окружение:
   переустановит зависимости, проверит версию node (а она ещё и расходится: CI 22.22.0 против
   локальных 26.x), полезет в Docker. **Это гарантированные полдня-день, потраченные впустую,
   в самый демотивирующий момент — до первой строчки кода.**
2. **`verify` требует Chromium и фикстуру каталога.** `verify:project-pdf` падает без браузера,
   а список fallback-путей (`backend/src/projects/renderPdfFromHtml.js:41-52`) содержит только
   Linux и Windows — **на macOS верификация красная без ручной переменной окружения** (M1 §12.2).
   Ещё несколько часов.
3. **Типы соврут ему.** Он откроет `buildFinancialBom.js`, наведёт курсор на `proposal`,
   увидит осмысленное имя типа — и будет считать, что переименование поля поймает компилятор.
   Не поймает (§1.3). Это не «неудобство», это **ложная уверенность в самом денежном файле**.
4. **Тестов на то, что он меняет, нет.** `docs/qa/design/D2-engine-coverage.md:20-21`:
   «Сегодня: **0 тестов**, ~20 verify-скриптов косвенно трогают ядро, **4 модуля** имеют настоящие
   числовые ассерты». И прицельно про главный файл — `D2:118`: «`matching/boiler.js` — 1164 строки,
   **28 порогов, ни один verify не импортирует**». Значит проверить свою правку он может только
   одним способом: посчитать эталон вручную как теплотехник. Это и есть основная статья затрат.
5. **Читать он будет на двух языках** (§5.1): 73 файла `backend/src` содержат и русский, и украинский.
   Для носителя одного из них — терпимо; для внешнего подрядчика — постоянное лишнее трение.

### 6.3 Что его защитит, а что нет

**Защитит (реально, а не на бумаге):**
- `tsc --noEmit` со `strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes` — и он
  **гоняется в CI** (`.github/workflows/verify.yml:39-41, :50-52` — шаги «Shared typecheck» и «Backend verify»);
- 50 backend verify-скриптов, вся цепочка за 14.8 с (M1 §12) — обратная связь мгновенная;
- маленькая медиана файла (83 строки) — ориентироваться в дереве легко;
- готовый набор Playwright `e2e/specs/personas.spec.ts`, `regressions.spec.ts` — проверить сквозной сценарий можно сразу.

**Не защитит:**
- корневой `npm run verify` — сломан у всех (M2), «verify поймает» — ложная опора;
- типы в `buildFinancialBom` / `buildReport` / `matching` — 1712 `any` (§1.3);
- ESLint на backend — `js/recommended` + 2 правила, без type-aware и без правил сложности (M1 §12.3);
- `verifyLanguagePolicy` — не ловит (§5.3), и всё равно не запускается;
- prettier — не запускается (§5.4);
- `bisect` бесполезен: 61 % коммитов «add changed <файл>», 18 коммитов трогают >50 файлов (M2).

### 6.4 Расчёт

| Этап | Дней |
|---|---|
| Окружение + диагностика сломанного `npm run verify` + Chromium/фикстура | **1.5** |
| Документация (~1 050 строк) + обход дерева и слоёв | **1.0** |
| Чтение ядра: `buildReport` (507) + целевой домен, напр. `boiler.js` (1165, cx=148, 28 порогов) | **2.5** |
| Сама правка | **0.5** |
| **Убедиться, что не сломал**: ручной теплотехнический эталон, прогон 50 verify + e2e, разбор warnings | **2.5** |
| **Итого** | **8.0** |

Для сравнения: правка **вне** ядра (маршрут, форма, отчёт) — **1–2 дня**. Разница в 4–5 раз
и есть цена сегодняшнего состояния ядра.

### 6.5 Что меняет это число

Число определяет **не сложность кода, а отсутствие исполняемой спецификации домена**.
Из 8 дней ~2.5 уходит на «доказать себе, что не сломал», и ещё ~1.5 — на сломанный гейт.

- Починить корневой `verify` (часы, вне моей оси — M2) → **−1 день**, сразу и для всех.
- Починить типы ядра (A3-01, 4–6 часов) → **−0.5 дня** и, что важнее, снимает риск тихой ошибки.
- Сделать слой В из D2 (golden-снапшоты, `docs/qa/design/D2-engine-coverage.md:405-536`) →
  **−2 дня**: проверка «не сломал» превращается в один прогон.

**С этими тремя вещами первое осмысленное изменение в ядре стоит ~4 дня вместо 8.**
Это и есть прямой ответ на вопрос «смогу ли я нанять помощь»: **сможете, но сначала
почините гейт и заведите golden-снапшоты — иначе вы платите наёмному человеку
за то, что он вручную пересчитывает теплотехнику, чтобы проверить собственную правку.**

---

## 7. НАХОДКИ

### [A3-01] Типы расчётного ядра молча деградируют в `any`, оставаясь на вид типизированными
- **Ось:** A3 | **Категория:** БЛОКЕР-B
- **Якорь:** `backend/src/types/shared-types.d.ts:198,199,200,201,736,845,855,957,958,959,960,962,981,997,1005,1059,1067,1252,1265,1360` (+ статические `:6,:11,:19`); `backend/src/types/boiler-types.d.ts:3,:6,:136`; `backend/src/hydraulics/types.d.ts:3,:6,:7,:569`; `backend/src/logic/ufhLoopHydraulics.types.d.ts:29,:55`; `backend/src/catalog/types.d.ts:6`; `tsconfig.strict-base.json:12` (`skipLibCheck: true`)
- **Что не так:** 26 ссылок на типы записаны без расширения `.js`, чего требует `moduleResolution: nodenext`. TS подставляет `any`, а `skipLibCheck: true` прячет ошибку, потому что все эти файлы — `.d.ts`. Результат: **1 712 выражений с типом `any` в `backend/src`** (96.48 % покрытия), с концентрацией в `buildFinancialBom.js` (227), `buildReport.js` (204), `enrichProposalBundlePrice.js` (78). Хуже всего то, что тип **печатается правильным именем**: `CalcRuntimeContext.catalog` показывается в IDE как `NormalizedCatalog`, имея внутри флаг `Any`.
- **Сценарий вреда:** разработчик переименовывает `price` → `priceUah` в предложении гидравлики. `tsc` молчит (`any`), ESLint на backend не type-aware, verify-скрипты не знают о новом поле. В `buildFinancialBom.js:556` проверка `typeof pump.price === 'number'` даёт `false`, цена становится `null`, и **строка сметы уходит клиенту с нулевой ценой при HTTP 200**. Класс подтверждён живым примером — см. A3-04.
- **Стоимость починки:** **4–6 часов.** (1) добавить `.js` к 26 спецификаторам (механически, 1 ч); (2) починить 4 ошибки, которые вылезут (3 из них — один дефект A3-04); (3) добавить в `verifyNoTypeBypass.mjs` регулярку на относительный `import('...')` без `.js` в `.d.ts` — 20 строк, чтобы не вернулось.
- **Проверено экспериментом:** на копии дерева выполнены шаги (1)–(2). До — `tsc` даёт 0 ошибок, после — ровно **4**, все настоящие, ни одного шумного каскада. Риск оценён фактически, а не на глаз.
- **Если не чинить никогда:** самый денежный код проекта (смета, цена комплекта) остаётся без проверки типов навсегда, при формально зелёном `tsc` и заявленной строгой типобезопасности. Любая эволюция каталога или контракта гидравлики даёт тихие нули и пропуски в смете.
- **Риск самой починки:** низкий и измеренный — 4 ошибки. Продуктовое поведение не меняется: правятся только `.d.ts`, рантайм-кода эти строки не содержат.
- **Явно НЕ рекомендуется:** переход на TypeScript. Он бы эту проблему **не** решил — битые спецификаторы в `.d.ts` сломались бы ровно так же.

### [A3-02] Гейт `verifyNoTypeBypass.mjs` проверяет буквы, а не типы
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `scripts/verifyNoTypeBypass.mjs:13-18` (охват), `:42-53` (10 регулярок), `:65` (строка-амнистия)
- **Что не так:** гейт построчно-текстовый и честно делает заявленное, но не видит: тихий `any` (A3-01); **218 JSDoc-кастов в `backend/src`** и 7 в `shared` (`/** @type {X} */ (…)` — полный эквивалент `as X`); **86 `as X` во frontend**; `@ts-expect-error` (его нет в списке паттернов, хотя ESLint frontend его разрешает); каталоги `frontend/scripts`, `e2e`, `scripts/` — 3 720 строк вне охвата. Плюс `:65` пропускает **любую** строку со словами «без any», вместе с нарушением на ней.
- **Сценарий вреда:** обхода сегодня нет (проверено десятью способами, §1.1), но защита держится на дисциплине автора, а не на гейте. Первый же наёмный разработчик, добавив `/** @type {SomeType} */ (jsonFromApi)`, пройдёт гейт и внесёт непроверяемое приведение в ядро.
- **Стоимость починки:** 3–4 часа: считать JSDoc-касты и `as X` не как ошибку, а как **бюджет с порогом** (сейчас 218/86 — зафиксировать и не давать расти); добавить `@ts-expect-error` в список; убрать амнистию `:65` (заменить на маркер в конце строки); расширить охват на 3 каталога.
- **Если не чинить никогда:** гейт продолжит давать зелёный свет и ложное чувство защиты; настоящие обходы (касты) остаются неучтёнными и неограниченными.
- **Риск самой починки:** минимальный, скрипт вне продуктового кода. Порог по кастам надо ставить по факту, иначе гейт станет красным и его отключат.

### [A3-03] Тип схемы «котёл — ГВС» в контракте BE↔FE не существует; поле не проверяется ни на одной стороне
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `shared/waterHeaterFormContract.d.ts:5, :8`; `shared/heatingMatchingSchemes.d.ts:5,13-17,19`
- **Что не так:** `import type { HotWaterBoilerPowerMatchingScheme } from './heatingMatchingSchemes.js'` импортирует тип, которого файл не экспортирует (там только константы). Проверено запуском `tsc` с `skipLibCheck: false`: `TS2305 … has no exported member` воспроизводится **и в `shared`, и во `frontend`**. Следовательно `WaterHeaterFormContractValue.hotWaterBoilerPowerMatchingScheme` — это `any`.
- **Сценарий вреда:** поле выбирает одну из пяти схем связки котла с ГВС и напрямую влияет на требуемую мощность котла. Опечатка в значении схемы на frontend не будет поймана ни компилятором frontend, ни backend — она дойдёт до `pickBoiler` и молча активирует ветку «по умолчанию», дав другой котёл и другую цену.
- **Стоимость починки:** **30 минут** — экспортировать тип из `shared/heatingMatchingSchemes.d.ts` (он выводится из `HOT_WATER_BOILER_MATCHING_SCHEME_ENUM`, `:5`).
- **Если не чинить никогда:** единственная действительно двусторонняя точка контракта BE↔FE остаётся нетипизированной.
- **Риск самой починки:** может вскрыть 1–2 несоответствия в местах, где сейчас передаётся `string`. Это и есть польза.
- **Отдельно:** это **единственная** ошибка, которую даёт `skipLibCheck: false` на `frontend` и `shared`. В остальном оба пакета чисты полностью.

### [A3-04] Бренд электробойлера никогда не попадает в коммерческое предложение
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/matching/enrichProposalBundlePrice.js:32-34`; `backend/src/catalog/types.d.ts:131-139`; `backend/src/catalog/validateCatalog.js:461-548`
- **Что не так:** код читает `selected.brand`, но тип `WaterHeaterCatalogItemNormalized` поля `brand` не имеет, валидатор `validateWaterHeater` его не заполняет (в отличие от 5 других валидаторов, где `brand` обязателен — `validateCatalog.js:572,758,1018,1134,1304`), и в каталоге `backend/test_data.json.example` у `products.waterHeaters` — 5 позиций, **у 0 из них есть `brand`**. Ветка мертва всегда.
- **Сценарий вреда:** в строке комплекта коммерческого предложения электробойлер идёт без бренда — «модель без производителя». Монтажник или дилер не может идентифицировать позицию в прайсе поставщика. Ошибка тихая, в документе, который показывают клиенту.
- **Стоимость починки:** 1–2 часа — решить, добавлять `brand` в валидатор и каталог или убрать мёртвую ветку.
- **Если не чинить никогда:** мелкий, но постоянный дефект коммерческого документа.
- **Риск самой починки:** нулевой.
- **Почему это здесь:** дефект найден **не чтением наугад**, а включением проверки типов из A3-01. Это доказательство, что A3-01 — не теоретическая претензия.

### [A3-05] Деградированный расчёт неотличим от полного программно, и сохраняется в базу
- **Ось:** A3 | **Категория:** БЛОКЕР-A
- **Якорь:** `backend/src/report/buildReport.js:622-681` (гидравлика), `:517-543` (коллекторы); `backend/src/types/shared-types.d.ts:1335-1376` (`CalcReport` без флага); `backend/src/api/routes.js:202`; `backend/src/api/projectsRoutes.js:519`
- **Что не так:** архитектура soft-fail применена минимум в 4 доменах (10 `catch` категории «подставить дефолт и продолжить» из 61). Сам подход **правильный** и реализован аккуратно — с логом, с `warnings.push`, с `unavailableReason` (`buildReport.js:676`). Дефект в другом: в `CalcReport` **нет поля `degraded`/`status`/`partial`**. Единственные признаки — свободный текст в `warnings[]` и `unavailableReason` глубоко внутри. Клиент, PDF-рендер и будущий платный API не могут отличить полную смету от сметы без труб программно. Деградированный отчёт при этом **пишется в Mongo** (`projectsRoutes.js:519`) и потом раздаётся через PDF и публичные share-ссылки как обычный.
- **Сценарий вреда:** пустой пул труб в каталоге → `backend/src/hydraulics/pickPipe.js:96` кидает обычный `Error` **без `code`** → `catch` в `buildReport.js:650` подставляет `pipeLines: []`, `estimatedTotalPrice: 0` → **HTTP 200**. Монтажник получает смету, в которой раздел труб просто отсутствует, отдаёт её клиенту и узнаёт о недостаче на объекте. Это структурная причина симптома, который QA описал как «не падает и почти всегда врёт».
- **Стоимость починки:** **4–6 часов.** Не убирать soft-fail (он нужен), а добавить в `CalcReport.meta` машиночитаемое `degraded: { hydraulics?: код, manifolds?: код, referenceStale?: true }` и заполнять его в тех же трёх `catch`. Frontend и PDF — показать явную плашку.
- **Если не чинить никогда:** любой платный сценарий (продажа PDF, комиссия дилера) строится на документе, про который система не знает, полон он или нет. Для вехи B это блокер по деньгам, для вехи A — по репутации.
- **Риск самой починки:** низкий, добавление поля обратно совместимо. Frontend надо править синхронно, иначе флаг никто не увидит.
- **Связь:** причина архитектурная, симптом — в зоне QA; см. `docs/qa/design/D2-engine-coverage.md` и реестр рисков S1.

### [A3-06] Две противоположные философии отказа в одном запросе
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/report/buildReport.js:231` (климат, вне `try` → 502), `:248,:255` (400), `:529` (200), `:650` (200); `backend/src/reference/configCache.js:144` (200)
- **Что не так:** отказ геокодирования роняет весь расчёт в 502, отказ гидравлики отдаёт 200 с неполной сметой, устаревшие справочники — 200 без признака. Правила нет, каждый случай решён отдельно.
- **Сценарий вреда:** владелец не может сформулировать для себя (и для наёмного разработчика) правило «когда мы отказываем, а когда деградируем». Следующий модуль будет написан по третьему варианту.
- **Стоимость починки:** 2–3 часа на решение и его запись в `docs/` (не код): «внешние справочные данные — деградируем с флагом; вход пользователя — 400; невозможность посчитать физику — 422». Приведение кода — вместе с A3-05.
- **Если не чинить никогда:** расхождение будет расти с каждым новым доменом.
- **Риск самой починки:** менять статусы работающих ручек без нужды не надо — начать с документа и флага (A3-05), код трогать по мере касания.

### [A3-07] Нет правила сложности ни в одном ESLint-конфиге
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `backend/eslint.config.js`, `frontend/eslint.config.js` (правил `complexity`/`max-lines-per-function`/`max-depth`/`max-params` нет); данные — M1 §7: 235 функций с cx>10
- **Что не так:** ограничителя роста сложности нет. Асимметрия: frontend — `strictTypeChecked` + 5 правил `no-unsafe-*`, backend — `js/recommended` + 2 правила, **при том что вся расчётная логика в backend**.
- **Сценарий вреда:** `pickBoiler` вырос до 658 строк постепенно, ничто этому не мешало; следующая функция вырастет так же.
- **Стоимость починки:** 1–2 часа. **Только храповиком:** `complexity: ['warn', 200]` и `max-lines-per-function: ['warn', 700]` — выше сегодняшнего максимума, чтобы гейт был зелёным с первого дня, и опускать по мере работы. Ставить порог 10 нельзя: 235 функций станут красными и правило отключат в тот же день.
- **Если не чинить никогда:** сложность ядра продолжит расти без сигнала.
- **Риск самой починки:** нулевой при пороге выше текущего максимума.

### [A3-08] Расчётное ядро с высоким ветвлением не покрыто ни одним числовым тестом
- **Ось:** A3 | **Категория:** ДОЛГ (**зависимость: сначала тесты, потом разрез**)
- **Якорь:** `backend/src/matching/boiler.js:443-1100` (cx=148, 658 строк, 41 `if`, 26 арифм.); `backend/src/matching/internal/pickRadiatorsCore.js:226-867` (cx=195, 36 `if`, 7 циклов); `backend/src/logic/warmFloorCalc.js:38-360` (cx=83)
- **Что не так:** это единственные три функции в топе сложности, где ветвление — **настоящая доменная логика**, а не защитный код (разложение в §2). Покрытия нет: `docs/qa/design/D2-engine-coverage.md:20-21` — «0 тестов, 4 модуля с числовыми ассертами», `D2:118` — «`matching/boiler.js` — 28 порогов, ни один verify не импортирует».
- **Сценарий вреда:** любая правка подбора котла меняет цену коммерческого предложения, и это невозможно заметить иначе как ручным теплотехническим пересчётом.
- **Стоимость починки:** **сам разрез — 3–5 дней на функцию. Но делать его сейчас нельзя.** Порядок обязателен: (1) слой В из D2 — golden-снапшоты, `docs/qa/design/D2-engine-coverage.md:405-536`; (2) unit-кейсы A3-01…A3-96 из `D2:118-141` на `boiler.js`; (3) **только после этого** выносить из `pickBoiler` таблицу порогов и функции фильтрации пула.
- **Если не чинить никогда:** ядро останется зоной, куда владелец не может пустить наёмного разработчика (см. §6).
- **Риск самой починки:** **самый высокий в проекте.** Рефакторинг расчётного ядра без тестов — единственное действие, которым можно тихо сломать деньги. Прямо говорю: **до появления golden-снапшотов эти три функции не трогать вообще**, даже «по пути».

### [A3-09] Meteostat: неограниченный бюджет запроса и «отравленный» кэш
- **Ось:** A3 | **Категория:** БЛОКЕР-A
- **Якорь:** `backend/src/climate/snipClimate.js:20,:145` (кэш промиса), `:210,:293,:268` (циклы), `:327` (`} catch { continue; }` без лога)
- **Что не так:** таймауты на **каждый** запрос есть (`:104` 15 с, `:129` 8 с, с `AbortController`) — это сделано правильно. Но **общего бюджета на операцию нет**: перебор до 20 станций × (3 HEAD + до 10 годовых CSV) даёт худший случай ≈ **50 минут** до ответа. Плюс `stationsLiteCachePromise` (`:20, :145`) **не сбрасывается при отказе** — один неудачный старт отравляет кэш промиса на весь срок жизни процесса. Плюс `:327` глушит сетевой сбой года без лога, делая его неотличимым от «данных за год нет».
- **Сценарий вреда:** Meteostat недоступен или тормозит → расчёт висит минутами. На Render free с одним инстансом это **выедает воркер и вешает сервис для всех**. После первого сбоя загрузки станций каждый последующий расчёт падает на переиспользованном отклонённом промисе — «сломалось один раз, сломано до перезапуска», а перезапуск на free происходит сам собой, что маскирует причину.
- **Стоимость починки:** **3–4 часа:** один общий `AbortSignal.timeout(...)` на всю операцию климата (например 30 с); сброс `stationsLiteCachePromise = null` в обработчике отказа; лог в `catch` на `:327`.
- **Если не чинить никогда:** случайные многоминутные зависания расчёта, которые невозможно диагностировать по логам, и самоотравляющийся кэш.
- **Риск самой починки:** низкий; надо аккуратно выбрать общий таймаут, чтобы не отсекать легитимные долгие ответы.

### [A3-10] Устаревшие справочники используются бессрочно и молча
- **Ось:** A3 | **Категория:** БЛОКЕР-B
- **Якорь:** `backend/src/reference/configCache.js:144-152`
- **Что не так:** при неудачном обновлении справочников возвращается закэшированный набор (`return cachedBundle;`) с логом `referenceCache.refresh.failed` и `stale: true`. **TTL на устаревание нет.** Долгая недоступность Mongo означает, что расчёты бессрочно идут на последнем удачном каталоге.
- **Сценарий вреда:** владелец обновляет цены в каталоге; Mongo в этот момент недоступен для инстанса; сервис продолжает **месяцами** считать сметы по старым ценам, отвечая 200 без единого признака в отчёте. Для сценария «комиссия ~4 % с дилерской сметы» это прямые деньги.
- **Стоимость починки:** **2–3 часа:** предельный возраст `cachedBundle` (например 6 часов), после которого — деградация с флагом (см. A3-05) или 503; отдавать возраст снимка в `report.meta` (поле `referenceBundleLoadedAt` уже есть — `buildReport.js:744-746`, надо использовать как признак).
- **Если не чинить никогда:** тихий расчёт по устаревшим ценам — самый дорогой из тихих отказов.
- **Риск самой починки:** при слишком коротком TTL сервис станет отказывать там, где раньше работал. Начинать с флага, а не с отказа.

### [A3-11] Координаты объекта пользователя пишутся в логи на уровне info
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/climate/snipClimate.js:274, :278`; `backend/src/climate/geocode.js:100`
- **Что не так:** точные `lat`/`lon` дома в логах при дефолтном `LOG_LEVEL=info`. При этом **адрес защищён сознательно** — `geocode.js:45` пишет `{ hasAddress: true }`, `buildReport.js:230` — `{ hasLocation: true }`. То есть менее точный идентификатор закрыт, а более точный открыт.
- **Сценарий вреда:** логи Render доступны всем, у кого есть доступ к дашборду; репозиторий публичный. Координаты + время дают привязку конкретного клиента к конкретному дому.
- **Стоимость починки:** **15 минут** — округлить до 1–2 знаков или заменить на `stationId`.
- **Если не чинить никогда:** мелкая, но настоящая утечка ПД, неприятная при первом же разговоре о приватности с B2B-заказчиком.
- **Риск самой починки:** нулевой; при отладке климата округлённых координат достаточно.

### [A3-12] По анонимному расчёту инцидент разобрать невозможно
- **Ось:** A3 | **Категория:** БЛОКЕР-B
- **Якорь:** `backend/src/api/routes.js:199` (`logger.debug`, подавлен при `info`), `:200` (вход отбрасывается), `:200-202` (отчёт не сохраняется); `backend/src/index.js:99-100, :242-250` (requestId клиенту не отдаётся); `backend/src/report/buildReport.js:224` и др. (доменные логи с `meta = null`, без requestId)
- **Что не так:** для публичного `POST /api/v1/calc` **ни вход, ни отчёт не сохраняются**, вход логируется на `debug` (выключен), а доменные логи идут без requestId и не сшиваются с запросом при конкурентности. `report.meta` (`buildReport.js:735-753`) содержит `schemaVersion: 1` — литерал, никогда не повышавшийся — и не содержит ни ревизии каталога, ни версии приложения, ни git sha (`grep` по `APP_VERSION|GIT_SHA|COMMIT_SHA|RENDER_GIT` — 0). Логи — только stdout (`logger.js:67-70`, `backend/Dockerfile:29`), без агрегации; retention — **НЕ ПРОВЕРЕНО** (нигде не описан; фактически дефолт Render, теряется при передеплое).
- **Сценарий вреда:** ровно вопрос из задания. Клиент пишет «смета неправильная, вчера в 15:40». По анонимному расчёту у владельца есть две строки — `api.request` и `api.response` (метод, путь, статус, длительность) — и координаты дома. **Ни комнат, ни площадей, ни цен, ни котла.** Ответить нечего. Для авторизованного расчёта внутри проекта — наоборот, всё есть: `calcInput` и `report` целиком лежат в Mongo (`backend/src/models/Calculation.js:38-39`) с `createdAt` (`:42`), расчёт воспроизводится точно.
- **Стоимость починки:** **1–1.5 дня.** (1) сохранять анонимные `calcInput` + хэш отчёта (или явно объявить, что разбор по ним невозможен); (2) отдавать `X-Request-Id` в ответе и в `ErrorEnvelope`, чтобы пользователь мог его назвать; (3) прокинуть `requestId` в доменные логи вместо `null`; (4) штамповать git sha и ревизию каталога в `report.meta`.
- **Если не чинить никогда:** каждая жалоба на неверную смету по публичной форме — слово против слова. Для вехи B (брать деньги) это несовместимо с претензионной работой.
- **Риск самой починки:** сохранение анонимных входов создаёт хранилище ПД (адрес объекта) — нужен срок хранения. Пункты (2)–(4) безопасны полностью.

### [A3-13] Пользовательские сообщения по-русски, а языковой гейт их не видит
- **Ось:** A3 | **Категория:** ДОЛГ
- **Якорь:** `backend/src/feedback/adminFeedback.js:64,112,119,125,131,137,157,166,199`; `backend/src/api/adminFeedbackRoutes.js:179,191,203`; `backend/src/logic/warmFloorCalc.js:67`; `backend/src/logic/normalizeHeatingUfhPreset.js:25`; `backend/src/matching/radiatorSizingHelpers.js:211-213`; `backend/src/hydraulics/pickPump.js:206`; `frontend/src/hooks/useCalcReport.ts:89,:98`; `frontend/src/data/fallbackUnderfloorHeatingPresets.ts:24,28,32,36`; `frontend/src/utils/parsers/parseHydraulicsProposalFromReport.ts:63`; гейт — `scripts/verifyLanguagePolicy.mjs:82-88, :108-112, :164-166`
- **Что не так:** ~24 русские пользовательские строки при политике «100 % украинский» (`docs/language-policy.md` §1, §9). Проверено, что они доходят до клиента: `backend/src/index.js:186-188, :243` отдают `err.message` дословно для **любого статуса кроме 500**, а `warmFloorCalc.js:70-72` выставляет **400**. Гейт при этом даёт `verifyLanguagePolicy: OK` (запущено), потому что его детектор — 6 захардкоженных регулярок, 5 из которых дословные строки из прошлых багов; `:108` выключает проверку **на всех строках, создающих ошибку**; `:110` **поимённо прощает** `Неизвестный ufhPresetId` — ту самую строку, что уходит с 400. Плюс гейт всё равно не запускается (обрыв корневой цепочки, M2; в CI — только `verifyNoTypeBypass.mjs`).
- **Сценарий вреда:** украинский монтажник видит в интерфейсе русские сообщения об ошибках и русские подписи ТП. Для веха A (живые монтажники) это прямой репутационный удар — и ровно то, что политика была призвана предотвратить.
- **Стоимость починки:** **4–6 часов:** перевести 24 строки (модуль `feedback` — основная масса) + заменить детектор на обобщённый (маркерные буквы `ы э ъ ё` в строковых литералах вне комментариев) с явным белым списком значений enum. Оценка объёма для нового детектора уже есть: RU-маркерных литералов — 99 в `backend/src`, 10 во `frontend/src`, 0 в `shared`.
- **Если не чинить никогда:** политика остаётся декларацией, а число русских сообщений растёт.
- **Риск самой починки:** **реальный и требует аккуратности.** Нельзя трогать значения enum и подстроки-матчеры (`'наружная стена'`, `'котельная'`, `'кровл'`, `'Электричество'` — `backend/src/logic/roomExteriorLayoutHeatLoss.js:9`, `shared/roomTypeNormalization.js:16,39-41`, `frontend/src/utils/envelopePresetKind.ts:40-43`, `backend/src/catalog/validateCatalog.js:263`): это **данные**, их перевод сломает сопоставление. Политика их и освобождает (§3).

### [A3-14] Смешение русского и украинского в комментариях
- **Ось:** A3 | **Категория:** КОСМЕТИКА
- **Якорь:** измерено — 683 файла из 701 содержат кириллицу; 304 только русские, 89 только украинские, **190 содержат оба языка**; в `backend/src` комментарии — 1 518 из 2 574 кириллических строк (59 %)
- **Что не так:** формально — незавершённая миграция RU→UA. Фактически — ничего.
- **Стоимость починки:** недели механической работы.
- **Решение: НЕ ДЕЛАТЬ.** Компилятор язык комментариев не читает, `docs/language-policy.md` §3 их прямо освобождает, автор понимает оба языка. Приводить к одному — только по мере касания файлов, никогда кампанией. **Записать и забыть.**
- **Риск самой починки:** правка JSDoc массовой заменой может задеть типы (`checkJs`) — то есть у этой «косметики» риск выше выгоды.

### [A3-15] Prettier настроен и никогда не запускается — 70 % дерева нарушает собственный конфиг
- **Ось:** A3 | **Категория:** КОСМЕТИКА
- **Якорь:** `.prettierrc` (корень); `prettier` отсутствует во всех 5 `package.json` (проверено grep'ом — 0 совпадений); husky/lint-staged нет; `.github/workflows/verify.yml` его не запускает
- **Что не так:** проверено запуском в режиме проверки: `backend/src` — **152 файла из 212 (72 %)**, `frontend/src` — **202 из 291 (69 %)**, всего **354 из 503 (70 %)** были бы переформатированы.
- **Стоимость починки:** 30 минут на прогон.
- **Решение: НЕ ДЕЛАТЬ СЕЙЧАС.** `prettier --write` на 354 файла переформатирует ровно те файлы ядра, для которых ещё нет тестов, и сделает `git diff`/`git blame` по ним нечитаемыми — а история и так плохая (61 % коммитов «add changed <файл>», M2). Правильный момент — **вместе с появлением golden-снапшотов (D2, слой В)**, отдельным коммитом, который больше ничего не содержит. Либо просто удалить `.prettierrc`, чтобы он не изображал гейт.
- **Риск самой починки:** потеря читаемости истории по ядру именно тогда, когда она нужнее всего.

---

## 8. НЕ ТРОГАТЬ

Это такой же результат, как список проблем. Каждый пункт выглядит как дефект, но чинить его сейчас — вред.

1. **`RoomAccordionItem.tsx` — 907 строк, cx=70.** Самая большая функция проекта. Замерено: **0 хуков**, `return (` на `:269`, то есть **729 из 908 строк — сплошной JSX**, в нём всего 2 `if` и 34 тернарника условного рендера. Это плоская разметка длинной формы. Состояния нет, эффектов нет, ошибка громкая (поле не отрисовалось), а не тихая. Разрезание — чистый риск без выгоды.
2. **`AppSurveyContent.tsx` — 622 строки, fan-out 34.** 11 `if`, 18 тернарников — линейная композиция секций анкеты. Высокий fan-out здесь **правильный**: это composition root экрана, он и должен знать про свои части.
3. **`buildReport` — cx=256.** Первое место в рейтинге сложности и при этом **не опасная функция**: 19 `if`, 0 циклов на 507 строк. Цикломатику создают 126 `?.` + 70 `??` + 89 тернарников — защитный код, а не логика. **Резать нельзя**: значительная часть этой защиты исчезнет сама после починки A3-01. Сначала типы, потом смотреть заново.
4. **`validateCatalog.js` — 1 568 строк.** Последовательность независимых валидаторов по категориям оборудования. Длина — свойство предметной области (126 SKU, 7 категорий). Два самодубля внутри файла (M1 §3, группа 3) тоже не трогать: они в разных валидаторах и разъедутся при первом изменении требований.
5. **Сам механизм soft-fail.** Валить весь расчёт из-за одного модуля хуже, чем деградировать. Автор сделал это сознательно (комментарий `buildReport.js:517`), с логом и с `unavailableReason`. Чинить надо **не механизм, а отсутствие флага** (A3-05).
6. **39 из 61 `catch`, которые преобразуют или пробрасывают ошибку корректно** — в том числе 26 route-хендлеров с `next(err)`. Это хорошая часть, её не переписывать.
7. **`process.on('unhandledRejection')` без `process.exit`** (`backend/src/index.js:33`, комментарий `:32`). Для одиночного инстанса на Render free падать по фоновому rejection хуже, чем логировать. Осознанное решение, оставить.
8. **`snake_case` в ключах данных** (`water_norms`, `indirect_wall`, `wall_gas_concrete_d500`). Это имена коллекций и id каталога, конвенция последовательная и освобождённая политикой §3. Переименование сломает данные.
9. **Русские `throw new Error` во внутренних валидаторах** (~85 строк, в основном `validateCatalog.js`). Они превращаются в замаскированные 500 (`index.js:229-231`) и до пользователя не доходят — это dev-facing тексты. В отличие от A3-13, переводить их не нужно.
10. **CSS-дубляж 11.34 %** (M1 §3, группа 1) — семь почти одинаковых `*ReportDialog.module.css`. Не моя ось, но подтверждаю с точки зрения сопровождения: цена ошибки в CSS минимальна и видна глазом, а выделение общего диалога затронет 7 работающих экранов.

---

## 9. СИЛЬНЫЕ СТОРОНЫ

Здесь их действительно много, и это важный сигнал: типичные «грехи вайб-кодинга» отсутствуют,
причём отсутствуют **проверяемо**, а не на слово.

1. **Запрет `any` соблюдается буквально.** Я искал обход **десятью** способами — `{*}`, `{any[]}`, `Record<string, any>`, `Object`/`{}`/`Function` как тип, `as unknown as`, `@ts-expect-error`, `@ts-nocheck`, implicit any, `exclude` в tsconfig, `eslint-disable` — и **не нашёл ни одного**. Все счётчики нулевые (§1.1). Для проекта, написанного одним человеком за два месяца, это исключительно.
2. **Типовое покрытие frontend — 99.30 %** (266 `any` на 37 764 выражения), измерено Compiler API. Это уровень, которого не достигает большинство коммерческих TS-команд.
3. **Строгость конфигов выше рынка.** `tsconfig.strict-base.json:2-14` включает `noUncheckedIndexedAccess` и `exactOptionalPropertyTypes` — два флага, которые обычно отключают первыми из-за шума. Здесь они включены, и код под ними компилируется чисто.
4. **`eslint-disable` во всём продуктовом коде — ровно 2 штуки**, обе с объяснением на той же строке (`frontend/src/components/RoomsForm/RoomsForm.tsx:65`, `frontend/src/hooks/useRoomsOrchestration.ts:57`).
5. **Конверт ошибок выдержан без единого исключения.** Сырых `res.status(4xx/5xx).json(...)` в обход `sendErrorEnvelope` в `backend/src/api/**` — **ноль**. 44 места используют конверт, 26 хендлеров делают `next(err)`, глобальный обработчик на месте (`backend/src/index.js:173, :255`). Это редкая дисциплина на 36 маршрутов.
6. **39 из 61 `catch` обрабатывают ошибку правильно** — с преобразованием в `AppError` и осмысленным кодом (`GEOCODE_TIMEOUT`, `MONGODB_UNAVAILABLE`, `PDF_RENDER_TIMEOUT`, `CALC_INPUT_TOO_LARGE`).
7. **Гигиена персональных данных продумана и реализована.** Есть специальный модуль безопасных срезов `backend/src/projects/projectChangeMeta.js:32-113`, и он используется: логируются `{present, bytes, roomsCount}` вместо survey, **имена** изменённых полей вместо значений, `hasEmail: Boolean(...)` вместо адреса (`backend/src/api/feedbackRoutes.js:52`). Ни один из 114 вызовов логгера не пишет email, телефон, имя клиента, тело запроса или JWT. Единственная дыра — координаты (A3-11), и она узкая.
8. **Ни одного `console.*` в прикладном коде** — все 4 вызова внутри самого логгера (`backend/src/utils/logger.js:67-70`). Логгер самописный, но грамотный: уровни, `LOG_LEVEL`, ISO-timestamp, поддержка requestId.
9. **Именование безупречно.** 0 кириллических идентификаторов, 0 транслитераций, 0 `snake_case` в объявлениях — и в `backend/src`, и во `frontend/src`. Смешение языков целиком в прозе, **никогда в структуре кода**.
10. **Приложение честно работает без Mongo.** Справочники падают на файлы (`loadCatalog.js:363`, `loadReferenceCollection.js:68`), прогрев кэша не блокирует старт (`index.js:161`), `POST /api/v1/calc` функционирует полностью, а защищённые маршруты дают корректный 503 `MONGODB_UNAVAILABLE` (`requireMongo.js:34`). Это осознанная и грамотная деградация.
11. **Таймауты на внешние вызовы есть везде**, с `AbortController` и `clearTimeout` в `finally`: Nominatim 8 с (`geocode.js:53-54, :85`), Meteostat 15 с и 8 с (`snipClimate.js:103-110, :128-136`), Mongo 8 с (`mongoConnectionConfig.js:14-15`). Пропущен только **общий** бюджет операции (A3-09) — то есть ошибка в деталях, а не в подходе.
12. **Форензика авторизованных расчётов сделана правильно.** `calcInput` и `report` целиком с `createdAt` и сводкой KPI (`backend/src/models/Calculation.js:11-23, :38-42`) — расчёт полугодовой давности воспроизводится точно, вместе с ценами. Многие зрелые продукты этого не умеют.
13. **База кода здоровая.** Медиана файла — 83 строки в `backend/src` и 65 во `frontend/src`; крупные модули — 25 штук на 587 файлов. Проблемы сложности **локализованы**, а не размазаны.
14. **Гейты, которые реально запускаются, — зелёные и быстрые.** `tsc` × 3 пакета, ESLint × 2, 50 backend verify-скриптов — всё OK за 14.8 с, и **это гоняется в CI** (`.github/workflows/verify.yml:39-41, :50-52`).
15. **QA-фундамент под будущий рефакторинг уже спроектирован.** `docs/qa/design/D2-engine-coverage.md` содержит готовый план на 831 автоматическую проверку ядра, включая поимённый список 96 кейсов на `boiler.js` (`D2:118-141`). Разрез сложных функций не надо проектировать с нуля — надо исполнить существующий план.

---

## 10. Порядок работ (по этой оси)

Отсортировано по отношению «выгода / риск», а не по важности.

| # | Что | Кат. | Часов | Зависит от |
|---|---|---|---|---|
| 1 | A3-11 округлить координаты в логах | ДОЛГ | 0.25 | — |
| 2 | A3-03 экспортировать тип схемы ГВС из `shared` | ДОЛГ | 0.5 | — |
| 3 | **A3-01 починить 26 спецификаторов + гейт на них** | **БЛОКЕР-B** | **4–6** | — |
| 4 | A3-04 бренд электробойлера | ДОЛГ | 1–2 | A3-01 |
| 5 | A3-09 общий таймаут Meteostat + сброс кэша | БЛОКЕР-A | 3–4 | — |
| 6 | **A3-05 флаг `degraded` в `CalcReport`** | **БЛОКЕР-A** | **4–6** | — |
| 7 | A3-10 TTL на устаревшие справочники | БЛОКЕР-B | 2–3 | A3-05 |
| 8 | A3-13 перевести 24 строки + обобщить детектор | ДОЛГ | 4–6 | — |
| 9 | A3-12 форензика анонимного расчёта | БЛОКЕР-B | 8–12 | — |
| 10 | A3-02 усилить гейт обходов типов | ДОЛГ | 3–4 | A3-01 |
| 11 | A3-07 храповик сложности в ESLint | ДОЛГ | 1–2 | — |
| 12 | A3-06 записать правило отказа в `docs/` | ДОЛГ | 2–3 | A3-05 |
| 13 | A3-08 разрез `pickBoiler` / `pickRadiators` | ДОЛГ | 3–5 **дней**/функция | **ТОЛЬКО после D2 слой В** |
| 14 | A3-14, A3-15 язык комментариев, prettier | КОСМЕТИКА | — | **не делать** |

Первые семь пунктов — **меньше трёх рабочих дней суммарно**, и они закрывают оба БЛОКЕРА-A,
два из трёх БЛОКЕРОВ-B и снимают главный риск тихой ошибки в смете.

**Единственная жёсткая зависимость: пункт 13 не начинать, пока нет golden-снапшотов
из `docs/qa/design/D2-engine-coverage.md:405-536`.** Рефакторинг расчётного ядра без тестов —
самый рискованный поступок, доступный в этом проекте.
