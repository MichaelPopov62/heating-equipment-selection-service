# D2 — Покрытие расчётного ядра

> Вход: `_CONTEXT.md`, `_ORCH-NOTES.md` (37 находок), `S1-risk-register.md` (210 записей),
> `R1-engine-inventory.md` (97 модулей, реестр порогов), `R5-domain-risk.md` (66 рисков + инварианты),
> `R6-fixtures-and-data.md` (FIX-01…FIX-13), `R4-test-infra-feasibility.md`.
> Все утверждения о коде — с якорем `file:line`. Что проверить не удалось — помечено «НЕ ПРОВЕРЕНО».
> Кода тестов здесь нет — только состав, приоритеты, допуски и один псевдокод-образец.

---

## Резюме

| Слой | Что это | Кейсов | Из них P0 | Чем меряется успех |
|---|---|---|---|---|
| **А — unit** | чистые функции по реестру порогов R1 | **648** | 274 | каждый порог реестра имеет ≥ 2 кейса и ≥ 1 числовой ассерт |
| **Б — property** | 57 свойств на генераторе `CalcInput` | **57 свойств** (33 активных гейта + 15 характеризационных + 9 новых) | 21 | 0 контрпримеров за 5 000 прогонов на фиксированном seed-наборе |
| **В — golden** | снапшоты отчёта по FIX-01…FIX-13 + FIX-09b | **14 объектов × 6 срезов = 84 снапшота** | 30 (5 smoke-объектов) | снапшот меняется только вместе с записью в `golden-changelog.md` |
| **Г — валидация экспертом** | ручной теплотехнический расчёт | **7 объектов × 6 величин = 42 сверки** | 42 | отклонение внутри коридора по каждой величине |

**Итого автоматических проверок расчётного ядра: 648 unit + 57 property + 84 golden + 42 экспертных = 831.**
Сегодня: 0 тестов, ~20 verify-скриптов косвенно трогают ядро, 4 модуля имеют настоящие числовые ассерты
(`unibox.js`, `manifold.js`, `buildFinancialBom.js`, `pickPump.js` — R1 §Резюме).

### Две поправки к входным данным (проверено при написании D2)

1. **В реестре порогов R1 фактически 193 строки, а не 173.** Строка «Итого: 173» (`R1:411`) не сходится
   с содержимым таблицы `R1:217-409` — там 193 записи с уникальными ID (`T-01…T-247` с разрывами).
   Разбивка по диапазонам: T-01…T-25 — 25, T-30…T-48 — 19, T-50…T-84 — 35, T-90…T-109 — 20,
   T-120…T-148 — 29, T-160…T-170 — 11, T-180…T-218 — 39, T-230…T-247 — 15. План строится на 193.
2. **В R5 фактически 48 физических инвариантов, а не 43**: A — 6 (`R5:650-670`), B — 8 (`:674-688`),
   C — 4 (`:692-704`), D — 6 (`:708-723`), E — 6 (`:727-738`), F — 10 (`:742-771`), G — 8 (`:775-800`).
   В property-набор взяты все 48 плюс 9 новых (INV-P1…P9, §2.4).

### Чем закрыты доменные P0

| Доменный P0 (S1) | Слой | Идентификатор кейса |
|---|---|---|
| RISK-CALC-01 вентиляция плоским `kVent` | **Г** (unit и golden бессильны, §4.5) | VAL-01…VAL-07, величина «теплопотери объекта» |
| RISK-CALC-02 внутренний санузел 0 Вт | А + Г | A1-17…A1-20, VAL-03 «теплопотери комнаты» |
| RISK-CALC-04 крыша одноэтажного дома не считается | А + Г | A1-31…A1-38 (T-09…T-12), VAL-01, VAL-02 |
| RISK-CALC-06 `outsideC > insideC` | А + Б | A10-05, INV-F7 |
| RISK-CALC-17 проточное ГВС ×2.5 | А + Г | A2-01…A2-14, VAL-03 «мощность котла» |
| RISK-CALC-18 нижняя планка ГВС 24 кВт | А + Г | A2-33…A2-36 (T-43), VAL-01, VAL-05 |
| RISK-MATCH-01 `requiredKw` = пик ГВС | А + В | A3-01…A3-12 (T-52), golden FIX-01/FIX-04 |
| RISK-MATCH-02 matching деградирует молча | **Б** | INV-P9 + INV-G1…G4 |
| RISK-MATCH-03 «запас за опаленням» | А | A3-40…A3-43 (T-63) |
| RISK-MATCH-04 `powerKw.min` не ограничивает | А + Б | A3-44…A3-47, INV-A4 |
| RISK-MATCH-05 `ufh_only` база = отдача ТП | А + Г | A11-09…A11-12 (T-245), VAL-05 |
| RISK-MATCH-06 сервис бракует собственные петли | **Б** | INV-P6 (структурная замена сломанного детектора N-16) |
| RISK-MATCH-14 каскад 2×24 на дом 9 кВт | В | golden FIX-02 |
| RISK-MATCH-20 выходов коллектора < контуров | А + Б | A7-14…A7-17, INV-G1 |
| RISK-MATCH-21 радиаторный коллектор без каскада | А | A7-22…A7-24 |
| RISK-MATCH-23 петля без терминала | А + Б | A7-28…A7-31, INV-G2 |
| RISK-HYDR-01 soft-fail гидравлики → 200 | А + Б | A11-13…A11-16 (T-247), INV-P9 |
| RISK-HYDR-09 `pex` + магистраль → нет трубы | А | A8-19…A8-22 (T-185) |
| RISK-MONEY-01 трубы `trunk`/`dhw` вне сметы | **Б** | INV-D6 |
| RISK-MONEY-02 труба без цены → 0 грн | **Б** | INV-E6 |
| RISK-SEC-01 лимит T поверхности через `rFinish` | А | A6-08…A6-13 (T-123, псевдокод §1.7) |
| RISK-INFRA-04 `fuzz-calc` не видит симптом | Б | INV-P5 + INV-P6 |

**Остаются без покрытия в D2** (передаются в другие документы или не автоматизируются):
RISK-CALC-03 (дефолт −5 °C — фронтовый, D3 E2E), RISK-UX-* целиком, RISK-PERF-05 (D4),
RISK-INFRA-02/11/13/19 (`data-testid`, DOM-маркеры — предусловие D3), RISK-SEC-02 (D5).
Прямо признаю: **RISK-CALC-01 нельзя закрыть ничем, кроме экспертного слоя Г** — обоснование в §4.5.

---

## 1. Слой А — unit

### 1.1 Правила слоя

1. Юнит вызывает **экспортированную функцию модуля напрямую**, без HTTP и без `buildReport`.
   Все модули `logic/`, `matching/`, `hydraulics/`, `dhw/waterCalc.js`, `report/buildFinancialBom.js`
   чисты (R1 §1, пометки `P`), поэтому это возможно без моков.
2. Модули с пометкой **M** (мутируют аргумент) получают дополнительный кейс «вход не изменён»:
   `roomExteriorLayoutHeatLoss.js:213-218`, `externalWallsValidate.js:44,54-55,83`,
   `heatingThermalRegimes.js:54,72-88,146-149`, `matching/index.js:174-177`,
   `resolveCirculationFlows.js:268-270`, `sizeForcedRoomEmitter.js:202-207`,
   `ufhLoopHydraulics.js:963-1001`, `enrichProposalBundlePrice.js`, `warmFloor.js`,
   `indirectWaterHeater.js` (`attachIndirectBoilerCoupling`), `indirectPriorityRoomHint.js`.
3. Модули с пометкой **IO** (`climate/*`, загрузчики справочников, `validatePipelineInput.js`)
   тестируются с подменой `globalThis.fetch` и с явным сбросом модульных кэшей
   (`stationsLiteCachePromise` — `snipClimate.js:20`; `validateFn` — `validatePipelineInput.js:16`;
   `cachedSchema` — `pipelineSchemaLoader.js:13`). Стратегия — R4 §Стратегия моков.
4. **Каждый порог реестра R1 обязан получить минимум 2 кейса** (по обе стороны) и **3 кейса**,
   если порог — сравнение с числом (ниже, ровно, выше). Для строгих неравенств `unibox.js:73-123`
   кейс «ровно на границе» обязателен: там 8 строгих сравнений, и R6 B-13 показывает,
   что при `area === 20.0` не подходит ни один унибокс.
5. **Каждый кейс сравнивается с числом или с идентификатором SKU**, а не с «поле присутствует».
   Это прямой ответ на «иллюзию покрытия» `verifyHydraulicsPipeline.js` (711 строк, 4 числовых
   сравнения — R1 §Сводка).
6. Каталог — только `CATALOG_SOURCE=file` + `CATALOG_FILE_PATH=backend/test_data.json.example`
   (R4 §5.1). Для чистых unit по подбору — синтетические мини-пулы из 3-5 SKU, чтобы кейс не
   ломался от правки каталога; кейсы «на реальном каталоге» отдельно помечены и вынесены в слой В.

### 1.2 Сводка по группам

| Гр. | Модули | Пороги R1 | Кейсов | P0 | Волна |
|---|---|---|---|---|---|
| **A1** | `logic/heatlossByRooms`, `envelopeHeatLoss`, `envelopePresets`, `orientationHeatLoss`, `roomExteriorLayoutHeatLoss`, `topBoundaryEnvelope`, `ventilationReserve`, `wallAssembly`, `externalWallsValidate`, `apartmentStackBoundaries`, `shared/roomDesignAirTemp` | T-01…T-25 (25) | **78** | 46 | 1 |
| **A2** | `logic/hotWater`, `dhw/waterCalc`, `utils/apartmentMatching`, `dhw/validateWaterNorms` | T-30…T-48 (19) | **62** | 40 | 1 |
| **A3** | `matching/boiler`, `utils/boilerMatchingByType`, `utils/boilerMountingConstraints`, `utils/apartmentCombiSerialBufferHint`, `report/automationHints`, `logic/heatingThermalRegimes`, `shared/heatingThermalRegime*` | T-50…T-77 (28) | **96** | 62 | 1 |
| **A4** | `matching/indirectWaterHeater`, `waterHeater`, `indirectPriorityRoomHint`, `internal/indirectCatalogHelpers`, `matching/index` (T-78) | T-78…T-84 (7) | **30** | 10 | 2 |
| **A5** | `matching/radiators`, `internal/pickRadiatorsCore`, `exploreRoomEmitterKind`, `decideObjectEmitterKind`, `sizeForcedRoomEmitter`, `resolveMicroLoadRadiatorStrategy`, `resolveMixedRadiatorRoomLoad`, `mixedRadiatorsUfhMode`, `summarizeRadiatorEmitters`, `radiatorSizingHelpers` | T-90…T-109 (20) | **58** | 12 | 2 |
| **A6** | `logic/ufhRoomHeatFlux`, `warmFloorCalc`, `ufhPipeEmbedment`, `ufhPipeSpacingResolve`, `ufhRequiredHeatFlux`, `ufhActiveFloorArea`, `ufhRoomCoverageCheck`, `ufhCircuitResolve`, `ufhMixingNode`, `ufhMixingNodeHydraulics`, `ufhDistributionResolve`, `ufhHydraulicsCircuit`, `ufhLoopGeometry`, `ufhLoopLength`, `ufhLoopHydraulics`, `matching/warmFloor`, `shared/ufh*` | T-120…T-148 (29) | **84** | 26 | 1 |
| **A7** | `matching/manifold`, `matching/unibox`, `internal/uniboxRoomAirPresets` | T-160…T-170 (11) | **34** | 14 | 2 |
| **A8** | 26 модулей `hydraulics/*` | T-180…T-218 (39) | **118** | 34 | 2 |
| **A9** | `report/buildFinancialBom`, `matching/enrichProposalBundlePrice` | T-230…T-236 (7) | **26** | 12 | 2 |
| **A10** | `climate/index`, `geocode`, `snipClimate` | T-240…T-243 (4) | **22** | 0 (P1) | 3 |
| **A11** | `report/buildReport` (ветвления), `matching/index` (оркестрация) | T-244…T-247 (4) | **24** | 14 | 1 |
| **A12** | `recommendations/recommendationResolver`, `dhw/validateAppliances`, `ufh/validateUnderfloorHeatingPresets`, `recommendations/validateRecommendations` | вне реестра | **16** | 4 | 3 |
| | | **193** | **648** | **274** | |

**Волна 1 (P0-минимум, 282 кейса)** — A1, A2, A3, A6, A11. Это ровно те пять групп, которые владеют
всеми доменными P0 из S1. Волна 2 — A4, A5, A7, A8, A9 (266). Волна 3 — A10, A12 (38) плюс добор
P1/P2-кейсов в волнах 1-2.

### 1.3 `matching/boiler.js` — 1164 строки, 28 порогов, ни один verify не импортирует

Приоритет №1 всего документа. R1 §3 прямо: «ни `requiredKw`, ни `selected.model`, ни `proposal*`
не ассертятся». R6 §2.1 показал прогоном, что `requiredKw` для дефолтной схемы **не зависит от
теплопотерь вообще** (9 кВт и 40 кВт → 85.26 кВт → один и тот же `Luna Duo-Tec E 40`).

| Кейсы | Функция / порог | Что ассертим | Кол-во |
|---|---|---|---|
| A3-01…A3-12 | `requiredKwFromHeatingAndDhw` T-52 (`boilerMatchingByType.js:28-39`) | все 3 ветки формулы × 4 комбинации (`heat` > `hw`, `heat` < `hw`, `hw = 0`, `heat = 0`) — числом | 12 |
| A3-13…A3-16 | запас T-50 ×1.15 (`boiler.js:462-471`), T-51 ×1.05 (`boilerMatchingByType.js:88-90`) | `heatingLoadKw` точно = `Q·1.15`; конденсационная линия = `Q·1.05` | 4 |
| A3-17…A3-22 | фильтр контуров T-58 (`boilerMatchingByType.js:71-81`) | какие SKU остаются в пуле для каждой из 5 схем + пустой пул | 6 |
| A3-23…A3-30 | монтаж T-56, T-57 (`boilerMountingConstraints.js:83-88,105-118`) | квартира: `floor` отсеян, `powerKw.max > 30` отсеян; дом: `boiler_room` + V ≥ 7.5 м³ + h ≥ 2.2 м — все 3 границы «ниже / ровно / выше» | 8 |
| A3-31…A3-34 | выбор одиночного T-62 (`boiler.js:536-540,707-708`) | «первый в пуле по `powerKw.max ↑` с `max ≥ required`» — на синтетическом пуле с двумя равными `max` (детектор отсутствия tie-break, `comparators.js:64-66`) | 4 |
| A3-35…A3-39 | каскад T-67 (`boiler.js:55-82`) | `count = ceil(required/max)`; выбор меньшего `count`, затем меньшего `totalNominalKw`; воспроизведение «дом 9 кВт → 2 × 24» (R6 B-03) | 5 |
| A3-40…A3-43 | **`nominalReservePercent` T-63** (`boiler.js:335-345`) | база `powerKw.min` против **отопления**, а не `max` против `requiredKw`; cap 150; воспроизведение U2 «+79 % при фактических +1263 %» (RISK-MATCH-03) | 4 |
| A3-44…A3-47 | **`powerKw.min` не ограничивает подбор** (`boiler.js:158-171`) | характеризация: котёл с `min` выше нагрузки проходит без warning (RISK-MATCH-04, INV-A4) | 4 |
| A3-48…A3-55 | fallback квартиры T-59, T-60, T-61 (`boiler.js:610-679`) | `WARN_APT_ELECTRIC_TO_COMBI_NO_SINGLE`; порог `singleCircuitOversizeRatio = 3` (2.99 / 3.0 / 3.01); молчаливый откат на весь пул | 8 |
| A3-56…A3-61 | `WARN_BOILER_UNDERPOWERED` vs мягкий текст T-66 (`boiler.js:865-888`) | для MAX_COMBI и COMBI_BUFFER — мягкий; для остальных — жёсткий код; дословный украинский текст | 6 |
| A3-62…A3-67 | линии economy / efficient T-68 (`boiler.js:920-936`) | economy — только неконденсационные; efficient — только конденсационные; `efficientCircuitMode`; поведение при пустой линии («немає традиційних котлів для лінії Економ», R6 §2.1) | 6 |
| A3-68…A3-71 | T-53 `forceSingleBoiler`, T-64 порог 50 кВт, T-65 `cascadeHintMinKw = 30`, T-55 `minSourcePowerKw` | границы «ниже / ровно / выше» | 8 |
| A3-72…A3-79 | T-69 `WARN_UFH_ONLY_TRADITIONAL_BOILER`, T-70…T-73 график | `isHighTemperatureHeatingGraph` на границах `ret = 54.9 / 55.0`, `supply = 64.9 / 65.0` (R1 отмечает пробел) | 8 |
| A3-80…A3-84 | T-74…T-77 `apartmentClassification`, `automationHints` | `largeAreaM2Min = 50`, `largeHeatingLoadKwMin = 15`, `peakThermalPowerKwMin = 18`, пороги 30/24/20 кВт | 5 |
| A3-85…A3-96 | пустой каталог, каталог из 1 SKU, SKU без `powerKw`, отрицательная мощность, `fuel` не читается (RISK-MATCH-36/N-36) | деградация вместо исключения; текст «Каталог котлів порожній» (`boiler.js:800`) | 12 |

### 1.4 `logic/hotWater.js` + `dhw/waterCalc.js` — ноль ассертов сегодня

R1 §3: «весь блок ГВС не проверен». Здесь же живут два P0 (RISK-CALC-17, RISK-CALC-18).

| Кейсы | Порог | Что ассертим | Кол-во |
|---|---|---|---|
| A2-01…A2-08 | T-30…T-34 клампы (`hotWater.js:46,49-59,63-68,70-75,83-89`) | `residents` 0/20/21; точка 0/30/31; `summer` 15 vs `winter` 5; `hotWaterC` 54/55/60/61; исключение `dishwasher`/`washingMachine` для квартиры | 8 |
| A2-09…A2-16 | **T-35 `simultaneityFactor`** (`waterCalc.js:133-145`) | `n = 0` → 1; `n = 1` → 1; формула `base × (1+min(pop,6)×0.035) × 1/(1+0.11·(n−1))`; clamp 0.2/1.0; `pop = 6` и `pop = 7` (насыщение); дом vs квартира (0.5 / 0.4) | 8 |
| A2-17…A2-20 | T-36 пик (`hotWater.js:109`) | `max(Σ×β, maxSingleFlowLps)` — обе ветви доминирования | 4 |
| A2-21…A2-24 | **T-37 + R5-dhw-01** (`hotWater.js:77,91-113,126-127,174-175`) | характеризация: квартира 3 жильца, душ+ванна → `hotWaterPowerKw ≈ 64.4 кВт` (эталон эксперта 18-30, §4). Отдельный кейс: `deltaTK = hot − cold = 55` при расходе смешанной воды | 4 |
| A2-25…A2-32 | T-38…T-42 объём бака (`waterCalc.js:31-40,64-96`; `hotWater.js:148-162`) | 45 л/чел; пол 135 л при ванне; сеанс (ванна +150, душей `min(shower, max(1,ceil(pop/2)))×50`, кухня `min(n,2)×15`, раковина `min(n,2)×12`, пол 35); `ceil(L/1.5)`; ×1.3 тропический; округление по ряду `[30…300]` и «иначе последний» | 8 |
| A2-33…A2-36 | **T-43 нижняя планка 24 кВт** (`hotWater.js:171-186`) | `hotWaterPowerKw = max(24, P_бак)`; бак 100 л / 30 мин → 12.8 кВт, а на выходе 24 (RISK-CALC-18); `residents: 0` → всё равно 24 (U3) | 4 |
| A2-37…A2-40 | R5-dhw-05 `tropicalShower` | `peakFlowLps` идентичен при `true` и `false` — характеризация дефекта | 4 |
| A2-41…A2-46 | T-44, T-45, T-48 override сценария (`buildReport.js:335-346,359-372,386-397`) | квартира + `SINGLE_INDIRECT_SUM` + `_apartmentIndirectDhwStorage`; квартира + `ELECTRIC_SEPARATE`; `SINGLE_BUFFER_ELECTRIC` | 6 |
| A2-47…A2-52 | T-46, T-47 (`apartmentMatching.js:118-164`) | 50 л/чел мин 50; буфер 25 л/чел мин 30 | 6 |
| A2-53…A2-58 | `tankFullHeatTimeMinutes` (`waterCalc.js:122-125`) | формула + **отдельный кейс-guard: функция не вызывается ни из одного модуля подбора** (R5 §НЕ ПРОВЕРЕНО п.2) — тест фиксирует мёртвый экспорт | 6 |
| A2-59…A2-62 | `validateWaterNorms` | отсутствующие/нулевые/отрицательные нормы → throw | 4 |

### 1.5 `logic/ventilationReserve.js` — 41 строка, главный доменный дефект

Модуль крошечный, но через него проходит **весь** расчёт (`heatlossByRooms.js:258`).

| Кейсы | Что ассертим | Кол-во |
|---|---|---|
| A1-01…A1-04 | `resolveKVent`: `natural` → 1.3, `recuperation` → 1.1, `undefined` → 1.3, мусор → 1.3 (`ventilationReserve.js:9,12,27-31`) | 4 |
| A1-05…A1-08 | `normalizeVentilationReserveMode`, `ventilationReserveModeLabel` — все значения | 4 |
| A1-09…A1-12 | **интеграционный ассерт на `heatlossByRooms`**: `designWatts / envelopeWatts` строго `1.3` при `heightM = 2.5` и при `heightM = 3.5`, при `areaM2 = 10` и `areaM2 = 40` — то есть **множитель не зависит от объёма** (RISK-CALC-01, `heatlossByRooms.js:258`) | 4 |
| A1-13…A1-14 | `heatLoss.rooms[i].ventilation.watts === 0` всегда (`heatlossByRooms.js:291`); `method === 'kVentPerRoom'` (`:290`) | 2 |

Эти 14 кейсов **не проверяют физику** — они фиксируют текущую модель, чтобы её нельзя было
поменять незаметно. Физику проверяет только слой Г (§4).

### 1.6 Остальные группы — что обязательно, а что не берём

**A1 (теплопотери, 78 кейсов).** Обязательны: T-09…T-12 границы комнаты (16 кейсов — RISK-CALC-04,
сегодня 0 ассертов), T-13 цепочка резолва U + `ENVELOPE_UVALUE_MISSING` (6), T-08
`ROOM_EXTERIOR_LAYOUT_WALLS` для всех трёх layout (6), T-02/T-03 все 8 румбов + проверка, что β
не применяется к `floor`/`ceiling` (10), T-04…T-07 угловая комната и коридорная стена (8),
T-17…T-21 `wallAssembly`/`externalWallsValidate` (12), T-22…T-24 границы квартиры (8),
T-25 санузел 24 °C (4), T-14…T-16 негативные ветки (8). Сюда же переносится содержимое
`verifyRoomExteriorLayoutHeatLoss.js` (120 строк, единственная числовая проверка поправок,
**не запускается вообще** — N-15).

**A6 (тёплый пол, 84 кейса).** Ядро — `ufhRoomHeatFlux.js` (§1.7). Плюс: T-120 R внедрения по трём
шагам + default (4), T-127 три статуса авто-шага + `none_sufficient` (8),
T-128 порог 0.95 (`ratio = 0.949 / 0.950 / 0.951`, 3), T-129 два статуса активной площади (4),
T-130…T-133 длина/площадь/Δt-хардкод 10 K против справочника (8),
T-134…T-137 смесительный узел и авто-схема с порогами 50 кВт и 7 комнат — «ниже / ровно / выше» (12),
T-138…T-141 warnings ТП с порогами 5 Вт/м², 200 мм, `+0.05` (10),
T-142…T-148 `ufhLoopHydraulics` — scoring частичных конфигураций (сегодня 0 ассертов, R1 §3),
границы v 0.2/0.7 и Δp 20 кПа, `resolutionStatus` во всех 4 значениях,
мёртвый экспорт `shouldTriggerUfhPipeResize` T-147 (18), прочее (17).

**A8 (гидравлика, 118 кейсов).** Здесь сегодня максимальная «иллюзия покрытия».
Обязательный минимум с числовыми эталонами: T-180 `G = Q/(c·Δt)` при c = 4180, ρ = 1000 (4);
T-182…T-184 λ Блазиуса, поправка `×(1+relRough×10)`, ν = 1.004e-6 — **по одному эталонному Δp
на участок, посчитанному вручную** (12); `resolveRoughnessMm` — все 30 материалов труб каталога,
включая кириллические `Металопластик`, `PE-XA EVOH`, `PP-R 100`, `PE- RT` (N-25: 27 из 30 уходят
в стальную ветку) (10); T-185…T-190 подбор трубы, guard Dвн, fallback largest/smallest, заужение
магистрали (16); T-191 микроветка на порогах 0.019 м³/ч и 150 Вт (6); T-194…T-198 ×2 на обратку,
`H = Δp/9.81`, балансировка, подъём H смесителем, `coarseRecommendedDn` на 4 порогах (16);
T-199…T-203 расходы по зонам, порог 5 %, `max(Q_heating, Q_dhw)`, запас 12 % (12);
T-204…T-209 подбор насоса: все 6 зон рабочей точки, «минимальный margin» среди подходящих,
исключение `circulation_hot_water`, ветка «настенный котёл → насос не подбирается вовсе»
(T-208, критична для сметы) (18); T-210…T-212 негативные ветки cross-validation — сегодня
**ни одного отрицательного кейса** (10); T-215…T-218 рёбра ГВС/БКН и топологии (14).

**A9 (смета, 26).** Переносим `verifyFinancialBom.js` один-в-один (там настоящие эталоны:
60000 → 24000 → 9000 → 93000) и добираем непроверенное: T-233 `manifolds.ok === false` →
коллекторы вне сметы, T-234 панель vs секция, T-232 встроенный насос, `qtyUnit: 'm'` для труб,
`kind: 'note'` без суммы.

**A10 (климат, 22).** Из UI недостижим (N-09), поэтому P1, волна 3. Но покрыть надо:
`Number('') === 0` (`snipClimate.js:248`) — стаб CSV `-20,-21,,,-22` → ожидание «окно отброшено»,
факт −12.6 °C; `minRollingAverage` (`:47-65`); склейка годов через `continue` (`:328-330`);
`values.length >= 5` как единственная проверка достаточности; отсутствие `try/catch` вокруг
`getDesignOutsideTempC` (`buildReport.js:229-237`) → 502 на весь расчёт; сброс
`stationsLiteCachePromise` между кейсами. **НЕ ПРОВЕРЕНО:** реальный формат bulk-CSV Meteostat
(R5 §НЕ ПРОВЕРЕНО п.1) — фикстура строится по коду парсера, а не по живому ответу; это надо
подтвердить одним ручным запросом перед реализацией.

**Что сознательно не берём в слой А.** Пересчёт мощности радиатора при ΔT (T-92, показатель 1.3) —
N-23 фиксирует «проверено и работает», погрешность ≤ 3 %; ограничиваемся переносом существующих
ассертов `verifyRadiatorSections.js` (3 секции при 75/65, 6 при 55/45) без расширения.
Бренд-скоринг T-94/T-95 — 4 кейса на синтетическом пуле (какой SKU победит), а не полная матрица:
это коммерчески чувствительно, но не физика.

### 1.7 Образец кейса (единственный псевдокод в документе)

Кейс A6-08, RISK-SEC-01 / N-22 — единственная находка о безопасности.

```
// backend/tests/unit/logic/ufhRoomHeatFlux.spec.ts
//
// Порог T-123 (R1). Код: ufhRoomHeatFlux.js:172
//   maxAllowableHeatFluxUpWm2 = max(0, (maxSurfaceT - insideC) / rFinish)
// Физически знаменатель обязан быть R_CONV_UP_M2KW = 0.1 (объявлена там же, :16,
// корректно используется в rUp на :158).

describe('computeUfhRoomHeatFlux — лимит температуры поверхности', () => {

  // A6-08 (характеризация текущего дефекта; падает, когда дефект починят)
  it.fails('плитка: лимит потока должен быть ~90 Вт/м², а не ~1170', () => {
    const r = computeUfhRoomHeatFlux({
      insideC: 20, maxSurfaceTempC: 29,
      finishMaterialId: 'tile_ceramic',   // rFinish ≈ 0.008
      circuitSupplyC: 45, circuitReturnC: 35,
      pipeSpacingMm: 150, bottomBoundary: 'heated',
    });
    expect(r.maxAllowableHeatFluxUpWm2).toBeCloseTo(90, 0);   // сейчас ≈ 1170
  });

  // A6-09 (замок текущего поведения; снимается вместе с фиксом)
  it('ЗАМОК: сегодня лимит считается через rFinish (дефект RISK-SEC-01)', () => {
    // ... тот же вход
    expect(r.maxAllowableHeatFluxUpWm2).toBeCloseTo(1170, -1);
    // допуск -1 => ±5, чтобы не ловить дрейф последнего знака
  });

  // A6-10 (отчётная температура поверхности, ufhRoomHeatFlux.js:179)
  it.fails('surfaceTempC при q=90 Вт/м² должна быть ~29 °C, а не 20.7', () => {
    expect(r.surfaceTempC).toBeCloseTo(29.0, 1);              // сейчас ≈ 20.7
  });

  // A6-11..A6-13: ПВХ/ламинат (maxT 27), санузел (insideC 24),
  //               граница min(пресет 29, паспорт финиша) — T-123 нижняя ветка
});
```

Пара «`it.fails` + ЗАМОК» — рабочая единица характеризации: первый тест зелёный, пока дефект жив,
и краснеет ровно в момент исправления (сигнал «обнови ЗАМОК и сними `it.fails`»); второй краснеет,
если поведение уехало **не** тем способом, каким мы ждём фикс. Так же оформляются все
характеризационные кейсы A2-21…A2-24, A2-37…A2-40, A3-40…A3-47.

---

## 2. Слой Б — property-based и инварианты

### 2.1 Генератор `CalcInput`

Развитие `backend/scripts/fuzz-calc.ts` (652 строки). **Переиспользуем как есть** (R1 §5):
`buildFacadeEnvelope:181`, `generateApartmentMixedInput:211`, `generateHouseInput:312`,
домены `FINISH_MATERIALS` / `ORIENTATIONS` / `PIPE_SPACINGS` / `HOUSE_BOILER_SCHEMES` /
`APARTMENT_ROOM_TYPES` / `HOUSE_ROOM_TYPES`, type-safe извлекатели `readUfhWarnings:449`,
`readHydraulicNotes:464`, `parseCalcErrorDetails:472`, `isRecord:444`, формат сводки
`printFuzzSummary:616`.

**Достраиваем шесть вещей** (все шесть — открытые пробелы из R1 §5):

| # | Чего не хватает | Решение |
|---|---|---|
| 1 | Seed-детерминизма (`Math.random` без seed, `fuzz-calc.ts:162-174`) | PRNG с seed из `--seed` / `FUZZ_SEED`; seed печатается в шапку и в каждый отчёт о падении. CI гоняет фиксированный набор из 20 seed'ов + 1 случайный (nightly) |
| 2 | Сохранения контрпримера | дамп входа и полного отчёта в `backend/tests/.artifacts/prop-fail-<inv>-<seed>-<i>.json`; путь печатается в консоль; в CI — `actions/upload-artifact` |
| 3 | Shrinking | `fast-check` даёт из коробки; собственные `fc.Arbitrary` строятся поверх существующих фабрик через `fc.gen()`-обёртку, чтобы не переписывать генераторы анкеты |
| 4 | Инвариантов вместо «не 500» | §2.2-2.4 — 57 свойств |
| 5 | Локального вызова без HTTP | прямой `buildReport({ input, ctx })` с `ctx = toCalcRuntimeContext(getReferenceBundle())`, `CATALOG_SOURCE=file`. Убирает зависимость от поднятого сервера, Mongo и rate-limit. HTTP-режим остаётся отдельной командой для API-контракта (D5) |
| 6 | Покрытия пространства входов | добираем 18 не генерируемых сегодня измерений: `ufh_only`, `radiators`, `apartmentStackPosition` кроме `middle_floor`, `boilerPlacementZone: 'boiler_room'`, `ventilationReserveMode: 'recuperation'`, `facadeSystem: 'sftk'/'ventilated'`, `radiatorWiringSystemType`, `radiatorEmitterPreference`, `radiatorConnection: 'bottom'`, `ufhTerminalControl: 'unibox'`, `furnitureOccupiedAreaM2`, `bathroomAirTempC`, `coldWaterDesignSeason: 'summer'`, `pipeMaterialPreference`, схемы `COMBI_BUFFER_ELECTRIC` и `SINGLE_BUFFER_ELECTRIC`, `residents: 0`, комнаты без окон |

**Отдельно — исправление N-16 (два бага фаззера, оба подтверждены при написании D2):**

- `fuzz-calc.ts:519-521` ищет в warnings русские `'низкая скорость'` / `'высокий риск'`,
  а текст пишется по-украински: `logic/ufhLoopHydraulics.js:539` —
  «Петля …: **низька швидкість** … — **високий ризик** завоздушування контуру.»
  Детектор не срабатывает никогда. **Замена — структурная, а не по тексту:** INV-P6 проверяет
  `room.loopHydraulicsResolutionStatus`, а не подстроки. Текстовые ассерты вообще запрещены
  в property-слое (дословные украинские тексты — только в unit и golden).
- `fuzz-calc.ts:606-608` — `process.exitCode = 1` только при `serverCrashed` или `rateLimited`;
  400 копится в `validationFailed` и прогон остаётся зелёным. Но генератор строит **заведомо
  валидные анкеты**, поэтому любой 400 здесь и есть главный симптом владельца. **INV-P5:
  любой не-200 — немедленный провал с дампом входа.**

### 2.2 Инварианты R5, взятые в набор (48)

Колонка «Режим»: **G** — активный гейт (сегодня должен быть зелёным); **X** — характеризация
(инвариант сегодня нарушается штатно; тест-`it.fails` + ЗАМОК, как в §1.7).

| ID | Формулировка (сокращённо) | Допуск | При нарушении | Режим | P |
|---|---|---|---|---|---|
| INV-A1 | `Σ deliverable ≥ 0.98 · heatLoss.totalWatts` | −2 % | дамп + тикет; блокирует релиз при исправлении R5-rad-04 | **X** | P0 |
| INV-A2 | по комнате `deliverable ≥ 0.95 · designWatts` | −5 % | дамп; перечень комнат-нарушителей в артефакте | **X** | P0 |
| INV-A3 | `totalNominalKw ≥ requiredKw` и `requiredKw ≥ Q_потерь + q↓` | 0 | fail | **X** (нарушается при `ufh_only`, `buildReport.js:404-410`) | P0 |
| INV-A4 | `boiler.powerKw.min ≤ Q_отопления`; `nominalReservePercent ≤ 20` | +20 % → warn | fail | **X** (RISK-MATCH-04) | P0 |
| INV-A5 | баланс q↑/q↓ по формуле модели | 1 Вт | fail | G | P1 |
| INV-A6 | `\|G − Q/(1.163·ΔT·1000)\| / G ≤ 0.02` для каждого потребителя | 2 % | fail | G | P0 |
| INV-B1 | `areaM2 ↑ ⇒ designWatts` не убывает | 0 | fail + оба входа в дамп | G | P0 |
| INV-B2 | `outsideC ↓ ⇒ totalWatts ↑` строго | 0 | fail | G | P0 |
| INV-B3 | `insulationThicknessMm ↑ ⇒ uValue` не растёт | 0 | fail | G | P1 |
| INV-B4 | площадь окна ↑ при `U_окна > U_стены` ⇒ `designWatts` не убывает | 0 | fail | G | P1 |
| INV-B5 | `insideC ↑ ⇒ totalWatts` не убывает и `adjustedWatts` не растёт | 0 | fail | G | P1 |
| INV-B6 | `residents ↑` / приборов ↑ ⇒ `peakFlowLps`, `hotWaterPowerKw`, `recommendedTankLiters` не убывают | 0 | fail | G | P0 |
| INV-B7 | `pipeSpacingMm ↓ ⇒ heatFluxUpWm2` и `pipeMetersPerSqM` не убывают | 0 | fail | G | P1 |
| INV-B8 | `circuitMeanC ↑ ⇒ surfaceTempC`, `heatFluxUpWm2` не убывают (до лимита) | 0 | fail | G | P1 |
| INV-C1 | все мощности/расходы/длины/площади/цены ≥ 0; `qty` целое при `qtyUnit: 'pcs'` | 0 | fail | G | P0 |
| INV-C2 | нет `NaN` / `Infinity` / неразрешённых `null` — рекурсивный обход отчёта | 0 | fail с JSON-path | G | P0 |
| INV-C3 | `0.08 ≤ uValue ≤ 6.0` для неисключённого элемента | — | fail | **X** (U = 0 у исключённых, `heatlossByRooms.js:156-165`) | P1 |
| INV-C4 | `areaM2 > 0`; Σ окон комнаты < Σ наружных стен комнаты | 0 | fail | G | P1 |
| INV-D1 | каждый подобранный SKU существует в каталоге | 0 | fail | G (для коллекторов — по `model + article`, `id` отсутствует) | P0 |
| INV-D2 | каждая строка сметы ссылается на SKU либо `kind: 'note'` | 0 | fail | G | P0 |
| INV-D3 | `id` уникален в `commercial.lines` | 0 | fail | **X** (R5-bom-08) | P1 |
| INV-D4 | `heatLoss.rooms[].id` ≡ `input.building.rooms[].id` (в обе стороны) | 0 | fail | G | P0 |
| INV-D5 | элемент принадлежит существующей комнате | 0 | fail | G | P1 |
| INV-D6 | Σ `lengthM` рёбер с `catalogPipeId` = Σ `qty` труб в смете | ±0.1 м | fail | **X** (RISK-MONEY-01: `trunk`/`dhw` выпадают) | P0 |
| INV-E1 | `grandTotal = equipment + labor + consumables` | 0.01 грн | fail | G | P0 |
| INV-E2 | `equipmentTotal = Σ lineTotal` по `kind: 'equipment'` | 0.01·N грн | fail | G | P0 |
| INV-E3 | `labor = round(equipment·0.40)`, `consumables = round(equipment·0.15)` | 0.01 грн | fail | G | P0 |
| INV-E4 | `lineTotal = round(unitPrice·qty)` построчно | 0.01 грн | fail | **X** (котёл при `unitsCount > 1`, трубы) | P1 |
| INV-E5 | `commercial.currency === 'UAH'` и совпадает с каталогом | 0 | fail | G | P1 |
| INV-E6 | нет `kind: 'equipment'` с `lineTotalUah == null` или `== 0` | 0 | fail | **X** (RISK-MONEY-02) | P0 |
| INV-F1 | `surfaceTempC ≤ 29` (жилые) / `≤ 33` (влажные) | ±0.5 K | fail | **X** (RISK-SEC-01) | P0 |
| INV-F2 | `heatFluxUpWm2 ≤ 8.92·(T_пов_max − insideC)^1.1` | +5 % | fail | **X** | P0 |
| INV-F3 | `0.25 ≤ v ≤ 1.2` магистраль, `≤ 0.8` ответвление, `≤ 0.5` петля ТП | нижняя — warn | warn + счётчик | **X** (`branchMin: 0`) | P1 |
| INV-F4 | `loopLengthM + 2·transit ≤ L_max(Ø)`; `Δp ≤ 20 кПа` | 0 | fail | **X** (транзит не входит, R5-ufh-05) | P1 |
| INV-F5 | радиаторный контур 2…25 K; контур ТП 5…10 K; `return < supply` | 0 | fail | G | P1 |
| INV-F6 | `circuitSupplyC ≤ 55` (≤ 45 для ламината/ПВХ); при `boilerSupply > circuitSupply` обязателен смеситель либо RTL на каждой петле | 0 | fail | G | P0 |
| INV-F7 | `−40 ≤ designOutsideTempC ≤ 0`; `deltaT ≥ 25 K` для отапливаемой комнаты | ±2 K от таблицы | fail | **X** (дефолт −5 °C даёт ΔT = 25 ровно; RISK-CALC-06 даёт отрицательный) | P0 |
| INV-F8 | `18 ≤ designAirTempC ≤ 26`; санузел ≥ 24 | 0 | fail | G | P1 |
| INV-F9 | `heatedAreaM2 ≥ 0.6·roomAreaM2` при ТП как основном источнике | — | warn | G | P2 |
| INV-F10 | `4 ≤ sections ≤ 24`, `unitsCount ≤ 4`, `400 ≤ panelLengthMm ≤ 3000`, ширина ≥ 0.7·окна | 0 | fail | **X** (правило 70 % уступает молча, R5-rad-06) | P1 |
| INV-G1 | `Σ outletsCount ≥ число петель этажа` | 0 | fail | **X** (RISK-MATCH-20) | P0 |
| INV-G2 | каждая петля имеет ровно одно терминальное устройство | 0 | fail | **X** (RISK-MATCH-23) | P0 |
| INV-G3 | `circuitsCount ≥ число насосных групп`; `maxPowerKw ≥ requiredKw` | 0 | fail | **X** (R5-manifold-05) | P1 |
| INV-G4 | `pumpHeadM(coeffs, Q) ≥ headRequiredM`; `qMin ≤ Q ≤ 0.85·qMax` | запас 10-30 % | fail | G | P0 |
| INV-G5 | `SINGLE_INDIRECT_SUM ⇒ isDoubleCircuit === false`; `MAX_COMBI ⇒ true` | 0 | fail | G | P1 |
| INV-G6 | `\|deltaTSystemK − (supplyC − returnC)\| ≤ 2 K` | 2 K | fail | **X** (RISK-HYDR / R5-hyd-01) | P1 |
| INV-G7 | `designAirTempC` совпадает во всех трёх модулях комнаты | 0.01 K | fail | G | P1 |
| INV-G8 | идемпотентность: два вызова — идентичный отчёт кроме `meta.*` | 0 | fail | G | P0 |

**Итого: 33 активных гейта (G) + 15 характеризационных (X).**
X-инварианты не блокируют CI сегодня, но каждый связан с тикетом; при исправлении дефекта режим
переключается на G одной строкой, и с этого момента регресс ловится автоматически.

### 2.3 Классы свойств и стоимость прогона

| Класс | Инварианты | Прогонов `buildReport` на один пример | Итераций в CI |
|---|---|---|---|
| Одиночный прогон | A3-A6, C1-C4, D1-D6, E1-E6, F1-F10, G1-G7, P5-P9 | 1 | 400 на PR / 5 000 nightly |
| Дифференциальный (монотонность) | B1-B8 | 2 (база + возмущение) | 200 на PR / 2 000 nightly |
| Идемпотентность / стабильность | G8, P1-P4 | 2 (второй на глубоко замороженной копии входа) | 100 на PR |
| Энергобаланс (характеризация) | A1, A2 | 1 | 200 nightly |

Бюджет времени на PR — не более 90 с (оценка по R4: `buildReport` без HTTP и без Mongo,
кэш справочников тёплый). **НЕ ПРОВЕРЕНО:** фактическая скорость одного `buildReport` — замер
невозможен без `node_modules`; если окажется > 100 мс, PR-набор урезается до 200/100/50 итераций,
а полный объём уходит в nightly.

### 2.4 Девять новых свойств (не из R5)

| ID | Формулировка | Допуск | При нарушении | P |
|---|---|---|---|---|
| **INV-P1** | детерминизм между процессами: тот же вход и тот же `catalogFingerprint` дают идентичный отчёт в двух отдельных процессах (кроме `meta.generatedAt`, `meta.referenceBundleLoadedAt`) | побайтово | fail + оба отчёта в дамп | P0 |
| **INV-P2** | `buildReport` не мутирует вход: `structuredClone(input)` до и после идентичны | побайтово | fail с путём изменённого поля | **P0** — сегодня нарушается: `buildReport.js:272-279` (`input.building.temps`), `:476`, `:492` |
| **INV-P3** | стабильность к перестановке каталога: `shuffle(catalog[kind], seed)` не меняет выбранный SKU | 0 | fail с обоими SKU | P1 — прямой детектор отсутствующего tie-break в `comparators.js:64-66`, `:75-77` |
| **INV-P4** | стабильность к перестановке комнат: перестановка `building.rooms[]` не меняет `totalWatts` и множество подобранных SKU | 0.01 Вт | fail | P1 |
| **INV-P5** | любой не-200 на сгенерированном валидном входе — провал прогона с дампом (замена `validationFailed`, `fuzz-calc.ts:606-608`) | 0 | fail | **P0** — главный симптом владельца |
| **INV-P6** | нет петли ТП с `loopHydraulicsResolutionStatus` вида `unresolved_*`, если отчёт при этом отдаёт смету (структурная замена сломанного детектора `fuzz-calc.ts:519-521`) | 0 | fail | **P0** — RISK-MATCH-06 |
| **INV-P7** | ни один пользовательский `warning` не содержит технической заглушки вида `[CODE] Текст … не знайдено` (`recommendationResolver.js:69`) | 0 | fail с кодом | P1 |
| **INV-P8** | при `hydraulics.unavailableReason != null` смета либо отсутствует, либо несёт явный флаг неполноты (`buildReport.js:650-681`) | 0 | fail | **P0** — RISK-HYDR-01 |
| **INV-P9** | matching никогда не возвращает «пустой успех»: при `ok: true` каждая обязательная позиция (котёл, трубы магистрали, насос, коллектор при наличии зоны) присутствует либо имеет заполненный `unavailableReason` | 0 | fail с перечнем | **P0** — RISK-MATCH-02 |

---

## 3. Слой В — золотые эталоны

### 3.1 Что снапшотить

Целиком отчёт снапшотить нельзя: он большой, в нём есть таймстемпы, и один сдвиг цены в каталоге
перекрашивает весь файл. Снапшот режется на **6 срезов**, каждый — отдельный файл, каждый со своей
политикой обновления:

| Срез | Содержимое | Владелец правки |
|---|---|---|
| **G-A физика** | `calculations.heatLoss`: `totalWatts`, `deltaT`, по каждой комнате — `envelopeWatts`, `designWatts`, `designAirTempC`, `kVent`, по каждому элементу — `kind`, `areaM2`, `uValue`, `deltaT`, `heatLossFactor`, `qWatts` | владелец-теплотехник |
| **G-B ГВС и ТП** | `calculations.hotWater` целиком; `calculations.underfloorHeating` по комнатам: `heatFluxUpWm2`, `heatFluxUpWatts`, `heatFluxDownWatts`, `surfaceTempC`, `pipeSpacingMm`, `loopsCount`, `perLoopLengthM`, `loopHydraulicsResolutionStatus`, `heatFluxCoverageStatus` | владелец-теплотехник |
| **G-C подбор** | `matching`: `boiler.requiredKw`, `selected.{model,powerKw}`, `proposal.powerRequirementBreakdown`, `nominalReservePercent`, `cascade`, `radiators.byRoom[].{radiatorModel,sections,unitsCount}`, `indirectWaterHeater.selected.model`, `waterHeater.selected.model`, `manifolds.*.selected.model`, `uniboxes.byLoop[].selected.id` | владелец-теплотехник |
| **G-D гидравлика** | `hydraulics.pipeLines[].{catalogPipeId,dnMm,lengthM}`, `pressure.{criticalPressureDropKPa,headRequiredM}`, `pumps[].{catalogId,dutyQ,dutyH,headMarginPercent,mode}` | QA + инженер |
| **G-E смета** | `commercial.lines[].{id,kind,categoryId,catalogId,qty,qtyUnit,unitPriceUah,lineTotalUah}`, `commercial.totals.*`, `currency` | QA (при неизменном fingerprint) |
| **G-F диагностика** | отсортированный список **кодов** `warnings`/`notes`/`recommendations` (`WARN_*`, `REC_*`) — **без текстов**; плюс `hydraulics.unavailableReason`, `manifolds.ok`, `skippedReason` | QA |

Тексты в снапшот не идут: они украинские и будут переписаны по F-11 (RISK-UX-15/RISK-INFRA-19 —
«план исправления проходимости сам по себе ломает текстовые ассерты»). Дословные тексты
проверяются точечно в unit-кейсах, где они и являются предметом проверки (A3-56…A3-61).

**Исключается из всех срезов:** `meta.generatedAt` (`buildReport.js:737`),
`meta.referenceBundleLoadedAt` (`:745-747`). Это единственные два источника недетерминизма в отчёте
(R4 §5.4: `Math.random`/`randomUUID` в `report`, `matching`, `hydraulics` — 0 совпадений).

### 3.2 Объекты

FIX-01…FIX-13 (R6 §3) + FIX-09b (комната ровно 20.0 м² — ни один унибокс не подходит, B-13) = **14**.
Smoke-набор P0: FIX-01, FIX-02, FIX-03, FIX-04, FIX-06 — гоняются на каждом PR (30 снапшотов).
Остальные 9 — nightly и перед релизом (54 снапшота).

**Климат в фикстурах задаётся только через `building.temps.outsideC`** (R6 §3): при `location`
без `outsideC` `buildReport.js:229` уходит в Nominatim и Meteostat через реальный `fetch`.
Ни одна golden-фикстура не содержит `location`.

Каждая фикстура — пара файлов:
`backend/tests/fixtures/golden/FIX-01/input.json` (только `CalcInput`, никаких обёрток) и
`backend/tests/fixtures/golden/FIX-01/meta.yaml` (зачем объект, какие ветки покрывает, ссылки на
пороги T-* и риски RISK-*). `meta.yaml` пишется один раз и живёт дольше снапшота.

### 3.3 Плавающая точка и порядок ключей

**Порядок ключей.** Перед сравнением отчёт прогоняется через канонический сериализатор:
рекурсивная сортировка ключей объектов по кодовым точкам, массивы — в исходном порядке (порядок
комнат и позиций сметы содержателен). Это снимает зависимость от порядка вставки V8 и от порядка
полей в `test_data.json` (R4 §5.3: порядок `Object.keys` из `JSON.parse` совпадает с файлом —
стабилен внутри источника, но между `file` и `mongo` различается).

**Числа.** Прямое сравнение `float` запрещено. Нормализатор округляет по типу величины **до**
записи в снапшот:

| Величина | Округление | Обоснование |
|---|---|---|
| мощность, Вт | 0.1 Вт | ниже — шум сложения по комнатам |
| мощность, кВт | 0.01 кВт | шаг каталожного ряда — 0.1 кВт |
| температура, °C | 0.01 K | `surfaceTempC` меняется на 8 K при дефекте RISK-SEC-01 — 0.01 более чем достаточно |
| U, Вт/(м²·K) | 0.0001 | пресеты заданы с 3-4 знаками |
| расход, м³/ч | 0.0001 | cross-validation в коде работает с 0.002 (`crossValidatePipelineInput.js:78-86`) |
| скорость, м/с | 0.001 | пороги 0.2 / 0.5 / 0.7 / 0.8 |
| давление, кПа; напор, м | 0.01 | порог 20 кПа, шаг насосов ~0.1 м |
| длина, м | 0.01 | смета в метрах |
| **деньги, грн** | **целые копейки: `Math.round(x·100)`**, сравнение целочисленное | `toBeCloseTo` на деньгах даёт ложно-зелёное; инварианты E1-E4 требуют 0.01 грн |
| проценты | 0.1 | `nominalReservePercent` округляется в коде (`boiler.js:338`) |

Нормализатор — часть тестовой обвязки, **прод-код не трогается**.

### 3.4 Версионирование по содержимому каталога (учёт N-29)

`schemaVersion` каталога игнорируется полностью (0 совпадений в `validateCatalog.js`),
`generatedAt` нигде не проверяется и переписывается при загрузке из Mongo (N-29). Значит на
декларируемую версию опираться нельзя — версионируем **по содержимому**.

В шапке каждого снапшот-файла — блок:

```
# fixture:            FIX-01
# slice:              G-C
# catalogFingerprint: sha256:8f3c…   (см. состав ниже)
# declaredSchemaVersion: 1
# declaredGeneratedAt:   2026-04-21
# appliancesFingerprint: sha256:11ad…
# acceptedBy:         M. Popov (теплотехник)
# acceptedAt:         2026-08-24
# changelog:          docs/qa/golden-changelog.md#2026-08-24-fix01-gc
```

`catalogFingerprint = sha256(канонический JSON от {test_data.json.example})`;
`appliancesFingerprint = sha256(канонический JSON от {appliances.json, water_norms.json,
underfloor_heating_presets.json, recommendations.json})`. «Канонический» — тот же сериализатор
из §3.3, поэтому переформатирование файла или перестановка ключей fingerprint не двигает,
а изменение хотя бы одной цифры — двигает.

Три отдельных guard-теста в слое А12:

- **A12-13:** `catalogFingerprint` из шапок всех снапшотов совпадает с фактическим. Расхождение —
  красный CI с текстом «каталог изменился, снапшоты требуют пересмотра», а не тихий дифф чисел.
- **A12-14:** `declaredSchemaVersion === 1` и `validateCatalog` **отвергает** `schemaVersion: 2`.
  Сегодня не отвергает — это `it.fails` + тикет по N-29.
- **A12-15:** `declaredGeneratedAt` присутствует и парсится; при загрузке из Mongo не теряется.
  Сегодня переписывается — характеризация.

### 3.5 Политика обновления снапшота

**Жёсткое правило: `vitest -u` в проекте нет.** В `package.json` нет скрипта с `--update`;
обновление возможно только через `npm run golden:accept -- --fixture FIX-01 --slice G-C
--reason "<текст>" --ticket "<id>"`, который отказывается работать без обоих аргументов и
дописывает запись в `docs/qa/golden-changelog.md`. Это делает «принял, не глядя» физически
неудобнее, чем «разобрался».

Классификация изменения снапшота — по двум признакам: изменился ли fingerprint и есть ли тикет.

| Fingerprint | Тикет на изменение поведения | Вердикт | Кто принимает |
|---|---|---|---|
| не изменился | нет | **баг**. Числа поехали без намеренной правки. Блокируем PR | никто; PR чинится |
| не изменился | есть, класса R5-*/RISK-* | **легитимная правка физики или подбора** | **владелец-теплотехник** для G-A, G-B, G-C; QA-лид для G-D; QA для G-E, G-F |
| изменился | есть тикет на данные | **правка каталога/справочника**. PR обязан содержать дифф каталога и объяснение, какие SKU и цены изменились | QA-лид + владелец, если сдвинулся выбор SKU (G-C) |
| изменился | нет | **несанкционированная правка данных**. Блокируем | никто |
| любой | правка структуры без движения чисел (переименование поля, порядок) | **косметика** — принимается, если числовой дифф пуст после нормализации | QA |

Дополнительные правила:

1. Изменения в **G-A** и **G-C** без подписи владельца-теплотехника не мержатся. Это ровно те два
   среза, где живут физика и деньги, и ровно те, где ошибка невидима (S1 §Резюме:
   «продукт не падает и почти всегда врёт»).
2. Любое изменение G-A обязано сопровождаться пересчётом слоя Г (§4): если поменялись
   теплопотери — эксперт подтверждает, что новое значение ближе к ручному расчёту, а не дальше.
   **Снапшот не является эталоном истины; эталон — слой Г.**
3. Снапшот, который меняется чаще двух раз за квартал без тикета на физику, объявляется
   нестабильным и разбирается отдельно (кандидат в property-инвариант вместо снапшота).
4. Артефакт при падении — не только дифф, но и полный «до/после» отчёт в
   `backend/tests/.artifacts/golden/<FIX>/<slice>-{expected,actual}.json`.

---

## 4. Валидационный набор против ручного расчёта эксперта

### 4.1 Зачем этот слой существует отдельно

Слои А, Б и В сравнивают продукт **сам с собой**:

- unit-кейс на T-01 ассертит `kVent = 1.3` — то есть закрепляет ровно тот дефект, который ищем;
- property INV-B2 («холоднее снаружи ⇒ больше потерь») выполняется и при модели `envelopeWatts ×
  1.3`, потому что монотонность у неверной модели тоже монотонна;
- golden FIX-01 честно запишет 242 Вт там, где физика даёт 1040 Вт (расчёт R5-heatloss-01),
  и будет годами зелёным.

Ни один из трёх слоёв **не содержит информации, которой нет в коде**. Систематическое занижение —
класс дефекта, который по определению не виден изнутри системы. Внешний оракул нужен ровно один:
**число, посчитанное человеком по нормативу, а не по коду.**

### 4.2 Что именно ловит слой Г и почему только он

| Дефект | Почему А не ловит | Почему Б не ловит | Почему В не ловит | Как ловит Г |
|---|---|---|---|---|
| **N-17 / RISK-CALC-01** вентиляция плоским `kVent` вместо `0.34·L·ΔT` | unit закрепляет 1.3 как «ожидаемое» | монотонность сохраняется | снапшот фиксирует заниженное число | VAL-01: эксперт даёт 1040 Вт для комнаты, продукт — 242 Вт, отклонение −77 % при коридоре ±10 % → красный |
| **N-09 / RISK-CALC-03** дефолт −5 °C вместо −19…−23 | температура — вход, а не логика | `outsideC` генерируется в валидном диапазоне | фикстуры задают `outsideC` явно и правильно | VAL-набор фиксирует **нормативную** t_н города; расхождение «что подставляет UI» ловит D3 E2E, а «что должно быть» — здесь |
| **N-12 / RISK-CALC-04** границы комнат по умолчанию | unit проверяет T-09…T-12 как написано | инвариантов на «крыша обязана считаться» нет | фикстуры авторства QA повторят те же дефолты | эксперт считает дом с крышей; продукт без неё; разрыв в теплопотерях объекта |
| Мультипликативное накопление трёх смещений (U2: 2.02 кВт на 158 м² вместо 5-6) | — | — | — | VAL-02 — ровно объект U2, ожидание эксперта 5.4 кВт, коридор ±10 % |

Отдельно важно: **слой Г — единственный, который будет краснеть до тех пор, пока дефекты не
починены.** Это осознанно. Он не входит в блокирующий PR-гейт до исправления физики; он входит
в **релизный** гейт и в отчёт владельцу. Формулировка гейта: «релиз с красным слоем Г допустим
только с явной подписью владельца о том, что расхождение известно и принято».

### 4.3 Состав набора — 7 объектов

Объекты выбраны так, чтобы каждое из трёх смещений было видно по отдельности и все вместе.

| ID | Объект | Почему в наборе | Связь с FIX |
|---|---|---|---|
| **VAL-01** | дом 120 м², 1 этаж, газобетон D500 375 + СФТК ППС 100, окна ПВХ 2-камерные, Киев `outsideC −22`, радиаторы 75/65, 2К проточное ГВС, 4 жильца | базовая линия. Одноэтажный дом с реальной крышей и полом — прямой удар по N-12; хорошо утеплённые стены — прямой удар по N-17 (чем лучше утепление, тем больше относительная ошибка вентиляции) | FIX-01 |
| **VAL-02** | дом 158 м², 1 этаж, `outsideC −19` — **объект живого прохода U2** | единственный объект с независимо наблюдённым результатом продукта (2.02 кВт). Эксперт даёт ожидание, разрыв документирован в U2 | — |
| **VAL-03** | квартира 65 м², средний этаж, `outsideC −22`, 2К проточное ГВС, 2 жильца, 1 санузел | мощность котла: продукт даёт `requiredKw = 41.38` (прогон R6), инженерный эталон 18-30 кВт (R5-dhw-01). Плюс внутренний санузел (RISK-CALC-02) | FIX-04 |
| **VAL-04** | квартира 145 м², последний этаж под чердаком, 2 санузла, `outsideC −24` | последний этаж → потолок в неотапливаемый чердак: проверка ΔT перекрытия (R5-heatloss-04, единственная ошибка «в плюс»). Ловит, что смещения не компенсируют друг друга | FIX-11 |
| **VAL-05** | дом 130 м², только ТП, `outsideC −22`, 1К + БКН, 3 жильца | RISK-MATCH-05: база котла = отдача ТП, а не теплопотери. Эксперт даёт мощность от теплопотерь + потери вниз; расхождение −38 % (R5-boiler-02) | FIX-06 |
| **VAL-06** | дом 380 м², 3 этажа, кирпич 510 **без утепления**, `outsideC −28` | верхний край. Неутеплённые стены — тот единственный случай, где `kVent = 1.3` случайно близок к правде; служит контролем: если и здесь расхождение велико, дело не только в вентиляции | FIX-07 |
| **VAL-07** | дом 45 м², 1 этаж, `outsideC −22`, без ГВС (`residents: 0`, `fixtures: {}`) | нижний край и чистая линия: `requiredKw` определяется **только** отоплением. Единственный объект, где мощность котла не искажена ГВС — контроль качества самой теплотехники | FIX-10 |

Каждый VAL-объект — тот же `input.json`, что и парная FIX-фикстура (кроме VAL-02, у которого пары
нет). Это принципиально: **золотой снапшот и экспертный эталон описывают один и тот же объект**,
поэтому расхождение между ними всегда читается как «модель против нормы», а не «разные объекты».

### 4.4 Величины и коридоры

Шесть величин на объект. Коридор задан от природы величины, а не «на глаз»:

| Величина | Поле отчёта | Коридор | Обоснование коридора |
|---|---|---|---|
| Теплопотери объекта, Вт | `calculations.heatLoss.totalWatts` | **±10 %** | разброс нормативных методик по ДБН В.2.6-31 в пределах 5-8 %; 10 % — верх допустимого для проектного расчёта |
| Теплопотери контрольной комнаты, Вт | `calculations.heatLoss.rooms[<id>].designWatts` | **±15 %** | на комнате доля вентиляции выше и чувствительнее к округлению площадей |
| Требуемая мощность котла, кВт | `matching.boiler.requiredKw` | **±15 %** | включает запас 1.15, который сам по себе — инженерное решение, а не физика |
| Номинал выбранного котла, кВт | `matching.boiler.selected.powerKw.max` | **соседний типоразмер ряда** | ряд дискретен; требовать точного совпадения бессмысленно, требовать «в пределах ±1 позиции ряда» — осмысленно |
| Расход теплоносителя котлового контура, м³/ч | `hydraulics.flows.boilerZone.designFlowM3PerHour` | **±5 %** | чистая арифметика `Q/(c·ΔT)`, спорить не о чем; расхождение > 5 % = ошибка в `c`, `ρ` или в ΔT |
| Рабочая точка насоса `Q` / `H`, м³/ч / м | `hydraulics.pumps[0].dutyQ` / `dutyH` | **Q ±5 %, H ±25 %** | `Q` — та же арифметика; `H` зависит от длин, фитингов и эмпирической поправки `λ·(1+relRough·10)` без источника (T-183, N-25) — узкий коридор дал бы шум, а не сигнал |

Итого **7 × 6 = 42 сверки**. Плюс по каждому объекту одна контрольная комната — эксперт сам
указывает, какую (обычно самую нагруженную).

### 4.5 Формат хранения — так, чтобы эксперт не программировал

Три файла на объект, и **эксперт правит ровно один из них, в обычном текстовом редакторе или Excel**.

```
backend/tests/validation/
  objects/
    VAL-01/
      input.json            # вход CalcInput — авторства QA, эксперт не трогает
      brief.md              # АВТОГЕНЕРИРУЕТСЯ из input.json (npm run val:brief)
  expert-reference.csv      # ← ЕДИНСТВЕННЫЙ файл, который правит эксперт
  README-эксперту.md        # инструкция на одну страницу
  field-map.yaml            # «величина» → JSON-path отчёта; правит QA, не эксперт
```

**`brief.md` — то, по чему эксперт считает.** Генерируется из `input.json` командой
`npm run val:brief`, чтобы эксперт никогда не читал JSON. Содержит: тип и этажность объекта,
таблицу комнат (название, тип, площадь, высота, границы сверху/снизу, ориентация), таблицу
ограждений (конструкция, площадь, U, толщина утеплителя), расчётные температуры, состав ГВС,
температурный график, схему подбора. То есть **исходные данные в том виде, в каком их получает
теплотехник от заказчика.** Ни одного идентификатора кода в `brief.md` нет.

**`expert-reference.csv`** — плоская таблица, одна строка = одна сверка. Колонки на русском,
значения — числа. Никакого JSON, никаких путей, никакого синтаксиса.

```csv
объект;величина;единица;значение_эксперта;допуск_проц;метод;источник_нормы;эксперт;дата;комментарий
VAL-01;Теплопотери объекта;Вт;10450;10;поэлементно Q=U*S*dT*k + вентиляция 0.34*L*dT, L по 3 м3/(ч*м2);ДБН В.2.6-31:2021 табл.1; ДБН В.2.5-67:2013 п.6;М. Попов;2026-08-24;крыша холодного чердака учтена, dT перекрытия 36 K при наружной -22
VAL-01;Теплопотери комнаты «Вітальня» (r1);Вт;;15;;;;;
VAL-01;Требуемая мощность котла;кВт;;15;;;;;
VAL-01;Номинал вибраного котла;кВт;;;;;;;
VAL-01;Расход теплоносителя котлового контура;м3/ч;;5;;;;;
VAL-01;Рабочая точка насоса — подача Q;м3/ч;;5;;;;;
VAL-01;Рабочая точка насоса — напор H;м;;25;;;;;
VAL-02;Теплопотери объекта;Вт;;10;;;;;
…
```

Заполнена одна строка — как образец для эксперта. Остальные строки раннер генерирует пустыми
(`npm run val:scaffold`), эксперт вписывает `значение_эксперта` и, при желании, правит `допуск_проц`.

Почему CSV, а не YAML: эксперт открывает его в Excel/LibreOffice двойным кликом, видит таблицу,
правит ячейку, сохраняет. YAML требует следить за отступами и кавычками — это уже программирование.
Разделитель `;`, кодировка UTF-8 с BOM (иначе Excel на Windows ломает кириллицу), десятичный
разделитель — точка (проверяется раннером, при запятой — понятная ошибка, а не тихое `NaN`).

**`field-map.yaml`** — мост между человеческим названием величины и полем отчёта. Правит QA:

```yaml
"Теплопотери объекта":
  path: calculations.heatLoss.totalWatts
  unit: Вт
"Теплопотери комнаты":                       # room-id берётся из скобок в названии величины
  path: calculations.heatLoss.rooms[$roomId].designWatts
  unit: Вт
"Требуемая мощность котла":
  path: matching.boiler.requiredKw
  unit: кВт
"Номинал вибраного котла":
  path: matching.boiler.selected.powerKw.max
  unit: кВт
  compare: ряд_каталога                      # «в пределах соседнего типоразмера»
"Расход теплоносителя котлового контура":
  path: hydraulics.flows.boilerZone.designFlowM3PerHour
  unit: м3/ч
"Рабочая точка насоса — подача Q":
  path: hydraulics.pumps[0].dutyQ
  unit: м3/ч
"Рабочая точка насоса — напор H":
  path: hydraulics.pumps[0].dutyH
  unit: м
```

Пустая ячейка `значение_эксперта` = сверка пропущена со статусом `PENDING` (не провал, но видна
в отчёте). Это позволяет эксперту заполнять набор постепенно, не ломая CI.

**Отчёт раннера** — таблица в консоли и Markdown-файл `docs/qa/validation-report.md`:

```
VAL-01  Теплопотери объекта              эксперт 10450 Вт   продукт 3820 Вт   -63.4%   [±10%]  FAIL
VAL-01  Теплопотери комнаты (r1)         эксперт  1040 Вт   продукт  242 Вт   -76.7%   [±15%]  FAIL
VAL-01  Требуемая мощность котла         эксперт    14 кВт  продукт 85.3 кВт  +509%    [±15%]  FAIL
VAL-01  Расход котлового контура         эксперт  0.62 м3/ч продукт 0.61      -1.6%    [±5%]   OK
…
Итого: 42 сверки, OK 11, FAIL 24, PENDING 7. Средний знак отклонения по теплопотерям: -58% (занижение).
```

Строка «средний знак отклонения» — главный индикатор для владельца: она в одно число сворачивает
то, ради чего слой существует.

**Что от эксперта требуется и чего не требуется.** Требуется: прочитать `brief.md`, посчитать
шесть чисел привычным способом (хоть в Excel, хоть на бумаге), вписать их в CSV и назвать метод
и норматив. Не требуется: открывать код, JSON, git, терминал. Приём файла — через любой канал;
QA кладёт его в репозиторий и запускает `npm run val`.

---

## 5. Миграция verify-скриптов (полная таблица)

### 5.1 Исходные числа (перепроверены при написании D2)

- `backend/scripts/`: **53** файла `verify*.{js,mjs}`; в цепочке `npm run verify`
  (`backend/package.json:13`) — **50** (пересчитано по строке скрипта);
- `frontend/scripts/`: **10**, все 10 в цепочке (`frontend/package.json`);
- `scripts/` (корень): **5** `verify*.mjs`, все 5 в корневой цепочке (`package.json`),
  но `.github/workflows/verify.yml` запускает **только `verifyNoTypeBypass.mjs`** — подтверждено
  чтением workflow: шаги «Type safety bypass gate», «Shared typecheck», «Backend verify»,
  «Frontend verify», и всё;
- **Итого 68 файлов, реально исполняется 61**, три мёртвых:
  `verifyRoomExteriorLayoutHeatLoss.js` (нет npm-записи вообще — подтверждено grep по
  `package.json`), `verify:projects-admin-access`, `verify:mongo-db`.

Честная оценка ценности (R1 §3, §Сводка): расчётное ядро реально защищают **4** модуля —
`unibox.js` (`verifyUniboxMatching.js`, 727 строк, ~40 ассертов), `manifold.js`
(`verifyManifoldMatching.js`, 611), `buildFinancialBom.js` (`verifyFinancialBom.js`, 402),
`pickPump.js` (`verifyPumpDuty.js` + `verifyFitPumpCurve.js` + `verifyBuiltinBoilerPump.js`).
`verifyHydraulicsPipeline.js` — 711 строк, из ~30 проверок **4** сравнивают с числом.
Все 10 frontend-скриптов — `readFileSync` + regex, кода не выполняют.

### 5.2 Backend — 53 скрипта

| # | Скрипт | Решение | Обоснование |
|---|---|---|---|
| 1 | `verifyCalcInputSchema.js` | перенести один-в-один | контракт AJV-схемы; дёшево, ценно, владелец — D5 |
| 2 | `verifyCalcInputValidation.js` | перенести один-в-один | + расширить негативами (`validate.js` фазы нормализации, N-02/N-03/N-08) в D5 |
| 3 | `verifySeedCatalog.js` | перенести один-в-один | становится guard целостности каталога; сюда же вешается `catalogFingerprint` (§3.4) |
| 4 | `verifyCatalogLanguage.js` | перенести один-в-один | языковой гейт данных; D5 |
| 5 | `verifyPipeCatalogValidation.js` | перенести один-в-один | 30 труб, реальные числа |
| 6 | `verifyUfhPresets.js` | перенести один-в-один | лучшее покрытие физики ТП сегодня (min(пресет, финиш) = 29/27, обрезка q↑); база группы A6 |
| 7 | `verifyRadiatorSections.js` | перенести один-в-один | настоящие числовые эталоны T-92 (3 секции при 75/65, 6 при 55/45); N-23 подтверждает корректность |
| 8 | `verifyRadiatorEmittersSummary.js` | перенести один-в-один | агрегаты и diff линий |
| 9 | `verifyRadiatorConnection.js` | перенести один-в-один | фильтр панелей по подводке |
| 10 | `verifyRadiatorEmitterKind.js` | перенести один-в-один | majority / tie-break / hard-lock |
| 11 | `verifyMixedRadiatorUfh.js` | перенести один-в-один | вычет отдачи ТП (T-103) |
| 12 | `verifyMicroLoadRadiator.js` | перенести один-в-один | skip / minimum_viable (T-102) |
| 13 | `verifyReferenceCacheInvalidate.js` | перенести один-в-один | становится частью тестового setup (R4 §5.2) |
| 14 | `verifyCalcRuntimeContext.js` | **поглотить property-тестом** | проверяет fail-fast без ctx, т.е. контракт вызова, а не результат; заменяется одним свойством «любой вызов `buildReport` без ctx бросает `CALC_RUNTIME_CONTEXT_REQUIRED`» |
| 15 | `verifyProjectCalcInput.js` | перенести один-в-один | D5 |
| 16 | `verifyProjectImport.js` | перенести один-в-один | D3 (загрузчик фикстур) |
| 17 | `verifyProjectsImportAdmin.js` | **удалить как дублирующий** | `readFileSync` роутов + поиск подстроки (R1 §Сводка п.4). Заменяется настоящим HTTP-тестом admin-доступа в D5 поверх JWKS-стаба (N-33). Держать оба — держать заведомо слабейший |
| 18 | `verifyDocumentSizeLimits.js` | перенести один-в-один | D5 |
| 19 | `verifyExtractCalculationSummary.js` | перенести один-в-один | сводка расчёта — предмет golden G-C |
| 20 | `verifyProjectsAuth.js` | перенести один-в-один | D5 |
| 21 | `verifyMigrateProjectOwnerIds.js` | **оставить как есть** | одноразовая миграция данных, не регресс-тест; переносить нечего |
| 22 | `verifyUserModel.js` | перенести один-в-один | D5 |
| 23 | `verifyAuthPipeline.js` | перенести один-в-один | D5, HS256-путь |
| 24 | `verifyPlatformAdminAllowlist.js` | перенести один-в-один | D5 |
| 25 | `verifyAuthMiddleware.js` | перенести один-в-один | D5 |
| 26 | `verifyAuthorizationPolicy.js` | перенести один-в-один | D5 |
| 27 | `verifyAuthorizationMiddleware.js` | перенести один-в-один | D5 |
| 28 | `verifyMeEndpoint.js` | перенести один-в-один | D5 |
| 29 | `verifyFeedback.mjs` | перенести один-в-один | D5 |
| 30 | `verifyAdminFeedback.mjs` | перенести один-в-один | D5 |
| 31 | `verifyProjectShare.js` | перенести один-в-один | D5 |
| 32 | `verifyProjectPdf.js` | **починить и включить в CI** | логика SKIP при `PDF_BROWSER_MISSING` верна, но `PDF_REQUIRE_BROWSER` в CI не выставлен → пропажа браузера проходит молча (R4 §6.3). Фикс: отдельный job `pdf` с `PDF_REQUIRE_BROWSER=1`, `PDF_MAX_CONCURRENT=1` |
| 33 | `verifyWaterHeaterFormUtils.js` | перенести один-в-один | контракт формы водонагревателя |
| 34 | `verifyWaterHeaterMatching.js` | перенести один-в-один | + добор: `need = 0`, fallback «максимально доступный» (R6 B-08, B-09) |
| 35 | `verifySurveyDraftMigration.js` | перенести один-в-один | D3 (черновик анкеты, N-07) |
| 36 | `verifyHydraulicsPipeline.js` | **поглотить property-тестом** | 711 строк, 4 числовых сравнения. Раскладывается ровно на три части: структурные проверки («поле не null», «Σ сходится», «Ø ≥ guard») → INV-A6/C1/C2/D6/G4; 6 фикстур → golden-объекты слоя В; 4 числа (`flowDeltaTK === 20`, `thermalRegime.deltaTK === 10`, Σ Q ± 0.002, trunk-рёбер = n−1) → unit A8. **Ничего не теряется, иллюзия покрытия исчезает** |
| 37 | `verifyPickPipe.js` | перенести один-в-один | + добор: `velocityLimitExceeded` → largest (T-188), ζ по ролям (T-189) |
| 38 | `verifyPipeCatalogPoolFilter.js` | перенести один-в-один | guard Dвн — прямо связан с RISK-HYDR-09 |
| 39 | `verifyCirculationFlows.js` | перенести один-в-один | + добор: порог 5 % (T-201), `max(Q_heating, Q_dhw)` (T-202), запас 12 % (T-200) |
| 40 | `verifyFlowDeltaTK.js` | перенести один-в-один | 32 строки, дёшево |
| 41 | `verifyBuiltinBoilerPump.js` | перенести один-в-один | 380 строк; ветка T-208 критична для сметы |
| 42 | `verifyFitPumpCurve.js` | перенести один-в-один | аппроксимация H(Q) по 3 точкам |
| 43 | `verifyPumpDuty.js` | перенести один-в-один | 284 строки, одно из 4 сильных мест |
| 44 | `verifyUfhLoopHydraulics.js` | перенести один-в-один | + добор: scoring T-143 (0 ассертов сегодня), все 4 `resolutionStatus`, границы v и Δp |
| 45 | `verifyUfhActiveArea.js` | перенести один-в-один | покрыт нормально (R1 §3) |
| 46 | `verifyRadiatorWiringGraph.js` | перенести один-в-один | 4 топологии, 167 строк |
| 47 | `verifyManifoldMatching.js` | перенести один-в-один | 611 строк, настоящий unit; ядро группы A7 |
| 48 | `verifyUniboxMatching.js` | перенести один-в-один | самый плотный тест репозитория (727 строк, ~40 ассертов); ядро A7 |
| 49 | `verifyRoomDesignAirTemp.js` | перенести один-в-один | 174 строки, покрыт хорошо |
| 50 | `verifyFinancialBom.js` | перенести один-в-один | 402 строки, настоящие эталоны денег; ядро A9 |
| 51 | `verifyProjectsAdminAccess.js` | **починить и включить в CI** | определён, но не в цепочке (N-15). Требует JWKS-стаба (N-33) — включается вместе с ним в D5 |
| 52 | `verifyMongoDatabase.mjs` | **починить и включить в CI** | определён, не в цепочке; единственная проверка справочников из Mongo. Включается в отдельный job с `mongodb-memory-server` (R4 §Стратегия БД) |
| 53 | `verifyRoomExteriorLayoutHeatLoss.js` | **починить и включить в CI**, затем перенести один-в-один | 120 строк, **нет npm-записи вообще** — единственная числовая проверка поправок теплопотерь не запускалась никогда. Сначала одна строка в `package.json` и в цепочку (стоимость — минуты, ценность — P0), потом переезд в A1 |

### 5.3 Frontend — 10 скриптов

Все 10 — `readFileSync` + regex по исходникам, кода не выполняют (R1 §3; RISK-INFRA-03 P0).
Решение по всем одинаковое и осознанное.

| # | Скрипт | Решение | Обоснование |
|---|---|---|---|
| 54 | `verifySurveySessionPipeline.mjs` | оставить как есть | это архитектурный линт (проверка структуры пайплайна сессии), а не тест. Как линт он полезен и дёшев |
| 55 | `verifyStartState.mjs` | оставить как есть | то же |
| 56 | `verifyFooterNav.mjs` | оставить как есть | то же |
| 57 | `verifyFrontendAuth.mjs` | оставить как есть | предмет получает реальное покрытие в D3 E2E; линт остаётся как быстрый гейт |
| 58 | `verifyFrontendMe.mjs` | оставить как есть | то же |
| 59 | `verifyAdminFeedback.mjs` | оставить как есть | то же |
| 60 | `verifyDevPanelAccess.mjs` | оставить как есть | то же |
| 61 | `verifyReportColocation.mjs` | оставить как есть | правило размещения файлов — по природе статический линт |
| 62 | `verifyTypesPlacement.mjs` | оставить как есть | то же |
| 63 | `verifySeoStatic.mjs` | оставить как есть | читает `dist/` после build; ближе к smoke сборки |

**Обязательное сопутствующее действие:** переименовать npm-скрипт `verify:*` → `lint:arch:*` и
вынести из цепочки `verify` в отдельную цепочку `lint:arch`. Пока они называются «verify»,
их 10 штук читаются в отчётах как 10 тестов фронтенда, которых нет. Это не косметика: RISK-INFRA-03
классифицирован как P0 именно из-за подменённого представления о покрытии.

### 5.4 Корень — 5 скриптов

| # | Скрипт | Решение | Обоснование |
|---|---|---|---|
| 64 | `verifyNoTypeBypass.mjs` | оставить как есть | единственный корневой, который CI реально гоняет; гейт `@ts-ignore`/`any` |
| 65 | `verifyAuthDocs.mjs` | **починить и включить в CI** | в корневой цепочке есть, в workflow нет (N-32) |
| 66 | `verifyDeployDocs.mjs` | **починить и включить в CI** | то же |
| 67 | `verifyBackendDocs.mjs` | **починить и включить в CI** | то же |
| 68 | `verifyLanguagePolicy.mjs` | **починить и включить в CI** | **приоритет над остальными тремя.** Отсутствие этого гейта — прямая причина русских вкраплений в украинском UI («Комната 1», «Без имени», «Точки водоразбора», «Магистраль»), которые независимо видели U1, U2 и U4 (N-32) |

Фикс для 65-68 — одна строка в `.github/workflows/verify.yml`: заменить шаг
`node scripts/verifyNoTypeBypass.mjs` на `npm run verify:type-bypass && npm run verify:auth-docs
&& npm run verify:deploy-docs && npm run verify:backend-docs && npm run verify:language-policy`,
после чего число реально исполняемых скриптов вырастает с 61 до 65 без единой правки прод-кода.

### 5.5 Итог миграции

| Решение | Кол-во | Из них backend / frontend / корень |
|---|---|---|
| перенести один-в-один | **45** | 45 / 0 / 0 |
| поглотить property-тестом | **2** | 2 / 0 / 0 |
| оставить как есть | **12** | 1 / 10 / 1 |
| удалить как дублирующий | **1** | 1 / 0 / 0 |
| починить и включить в CI | **8** | 4 / 0 / 4 |
| **Всего** | **68** | 53 / 10 / 5 |

Порядок работ: сначала пять дешёвых фиксов CI (§5.4 + №53) — они дают +5 исполняемых скриптов
за один PR и закрывают языковой гейт; затем перенос 45 (волнами, вместе с соответствующими
группами слоя А); поглощение №14 и №36 — только после того, как property-набор зелёный,
чтобы не остаться без покрытия в промежутке.

---

## 6. Целевые метрики покрытия

Покрытие по строкам — метрика необходимая, но недостаточная: `verifyHydraulicsPipeline.js`
исполняет весь гидравлический пайплайн (высокое line coverage) и при этом не сравнивает с числом
почти ничего. Поэтому целевые метрики двухслойные: **покрытие исполнения** + **покрытие решений
числом**. Третьим контуром — mutation score на самых денежных модулях.

### 6.1 Покрытие исполнения (c8 / istanbul через vitest)

| Слой | Lines | Branches | Почему такая цифра |
|---|---|---|---|
| `logic/` | **95 %** | **90 %** | база всего расчёта: ошибка здесь мультиплицируется в котёл, радиаторы, ТП, гидравлику и смету одновременно (R1 §4 п.3). 30 модулей, все чистые, 25 порогов — недостижимых веток почти нет. Оставшиеся 5 % — защитные `throw` на невозможных входах |
| `dhw/` | **95 %** | **90 %** | `waterCalc.js` — 7 формул, все входят в `requiredKw` котла через `max`/сумму; сегодня 0 ассертов (R1 §4 п.2). Модуль на 145 строк, покрыть его на 95 % стоит один день |
| `matching/boiler.js` + `utils/boiler*` | **95 %** | **90 %** | это продукт. 1164 строки, 28 порогов, ни один verify не импортирует. Пять стратегий молчаливой деградации (R6 §2.2) — каждая должна быть исполнена тестом, иначе «matching никогда не возвращает ошибку» останется непроверяемым |
| остальной `matching/` | **90 %** | **85 %** | здесь уже есть плотные тесты (`unibox`, `manifold`); 90 % — доведение до уровня лучших модулей, а не рывок. Ниже 85 % по ветвям нельзя: ветвлений эскалации multi-unit и fallback'ов больше, чем строк логики |
| `hydraulics/` | **85 %** | **80 %** | 26 модулей, 39 порогов, часть веток достижима только через редкие топологии (гидрострелка + БКН + микроколлектор одновременно). Требовать 95 % — заставить писать искусственные DTO вместо реальных сценариев. 85/80 достигается 6 golden-фикстурами + 118 unit-кейсами |
| `report/buildFinancialBom.js` | **95 %** | **90 %** | деньги клиента; уже покрыт на приличном уровне (`verifyFinancialBom.js`, 402 строки) |
| `report/buildReport.js` | **85 %** lines / **100 % soft-fail веток** | — | оркестратор с сетью и мутациями. Важно не общее число, а **обе ветки `catch`**: soft-fail гидравлики (`:650-681`, RISK-HYDR-01 P0) и soft-fail коллекторов (`:520-563`) обязаны быть исполнены явным тестом каждая |
| `climate/` | **80 %** | **70 %** | из UI недостижим (N-09) — бьёт только по API-потребителям, поэтому P1. Плюс формат bulk-CSV Meteostat НЕ ПРОВЕРЕН, часть веток парсера писать вслепую бессмысленно |
| `recommendations/`, валидаторы справочников | **90 %** | **80 %** | справочники меняются в Mongo без деплоя — это отдельный класс риска (R1 §Резюме); валидатор обязан ловить мусор до подбора |

Порог CI: падение покрытия любого слоя более чем на 1 п.п. относительно `main` — красный.
Абсолютные цифры включаются как гейт **по слоям поэтапно**, вместе с завершением соответствующей
волны §1.2, а не все сразу.

### 6.2 Покрытие решений числом (собственная метрика)

Ключевая метрика этого документа. Считается автоматически: для каждого порога `T-XX` из реестра R1
в тестах должен быть тег `@threshold T-XX`, и хотя бы один ассерт в кейсе с этим тегом должен
сравнивать с числом или идентификатором SKU (а не с `toBeDefined` / `toBeTruthy` / `length > 0`).

| Метрика | Сегодня | Конец волны 1 | Конец волны 3 |
|---|---|---|---|
| Порогов реестра R1 с ≥ 1 числовым ассертом | **~35 из 193** (оценка по R1 §3) | **110 из 193** | **193 из 193** |
| Порогов группы A3 (котёл) с числовым ассертом | **0 из 28** | **28 из 28** | 28 из 28 |
| Инвариантов R5 в активном property-наборе (режим G) | 0 из 48 | 33 из 48 | 33 + переключённые по мере фиксов |
| Модулей ядра, не импортируемых ни одним тестом | **~35 из 97** (R1 §Резюме) | **12** | **0** |
| Golden-объектов | 0 | 5 (smoke) | 14 |
| Экспертных сверок с заполненным ожиданием | 0 | 12 (VAL-01…VAL-02) | 42 |

### 6.3 Mutation score — третий контур

Покрытие строк не отличает «исполнено» от «проверено». Stryker на **трёх** пакетах, где цена
незамеченной ошибки максимальна:

| Пакет | Цель | Обоснование |
|---|---|---|
| `logic/` + `dhw/` | **≥ 75 %** | если мутант «`kVent = 1.3` → `1.31`» или «`× 1.15` → `× 1.5`» выживает — тест исполняет код, но не проверяет его. Ровно тот дефект, который R1 назвал «иллюзией покрытия» |
| `matching/boiler.js` + `utils/boilerMatchingByType.js` | **≥ 70 %** | scoring и пороги подбора; мутация порога должна ронять тест |
| `report/buildFinancialBom.js` | **≥ 85 %** | деньги, чистая арифметика, мутации тривиально детектируемы — низкий score здесь означает, что тестов просто нет |

Гидравлику мутационным тестированием не покрываем: физика содержит эмпирику без источника
(`λ·(1+relRough·10)`, T-183), и «выживший мутант» там может означать не дыру в тестах,
а неопределённость модели. Прогон — nightly, не на PR (стоимость).

### 6.4 Чего мы **не** меряем и почему

- Общего «80 % по проекту» нет. Один процент, усреднённый по 97 модулям, скроет 0 % на
  `matching/boiler.js` за счёт 100 % на `math.js` (16 строк).
- Покрытия frontend в этом документе нет — оно принадлежит D3.
- Покрытие не является гейтом до завершения волны 1: гейт на пустом наборе провоцирует писать
  тесты ради процента, а нам нужны тесты ради порогов.

---

## 7. Особые случаи: детерминизм, допуски, порядок

### 7.1 Недетерминизм

| Источник | Якорь | Что делаем |
|---|---|---|
| `meta.generatedAt: new Date().toISOString()` | `buildReport.js:737` | вырезается нормализатором из всех снапшотов; отдельный unit-кейс проверяет формат ISO и что поле вообще есть |
| `meta.referenceBundleLoadedAt` | `buildReport.js:745-747` | то же |
| `generateShareToken()` — `randomBytes(24)` | `shareToken.js:16` | вне расчётного ядра; D5 |
| `Math.random` / `randomUUID` в `report`, `matching`, `hydraulics` | **не найдено** (R4 §5.4, grep → 0) | ничего не требуется; добавляем guard-тест A12-16: grep по `backend/src/{report,matching,hydraulics,logic,dhw}` на `Math.random`/`randomUUID` даёт 0 — регресс-детектор на будущее |
| `Math.random` в `fuzz-calc.ts:162-174` | без seed | заменяется seeded PRNG (§2.1 п.1) |
| `new Date()` в парсере климата | `snipClimate.js:270` | fake timers на фиксированный instant в кейсах A10 |
| **Мутация входа `buildReport`** | `buildReport.js:272-279` (`input.building.temps`), `:476`, `:492` | **самый коварный источник**: второй вызов на том же объекте даёт другой результат (R5 INV-G8, RISK-CALC-23). Каждый golden- и property-прогон получает `structuredClone(input)`; INV-P2 сравнивает вход до и после и падает при изменении. Без этого golden-эталоны нестабильны by construction |
| Глобальные кэши | `stationsLiteCachePromise` (`snipClimate.js:20`), `validateFn` (`validatePipelineInput.js:16`), `cachedSchema` (`pipelineSchemaLoader.js:13`), reference cache (`configCache.js:103-118`) | `invalidateReferenceCache()` в `beforeEach` (R4 §5.2); для модульных кэшей — `vi.resetModules()` + `resetHydraulicsPipelineValidatorForTests()` |
| Rate limiters на импорт-тайме | `rateLimiters.js:27,70-80` | `RATE_LIMIT_DISABLED=true` выставляется в `setupFiles` **до** любого импорта; менять между тестами внутри процесса бесполезно (R4 §5.4) |

### 7.2 Плавающая точка и допуски

Правила, обязательные для всех четырёх слоёв:

1. **`toBe` / `===` на `number` запрещены**, кроме целых (`sections`, `loopsCount`, `outletsCount`,
   `unitsCount`, `qty` при `qtyUnit: 'pcs'`) и денег после перевода в копейки.
2. **Деньги — целые копейки.** `Math.round(x·100)` и целочисленное сравнение. `toBeCloseTo`
   на суммах маскирует накопительное округление, которое как раз и является дефектом
   (INV-E4 нарушается для котла при `unitsCount > 1` и для труб).
3. **Абсолютный допуск — для малых величин, относительный — для больших.** Правило переключения:
   `|expected| < 10` → абсолютный из таблицы §3.3; иначе относительный. Для теплопотерь объекта
   (тысячи Вт) абсолютный допуск 0.1 Вт бессмысленно жёсткий, относительный 1e-9 — осмысленный.
4. **Допуск задаётся один раз на величину, в общем модуле `tolerances.ts`**, а не по месту.
   Иначе через полгода в репозитории будут три разных «допустимых» отклонения расхода.
5. **Пороги проверяются тремя точками**: `порог − ε`, `порог`, `порог + ε`, где `ε` — минимальный
   шаг, различимый после округления по §3.3. Для строгих неравенств (`unibox.js:73-123`, 8 штук)
   точка «ровно» обязательна — R6 B-13 показывает, что при `area === 20.0` не подходит ни один
   унибокс, и это неочевидное поведение должно быть зафиксировано явно.
6. **`toBeCloseTo(x, digits)` — только с явно указанным `digits`.** Умолчание vitest (2 знака)
   для скорости 0.2 м/с даёт допуск ±0.005, то есть 2.5 % — случайно приемлемо; для напора 8 м
   тот же вызов даёт ±0.005 м, то есть 0.06 % — случайно жёстко. Умолчаниями не пользуемся.
7. **Особый случай — `1e-9` и `1e-6` в самом коде**: `ufhRoomHeatFlux.js:174-190` (флаг обрезки
   при превышении `+1e-9`), `ufhRoomCoverageCheck.js:36-51` (`qRequired > maxAllowable + 1e-6`),
   `crossValidatePipelineInput.js:78-86` (`> 0.002`). Тесты этих порогов пишутся **с шагом,
   заведомо большим кодового эпсилона** (например ±1e-6 для `1e-9`), иначе кейс проверяет
   не логику, а поведение double.

### 7.3 Зависимость от даты

- В расчёте дата используется **в одном месте** — `meta.generatedAt` (`buildReport.js:737`),
  и в парсере климата (`snipClimate.js:270`, окно `METEOSTAT_YEARS` отсчитывается от текущего года).
- **Каталог** декларирует `generatedAt: 2026-04-21` при текущей дате 2026-08-23 (R6 §5.1);
  поле нигде не проверяется (N-29). Guard A12-15 фиксирует значение в снапшоте (§3.4) — так
  «каталог не обновлялся 4 месяца» становится видимым фактом, а не невидимым.
- **Тесты не зависят от календаря.** Единственные кейсы с фиктивным временем — A10 (климат):
  `vi.setSystemTime('2026-01-15T00:00:00Z')`, чтобы окно из 10 лет было воспроизводимым.
- Отдельный guard: **ни один тест не использует `new Date()` без явной фиксации**. Проверяется
  ESLint-правилом в тестовой конфигурации, а не ревью.

### 7.4 Зависимость от порядка ключей в отчёте

- Канонический сериализатор с рекурсивной сортировкой ключей — §3.3. Порядок ключей объекта
  из `JSON.parse` совпадает с порядком в файле и стабилен (R4 §5.3), но опираться на это нельзя:
  при `CATALOG_SOURCE=mongo` порядок другой.
- Отдельный кейс A12-17: `canonical(report) === canonical(reorderKeys(report))` — доказывает,
  что сериализатор действительно снимает зависимость.
- **Массивы не сортируются.** Порядок комнат, петель, строк сметы и рёбер графа содержателен
  (`commercial.lines` схлопывается по ключу — `buildFinancialBom.js:98-145`, порядок влияет на
  результат схлопывания). Стабильность порядка массивов проверяется отдельно — INV-P4.

### 7.5 Зависимость от порядка SKU в каталоге

Самый недооценённый источник расхождений. R4 §5.3 зафиксировал: `Array.prototype.sort` в V8
стабилен, поэтому равные элементы сохраняют **порядок входа**, а порядок входа для `file` — это
порядок массивов в `test_data.json`, для `mongo` — `Product.find({}).sort({ kind: 1, catalogKey: 1 })`
(`loadCatalog.js:207`) с последующей перегруппировкой. Компараторы без tie-break:

- `compareBoilersByMaxPowerAsc` — только `powerKw.max` (`comparators.js:64-66`), применяется
  в `buildMatchingSortPools` (`matchingSortPools.js:34`) и определяет T-62 «первый подходящий»;
- `compareWaterHeatersByMinVolumeAsc` — только минимальный объём (`comparators.js:75-77`).

Следствие: **два котла с одинаковым `powerKw.max` при загрузке из file и из mongo дадут разный
выбор.** Это не гипотеза — это прямое следствие стабильной сортировки по неполному ключу.

Меры:

1. **Все тесты ядра — только `CATALOG_SOURCE=file`** с `CATALOG_FILE_PATH`, указывающим
   на `backend/test_data.json.example` напрямую, а не на gitignore-нутый `test_data.json`
   (R4 §5.1). Плюс `WATER_NORMS_SOURCE=file`, `APPLIANCES_SOURCE=file`,
   `RECOMMENDATIONS_SOURCE=file`, `UFH_PRESETS_SOURCE=file` — иначе `auto` при поднятой
   memory-server молча возьмёт другой источник (`loadReferenceCollection.js:54-77`).
2. **INV-P3 (§2.4)** — свойство «перестановка каталога не меняет выбранный SKU». Это активный
   детектор отсутствующих tie-break'ов: `shuffle(catalog.boilers, seed)` → тот же `selected.model`.
   Сегодня свойство, скорее всего, падает; оно и должно падать, пока tie-break не добавлен.
   Артефакт падения — пара SKU с одинаковым ключом сортировки, то есть готовый тикет.
3. **Отдельный кейс P2 «file vs mongo»** (R4 §5.3 рекомендует): один и тот же вход через оба
   источника даёт одинаковый выбор оборудования. Требует `mongodb-memory-server` — идёт в nightly.
4. **Golden-снапшоты хранят `catalogFingerprint`** (§3.4): при перестановке SKU внутри файла
   fingerprint изменится (канонизация сортирует ключи объектов, но не элементы массивов),
   и это будет видно до того, как поедут числа.

---

## 8. Трассировка: доменный риск R5/S1 → слой и кейс

Таблица покрывает все P0 расчётного ядра и P1, доходящие до денег. Полная трассировка
193 порогов ведётся тегами `@threshold T-XX` в коде тестов (§6.2), здесь — уровень рисков.

| Риск S1 | Инвариант / порог | Слой | Идентификатор | Режим |
|---|---|---|---|---|
| RISK-CALC-01 вентиляция `kVent` | T-01; R5-heatloss-01 | А + **Г** | A1-01…A1-14; VAL-01…VAL-07 «теплопотери объекта» | характеризация + экспертный FAIL |
| RISK-CALC-02 внутренний санузел 0 Вт | T-25, T-102; R5-heatloss-02 | А + Г | A1-17…A1-20, A5-21…A5-24; VAL-03 «теплопотери комнаты» | характеризация |
| RISK-CALC-04 крыша одноэтажного дома | T-09…T-12 | А + Г | A1-31…A1-38; VAL-01, VAL-02 | гейт (unit) + экспертный |
| RISK-CALC-06 `outsideC > insideC` | INV-F7 | А + Б | A10-05 (буд. A11-05); INV-F7 | характеризация |
| RISK-CALC-07 ΔT пола/потолка до улицы | R5-heatloss-04 | А + Г | A1-21…A1-24; VAL-04 | характеризация |
| RISK-CALC-08 мостики холода / `r` | T-17, T-18; R5-heatloss-03 | А + Г | A1-45…A1-50; VAL-06 | характеризация |
| RISK-CALC-12 `uValue: 0` у исключённых | INV-C3 | Б | INV-C3 | характеризация |
| RISK-CALC-13/14/15/16 климат | T-240…T-243; R5-climate-01…04 | А | A10-01…A10-22 | гейт (парсер) + характеризация (методика) |
| RISK-CALC-17 проточное ГВС ×2.5 | T-37; R5-dhw-01 | А + Г | A2-21…A2-24; VAL-03 «мощность котла» | характеризация + экспертный |
| RISK-CALC-18 планка ГВС 24 кВт | T-43; R5-dhw-02 | А + Г | A2-33…A2-36; VAL-01, VAL-05, VAL-07 | характеризация + экспертный |
| RISK-CALC-19 сумма вместо `max` при БКН | T-52; R5-dhw-04 | А | A3-01…A3-12 | характеризация |
| RISK-CALC-20 змеевик БКН без `supplyC` | T-81…T-83; R5-dhw-03 | А | A4-11…A4-18 | характеризация |
| RISK-CALC-21 тропический душ | T-41; R5-dhw-05 | А | A2-37…A2-40 | характеризация |
| RISK-CALC-23 мутация входа | INV-G8 | Б | **INV-P2**, INV-G8 | гейт (падает сегодня → тикет) |
| RISK-CALC-24 Δt ТП хардкод 10 K | T-133 | А | A6-30…A6-33 | гейт (расхождение кода и `appliances.json`) |
| RISK-CALC-25 длина петли без транзита | INV-F4; R5-ufh-05 | А + Б | A6-42…A6-45; INV-F4 | характеризация |
| RISK-CALC-26 q↓ не в нагрузке котла | T-121, T-122, T-245 | А + Г | A6-04…A6-07, A11-09…A11-12; VAL-05 | характеризация |
| RISK-CALC-32 правдоподобие результата | INV-B1, INV-B2, INV-F7 | Б | INV-B1, INV-B2, INV-F7 | гейт |
| RISK-MATCH-01 `requiredKw` = пик ГВС | T-52, T-54 | А + В | A3-01…A3-12; golden FIX-01, FIX-04 (G-C) | гейт (unit) + снапшот |
| RISK-MATCH-02 молчаливая деградация | R6 §2.2 (5 стратегий) | Б | **INV-P9** + INV-G1…G4 | гейт |
| RISK-MATCH-03 «запас за опаленням» | T-63 | А | A3-40…A3-43 | характеризация |
| RISK-MATCH-04 `powerKw.min` не ограничивает | INV-A4; R5-boiler-01 | А + Б | A3-44…A3-47; INV-A4 | характеризация |
| RISK-MATCH-05 `ufh_only` база = отдача ТП | T-245; INV-A3 | А + Г | A11-09…A11-12; VAL-05 | характеризация + экспертный |
| RISK-MATCH-06 забракованные петли ТП | — | Б | **INV-P6** (структурная замена N-16) | гейт |
| RISK-MATCH-14 каскад 2×24 на дом 9 кВт | T-67; R6 B-03 | А + В | A3-35…A3-39; golden FIX-02 (G-C) | гейт + снапшот |
| RISK-MATCH-20 выходов < контуров | T-162; INV-G1 | А + Б | A7-14…A7-17; INV-G1 | характеризация |
| RISK-MATCH-21 радиаторный коллектор без каскада | T-165; R6 B-12 | А | A7-22…A7-24 | характеризация |
| RISK-MATCH-23 петля без терминала | T-166, T-168; INV-G2 | А + Б | A7-28…A7-31; INV-G2 | характеризация |
| RISK-HYDR-01 soft-fail → 200 со сметой | T-247 | А + Б | A11-13…A11-16; **INV-P8** | гейт |
| RISK-HYDR-02 `resolveRoughnessMm` кириллица | T-183; N-25 | А | A8-09…A8-18 (все 30 материалов каталога) | гейт (характеризует 27 из 30 в стальной ветке) |
| RISK-HYDR-09 `pex` + магистраль | T-185; R6 B-14 | А | A8-19…A8-22 | гейт |
| RISK-MONEY-01 `trunk`/`dhw` вне сметы | INV-D6; T-236 | Б | INV-D6 | характеризация |
| RISK-MONEY-02 труба без цены → 0 грн | INV-E6 | Б | INV-E6 | характеризация |
| RISK-SEC-01 лимит T поверхности | T-123, T-124; INV-F1, INV-F2 | А + Б | **A6-08…A6-13** (§1.7); INV-F1, INV-F2 | характеризация — единственная находка о безопасности |
| RISK-INFRA-04 `fuzz-calc` слеп | — | Б | **INV-P5** (400 = провал), **INV-P6** (структурный детектор) | гейт |
| RISK-DATA (N-29) `schemaVersion`/`generatedAt` | — | А + В | A12-13…A12-15; шапка снапшота (§3.4) | гейт + характеризация |
| Порядок SKU без tie-break | `comparators.js:64-66` | Б | **INV-P3** | гейт (падает сегодня → тикет) |

### Что осталось непокрытым осознанно

| Не покрыто | Почему | Куда уходит |
|---|---|---|
| RISK-CALC-03 (дефолт −5 °C в UI) | это фронтовое умолчание (`migrateDerivedState.ts:168`), а не логика ядра | D3 (E2E) |
| RISK-CALC-05 (`floorPresetId = floorPresets[0]`) | то же — `useRoomsOrchestration.ts:116-117` | D3 |
| Все RISK-UX-* | вне расчётного ядра | D3 |
| RISK-PERF-05 (лимит 20/15 мин) | нагрузочный профиль | D4 |
| RISK-INFRA-02/11/13/19 (`data-testid`, DOM-маркеры) | предусловие E2E, а не тест ядра | D3 |
| RISK-SEC-02, RISK-AUTH-* | безопасность и авторизация | D5 |
| R5-heatloss-06 (модель соседних помещений), R5-boiler-05 (электрокотёл) | требуют изменения **входного контракта**, тестировать нечего до появления полей. Электрокотлов в каталоге 0 SKU (N-27) — сетапы с ними закладываются как «подбор невозможен», а не как рабочие | бэклог продукта |
| Полная матрица бренд-скоринга радиаторов (T-94, T-95) | коммерчески чувствительно, но не физика; берём 4 кейса «какой SKU победит» вместо ~60 | P2, волна 3 |

### НЕ ПРОВЕРЕНО в этом документе

1. **Скорость одного `buildReport`** — замер невозможен без `node_modules`. От неё зависит объём
   property-набора на PR (§2.3); при > 100 мс числа итераций урезаются втрое.
2. **Формат bulk-CSV Meteostat** — фикстуры группы A10 строятся по коду парсера
   (`snipClimate.js:236-251`), а не по живому ответу (унаследовано из R5 §НЕ ПРОВЕРЕНО п.1).
   Требуется один ручной запрос до реализации A10.
3. **Точные номера строк внутри переносимых verify-скриптов** — читались имена, размеры и выводы
   R1 §3, но не полный текст каждого из 45 переносимых скриптов. При переносе возможны
   обнаружения «скрипт выходит до ассертов» (R1 §6 п.1 предупреждает об этом же).
4. **Фактические ожидаемые числа VAL-01…VAL-07** — их обязан посчитать эксперт-теплотехник;
   значение в образце строки CSV (§4.5) взято из расчёта R5-heatloss-01 как иллюстрация формата,
   **не как утверждённый эталон**.
5. **`backend/src/catalog/matchingSortPools.js`** не читался; утверждение «пул котлов отсортирован
   по `powerKw.max ↑`» опирается на `comparators.js:64-66` и на R1 §6 п.5, где это же помечено
   как неподтверждённое. Кейсы A3-31…A3-34 спроектированы так, чтобы это проверить.
