# Глобальный тип излучателей (sectional / panel) — Two-Pass Orchestrator

## Вводная (обязательная)

Реализация ведётся **только как production-пакет**: полный контракт, оркестратор,
эскалация (включая несколько приборов в комнате), рекомендации, UI, гидравлика
и verify в **одном** релизе.

Запрещено:
- минимальный / MVP-срез «сначала только lock без эскалации»;
- заглушки, пустые enum, TODO/FIXME «на будущее»;
- откладывание `unitsCount > 1`, warning дефицита или единообразия линий
  economy/efficient на следующий этап.

## Проблема

До v3 выбор `section` vs `panel` выполнялся **локально** в комнате
(нижняя подводка, правило окна, порог >N секций, отсутствие секций).
На одном объекте в разных комнатах могли оказаться разные типы приборов —
неприемлемо для сметы и монтажа.

## Решение

### 1. Глобальный preference

`heatingSystem.radiatorEmitterPreference`:

| Значение | Поведение |
|----------|-----------|
| `auto` (default) | Pass 1 (голоса) → один kind на объект → Pass 2 |
| `sectional` | Kind зафиксирован; Pass 1 для kind не нужен |
| `panel` | Аналогично |

Поле **ортогонально** `radiatorConnection` (`side` \| `bottom`).
Подводка фильтрует панельный пул (K/Klasik vs VK/VKP) и **не** переключает тип прибора.

Нормализация: `normalizeRadiatorEmitterPreference` (пустое/неизвестное → `auto`)
в `normalizeHeatingSystemThermalRegime`. Черновики без поля → `auto`.

Shared: `shared/radiatorEmitterPreference.js`.

### 2. Two-Pass Orchestrator

Модули:
- `matching/internal/decideObjectEmitterKind.js` — preference / majority / tie;
- `matching/internal/exploreRoomEmitterKind.js` — Pass 1 (голос);
- `matching/internal/sizeForcedRoomEmitter.js` — Pass 2 + эскалация;
- оркестрация — `pickRadiators` / `pickRadiatorsWithProposalLines`.

**Pass 1 (Dry Run, только при `auto`):** по комнатам с радиаторами —
локальный «идеальный» kind + reason. Skip / ufh-only / micro-skip не голосуют.

**Решение:** majority; ничья → `sectional` (`appliances.radiator.emitterKind.tieBreakKind`).
Результат: `resolvedEmitterKind`, `emitterKindVotes`, `emitterKindDecisionNotes`.

**Pass 2 (Decisive):** все комнаты с одним `forcedKind`. Локальный flip kind
запрещён.

**Линии proposal:** kind выбирается **один раз** на объекте (основная линия)
и **принудительно** применяется к `lineEconomy` / `lineEfficient`
(`forcedEmitterKind`). Разный `displayKind` между линиями — дефект.

### 3. Эскалация при forced kind

Вместо скрытого перехода на другой тип:

1. Подбор в пуле того же kind (в т.ч. другая высота / большая Вт/секцию).
2. Несколько приборов в комнате (`unitsCount ≥ 2`), если геометрия окон позволяет.
3. Иначе — максимальный достижимый вариант того же kind + warning с дефицитом Вт.

Параметры: `appliances.radiator.emitterKind` (`schemaVersion: 3`):
`maxSectionsBeforeMultiUnit`, `maxUnitsPerRoom`, `maxSectionsHeuristic`,
`sectionalCandidatesPerRoom`, `tieBreakKind`.

`unitsCount` участвует в отчёте, `emittersSummary` и в `flowRateM3PerHour`
(нагрузка комнаты; при multi-unit — суммарная отдача приборов).

### 4. Micro-load

`pickMinimumViableForcedKind` использует тот же `forcedKind` объекта.

## Контракт отчёта

- `matching.radiators.inputs.radiatorEmitterPreference`
- `matching.radiators.resolvedEmitterKind`
- `matching.radiators.emitterKindVotes`
- `matching.radiators.emitterKindDecisionNotes`
- `byRoom[].displayKind`, `unitsCount`, `deliverableWatts`
- те же поля kind на линиях economy/efficient

Рекомендации: `REC_RADIATOR_EMITTER_KIND_MAJORITY`, `REC_RADIATOR_MULTI_UNIT`,
`WARN_RADIATOR_KIND_LOCKED_UNDERPOWERED`.

## UI

Анкета (шаг «Котёл»): preference рядом с подводкой.
В отчёте — единый тип по объекту; `unitsCount` в колонке количества.

## Verify

```bash
cd backend && npm run verify:radiator-emitter-kind
```

Обязательные сценарии: majority без flip; hard lock; `bottom` + sectional;
multi-unit; underpowered warning; одинаковый kind на main/economy/efficient.

См. также: [`radiator-connection.md`](radiator-connection.md),
[`radiator-emitters-summary.md`](radiator-emitters-summary.md).
