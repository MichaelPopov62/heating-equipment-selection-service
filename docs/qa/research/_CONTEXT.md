# КОНТЕКСТ ПРОЕКТА HeatCalc (общий брифинг для QA-агентов)

> Это проверенная фактура от владельца продукта. Принимай как отправную точку,
> но ПЕРЕПРОВЕРЯЙ по коду перед тем, как строить на этом выводы.
> Любое утверждение о поведении кода в твоём отчёте — с якорем `path/to/file.js:line`.
> Если проверить не удалось — пиши «НЕ ПРОВЕРЕНО» явно, не догадывайся.

## Что это
B2B/B2C сервис инженерного подбора отопления: анкета → климат → теплопотери → ГВС →
подбор оборудования → гидравлика → JSON-отчёт → коммерческая смета → PDF → публичная share-ссылка.

## Стек и масштаб
- Монорепо: `backend/` (Express, ESM, JS + строгая JSDoc-типизация с `checkJs`),
  `frontend/` (React 19 + Vite + TS + React Query + react-router),
  `shared/` (общие контракты), `components/schemas/` + `openapi.yaml` (25 путей).
- ~63 000 строк в 513 файлах. 123 коммита, 16.06.2026 → 13.08.2026.
- MongoDB / Mongoose. Auth — Clerk (frontend SDK) + JWKS-верификация на backend через `jose`.
- PDF — Puppeteer/Chromium (`backend/Dockerfile`, `docker-compose.pdf.yml`).
- Деплой: Vercel (frontend) + Render (backend).

## Расчётный пайплайн
`api/runCalculation.js` → `getReferenceBundle()` → `toCalcRuntimeContext()` →
`validateAndNormalizeInput(body, ctx)` (AJV) → `buildReport({ input, ctx })`
(`backend/src/report/buildReport.js`, 771 строка).
Внутри: климат → `logic/heatlossByRooms.js` → `logic/hotWater.js` →
`matching/*` (boiler, radiators, warmFloor, waterHeater, indirectWaterHeater, manifold, unibox) →
`hydraulics/*` → `recommendations/*` → `report/buildFinancialBom.js`.

## Шаги анкеты (SSOT — `frontend/src/constants/surveySteps.ts`)
`object → warmFloor → rooms → hotWater → boiler → radiators → waterHeater → hydraulics →
technicalResult → dataReference → financialResult`

## Состояние тестирования — стартовая точка
- Файлов `*.test.*` / `*.spec.*` — **ноль**. Ни vitest, ни jest, ни playwright в зависимостях.
- Вместо тестов — ~55 самописных скриптов `backend/scripts/verifyXxx.js` и ~13
  `frontend/scripts/verifyXxx.mjs`, собранных в `npm run verify`. Это ассерт-скрипты без
  фреймворка: нет покрытия, нет пер-кейсового отчёта, нет E2E.
- Есть `backend/scripts/fuzz-calc.ts` (652 строки, `npm run test:fuzz`) — уже правильное
  направление, изучить и переиспользовать.
- CI: `.github/workflows/verify.yml` — node 22.22.0, `npm ci` в shared/backend/frontend,
  копирует `test_data.json.example` → `test_data.json`, гоняет backend verify и frontend verify.

## Ключ к герметичному прогону тестов (главный технический разблокиратор) — `backend/.env.example`
- `PROJECTS_AUTH_ENABLED` — в dev auth выключен по умолчанию;
  `PROJECTS_DEV_OWNER_ID=000000000000000000000001` подставляет владельца проектов без Clerk.
- `AUTH_JWT_SECRET` — путь HS256 для `verify:auth-pipeline`, т.е. тестовые JWT можно выпускать
  локально, не поднимая Clerk.
- `RATE_LIMIT_DISABLED=true` и пофичевые `RATE_LIMIT_*` — управляемость лимитов в тестах.
- `CATALOG_SOURCE=file` + `backend/test_data.json.example` — детерминированный каталог без Mongo.
- `PDF_REQUIRE_BROWSER=1`, `PDF_BROWSER_EXECUTABLE`, `PDF_MAX_CONCURRENT`, `PDF_QUEUE_WAIT_MS`.
- `REFERENCE_WARMUP_BLOCK_STARTUP`, `SYSTEM_INTERNAL_TOKEN` +
  `POST /api/v1/system/invalidate-reference-cache` — контроль кэша справочников между тестами.
- Frontend: `VITE_PROJECTS_BEARER_TOKEN` — Bearer для API проектов без Clerk UI,
  `VITE_AUTH_REQUIRED`, `VITE_API_BASE_URL` (пусто → Vite proxy).

## Внешние зависимости, обязательные к моканию
`backend/src/climate/geocode.js:59` (Nominatim) и `backend/src/climate/snipClimate.js:108,132`
(Meteostat bulk, `METEOSTAT_YEARS=10`) ходят в реальный интернет через `fetch`.
Без стаба любой тест расчёта — флейки и зависимость от чужого аптайма.

## Загрузчик фикстур, который уже есть
`POST /api/v1/projects/import` (admin-only, `403 ADMIN_REQUIRED` для user) принимает
`ProjectExportBundle v1` — проект + история `calculations` с `calcInput`, `report`, `summary`.
Готовый механизм детерминированной подготовки состояния для E2E и золотых эталонов.
См. `docs/project-export-import.md`.

## Каталог (`backend/test_data.json.example`, `schemaVersion: 1`, `generatedAt: 2026-04-21`, UAH)
котлы двухконтурные 13, одноконтурные 11, радиаторы 13, водонагреватели 5, трубы 30, БКН 13,
насосы 15, коллекторы 14, коллекторы котловые 3, униботы 9. Итого ~126 SKU.
Плюс `backend/data/`: `appliances.json`, `recommendations.json` (36 КБ),
`underfloor_heating_presets.json`, `water_norms.json`.

## Финансовая смета (`docs/financial-summary.md`)
Монтаж — 40% от `equipmentTotalUah`, расходники — 15%. Смесительный узел ТП при
`isMixingNodeRequired` — строка `kind: note` без суммы. Встроенный насос котла
(`pumpSource: boiler_builtin`) в смету не входит. Одинаковые позиции схлопываются.
Учитывается только основная линия matching, не economy/efficient.

## Авторизация (`docs/auth.md`)
Clerk JWT → `verifyAccessToken` (JOSE+JWKS) → `mapJwtPayload` → `resolveUser` → Mongo `users` →
`req.user.id` → `projects.ownerId`. IDOR для `role=user`: чужой `projectId` → `404 PROJECT_NOT_FOUND`.
Admin видит всё; cross-owner доступ логируется. `role=admin` — если email ∈ `PLATFORM_ADMIN_EMAILS`.
**Важно:** `subscription` (`free|pro|marketplace`) — чистая метка без квот.
В `backend/src/auth/authorizationPolicy.js:2` прямо написано «role/subscription без quota-gates».
Единственное применение — контакт публикатора на share (`buildPublisherPresentation.js:14`).
Гейтов по тарифу тестировать нечего — но в план надо заложить раздел
«тесты, которые понадобятся, когда появится платный гейт» отдельным отложенным блоком.

## Публичные и потенциально уязвимые поверхности
- `POST /api/v1/calc` — публичный, без auth, только rate-limit, отдаёт полный отчёт со сметой.
- `GET /api/v1/public/shares/{token}` и `/pdf` — без JWT.
- Rate limits (окно 15 мин): calc — dev 120 / prod 20, project calc 15, projects write 60,
  projects read 120, public share 120, feedback 20.

## Язык UI — украинский
`docs/language-policy.md`, есть verify-скрипт. Тексты в ассертах E2E брать оттуда, не выдумывать.

## Доменная документация — 33 файла в `docs/`
`project-structure.md` (SSOT дерева, 40 КБ), `auth.md` (34 КБ), `calc-input-validation.md`,
`calc-runtime-context.md`, `hydraulics-pipeline.md`, `financial-summary.md`, `projects-api.md`,
`project-pdf.md`, `client-share-and-layers.md`, `manifold-matching.md`, `unibox-matching.md`,
`ufh-*.md`, `radiator-*.md`, `room-*.md`, `water-heater-form.md`, `heating-schemes-*.md`,
`frontend-calc-runner.md`, `survey-draft.md`, `start-state.md`, `frontend-dev-panel.md`,
`project-export-import.md`, `type-safety.md`, `language-policy.md`.
**Внимание:** `.cursorrules` упоминается в README как контракт, но он в `.gitignore` и в
репозитории его нет. Не строй на нём планы; отметь как gap.

## Известные ограничения продукта
Тепловых насосов в каталоге и matching нет (scope: газовые/электрические котлы класса Baxi).
Render free — cold start первого запроса.

## ГЛАВНЫЙ СИМПТОМ, РАДИ КОТОРОГО ВСЁ ЗАТЕВАЕТСЯ
**Владелец продукта — сам автор кода и предметный эксперт-теплотехник — не смог заполнить
собственную анкету так, чтобы получить расчёт.** Это дефект уровня P0: если не проходит автор,
не пройдёт ни один мастер. Результаты живого прохождения формы четырьмя персонами лежат в
`docs/qa/research/U1-ux-novice.md`, `U2-ux-installer.md`, `U3-ux-minimal-path.md`,
`U4-ux-adversarial.md`, разбор причин — `U5-ux-rootcause.md`.

## СКВОЗНАЯ ПРИОРИТИЗАЦИЯ (обязательна для каждого кейса и каждой рекомендации)
- `P0` — блокирует выход на живых мастеров;
- `P1` — блокирует приём денег;
- `P2` — нужно, но после первых денег.

## ПРИОРИТЕТ ПОКРЫТИЯ, ЗАДАННЫЙ ВЛАДЕЛЬЦЕМ
0. Проходимость анкеты (блокирует всё остальное).
1. E2E — основной вес. Реальные пользовательские сценарии под разные сетапы объекта.
2. Полное покрытие расчётного ядра и движка подбора — физика и matching. Это продукт, за
   который будут брать деньги.
3. Остальное (API-контракт, безопасность, производительность, нефункциональные) — по
   остаточному принципу, но должно быть в плане.

## ЖЁСТКИЕ ПРАВИЛА ДЛЯ ВСЕХ АГЕНТОВ
1. Никаких выдуманных фактов. Якорь `file:line` на каждое утверждение о коде.
2. **Не писать код тестов.** Продукт этой работы — план, а не реализация. Максимум —
   сигнатуры, имена файлов, псевдокод одного показательного кейса.
3. Результат — в свой файл, плюс сжатая выжимка до 400 слов оркестратору.
4. **Не устанавливать зависимости и не менять код продукта.** `node_modules` не установлены.
   Если нужен прогон — сначала спроси разрешения у оркестратора.
5. Язык артефактов — русский; технические термины и идентификаторы — как в коде (английский).
   Ассерты на UI-тексты — украинский, дословно из исходников.
