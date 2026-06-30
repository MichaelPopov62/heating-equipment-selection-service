# Frontend: оркестрация расчёта (SurveySession + useSurveyCalcRunner)

Документ описывает слой клиента: единая сессия анкеты, вызов `POST /api/v1/calc`, хранение отчёта и синхронизация с формой.

См. также: [`survey-draft.md`](survey-draft.md), [`hydraulics-pipeline.md`](hydraulics-pipeline.md) § SurveySession.

---

## SSOT calc-state на клиенте

| Ответственность | Модуль |
|-----------------|--------|
| Состояние `report`, `uiPhase`, `calcInputKey`, черновик | `frontend/src/surveySession/SurveySessionProvider.tsx` |
| Pipeline мутаций | `runSurveyMutationPipeline.ts` → `reduceSurveyMutation` → `migrateDerivedState` → `decideCalcAction` |
| HTTP calc (debounce, dedup, отмена гонок) | `frontend/src/hooks/useSurveyCalcRunner.ts` (`managedBySession: true`) |
| Сборка тела запроса | `buildCalcPayloadFromDraft` в `buildCalcInputSnapshot.ts` |
| Ключ изменений входа | `buildCalcInputKeyFromDraft` в том же модуле |
| Парсинг отчёта для UI | `frontend/src/hooks/useCalcReport.ts` |

`App.tsx` оборачивает форму в `SurveySessionProvider`. **`calcReport` не хранится в `App.tsx`** — компоненты читают `report` из контекста сессии.

---

## Pipeline мутации

```mermaid
flowchart LR
  UI[dispatch mutation] --> Reduce[reduceSurveyMutation]
  Reduce --> Migrate[migrateDerivedState]
  Migrate --> Key[buildCalcInputKeyFromDraft]
  Key --> Decide[decideCalcAction]
  Decide -->|schedule| Runner[useSurveyCalcRunner debounce 700ms]
  Runner --> API[POST /api/v1/calc]
  API -->|ok| ApplyOk[applyCalcResponseOk — полная замена report]
  API -->|fail| ApplyFail[applyCalcResponseFail — report сохраняется]
```

### `uiPhase`

| Значение | Когда |
|----------|--------|
| `idle` | Нет отчёта, нет пересчёта |
| `stable` | Отчёт актуален |
| `recalculating` | Запланирован или идёт POST calc |
| `error` | Ошибка calc; предыдущий отчёт **не** сбрасывается |

### Смена режима отопления (`HEATING_EMITTERS_MODE_SET`)

При переходе на «Классика» (`presetId: null`):

- сбрасываются `ufhPresetId`, `waterUnderfloorHeating`;
- ТП в комнатах отключается (`enabled: false`);
- пересобирается `wiringLayoutV3`;
- `calcInputKey` меняется → `decideCalcAction` → `schedule` → `uiPhase=recalculating`;
- после успешного POST отчёт **заменяется целиком** (`applyCalcResponseOk`), без domain-merge и без `null` между ответами.

Пока идёт пересчёт, в UI может отображаться **предыдущий** отчёт с индикатором загрузки — это ожидаемо.

### `wiringLayoutV3`

Черновик v4 хранит layout разводки (`systemType`, ветки). При `WIRING_SCHEME_SET` и `SET_ROOMS` — `migrateWiringLayoutOnSystemTypeChange` / `adaptFlatRoomsToWiringLayout`. На сервер уходит через `buildCalcPayloadFromDraft`; граф гидравлики строится в `buildGraph.js`.

---

## API хука (legacy / внутри сессии)

```typescript
const {
  calcLoading,
  calcError,
  beginDraftInitialization,
  endDraftInitialization,
  scheduleFreshCalc,
  runApiCalc,
  abortInFlightCalc,
} = useSurveyCalcRunner({
  buildCalcPayload,
  canAutoCalc,
  calcInputKey,
  onCalcSuccess,
  onCalcError,
  managedBySession: true,
  draftInitializing,
});
```

При `managedBySession: true` хук **не** владеет `calcReport` — только loading, HTTP и колбэки.

### Debounce и dedup

- `SURVEY_CALC_DEBOUNCE_MS = 700`
- Перед POST сравнивается `JSON.stringify(payload)` с последним успешным — дубликаты не уходят
- `runApiCalc` (кнопка «Рассчитать») сбрасывает dedup и вызывает POST немедленно

### Загрузка черновика

`beginDraftInitialization()` в начале `applySurveyDraftState`; `endDraftInitialization()` в `queueMicrotask` после `restoreCalcReport`. На интервале guard блокируется автопересчёт.

---

## Связанные модули (`App.tsx` / `AppSurveyContent.tsx`)

| Модуль | Назначение |
|--------|------------|
| `SurveySessionProvider` | контекст, `dispatch`, `report`, `uiPhase` |
| `useSurveyCalcRunner` | calc API (исполнитель) |
| `useCalcReport` | парсинг report → DTO для UI |
| `useSurveyProject` | файлы, Mongo, hash-URL |
| `useRoomsOrchestration` | синхронизация комнат с objectMeta |
| `useSurveyEstimates` | локальные оценки до API |
| `HydraulicsProposalSection` | блок гидравлики из `matching.hydraulics` |

Ручной `invalidateCalcReport()` в формах **не нужен** — пересчёт централизован в сессии.

---

## Verify

```bash
cd frontend && npm run verify:survey-session
cd frontend && npm run lint && npm run build
cd backend && npm run verify:survey-draft-migration && npm run verify:water-heater-form
```
