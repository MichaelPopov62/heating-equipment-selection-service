# Финансовый итог (report.commercial)

Коммерческая смета после подбора оборудования и гидравлики. UI — шаг анкеты **«Итог финансовый»** (после «Справочник данных»).

## Источник правды

| Слой | Модуль |
|------|--------|
| Сборка | `backend/src/report/buildFinancialBom.js` → `buildFinancialBom` |
| Вызов | `buildReport.js` после hydraulics, поле `report.commercial` |
| Контракт | OpenAPI `CommercialBomReport` / `FinancialBomLine` |
| Verify | `npm run verify:financial-bom` (входит в `backend` `verify`) |
| UI | `FinancialSummaryTable` + `parseCommercialBomFromReport` |

## Правила

- Учитывается **только основная линия**: `matching.boiler.proposal`, корневой `matching.radiators` (не economy/efficient).
- Монтаж: **40%** от `equipmentTotalUah`; расходники: **15%** — строки `kind: labor | consumable` в том же `lines[]`.
- Смесительный узел ТП при `isMixingNodeRequired`: строка `kind: note`, модель/note **«сборка самостоятельно»**, без суммы (не входит в equipment).
- Встроенный насос котла (`pumpSource: boiler_builtin`) в смету **не** добавляется.
- Одинаковые позиции схлопываются (`collapseFinancialBomLines`): сумма qty и lineTotal.
- Радиаторы: в `byRoom` поле `unitPriceUah` из каталога; в смете цена прибора = цена×секции (section) или цена панели.

## Итоги (`totals`)

- `equipmentQtyPcs` — сумма qty с `qtyUnit=pcs` и `kind=equipment`
- `equipmentTotalUah` — сумма денежных строк оборудования
- `grandTotalUah` = оборудование + монтаж + расходники

Валюта: **UAH**.
