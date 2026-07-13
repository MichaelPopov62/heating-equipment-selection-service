# Агрегат радиаторов: emittersSummary

## Проблема

`totalSections` суммировал только `sections` и **игнорировал панели** (`sections: null`).
Сравнение Economy (секции) vs Efficient (панель) давало ложные KPI (например 35 / 18).
Поле `outputPerSectionWatts` для панели ошибочно содержало мощность всего прибора.

## Контракт

- `RadiatorsEmittersSummary` — `panelUnits`, `sectionalUnits`, `sectionalSections`, `totalDeliverableWatts`, …
- `totalSections` ≡ `emittersSummary.sectionalSections` (панели не входят)
- `byRoom.deliverableWatts`, `displayKind`, `unitsCount`
- для `priceBasis=panel`: `outputPerSectionWatts = 0`, мощность в `deliverableWatts`
- `roomEmitterDiffs[]` — сравнение kind между lineEconomy и lineEfficient

## Алгоритм панели

`pickPanelSkuForRoom(..., windowOpeningWidthMm)` сначала ищет панели с
`length ≥ 0.7 × openingWidth`, затем fallback. `secWidthOk` считается **после**
правила окна на секциях.

## Verify

```bash
cd backend && npm run verify:radiator-emitters
```

Схемы: `components/schemas/RadiatorsEmittersSummary.yaml`, `RadiatorsRoomEmitterDiff.yaml`.

См. также: [`radiator-connection.md`](radiator-connection.md) — подводка side/bottom;
[`radiator-emitter-kind.md`](radiator-emitter-kind.md) — единый тип приборов на объект (Two-Pass).

