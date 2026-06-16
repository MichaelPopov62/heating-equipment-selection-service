# Положение помещения (`roomExteriorLayout`)

Анкета (frontend) и поле **`building.rooms[].roomExteriorLayout`** в API для **дома** и **квартиры**.

## Режимы и расчёт теплопотерь

| `roomExteriorLayout` | UI | Стены в API | `heatLossFactor` (wall/window) | ΔT |
|----------------------|-----|-------------|-------------------------------|-----|
| `corner` | Стена №1 + №2 | 2× `"наружная стена"` | **(1 + β ориентации) × 1.08** | уличный `inside − outside` |
| `facade` | Стена №1 | 1× `"наружная стена"` | **(1 + β ориентации)** | уличный |
| `internal` | стена в коридор | 1× `"стена в неотапливаемый коридор"` | **1** (β не применяется) | **`inside − 15 °C`** |

- **U** — из `objectMeta.externalWalls`; для internal основной эффект — **пониженный ΔT** (~9× меньше Q при той же площади).
- **Угловой множитель 1.08** — 8 % (диапазон ТЗ 5–10 %), на все `kind=wall|window` комнаты при `corner`.

В отчёте: `heatLossFactor`, `cornerRoomFactor`, `adjacentTempC`, `deltaT` по элементам.

## Валидация (400 `ROOM_EXTERIOR_LAYOUT_WALLS`)

После нормализации layout проверяется число стен:

- `internal` — ровно 1 коридорная, 0 фасадных
- `facade` — ровно 1 фасадная
- `corner` — ровно 2 фасадные

## Модули

| Файл | Роль |
|------|------|
| `frontend/src/utils/roomExteriorLayout.ts` | UI, infer, payload |
| `backend/src/logic/roomExteriorLayoutHeatLoss.js` | ΔT, U, heatLossFactor, validate |
| `backend/src/logic/heatlossByRooms.js` | интеграция в расчёт |
| `backend/scripts/verifyRoomExteriorLayoutHeatLoss.js` | автопроверка |

## Проверка

```bash
cd backend && node scripts/verifyRoomExteriorLayoutHeatLoss.js
```

## FAQ

**Почему `heatLossFactor: 1.1` на северной стене?**  
Это β ориентации (N → +10 %). Для `corner` дополнительно ×1.08 → ~1.19.

**Почему internal Q намного меньше?**  
ΔT ≈ 5 K вместо ~42 K и U перегородки вместо фасадной сборки.
