# Політика мови сервісу (UA)

Єдиний стандарт user-facing текстів. Цей документ — **SSOT правил** (поточний стан: усі шари нижче — українською).

Пов’язані документи: [`.cursorrules`](../.cursorrules), [`project-structure.md`](project-structure.md), [`room-exterior-layout.md`](room-exterior-layout.md).

---

## 1. Ціль

**100 % користувацьких текстів** сервісу — **українська мова**:

- UI анкети та звітів (label, placeholder, hint, button, aria)
- Підказки котла, ТП, гідравліки
- Backend-справочники (`recommendations.json`, `envelopePresets.js`, …)
- Повідомлення валідації, HTTP-помилки, PDF
- Inline warnings у `report.warnings[]`

**Стратегія:** прямa заміна RU → UA in-place. **Без** i18n-фреймворку для другої мови (окрім shell `frontend/src/i18n/uk/*`).

---

## 2. Що перекладаємо

| Категорія | Приклади |
|-----------|----------|
| Label | `<label>`, `styles.label`, заголовки секцій |
| Placeholder | `placeholder="…"` |
| Hint / підказка | `<p className={styles.hint}>`, tooltip, `title` |
| Button / link text | текст між тегами кнопок |
| aria-label / aria-labelledby | доступність |
| Текст `<option>` | **лише текст між тегами**, не `value=` |
| Повідомлення валідації | `throw new Error('…')`, `return '…'` з validate-* |
| Backend display | `title`, `text`, `material`, `description` у JSON/JS data |
| PDF / print HTML | видимий користувачу текст |
| Toast / dialog | повідомлення в UI |

**Правило per-file:** у кожному зміненому файлі перекладаються **всі** user-facing рядки згідно з таблицею вище.

---

## 3. Що **не** перекладаємо

| Категорія | Приклади | Причина |
|-----------|----------|---------|
| Імена змінних, функцій | `roomLayout`, `ufhEnabled` | код |
| Ключі об’єктів / DTO | `roomId`, `floorPresetId`, `externalWall1` | контракт |
| Enum **values** (payload) | `'санузел'`, `'гостиная'`, `'facade'` | AJV / state |
| **Construction (calc input)** | `'наружная стена'`, `'стена в неотапливаемый коридор'` | API contract |
| Scheme keys | `maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw` | enum key |
| Preset / recommendation **id** | `wall_gas_concrete_d500`, `WARN_BOILER_UNDERPOWERED` | ключі довідників |
| Recommendation **code** | `REC_*`, `WARN_*` | ключі в коді |
| Legacy compat values | `living`, `bathroom`, `жилое` | нормалізація при завантаженні SurveyDraft (не в API) |
| CSS class names | `styles.label` | код |
| Коментарі / JSDoc | `/** … */` | dev-only |
| OpenAPI descriptions | yaml dev-docs | dev-only |

---

## 4. Правило «payload vs display»

| Контекст | `'наружная стена'` | Дія |
|----------|-------------------|-----|
| **Calc payload** (`envelopeElements[].construction`) | значення enum | **Не змінювати** |
| **Display** (`envelopePresets.js` → `construction`, підпис `<option>`) | текст на екрані | **UA** → `зовнішня стіна` |

Типи кімнат: `room.type = 'санузел'` — **value не змінювати**; label у селекті — **UA**.

---

## 5. Whitelist (grep-аудит)

Допустимі після gate **0** user-facing RU поза whitelist:

### 5.1 Типи приміщень (enum values)

`shared/roomTypeNormalization.js` → `CANONICAL_ROOM_TYPES`:
`прихожая`, `тамбур`, `гостиная`, `коридор`, `спальня`, `кухня`, `санузел`, `тех`, `котельная`, `помещение`

**Backend synonym** (`ROOM_TYPE_SYNONYMS`): `kitchen`, `гостинная`, …

**Frontend-only** (`LEGACY_ROOM_TYPE_MAP`, не відправляти в API): `жилое`, `living`, `bathroom`, `tech`.

### 5.2 Construction (calc input)

`наружная стена`, `стена в неотапливаемый коридор`

### 5.3 Layout / scheme / preset ids

`corner`, `facade`, `internal`; scheme keys §3; `traditional_dt50_75_65`, `condensing_dt30_55_45`, …

### 5.4 Verify / test fixtures

`backend/scripts/verify*.js`, `fuzz-calc.ts` — payload рядки з whitelist construction/room types.

---

## 6. Джерела текстів (поточний стан)

| Шар | Шлях | Мова |
|-----|------|------|
| Shell UI | `frontend/src/i18n/uk/*.ts` | UA |
| Анкета / звіти | `frontend/src/components/`, `constants/`, `utils/` | UA |
| Shared labels | `shared/heatingMatchingSchemes.js`, … | UA |
| Recommendations | `backend/data/recommendations.json` | UA |
| Envelope presets | `backend/src/logic/envelopePresets.js` | UA |
| UFH presets | `backend/data/underfloor_heating_presets.json` | UA |
| Inline backend | `validate.js`, `matching/*.js`, PDF builders | UA |
| Products (каталог) | `backend/test_data.json.example` → Mongo `products` | UA |

**Автоперевірка:** `npm run verify:language-policy`; `npm run verify:catalog-language` (backend / `products`).

---

## 7. Чеклист на зміну файлу

- [ ] Label / placeholder / hint / button / aria — UA
- [ ] Тексти `<option>` — UA; `value=` — без змін
- [ ] Enum payload — **без diff**
- [ ] `npm run verify` — green

---

## 8. Автоперевірка мови

```bash
npm run verify:language-policy
```

Скрипт: [`scripts/verifyLanguagePolicy.mjs`](../scripts/verifyLanguagePolicy.mjs). Входить у корневий `npm run verify`.

**Очікування:** `verifyLanguagePolicy: OK`, **0** user-facing RU поза whitelist §5.

---

## 9. Definition of Done

- [x] 100 % user-facing текст — українська
- [x] Enum values calc payload — не змінені (whitelist §5)
- [x] `npm run verify` — green
- [x] `npm run verify:language-policy` — green
- [ ] Smoke E2E UI (11 кроків, PDF, share, 400) — ручний чеклист §10

---

## 10. Ручний Smoke E2E UI

Автоматичний `npm run verify` не покриває повний UI-прогон:

- [ ] 11 кроків анкети — label / hint / button на UA
- [ ] Автопересчёт / «Помилка розрахунку» при недоступному backend
- [ ] Крок `technicalResult` — гідравліка: «Контур опалення / теплої підлоги»
- [ ] PDF завантажується, текст UA
- [ ] Share link публікується
- [ ] POST `{}` → 400 з UA-повідомленнями (якщо backend віддає)

---

## 11. Операційний крок (Mongo production)

Якщо `CATALOG_SOURCE=mongo`: після оновлення JSON-еталонів — `npm run seed` у `backend/` або TTL `REFERENCE_CACHE_TTL_MS` / `POST /api/v1/system/invalidate-reference-cache`, інакше в БД можуть лишитися застарілі тексти recommendations/presets.
