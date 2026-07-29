# Форма «Водонагреватель» (WaterHeaterForm)

Документ описывает шаг анкеты **«Водонагреватель»**: стратегические решения пользователя по подбору БКН/электробойлера, связь с API и UI-компонентами.

---

## Цель

Пользователь выбирает **стратегию** ГВС (схему связки котёл / горячая вода), а не модель или литраж вручную. Объём и номенклатура подбираются бэкендом по `recommendedTankLiters` и каталогу. Ручной выбор модели/литража в форму **не входит**.

---

## Разделение шагов анкеты

| Шаг | Компонент | Поля API / UI |
|-----|-----------|---------------|
| Горячая вода | `HotWaterForm` + `HotWaterReportDialog` | `hotWater.*` — ввод; расчёт API — в модалке; точки — ещё на `technicalResult` (`HotWaterFixturesSummaryTable`) |
| **Водонагреватель** | **`WaterHeaterForm`** + **`WaterHeaterReportDialog`** | `heatingSystem.hotWaterBoilerPowerMatchingScheme`, `objectMeta.indirectDhwSpaceAvailable` (условно); matching — только в модалке «Отчёт по подбору водонагревателя» |
| Котёл | `AppSurveyContent.tsx` → `BoilerSurveyForm` | `heatingSystem.thermalRegimePreset` — только радиаторный график |

---

## WaterHeaterFormValue

Файл: `frontend/src/types/waterHeater.ts`

```typescript
{
  hotWaterBoilerPowerMatchingScheme: HotWaterBoilerPowerMatchingScheme;
  indirectDhwSpaceAvailable: boolean;
}
```

Единственный источник правды для флага БКН в UI — `waterHeaterForm`. В `buildCalcRequestPayload` флаг мержится в `objectMeta` через `objectMetaForCalcPayload()`.

---

## Контекстная видимость галочки БКН

Галочка **«Есть место под БКН»** показывается только когда бэкенд проверяет флаг:

- `objectType === 'apartment'`
- `scheme === singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw`

Для **дома** галочка не отображается — в `matching/index.js` для дома используется `objectType === 'house'` без `indirectDhwSpaceAvailable`.

Функция: `shouldShowIndirectDhwSpaceCheckbox()` в `frontend/src/utils/waterHeaterSchemeOptions.ts`.

---

## Схемы в селекте

Список опций — `getWaterHeaterSchemeOptions(objectType, apartmentLarge)`:

- **Малая квартира** (площадь ≤ 50 м² и < 2 санузлов/точек ванна+душ): схема «1К + БКН» **скрыта**.
- **Крупная квартира** и **дом**: все 5 схем из `shared/heatingMatchingSchemes.js`.

При недоступной схеме `AppSurveyContent.tsx` сбрасывает выбор на `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw`.

---

## Поток данных

```mermaid
flowchart LR
  HWF[HotWaterForm] --> Session[SurveySession waterHeaterForm state]
  HWF --> Fixtures[hotWaterForm.fixtures]
  Fixtures --> SidebarFix[HotWaterFixturesSummaryTable]
  Fixtures --> HWModal[HotWaterReportDialog]
  WHF[WaterHeaterForm] --> Session
  WHF --> WHModal[WaterHeaterReportDialog]
  Session --> BCP[buildCalcRequestPayload]
  BCP --> API[POST /api/v1/calc]
  API --> Report[matching.indirectWaterHeater / waterHeater / calculations.hotWater]
  Report --> WHModal
  Report --> HWModal
  WHModal --> Preview[WaterHeaterMatchingPreview]
  Preview --> Card[WaterHeaterProposalCard]
  TechnicalResult[RecommendationsBlock] --> SidebarFix
  TechnicalResult --> HWSummary[HotWaterSummaryTable]
```

- **INPUT:** `HotWaterForm` (потребление) + `WaterHeaterForm` (стратегия; `onApplyScheme` на `technicalResult`)
- **OUTPUT:**
  - шаг `technicalResult` после теплопотерь — `HotWaterFixturesSummaryTable` (точки из анкеты, live);
  - `WaterHeaterReportDialog` → `WaterHeaterMatchingPreview` → `WaterHeaterProposalCard` (модалка шага «Водонагреватель»);
  - шаг `technicalResult` — `HotWaterSummaryTable` (ЭБ/БКН, без карточек matching)

Паттерн UI — как у ТП и ГВ: на форме только ввод + кнопка отчёта; полный результат — в модалке.
На шагах ТП / ГВ / Водонагреватель рядом с отчётом — **«Назад к результатам»**
(`navigateToResultsSection` → якоря `RESULTS_SECTION_IDS` на `technicalResult`).

---

## Компоненты UI (слой результата)

### `HotWaterFixturesTable` / `HotWaterFixturesSummaryTable`

Единая таблица точек водоразбора. **SSOT данных — `hotWaterForm.fixtures`** (анкета), не API:

- запись в сессию — `normalizeHotWaterForm` в `reduceSurveyMutation` (`SET_HOT_WATER_FORM`)
  и в `migrateSurveyDraft`;
- calc payload — снова `normalizeHotWaterForm` в `buildCalcRequestPayload`;
- UI — `normalizeHotWaterFixtures` в таблице / `countThermalFixtures` (без `NaN`);
- шаг `technicalResult` — `HotWaterFixturesSummaryTable` (live при смене анкеты);
- модалка — точки из анкеты **даже без** ответа calc; пик/кВт/бак — из `calculations.hotWater`.

При изменении анкеты таблица обновляется сразу; расчёт API — после debounce, если
`canAutoCalc` (заполнены помещения/ограждения).

### `WaterHeaterProposalCard`

Discriminated union в `frontend/src/types/waterHeaterMatching.ts`:

```typescript
{ kind: 'indirect'; title; titleDomId; data: ParsedIndirectWaterHeaterMatching }
| { kind: 'electric'; title; titleDomId; data: ParsedWaterHeaterMatching }
```

Специфичные поля БКН (`coilPowerKw`, `effectiveHeatPowerKw`, …) и ЭВН (`powerKw`) читаются **из `data`**, без пропсов `indirect` / `electricPowerKw`.

### `WaterHeaterMatchingPreview`

Единая обёртка рендера обеих карточек. Используется **в модалке** отчёта:

- `WaterHeaterReportView` — `idPrefix="wh-report"`

На шаге `technicalResult` отображается компактная `HotWaterSummaryTable` (строки ЭБ/БКН), без `WaterHeaterMatchingPreview`.

### Участие ЭБ/БКН в `HotWaterSummaryTable`

Подписи строк — `resolveHotWaterEquipmentRowLabel` (`hotWaterEquipmentParticipation.ts`):

| Схема / исход matching | ЭБ на `technicalResult` | БКН на `technicalResult` |
|------------------------|---------------|----------------|
| «1К + БКН» + БКН выбран | «Не участвует в расчёте» | результат подбора |
| «1К + БКН» + fallback без БКН | результат запасного ЭВН (+ warning) | skipped / нет модели |
| отдельный ЭВН / буферный ЭВН (1К или 2К) | результат подбора | «Не участвует в расчёте» |
| max-комби без БКН | «Не участвует…» | «Не участвует…» / по matching |

При успешном БКН оркестратор (`matching/index.js`) **не** пишет `recommendedTankLiters` в `matching.waterHeater.requiredTankLiters` (остаётся `0`, `selected: null`). Объём бака — только в `matching.indirectWaterHeater` и в `calculations.hotWater.recommendedTankLiters`. Парсер `parseWaterHeaterMatchingFromReport` игнорирует stub «только литры» без модели/warnings.

### `WaterHeaterReportDialog`

Модалка полного подбора (паттерн `HotWaterReportDialog` / `UnderfloorHeatingReportDialog`):

- кнопка «Отчёт по подбору водонагревателя» на `WaterHeaterForm`;
- guard — `hasWaterHeaterReportContent(indirect, electric)`.

---

## Подписи объёма (контекст vs результат)

| Место | Источник | Подпись в UI |
|-------|----------|--------------|
| Контекст формы / отчёт ГВ | `calculations.hotWater.recommendedTankLiters` | **Рекомендуемый объём (расчёт ГВС)** |
| Карточка подбора (модалка) | `matching.*.requiredTankLiters` | **Расчётный минимум (подбор)** |

Разные слои отчёта — намеренное разделение «расчёт потребления» и «порог matching».

---

## Реактивность

Изменение схемы или галочки → `calcInputKey` меняется → хук сбрасывает отчёт → debounce **700 ms** → `POST /api/v1/calc` → обновление карточек БКН и ЭВН в модалке отчёта и строк на `technicalResult`.

Подробнее: [`frontend-calc-runner.md`](frontend-calc-runner.md).

---

## SurveyDraft (состояние анкеты)

**Единый контракт:** `SURVEY_DRAFT_SCHEMA_VERSION` и тип `SurveyDraft` в `frontend/src/types/surveyDraft.ts`.

**Загрузка** (файл, `projects.survey`, hash-URL) — только через `migrateSurveyDraft()` (`frontend/src/utils/migrateSurveyDraft.ts`). `parseSurveyDraft` — алиас этой функции.

При загрузке snapshot приводится к текущему контракту:

- `waterHeaterForm` — единственное место хранения схемы ГВС и флага «место под БКН»;
- если в snapshot блока `waterHeaterForm` нет — значения берутся из корневого `hotWaterBoilerPowerMatchingScheme` и `objectMeta.indirectDhwSpaceAvailable`, затем нормализуются;
- `objectMeta.indirectDhwSpaceAvailable` в сохранённом SurveyDraft **не хранится** (только в calc через `objectMetaForCalcPayload()`);
- отсутствующие поля заполняются дефолтами (`createDefaultWaterHeaterFormValue()` и др.).

**Запись:** `buildSurveyDraft()` всегда пишет `schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION` и полный `waterHeaterForm`.

См. также: [`survey-draft.md`](survey-draft.md).

---

## `tropicalShower` и объём бака

Флаг анкеты `hotWater.tropicalShower` умножает расчётную потребность в объёме на
`water_norms.storage.tropicalShowerVolumeFactor` (**1.3**), затем результат округляется
к `storage.typicalTankSizes`. Коэффициент один и тот же для дома и квартиры.

| Контекст | Где применяется множитель | Модуль |
|----------|---------------------------|--------|
| Дом, сценарий **storage** (БКН / накопитель) | Один раз к `dhwTankLitersCombinedRaw` = max(legacy, сеансовый эквивалент) | `backend/src/logic/hotWater.js` |
| Квартира + схема отдельного ЭВН | К норме `apartmentElectricStorage` до snap | `recommendedApartmentElectricTankLiters` → `buildReport.js` |
| Любой объект + **2К + буферный ЭВН** | К норме `combiBufferElectricStorage` до snap | `recommendedCombiBufferTankLiters` → `buildReport.js` |
| Любой объект + **1К + буферный ЭВН** | К норме `singleCircuitBufferElectricStorage` до snap | `recommendedSingleCircuitBufferTankLiters` → `buildReport.js` |
| Квартира, чистый **flowThrough** без бака | Объём = 0; флаг на литраж не влияет (меняется только если схема задаёт бак) | — |

Общий хелпер snap + tropical для ЭВН/буфера: `snapTankLitersWithTropical` в
`backend/src/utils/apartmentMatching.js`. Legacy-норма storage
(`recommendedStorageTankLitersRaw`) считает только жителей/ванну без множителя;
+30 % в storage-пайплайне накладывается один раз на `combinedRaw` в `hotWater.js`.

Контракт API: `components/schemas/CalcInput.yaml` (`hotWater.tropicalShower`),
норма — `WaterNormsStorage.yaml` (`tropicalShowerVolumeFactor`).

---

## Локальная валидация

`validateWaterHeaterForm()` — только **warnings**, без блокировки расчёта:

- схема вне списка доступных;
- «1К + БКН» без галочки места под бойлер;
- нет жильцов и точек на шаге «Горячая вода».

---

## Связанные файлы

| Файл | Назначение |
|------|------------|
| `frontend/src/components/HotWaterForm/HotWaterForm.tsx` | UI шага «Горячая вода» (ввод + кнопка отчёта) |
| `frontend/src/components/HotWaterReport/HotWaterReportDialog.tsx` | Модалка полного расчёта ГВ |
| `frontend/src/utils/hotWaterFormDefaults.ts` | Дефолты формы ГВ и ключи fixtures |
| `frontend/src/utils/normalizeHotWaterForm.ts` | Нормализация формы/точек (SurveyDraft, мутации, calc) |
| `frontend/src/utils/countThermalFixtures.ts` | Итоги точек + guard показа (без NaN) |
| `frontend/src/components/HotWaterReport/HotWaterFixturesTable.tsx` | Таблица точек водоразбора (SSOT UI) |
| `frontend/src/components/HotWaterReport/HotWaterFixturesSummaryTable.tsx` | Таблица точек на `technicalResult` |
| `frontend/src/components/HotWaterReport/HotWaterSummaryTable.tsx` | Компактный итог ЭБ/БКН на `technicalResult` |
| `frontend/src/utils/hotWaterEquipmentParticipation.ts` | Участие ЭБ/БКН по схеме и подписи строк |
| `frontend/src/utils/parseWaterHeaterMatchingFromReport.ts` | Парсинг `matching.waterHeater` (stub без модели → null) |
| `frontend/src/components/WaterHeaterForm/WaterHeaterForm.tsx` | UI формы (стратегия + кнопки отчёта и «Назад к результатам») |
| `frontend/src/constants/surveyResultsSections.ts` | Якоря секций `technicalResult` для «Назад к результатам» |
| `frontend/src/components/SurveyNavigation/SurveyReportActions.module.css` | Общие стили кнопок отчёта / назад |
| `frontend/src/components/WaterHeaterReport/WaterHeaterReportDialog.tsx` | Модалка полного подбора БКН/ЭВН |
| `frontend/src/components/WaterHeaterReport/WaterHeaterReportView.tsx` | Контент модалки |
| `frontend/src/components/WaterHeaterReport/hasWaterHeaterReportContent.ts` | Guard кнопки отчёта |
| `frontend/src/components/WaterHeaterMatchingPreview/WaterHeaterMatchingPreview.tsx` | Рендер карточек БКН/ЭВН в модалке |
| `frontend/src/components/WaterHeaterProposalCard/WaterHeaterProposalCard.tsx` | Карточка одной линии (read-only) |
| `frontend/src/types/waterHeaterMatching.ts` | Discriminated union пропсов карточки |
| `frontend/src/utils/waterHeaterSchemeOptions.ts` | Фильтр схем, видимость БКН |
| `shared/waterHeaterFormContract.js` | Видимость галочки БКН, мерж `objectMeta.indirectDhwSpaceAvailable` |
| `frontend/src/utils/objectMetaForCalcPayload.ts` | Типизированный re-export shared |
| `frontend/src/query/useSurveyCalc.ts` | Calc API (React Query), debounce, draftInitializing guard |
| `frontend/src/utils/migrateSurveyDraft.ts` | Нормализация snapshot → SurveyDraft |
| `backend/src/logic/hotWater.js` | Storage ГВС; tropical к `combinedRaw` |
| `backend/src/utils/apartmentMatching.js` | Объёмы ЭВН/буфера + `snapTankLitersWithTropical` |
| `backend/src/report/buildReport.js` | Overwrite `recommendedTankLiters` для ЭВН/буферных схем |
| `frontend/src/services/buildCalcRequestPayload.ts` | Сборка CalcInput |
| `backend/src/matching/index.js` | Оркестрация pickIndirect / pickWaterHeater |

См. также: [`heating-schemes-thermal-regime.md`](heating-schemes-thermal-regime.md), [`heating-schemes-test-checklist.md`](heating-schemes-test-checklist.md).
