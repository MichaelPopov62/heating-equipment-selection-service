# Манифест `data-testid` фронтенда HeatCalc

Задача F-13. Добавлены **только** атрибуты в разметку: ни логики, ни текстов,
ни структуры компонентов не менялось. Существующие `id` сохранены как есть —
`#roomsCount`, `#wallThicknessMm`, `#name-r1`, `#type-r1`, `#area-r1`,
`#height-r1`, `#externalWall1-area-r1`, `#win-w-r1-0` продолжают работать.

Конвенция: `data-testid="<область>-<сущность>"`, kebab-case, латиница.
Для сущностей с идентификатором — суффикс `-{roomId}` / `-{stepId}`.

Строки указаны по состоянию **после** правок (проверено `grep -rn data-testid frontend/src`).

---

## 1. Навигация по шагам

`{stepId}` — ключ из `frontend/src/constants/surveySteps.ts` (`SURVEY_STEPS`).

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `step-nav-{stepId}` | `frontend/src/AppSurveyContent.tsx:415` | Кнопка бокового меню шага. Одна разметка на все 11 кнопок. |

Полный набор значений (порядок = `SURVEY_STEPS`):

`step-nav-object`, `step-nav-warmFloor`, `step-nav-rooms`, `step-nav-hotWater`,
`step-nav-boiler`, `step-nav-radiators`, `step-nav-waterHeater`,
`step-nav-hydraulics`, `step-nav-technicalResult`, `step-nav-dataReference`,
`step-nav-financialResult`.

> `stepId` — camelCase, потому что это ключ SSOT, а не свободная строка.
> `aria-current="step"` на активной кнопке не трогали.

## 2. Шаг «Об'єкт»

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `field-client-name` | `frontend/src/components/Header/Header.tsx:144` | `<input>` «Ім'я клієнта». **Живёт в шапке, а не в форме шага** — см. примечание ниже. |
| `field-rooms-count` | `frontend/src/components/ObjectMetaForm/ObjectMetaForm.tsx:214` | `<input id="roomsCount">` «Кількість приміщень». |
| `field-wall-thickness` | `frontend/src/components/ObjectMetaForm/ObjectMetaForm.tsx:379` | `<input id="wallThicknessMm">` «Товщина несучої стіни, мм». |
| `field-inside-temp` | `frontend/src/AppSurveyContent.tsx:492` | `<input>` «Всередині, °C». Без `id`, обёрнут в `<label>`. |
| `field-outside-temp` | `frontend/src/AppSurveyContent.tsx:506` | `<input>` «Зовні, °C». Без `id`. |
| `field-bathroom-temp` | `frontend/src/AppSurveyContent.tsx:520` | `<input>` «Повітря в санвузлі, °C». Без `id`. |

> «Ім'я клієнта» — не поле шага «Об'єкт», а поле шапки (`Header`, `variant="survey"`),
> присутствует на всех шагах. Атрибут поставлен по месту фактического рендера.

## 3. Карточка помещения

`{roomId}` — `r1`, `r2`, … Поля есть в DOM и у свёрнутой карточки.

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `room-card-{roomId}` | `frontend/src/components/RoomsForm/RoomAccordionItem.tsx:273` | `<article>` — контейнер карточки. |
| `room-toggle-{roomId}` | `RoomAccordionItem.tsx:278` | Кнопка-заголовок «Відкрити / Згорнути» (`aria-expanded`). |
| `room-name-{roomId}` | `RoomAccordionItem.tsx:316` | `<input id="name-{roomId}">` «Назва». |
| `room-type-{roomId}` | `RoomAccordionItem.tsx:331` | `<select id="type-{roomId}">` «Тип». |
| `room-area-{roomId}` | `RoomAccordionItem.tsx:433` | `<input id="area-{roomId}">` «Площа, м²». |
| `room-height-{roomId}` | `RoomAccordionItem.tsx:452` | `<input id="height-{roomId}">` «Висота, м». |
| `room-layout-{roomId}` | `RoomAccordionItem.tsx:471` | `<select id="room-layout-{roomId}">` «Розташування приміщення». |
| `room-wall1-area-{roomId}` | `RoomAccordionItem.tsx:827` | `<input id="externalWall1-area-{roomId}">` — площадь «Стіна №1». **Ключевое поле: без него расчёт не запускается (BUG-01).** |
| `room-wall2-area-{roomId}` | `RoomAccordionItem.tsx:827` | `<input id="externalWall2-area-{roomId}">` — площадь второй наружной стены. Рендерится тем же `map` по `wallFieldConfigs`; добавлен, чтобы `data-testid` оставался уникальным (иначе у углового помещения было бы два `room-wall1-area-*`). |

## 4. Шаг «Гаряча вода»

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `field-residents` | `frontend/src/components/HotWaterForm/HotWaterForm.tsx:94` | `<input id="hw-residents">` «Кількість осіб». |

## 5. Кнопки шапки

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `header-projects` | `frontend/src/components/Header/Header.tsx:162` | «Проєкти». Единственная кнопка, доступная и при `variant="start"`. |
| `header-save` | `Header.tsx:176` | «Зберегти» (`disabled` без имени клиента). |
| `header-share` | `Header.tsx:198` | «Посилання» (`disabled` без сохранённого проекта). |
| `header-pdf` | `Header.tsx:231` | «PDF / Завантажити» — триггер меню (`aria-haspopup="menu"`). |
| `pdf-financial` | `Header.tsx:246` | Пункт меню «Фінансовий підсумок (PDF)». Рендерится только при открытом меню. |
| `pdf-financial-technical` | `Header.tsx:257` | Пункт меню «Фінанси + технічний розрахунок (PDF)». Рендерится только при открытом меню. |

## 6. Маркеры состояния результата

| Атрибут | Файл:строка | Значения | Источник значения |
| --- | --- | --- | --- |
| `data-testid="result-panel"` | `frontend/src/components/RecommendationsBlock/RecommendationsBlock.tsx:90` | — | Корневой `<div>` блока «Результати розрахунку» (шаг `technicalResult`). |
| `data-source` | `RecommendationsBlock.tsx:91` | `api` \| `quick` | `apiHeatLoss != null`. Это **ровно тот же признак**, из которого `HeatLossSummaryTable.tsx:27-28` строит подпись «Джерело: розрахунок API за огородженнями» / «Джерело: швидка оцінка (100 Вт/м²)»: `apiHeatLoss` приходит в обе точки одним и тем же пропом из `AppSurveyContent`. Новой сущности не заводилось. |
| `data-calc-phase` | `RecommendationsBlock.tsx:92` | `idle` \| `pending` \| `ok` \| `error` | Существующее состояние `SurveySessionState.uiPhase` (`frontend/src/surveySession/types.ts:20`, тип `SurveyUiPhase = 'idle' \| 'stable' \| 'recalculating' \| 'error'`) плюс уже существовавший в компоненте `showRecalculating`. |

### Отображение `data-calc-phase`

В состоянии проекта словарь фаз другой, чем в ТЗ. Отображение 1:1, без новой логики:

| Условие (существующее состояние) | `data-calc-phase` |
| --- | --- |
| `showRecalculating` = `calcLoading \|\| reportIsStale \|\| uiPhase === 'recalculating'` | `pending` |
| `uiPhase === 'error'` | `error` |
| `uiPhase === 'stable'` | `ok` |
| иначе (`uiPhase === 'idle'`) | `idle` |

`showRecalculating` — константа, которая была в компоненте **до** правок и уже
управляла показом плашки «Оновлення розрахунку на сервері…». Ничего нового не
вычисляется, только переименовываются значения для машинного чтения.

Практический вывод для набора: BUG-04 (после ошибки на экране остаётся
предыдущий результат с правильной подписью) теперь ловится как
`data-calc-phase="error"` при `data-source="api"` — подпись при этом врёт,
а атрибут нет.

## 7. Смета

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `estimate-total` | `frontend/src/components/FinancialSummary/FinancialSummaryTable.tsx:230` | `<tr class="grandRow">` со строкой «Загальна вартість об'єкта». Сумма — в последней `<td>`. |
| `estimate-empty` | `FinancialSummaryTable.tsx:139` | `<p role="status">` «Немає актуальної кошторису. Заповніть анкету та дочекайтеся розрахунку.» |

> `FinancialSummaryTable` рендерится на шаге `financialResult` **и** на публичной
> странице `SharePresentationPage.tsx:172`. Оба `data-testid` появятся и там.

## 8. Ошибка расчёта

| `data-testid` | Файл:строка | Элемент |
| --- | --- | --- |
| `calc-error` | `frontend/src/AppSurveyContent.tsx:393` | `<div role="alert">` с текстом `calcError`, в т.ч. «Некоректні вхідні дані». |

**`data-error-code` не добавлен.** В состоянии фронтенда кода ошибки нет:
`SurveySessionState.calcError` имеет тип `string | null`
(`frontend/src/surveySession/types.ts:74`), в него кладётся только сообщение.
`frontend/src/utils/apiError.ts` (`parseApiErrorMessage`) читает из ответа
`{ ok: false, error: { message } }` **исключительно** `message` — поле `code`
из ответа бекенда (`backend/src/api/validate.js:282`, `ERROR_CODES.VALIDATION_ERROR`)
до фронтенда не доезжает. Чтобы получить `data-error-code`, нужно протянуть
`code` через `parseApiErrorMessage` → `useSurveyCalc` → `applyCalcResponseFail`
→ `SurveySessionState`. Это изменение состояния и типов, то есть **требует
рефакторинга** — за границами данной задачи.

---

## Что осталось непокрытым / требует рефакторинга

1. **`data-error-code`** — см. раздел 8. Нужен проброс `code` из тела ответа
   API в состояние сессии.
2. **`field-client-name` не на шаге «Об'єкт»** — поле физически в `Header`.
   Атрибут добавлен по месту рендера; переносить поле в форму шага — это
   изменение структуры, не делалось.
3. **Подпись «Джерело: …» осталась в `HeatLossSummaryTable`**, а машиночитаемый
   `data-source` — на родительском `result-panel`. Компонент
   `HeatLossSummaryTable` — чисто презентационный, `uiPhase` в него не приходит;
   сводить оба маркера в один узел означало бы менять пропсы компонента.
   Для набора это не проблема: `data-source` читается с `[data-testid="result-panel"]`.

## Проверки после правок

| Команда | Результат |
| --- | --- |
| `npm ci` (в `frontend/`) | exit 0 |
| `npm run typecheck` | exit 0, вывод пуст |
| `npm run lint` | exit 0, вывод пуст |
| `npm run verify:dead-code` (knip) | exit 0 |
| `node scripts/verifyNoTypeBypass.mjs` | `verifyNoTypeBypass: OK`, exit 0 |

Ни одного `any`, `@ts-ignore` или `@ts-expect-error` не добавлено.
