# Расчётная температура воздуха помещения

Smart fallback **температуры воздуха** (не теплоносителя) без обязательного per-room поля в анкете.

## SSOT

`shared/roomDesignAirTemp.js` → `resolveDesignRoomAirTempC({ roomType, insideC, bathroomAirTempC? })`

Используется в:

- `logic/heatlossByRooms.js` — ΔT ограждений
- `logic/warmFloorCalc.js` — q↑ / поверхность / петли
- `matching/internal/pickRadiatorsCore.js` — ΔTmean радиатора по комнате
- `matching/unibox.js` — фильтр `minAirTempC` / `maxAirTempC`

## Правила

| `room.type` | Расчётная T воздуха |
|-------------|---------------------|
| `санузел` | `max(bathroomAirTempC ?? insideC, 24)` |
| остальные | `temps.insideC` |

| Поле анкеты | Смысл |
|-------------|--------|
| `temps.insideC` | Общая T воздуха объекта (опросный SSOT в `report.temps`) |
| `temps.bathroomAirTempC` | Опционально; **≥ 24**, **≤ 35**; только воздух санузла |

Примеры для санузла: `insideC=20` → 24 (пол); `insideC=26` → 26; `bathroomAirTempC=27` → 27.

В отчёте комнаты: `designAirTempC`, `designAirTempSource` (`survey` | `bathroom_field` | `floor`).

## Verify

```bash
cd backend && npm run verify:room-design-air-temp
```

См. также [`unibox-matching.md`](unibox-matching.md).
