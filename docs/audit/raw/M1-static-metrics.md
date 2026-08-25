# M1 — Объективные статические метрики

> Агент M1. Задача — **добыть числа**, а не интерпретировать. Интерпретация — за осями A1–A6.
> Всё ниже получено **реальным запуском** инструментов 23.08.2026 на ветке `qa/audit-and-persona-suite`
> (HEAD `8f6a35d`). Сырые выводы — в `docs/audit/artifacts/`.
>
> Окружение: macOS darwin 25.6.0 (arm64), **node v26.7.0**, npm 11.19.0, graphviz 15.1.1
> (установлен мной через `brew install graphviz` — до этого `dot` в системе не было).
> Все инструменты ставились через `npx -y`, `package.json` проектов **не изменялись**.
> Временные конфиги (`backend/knip.audit*.json`, `backend/eslint.audit.config.mjs`,
> `frontend/eslint.audit.config.mjs`) **созданы и удалены за собой** — `git status` чист,
> кроме `docs/audit/` (проверено, см. конец отчёта).

---

## 0. Сводная таблица: инструмент → версия → команда → статус

| # | Инструмент | Версия | Команда (сокр.) | Статус | Артефакт | Одной строкой |
|---|---|---|---|---|---|---|
| 1 | madge (циклы) | 8.0.0 | `npx -y madge --circular --extensions js,ts,tsx backend/src` (+ frontend, shared) | OK | `madge-circular.txt` | 2 цикла в backend, 1 в frontend, 0 в shared — **все три только между типами** |
| 2 | madge (сироты) | 8.0.0 | `npx -y madge --orphans …` | OK | `madge-orphans.txt` | backend 13, frontend 2, shared 21 «сирот» — но 90 % объясняются границей скана |
| 3 | madge (граф SVG) | 8.0.0 | `npx -y madge --image docs/audit/artifacts/graph-*.svg …` | OK | `graph-backend.svg` (415 КБ), `graph-frontend.svg` (899 КБ), `graph-shared.svg` (19 КБ) | картинки есть — graphviz поставлен |
| 4 | madge (JSON-граф) | 8.0.0 | `npx -y madge --json …` | OK | `graph-*.json` | сырьё для метрик fan-in/fan-out (§4) |
| 5 | jscpd | 5.0.16 | `npx -y jscpd backend/src frontend/src shared --min-lines 15 --reporters console,json --output docs/audit/artifacts/jscpd` | OK | `jscpd-console.txt`, `jscpd-top.tsv`, `jscpd/jscpd-report.json` | 49 клонов, **1.82 % строк**; в JS/TS — 0.88–0.95 %, весь дубляж в CSS (11.34 %) |
| 6 | knip (backend, entry = src + scripts) | 6.32.2 | `npx -y knip --config knip.audit.json --no-exit-code` из `backend/` | OK | `knip-backend.txt` | 0 мёртвых файлов, **70 неиспользуемых экспортов**, 2 незадекларированные зависимости |
| 7 | knip (backend, entry = только `src/index.js`) | 6.32.2 | `npx -y knip --config knip.audit3.json --no-exit-code --production` из `backend/` | OK | `knip-backend-runtime-only.txt` | **10 файлов и 127 экспортов недостижимы из продакшн-входа** (живут ради `scripts/`) |
| 8 | knip (frontend, штатный) | 5.88.1 (локальный) | `npx knip --treat-config-hints-as-errors` из `frontend/` (= `npm run verify:dead-code`) | OK | `knip-frontend.txt` | **пусто, гейт зелёный** |
| 9 | ts-prune | 0.10.3 | `npx -y ts-prune -p frontend/tsconfig.app.json` | OK | `ts-prune-frontend.txt` | 229 записей; **45 «настоящих» неиспользуемых** (16 в `frontend/src`, 29 в `shared/`) |
| 10 | depcheck | 1.4.7 | `npx -y depcheck backend` (+ frontend, shared, e2e) | OK | `depcheck.txt` | backend: 2 лишних devDep, 1 отсутствующая; frontend/shared/e2e — чисто |
| 11 | npm audit | npm 11.19.0 | `npm audit --prefix <pkg> --json` | OK | `npm-audit-*.json`, `npm-audit-summary.txt` | backend **11 (8 high, 2 moderate, 1 low)**, frontend 1 high, shared/e2e 0 |
| 12 | npm outdated | npm 11.19.0 | `npm outdated --prefix <pkg>` | OK | `npm-outdated.txt` | мажорных лагов почти нет; 3 позиции с major-лагом (puppeteer, @types/node, typescript) |
| 13 | cloc | 2.06 | `npx -y cloc --vcs=git` + по каталогам | OK | `cloc-total.txt`, `cloc-by-dir.txt` | 947 git-файлов, **195 541 строк**; кода (JS+TS+CSS) — 68 423 |
| 14 | ESLint ad-hoc (сложность) | 10.2.1 (локальный backend/frontend) | `npx eslint --no-config-lookup --config eslint.audit.config.mjs "src/**/*.js" -f json` | OK | `eslint-complexity-*.json`, `eslint-complexity-top.txt` | **235 функций с цикломатикой > 10**, 156 функций > 60 строк; максимум **cx=256** |
| 15 | Распределение файлов по размеру | своё (node + `git ls-files`) | см. §8 | OK | `file-size-distribution.txt` | 5 файлов > 1000 строк, 20 в диапазоне 500–1000 |
| 16 | Сборка frontend | vite 8.2.0 | `npm run build --prefix frontend` | OK | `frontend-build.txt` | **сборка проходит за 3.3 с**, 6688 модулей |
| 17 | Размер бандла (gzip/brotli) | своё (node zlib) | см. §9 | OK | `frontend-bundle-sizes.txt` | JS+CSS raw 967 869 Б, **gzip 270 804 Б**, brotli 233 157 Б |
| 18 | vite-bundle-visualizer | 1.2.1 | `npx -y vite-bundle-visualizer -o ../docs/audit/artifacts/frontend-bundle-visualizer.html` | OK | `frontend-bundle-visualizer.html` (2.1 МБ) | treemap собран |
| 19 | secretlint | 13.0.4 (preset-recommend) | `cat <файлы дерева> \| xargs npx -y -p secretlint -p @secretlint/secretlint-rule-preset-recommend secretlint --secretlintrc <rc>` | OK | `secretlint.txt` | **0 находок** на 1093 файлах рабочего дерева |
| 20 | `@secretlint/quick-start` | — | `npx -y @secretlint/quick-start .` | **НЕ ЗАВЁЛСЯ (молча)** | `secretlint.txt` (заменён) | см. §10 — пустой вывод даже на заведомом лике; заменён на явный `secretlint` + preset |
| 21 | dependency-cruiser | 18.2.0 + typescript 6.0.3 | `depcruise --config <recommended-strict> --output-type err-long backend/src` (+ frontend, shared) | OK / частично | `dependency-cruiser.txt` | backend 3 нарушения, shared 9 «сирот», frontend — 21, но 20 из них **ложные** (§11) |
| 22 | Ручной grep по секретам | — | mongodb-URI / `sk_live` / JWT / `.env` | OK | `secrets-manual-grep.txt` | 0 находок, `.env` в git нет — только `.env.example` |
| 23 | Гейты проекта | — | `npm run lint/typecheck` ×3, `npm run verify --prefix backend`, 5 корневых `scripts/verify*.mjs` | OK / **1 падение** | `lint-typecheck.txt`, `backend-verify-run*.txt`, `root-verify-scripts.txt` | всё зелёное, **кроме `scripts/verifyBackendDocs.mjs` — крэш ENOENT** (§12) |

### Что не завелось и чем заменено

| Инструмент | Что произошло | Замена |
|---|---|---|
| `npx -y @secretlint/quick-start .` | Отработал с EXIT=0 и **пустым выводом**. Проверил на контрольном файле с настоящим GitHub-токеном и Stripe-ключом — quick-start **тоже промолчал**, значит он не сканировал, а не «не нашёл». | Явный `secretlint@13.0.4` с `@secretlint/secretlint-rule-preset-recommend` и rc-файлом; на том же контрольном файле он выдал 2 ошибки (`GITHUB_TOKEN`, `STRIPE_SECRET_KEY_LIVE`) — детектор работает. |
| `npx -y dependency-cruiser --no-config --validate backend/src` | Отработал, но с **пустым набором правил** (`✔ no dependency violations found (1520 modules …)` — он ещё и полез в `node_modules`). | Поставил `dependency-cruiser@18` + `typescript@6.0.3` в скрэтчпад, конфиг `extends: 'dependency-cruiser/configs/recommended-strict'` + `exclude: node_modules`. |
| `depcruise … frontend/src` из корня | `error TS5083: Cannot read file '…/frontend/tsconfig.strict-base.json'` — резолвер неправильно раскрыл `extends: "../tsconfig.strict-base.json"`. | Запущен из `frontend/` c `--ts-config tsconfig.app.json` — 373 модуля прочитаны. |
| `depcruise` по `frontend/src` без typescript в области видимости | `‼ missing-typescript-transpiler … (0 modules cruised)`. | Установлен `typescript@6.0.3` рядом с dependency-cruiser. |
| `madge --extensions ts,tsx frontend/src` | `Processed 372 files (1 warning)` → `✖ Skipped 1 file`. С `DEBUG=madge*` madge **не называет** пропущенный файл. | Не заменял. **НЕ ПРОВЕРЕНО**, какой именно файл пропущен; на выводы это не влияет (372 из 373 файлов, что видит dependency-cruiser). |
| `npm run verify --prefix backend` (первый прогон) | Упал на `verify:project-pdf`: локальный кэш puppeteer битый (Chrome 140 распакован, но `Google Chrome for Testing Framework` отсутствует → `dlopen … no such file`). **Это дефект машины, а не кода.** | Повторил с `PDF_BROWSER_EXECUTABLE=/Applications/Google Chrome.app/…` — вся цепочка прошла (§12). |
| `xargs -a` | BSD-xargs на macOS не знает `-a`. | `cat file \| xargs …`. |
| `timeout` | Нет в macOS по умолчанию. | Убран, полагался на таймаут харнесса. |

---

## 1. Циклические зависимости

`docs/audit/artifacts/madge-circular.txt`, `dependency-cruiser.txt`

| Пакет | Файлов обработано | Циклов | Цикл |
|---|---|---|---|
| `backend/src` (js,ts,tsx) | 234 | **2** | `catalog/types.d.ts → types/boiler-types.d.ts → catalog/types.d.ts`<br>`hydraulics/types.d.ts → types/shared-types.d.ts → hydraulics/types.d.ts` |
| `frontend/src` (ts,tsx) | 372 | **1** | `utils/roomEnvelopeFields.ts → utils/roomExteriorLayout.ts → utils/roomEnvelopeFields.ts` |
| `shared` (js,ts) | 25 | **0** | — |

dependency-cruiser (recommended-strict) подтвердил ровно те же 3 цикла, независимым резолвером.

**Голый факт для осей:** оба backend-цикла — **между `.d.ts`**, то есть цикл только на уровне типов,
в рантайме его нет (TS такие циклы допускает). Единственный runtime-цикл во всём монорепо —
frontend `roomEnvelopeFields ↔ roomExteriorLayout`. Читать код и решать, вреден ли он, — задача A1/A3.

---

## 2. Сироты и мёртвый код

### 2.1 madge `--orphans` (`madge-orphans.txt`)

| Пакет | «Сирот» | Список |
|---|---|---|
| `backend/src` | 13 | `index.js`, `logic/ufhLoopHydraulics.types.d.ts`, `models/{Boiler,BoilerManifold,IndirectWaterHeater,Manifold,Pipe,Pump,Radiator,Unibox,WaterHeater}.js`, `projects/migrateLegacyProjectOwnerId.js`, `types/express-augment.d.ts` |
| `frontend/src` | 2 | `main.tsx`, `vite-env.d.ts` |
| `shared` | 21 | почти весь каталог |

**Важно — не принимать за находку без поправки.** madge сканировал только указанный корень:
- `index.js` (backend) и `main.tsx` (frontend) — это точки входа, не мусор.
- 9 `models/*.js` — это mongoose-**дискриминаторы**, импортируются **только** из `backend/scripts/seed.js:14-21`.
  Это не случайность, а объявленное решение: `backend/src/models/public.js:3` — комментарий
  «discriminators (Boiler, Radiator, …) импортируются только из scripts/seed.js».
- `projects/migrateLegacyProjectOwnerId.js` — используется из `backend/scripts/migrateProjectOwnerIds.js:18`
  и `backend/scripts/verifyMigrateProjectOwnerIds.js:14`.
- 21 «сирота» в `shared` — артефакт скана: `shared/` почти не имеет внутренних связей, всё потребление
  идёт из `backend/` и `frontend/` (см. §2.4).

### 2.2 knip по backend — 2 прогона, 2 разных ответа

Конфигурация knip для backend в проекте **отсутствует** (`knip.json` есть только у frontend). Я создал два
временных конфига и удалил их.

**Прогон A — entry = `src/index.js` + `scripts/**/*` (честная модель «что реально живо»):**
`knip-backend.txt`

- Мёртвых файлов: **0**
- Неиспользуемых экспортов: **70**
- Незадекларированных зависимостей: **2** — `express-serve-static-core` (`src/types/express-augment.d.ts:6`),
  `mongodb` (`src/utils/mongoConnectionConfig.js:20`)

**Прогон B — entry = только `src/index.js`, `--production` (что нужно продакшн-серверу):**
`knip-backend-runtime-only.txt`

- Недостижимых файлов: **10** — 9 × `src/models/*.js` (дискриминаторы) + `src/projects/migrateLegacyProjectOwnerId.js`
- Неиспользуемых экспортов: **127**

Дельта A→B (127 − 70 = **57 экспортов**) — это ровно тот объём `src/`, который существует не для
продакшена, а для 62 verify-скриптов в `backend/scripts/`. Число для оценки «налога на самопальные тесты».

Топ-каталоги по неиспользуемым экспортам (прогон A, 70 шт.):
`src/logic/` — 21, `src/hydraulics/` — 13 (из них 5 — реэкспорты в `hydraulics/public.js`,
которые никто не импортирует), `src/matching/` — 11, `src/catalog/` — 11, `src/utils/` — 4,
`src/auth/` — 3, `src/api/` — 2, по 1 — `report`, `reference`, `projects`, `models`, `data`. Сумма 70.

Отдельно: `src/hydraulics/public.js:9-12`, `src/matching/public.js:9`, `src/reference/public.js:7`,
`src/api/public.js:6-7` — **барьерные `public.js` реэкспортируют то, что никем не потребляется**.
Т.е. часть публичного API слоёв — мёртвая. Это материал для A1.

### 2.3 frontend

- Штатный `knip` (`npm run verify:dead-code`) — **пусто, EXIT=0**. Гейт работает.
  Но конфиг ослаблен, и это надо знать: `frontend/knip.json` содержит
  `"ignoreExportsUsedInFile": true` и `"ignoreIssues": { "**/*": ["types"] }` —
  т.е. **неиспользуемые типы вообще не проверяются**, и `project` ограничен `src/**/*.{ts,tsx}`,
  так что `shared/` под гейт не попадает.
- `ts-prune` (без этих поблажек): 229 записей, из них 184 помечены `(used in module)`.
  «Настоящих» неиспользуемых экспортов — **45**:

| Область | Кол-во | Примеры |
|---|---|---|
| `frontend/src` | 16 | `services/catalog.ts:25,30,34,35,36` (5 типов), `types/radiatorEmitterPreference.ts:8,13,16,18` (4), `types/heatingThermalRegime.ts:9,10,11` (3), `types/radiatorConnection.ts:10,14` (2), `components/RoomsForm/RoomAccordionItem.tsx:90`, `App.tsx:35 default` |
| `shared/*.d.ts` | 29 | `ufhCircuitPresets.d.ts` (5), `ufhModePresetIds.d.ts` (5), `ufhTerminalControl.d.ts` (3), `roomDesignAirTemp.d.ts` (4), `ufhDistributionPresets.d.ts` (3), `surveyMutationKinds.ts` (1) и др. |

Оговорка: `ts-prune` смотрит только на проект `frontend/tsconfig.app.json`, поэтому все `shared/*`
здесь означают «не используется **из frontend**», а не «мертво вообще». Реальное потребление — §2.4.

### 2.4 `shared/` — кто чем пользуется (`shared-usage.txt`)

Посчитано grep'ом по `backend/{src,scripts}` и `frontend/{src,scripts}` + `e2e`:

| Модуль | Файлов-потребителей в backend | Во frontend/e2e |
|---|---|---|
| `heatingMatchingSchemes.js` | 13 | 1 |
| `ufhModePresetIds.js` | 6 | 0 |
| `roomDesignAirTemp.js` | 5 | 0 |
| `radiatorConnection.js` | 3 | 1 |
| `radiatorEmitterPreference.js` | 3 | 1 |
| `roomTypeNormalization.js` | 3 | 2 |
| `ufhDistributionPresets.js` | 3 | 2 |
| `ufhCircuitPresets.js` | 2 | 0 |
| `heatingThermalRegimePresets.js` | 1 | 1 |
| `heatingThermalRegimeRecommendations.js` | 1 | 1 |
| `ufhTerminalControl.js` | 1 | 0 |
| `waterHeaterFormContract.js` | 1 | 2 |
| **`surveyMutationKinds.ts`** | **0** | **0** |

`shared/surveyMutationKinds.ts` (23 строки, 14 констант + тип) — **единственный файл в `shared/`,
который не импортирует никто**. Проверено `git grep`: единственное упоминание вне самого файла —
`docs/project-structure.md:66`. Это 100 % мёртвый код, объявленный в SSOT-документе как живой.

Второе наблюдение: **5 из 13 модулей `shared/` используются только backend'ом** (`ufhModePresetIds`,
`roomDesignAirTemp`, `ufhCircuitPresets`, `ufhTerminalControl` — и `heatingMatchingSchemes` с
перекосом 13:1). Т.е. «общий контракт BE↔FE» на деле — в основном односторонний. Материал для A1.

---

## 3. Дублирование (jscpd)

`jscpd-console.txt`, `jscpd-top.tsv`, `jscpd/jscpd-report.json`

```
npx -y jscpd backend/src frontend/src shared --min-lines 15 --reporters console,json --output docs/audit/artifacts/jscpd
```

| Формат | Файлов | Строк всего | Клонов | Дублировано строк | % |
|---|---|---|---|---|---|
| css | 72 | 6 525 | 20 | 740 | **11.34 %** |
| javascript | 199 | 31 430 | 15 | 277 | 0.88 % |
| json | 2 | 60 | 0 | 0 | 0 % |
| tsx | 99 | 13 748 | 5 | 83 | 0.60 % |
| typescript | 190 | 18 463 | 9 | 176 | 0.95 % |
| **Всего** | **562** | **70 226** | **49** | **1 276** | **1.82 %** |

### Все 49 клонов, отсортированы по длине (топ-30 в таблице, полный список — `jscpd-top.tsv`)

| # | Строк | Токенов | Формат | Фрагмент A | Фрагмент B |
|---|---|---|---|---|---|
| 1 | 82 | 434 | css | `ProjectTransferDialog/ProjectTransferDialog.module.css:2-83` | `WaterHeaterReport/WaterHeaterReportDialog.module.css:1-75` |
| 2 | 75 | 433 | css | `BoilerReport/BoilerReportDialog.module.css:1-75` | `HydraulicsReport/HydraulicsReportDialog.module.css:1-75` |
| 3 | 75 | 433 | css | `BoilerReport/BoilerReportDialog.module.css:1-75` | `RadiatorsReport/RadiatorsReportDialog.module.css:1-75` |
| 4 | 75 | 434 | css | `RadiatorsReport/RadiatorsReportDialog.module.css:1-75` | `UnderfloorHeatingReport/UnderfloorHeatingReportDialog.module.css:2-76` |
| 5 | 61 | 366 | css | `BoilerReport/BoilerReportDialog.module.css:15-75` | `HotWaterReport/HotWaterReportDialog.module.css:15-75` |
| 6 | 52 | 274 | css | `BoilerReport/BoilerSummaryTable.module.css:1-52` | `RadiatorsReport/RadiatorsSummaryTable.module.css:1-52` |
| 7 | 52 | 274 | css | `HotWaterReport/HotWaterSummaryTable.module.css:1-52` | `UnderfloorHeatingReport/UnderfloorHeatingSummaryTable.module.css:1-52` |
| 8 | 33 | 113 | ts | `backend/src/dhw/types.d.ts:90-122` | `backend/src/hydraulics/types.d.ts:65-96` |
| 9 | 32 | 131 | css | `HotWaterReport/HotWaterReportView.module.css:1-32` | `RadiatorsReport/RadiatorsReportView.module.css:1-31` |
| 10 | 29 | 85 | ts | `frontend/src/types/surveyDraft.ts:28-56` | `frontend/src/utils/buildSurveyDraft.ts:27-43` |
| 11 | 28 | 132 | js | `backend/src/catalog/validateCatalog.js:1007-1034` | `backend/src/catalog/validateCatalog.js:1123-1150` |
| 12 | 27 | 148 | css | `BoilerReport/BoilerReportDialog.module.css:1-27` | `ProjectsDialog/ProjectsDialog.module.css:2-27` |
| 13 | 26 | 107 | css | `BoilerReport/BoilerSummaryTable.module.css:27-52` | `HeatLossReport/HeatLossSummaryTable.module.css:16-41` |
| 14 | 25 | 121 | css | `AppErrorBoundary/AppErrorBoundary.module.css:1-25` | `BootstrapErrorScreen/BootstrapErrorScreen.module.css:1-25` |
| 15 | 25 | 106 | css | `BoilerReport/BoilerSummaryTable.module.css:27-51` | `FinancialSummary/FinancialSummaryTable.module.css:16-40` |
| 16 | 25 | 110 | css | `ProjectTransferDialog/ProjectTransferDialog.module.css:65-89` | `ProjectsDialog/ProjectsDialog.module.css:34-58` |
| 17 | 24 | 153 | js | `backend/src/api/publicSharesRoutes.js:62-85` | `backend/src/api/publicSharesRoutes.js:113-136` |
| 18 | 24 | 119 | css | `BoilerReport/BoilerReportDialog.module.css:16-39` | `UnderfloorHeatingReport/UfhWarningResolutionDialog.module.css:16-39` |
| 19 | 23 | 66 | js | `backend/src/api/projectsRoutes.js:87-109` | `backend/src/api/publicSharesRoutes.js:30-48` |
| 20 | 21 | 60 | js | `backend/src/hydraulics/buildSnapshots.js:35-55` | `backend/src/matching/manifold.js:299-320` |
| 21 | 20 | 66 | js | `backend/src/api/adminFeedbackRoutes.js:27-46` | `backend/src/api/projectsRoutes.js:95-116` |
| 22 | 20 | 84 | ts | `backend/src/hydraulics/types.d.ts:501-520` | `frontend/src/types/hydraulics.ts:43-62` |
| 23 | 19 | 66 | js | `backend/src/api/adminFeedbackRoutes.js:21-39` | `backend/src/api/adminRoutes.js:17-35` |
| 24 | 19 | 114 | js | `backend/src/api/projectsRoutes.js:714-732` | `backend/src/api/projectsRoutes.js:832-850` |
| 25 | 19 | 62 | js | `backend/src/catalog/validateCatalog.js:986-1004` | `backend/src/catalog/validateCatalog.js:1102-1120` |
| 26 | 19 | 68 | js | `backend/src/projects/serializeProject.js:14-32` | `backend/src/projects/serializeShare.js:11-29` |
| 27 | 19 | 61 | css | `HotWaterForm/HotWaterForm.module.css:6-24` | `WaterHeaterForm/WaterHeaterForm.module.css:8-26` |
| 28 | 19 | 59 | ts | `frontend/src/surveySession/createDefaultSurveyDraft.ts:51-69` | `frontend/src/surveySession/createEmptySurveySessionState.ts:24-42` |
| 29 | 18 | 144 | js | `backend/src/hydraulics/pickPipe.js:48-65` | `backend/src/logic/ufhLoopHydraulics.js:107-123` |
| 30 | 18 | 97 | tsx | `components/BoilerSurveyForm/BoilerSurveyForm.tsx:115-132` | `components/HotWaterForm/HotWaterForm.tsx:309-326` |

Клоны 31–49 — того же характера (ещё 3 копии того же 18-строчного tsx-фрагмента из
`BoilerSurveyForm.tsx:115-132` в `HydraulicsSection.tsx:257`, `RadiatorsSurveyForm.tsx:143`;
дубли `hydraulics/types.d.ts` ↔ `frontend/src/types/hydraulics.ts`; `pickPipe.js` ↔ `pickTrunkChain.js`).

**Три отдельные группы, которые различаются по природе (интерпретировать — A2/A1):**
1. **CSS-модули отчётных диалогов** (клоны 1–7, 9, 12–16, 18, 27, 33–34, 41, 47–48) — 20 клонов, 740 строк.
   Механическое копирование одного «диалога отчёта» ×7.
2. **Дубли типов через границу BE↔FE** (клоны 8, 22, 38, 39, 40, 46) — `backend/src/hydraulics/types.d.ts`
   ↔ `frontend/src/types/hydraulics.ts`, `backend/src/types/shared-types.d.ts` ↔ `frontend/src/utils/parsers/*`.
   Это прямое измерение цены «ручной двойной синхронизации контракта».
3. **Дубли внутри одного файла** (11, 17, 24, 25, 36, 43) — `validateCatalog.js` дублирует сам себя дважды,
   `projectsRoutes.js` — дважды, `publicSharesRoutes.js` — один раз.

---

## 4. Граф модулей: fan-in / fan-out

`graph-metrics.txt`, `graph-*.json`, `graph-*.svg`

| Пакет | Модулей | Рёбер | Средний fan-out |
|---|---|---|---|
| `backend/src` | 234 | 528 | 2.26 |
| `frontend/src` | 372 | 1 075 | 2.89 |
| `shared` | 25 | 5 | 0.20 |

**backend — топ fan-in:** `utils/logger.js` 31, `utils/math.js` 23, `utils/isPlainObject.js` 17,
`api/sendErrorEnvelope.js` 12, `../../shared/heatingMatchingSchemes.js` 11, `auth/projectsAuthConfig.js` 11,
`api/errorCodes.js` 10, `models/Product.js` 10, `models/productSchemas.js` 10, `models/public.js` 10.

**backend — топ fan-out:** `api/projectsRoutes.js` 27, `api/validate.js` 20, `report/buildReport.js` 20,
`matching/internal/pickRadiatorsCore.js` 18, `logic/warmFloorCalc.js` 16, `api/routes.js` 15.

**frontend — топ fan-in:** `types/envelope.ts` 33, `utils/jsonGuards.ts` 27, `types/hydraulics.ts` 26,
`types/rooms.ts` 22, `routing/paths.ts` 19, `types/underfloorHeating.ts` 19.

**frontend — топ fan-out:** `AppSurveyContent.tsx` 34, `SurveyAppRoot.tsx` 22,
`components/RecommendationsBlock/RecommendationsBlock.tsx` 21, `utils/migrateSurveyDraft.ts` 20,
`hooks/useCalcReport.ts` 16, `routing/AppRouter.tsx` 16.

### Границы слоёв backend: обход `public.js`

`backend-layer-boundaries.txt` — посчитано по JSON-графу madge.
Домены с барьером `public.js`: `api`, `catalog`, `hydraulics`, `matching`, `models`, `reference`, `report`.

**Кросс-доменных импортов в обход `public.js`: 36.** Разбивка:

| Направление | Кол-во | Примеры |
|---|---|---|
| `logic → hydraulics` | 6 | `logic/ufhLoopHydraulics.js → hydraulics/pickPipe.js`, `→ hydraulics/pipeHydraulics.js`, `→ hydraulics/thermalLoadToFlow.js` |
| `projects → api` | 4 | `projects/projectAccess.js → api/errorCodes.js` (+3) |
| `auth → api` | 3 | `auth/requireAuth.js → api/sendErrorEnvelope.js` (+2) |
| `matching → catalog` | 3 | `matching/boiler.js → catalog/matchingSortPools.js`, `matching/waterHeater.js → catalog/comparators.js` |
| `dhw → models` / `dhw → reference` | 2 + 2 | `dhw/loadAppliances.js → models/Appliance.js`, `→ reference/loadReferenceCollection.js` |
| `matching → hydraulics` | 2 | `matching/internal/pickRadiatorsCore.js → hydraulics/resolveFlowDeltaTK.js`, `→ hydraulics/thermalLoadToFlow.js` |
| `matching → reference` | 2 | `matching/boiler.js`, `matching/index.js` → `reference/assertCalcRuntimeContext.js` |
| `types → catalog / hydraulics` | 3 | `types/shared-types.d.ts → catalog/types.d.ts`, `→ hydraulics/types.d.ts` |
| `report → matching` | 1 | `report/buildReport.js → matching/warmFloor.js` |
| прочие (`ufh`, `recommendations`, `api → reference`, `index.js → api`) | 8 | — |

Причина, почему ESLint это не ловит, — в самом конфиге: `backend/eslint.config.js:28-35` отключает
правило `no-restricted-imports` для `src/models/**`, `src/matching/**`, `src/catalog/**`,
`src/reference/**`, `src/report/**`, `src/api/**`. Т.е. **6 из 7 доменов с барьером сами от барьера
освобождены**, гейт действует только на `logic/`, `hydraulics/`, `dhw/`, `ufh/`, `auth/`, `projects/`,
`utils/`, `recommendations/`, `feedback/`, `climate/`. Оценка вреда — за A1.

---

## 5. Зависимости

### 5.1 depcheck (`depcheck.txt`)

| Пакет | Лишние | Отсутствующие |
|---|---|---|
| `backend` | `@types/cors`, `@types/express` (devDeps) | `express-serve-static-core` — используется в `backend/src/types/express-augment.d.ts:6` |
| `frontend` | — | — |
| `shared` | — | — |
| `e2e` | — | — |

Замечание: `@types/express` формально «лишний» по depcheck, но он тянет `express-serve-static-core`
транзитивно — поэтому сборка и не падает. knip нашёл ровно ту же пару (§2.2).
`mongodb` тоже не задекларирован (`src/utils/mongoConnectionConfig.js:20`) — приходит транзитивно из `mongoose`.

### 5.2 npm audit (`npm-audit-summary.txt`, `npm-audit-*.json`)

**backend: 11 уязвимостей — 8 high, 2 moderate, 1 low.**

| Severity | Пакет | Путь | Суть | Фикс | Эксплуатируемо в этом проекте? |
|---|---|---|---|---|---|
| high | `puppeteer` 24.22.0 | прямая зависимость | цепочка `@puppeteer/browsers → extract-zip` | `puppeteer@25.8.0` (**мажор**) | Только при скачивании браузера, т.е. на `npm ci`. Не рантайм-вектор. |
| high | `puppeteer-core` 24.22.0 | прямая зависимость | то же | `puppeteer-core@25.8.0` (**мажор**) | то же |
| high | `@puppeteer/browsers` | `node_modules/@puppeteer/browsers` | через `extract-zip` | мажор puppeteer | то же |
| high | `extract-zip` | `node_modules/extract-zip` | GHSA-jmr9-qjv8-65gv: symlink path traversal при распаковке | мажор puppeteer | Распаковывается только архив Chrome с googleapis. Вектор — компрометация CDN. |
| high | `brace-expansion` 3.0.0–5.0.8 | транзитивно | 4 × DoS (GHSA-jxxr-4gwj-5jf2, -3jxr-9vmj-r5cp, -mh99-v99m-4gvg, -rgw5-rvv9-x895) | `fixAvailable: true` (не мажор) | Пакет из инструментария (glob/minimatch), не на пути запроса. |
| high | `fast-uri` 3.0.0–3.1.4 | транзитивно **из ajv** | 5 × host confusion / path traversal (GHSA-v2hh-gcrm-f6hx и др.) | `true` | **Требует внимания A5:** `ajv` валидирует вход `POST /api/v1/calc`. `fast-uri` используется ajv для формата `uri`. Нужно проверить, применяется ли `format: uri` в схемах. **НЕ ПРОВЕРЕНО мной.** |
| high | `ip-address` ≤10.3.0 | транзитивно | 3 × обход SSRF-проверок (GHSA-mwp4-54f8-5fhr и др.) | `true` | Приходит из socks/proxy-цепочки puppeteer. |
| high | `js-yaml` 4.0.0–4.3.0 | транзитивно (`@apidevtools/json-schema-ref-parser`) | 3 × квадратичный DoS на merge-ключах/`!!omap` | `true` | Парсит `openapi.yaml`/схемы **на старте процесса**, из репозитория. Внешний YAML не принимается. |
| moderate | `mongoose` 9.5.0 | **прямая** | GHSA-664h-wqgq-64gw: **prototype pollution в update-касте через `__proto__`-путь** | `true` (9.9.3, не мажор) | **Самое серьёзное по вектору.** Требует проверки A5: доходит ли пользовательский объект до `Model.updateOne/findOneAndUpdate` с ключами из тела запроса (`PATCH /api/v1/projects/{id}`, `/api/v1/admin/users/{id}`). |
| moderate | `qs` 6.11.1–6.15.1 | транзитивно (express) | GHSA-q8mj-m7cp-5q26: `qs.stringify` кидает TypeError | `true` | Только на stringify, сервер парсит. |
| low | `body-parser` 2.0.0–2.2.2 | транзитивно (express) | GHSA-v422-hmwv-36x6: невалидный `limit` молча отключает проверку размера | `true` | Нужно проверить, задан ли `limit` строкой корректного формата. |

**frontend: 1 high** — `nanoid <3.3.18` (GHSA-2v37-7h3g-55p8, бесконечный цикл при `size=0`), `fixAvailable: true`.
Транзитивная, в рантайме браузера. **shared: 0. e2e: 0.**

Ничего с готовым публичным эксплойтом под этот сценарий эксплуатации я **не нашёл**.
Ближе всего к реальному риску — `mongoose` prototype pollution (прямая зависимость, non-major фикс).

### 5.3 npm outdated (`npm-outdated.txt`)

**Мажорный лаг (Current → Latest пересекает мажор):**

| Пакет | Пакет-владелец | Current | Latest | Комментарий |
|---|---|---|---|---|
| `puppeteer` / `puppeteer-core` | backend | 24.22.0 | 25.8.0 | единственный путь закрыть 4 high-CVE |
| `@apidevtools/json-schema-ref-parser` | backend | 15.3.5 | 16.0.0 | — |
| `@types/node` | backend 25.6.0 / frontend 24.12.2 / shared 25.9.5 | — | 26.2.0 | **три разные мажорные версии `@types/node` в одном монорепо**; локальный node — 26.7.0, CI — 22.22.0 |
| `typescript` | все три | 6.0.3 | 7.0.2 | закреплено `~6.0.2`, осознанное решение |
| `knip` | frontend | 5.88.1 | 6.32.2 | — |

**Минорный/патч-лаг** (всё с `fixAvailable`, мажоров нет): backend — `ajv` 8.18→8.20, `bson` 7.3.1→7.3.2,
`eslint` 10.2.1→10.9.0, `express-rate-limit` 8.5.2→8.6.2, `globals` 17.5→17.11, `helmet` 8.2→8.3,
`jose` 6.2.3→6.2.10, `mongoose` 9.5.0→9.9.3, `tsx` 4.23.5→4.23.12.
frontend — `@clerk/localizations` 4.13.7→4.15.5, `@tabler/icons-react` 3.41.1→3.46.0,
`@tanstack/react-query` 5.101.2→5.102.2, `@types/react` 19.2.14→19.2.18, `@vitejs/plugin-react` 6.0.1→6.1.0,
`typescript-eslint` 8.59→8.67, `vite` 8.2.0→8.2.2. **e2e — отставания нет вообще.**

Общий вывод по разделу: **зависимостями занимались недавно и аккуратно** — почти всё в пределах минора.
Проблема не в «заброшенности», а в двух точках: puppeteer (мажор ради CVE) и mongoose (минор, но с CVE).

---

## 6. Объём и языки

### Весь репозиторий, `npx -y cloc --vcs=git` — cloc 2.06 (пакет npm `cloc@2.6.0-cloc`) (`cloc-total.txt`)

| Язык | Файлов | Пустых | Комментариев | Кода |
|---|---|---|---|---|
| JSON | 36 | 1 | 0 | **96 952** |
| JavaScript | 312 | 4 068 | 7 722 | 35 043 |
| TypeScript | 323 | 2 931 | 3 887 | 27 930 |
| Markdown | 73 | 5 138 | 8 | 22 420 |
| YAML | 121 | 53 | 6 | 6 258 |
| CSS | 74 | 933 | 157 | 5 450 |
| HTML | 2 | 105 | 2 | 1 381 |
| прочее (Text/XML/Dockerfile/INI/SVG) | 6 | 15 | 3 | 107 |
| **SUM** | **947** | **13 244** | **11 785** | **195 541** |

Из 96 952 строк JSON — **~85 000 приходится на 9 файлов `frontend/lighthouse-*.json`** (4 696 945 байт).
Т.е. «195 тысяч строк» проекта — это в значительной мере мусорные артефакты аудита Lighthouse.

### По каталогам (`cloc-by-dir.txt`)

| Каталог | Файлов | Код | Комментарии | Доля комментариев |
|---|---|---|---|---|
| `backend/src` | 222 (JS 212 + TS 10) | 24 440 | 6 775 | **21.7 %** |
| `backend/scripts` | 69 | 11 271 | 1 058 | 8.6 % |
| `backend/data` | 4 (JSON) | 747 | 0 | — |
| `frontend/src` | 365 (TS 291 + CSS 74) | 29 039 | 3 132 | 9.7 % |
| `frontend/scripts` | 12 | 973 | 109 | 10.1 % |
| `shared` | 28 | 716 | 320 | **30.9 %** |
| `e2e` | 10 | 1 234 | 231 | 15.8 % |
| `docs` | 70 | 23 105 | 7 | — |
| `components` (OpenAPI YAML) | 118 | 4 645 | 2 | — |
| `scripts` (корень) | 6 | 927 | 64 | 6.5 % |

**Продуктовый код (backend/src + frontend/src + shared): 54 195 строк кода.**
**Не-продуктовый код, который надо сопровождать (backend/scripts + frontend/scripts + scripts + e2e):
14 405 строк** — это 27 % от объёма продукта.

Комментарии в `backend/src` — 21.7 %: это JSDoc, обязательный для `checkJs`. Не «болтовня», а типы.

---

## 7. Сложность (ESLint ad-hoc)

Правила временного конфига: `complexity: ['error', 10]`, `max-lines-per-function: ['error', {max: 60,
skipBlankLines: true, skipComments: true, IIFEs: true}]`, `max-depth: ['error', 4]`,
`max-params: ['error', 4]`, `max-statements: ['error', 40]`.
Запущено локальным `eslint@10.2.1` из `backend/` и `frontend/` (у frontend — парсер `typescript-eslint`).

**Итого нарушений: `complexity` — 235, `max-lines-per-function` — 156, `max-statements` — 28,
`max-params` — 8, `max-depth` — 4.**

### ТОП-30 по цикломатической сложности

| # | cx | Длина, строк | Файл:строка | Функция |
|---|---|---|---|---|
| 1 | **256** | 506 | `backend/src/report/buildReport.js:206` | `buildReport` (async) |
| 2 | **195** | 641 | `backend/src/matching/internal/pickRadiatorsCore.js:226` | `pickRadiators` |
| 3 | **148** | 657 | `backend/src/matching/boiler.js:443` | `pickBoiler` |
| 4 | 84 | 211 | `backend/src/hydraulics/buildSnapshots.js:129` | `buildHydraulicsSnapshots` |
| 5 | 84 | 203 | `backend/src/matching/index.js:85` | `matchEquipment` |
| 6 | 83 | 322 | `backend/src/logic/warmFloorCalc.js:38` | `calculateUnderfloorHeating` |
| 7 | 74 | 226 | `frontend/src/utils/buildTechnicalPrintHtml.ts:116` | `buildTechnicalPrintHtml` |
| 8 | 72 | 150 | `frontend/src/utils/boilerProposalParse.ts:10` | `parseBoilerProposalPayload` |
| 9 | 70 | **907** | `frontend/src/components/RoomsForm/RoomAccordionItem.tsx:90` | `RoomAccordionItem` |
| 10 | 55 | — | `backend/src/hydraulics/buildHydraulicsProposal.js:175` | `buildHydraulicsProposal` |
| 11 | 51 | — | `backend/src/catalog/validateCatalog.js:54` | `normalizeBoilerFromExtendedFormats` |
| 12 | 50 | — | `frontend/src/utils/parsers/parseUnderfloorHeatingFromReport.ts:183` | `parseRoomRow` |
| 13 | 48 | 473 | `frontend/src/components/UnderfloorHeatingReport/UnderfloorHeatingReportView.tsx:58` | `UnderfloorHeatingReportView` |
| 14 | 47 | — | `backend/src/logic/heatlossByRooms.js:103` | (стрелочная) |
| 15 | 47 | — | `backend/src/projects/buildTechnicalPdfHtml.js:81` | `buildTechnicalPdfHtml` |
| 16 | 46 | 209 | `backend/src/catalog/validateCatalog.js:1258` | `validateUnibox` |
| 17 | 45 | 220 | `backend/src/hydraulics/buildGraph.js:43` | `buildHydraulicsGraph` |
| 18 | 45 | — | `frontend/src/components/HydraulicsReport/HydraulicsSummaryTable.tsx:22` | `HydraulicsSummaryTable` |
| 19 | 45 | 220 | `frontend/src/components/RecommendationsBlock/RecommendationsBlock.tsx:51` | `RecommendationsBlock` |
| 20 | 44 | 180 | `backend/src/matching/warmFloor.js:124` | `applyUnderfloorHeatingRecommendations` |
| 21 | 44 | 475 | `frontend/src/components/ObjectMetaForm/ObjectMetaForm.tsx:45` | `ObjectMetaForm` |
| 22 | 43 | 169 | `backend/src/logic/hotWater.js:31` | `calculateHotWaterDemand` |
| 23 | 41 | — | `backend/src/hydraulics/crossValidatePipelineInput.js:12` | `crossValidateHydraulicsPipelineInput` |
| 24 | 40 | — | `backend/src/catalog/validateCatalog.js:204` | `validateBoiler` |
| 25 | 40 | — | `backend/src/matching/internal/sizeForcedRoomEmitter.js:69` | `sizeForcedSectional` |
| 26 | 38 | — | `backend/src/catalog/validateCatalog.js:151` | `normalizeRadiatorFromExtendedFormats` |
| 27 | 37 | — | `backend/src/api/validate.js:260` | `validateAndNormalizeInput` |
| 28 | 36 | — | `backend/src/projects/extractCalculationSummary.js:26` | `extractCalculationSummary` |
| 29 | 36 | — | `frontend/src/utils/parsers/parseRadiatorsMatchingFromReport.ts:250` | `parseRadiatorsMatchingFromReport` |
| 30 | 35 | — | `backend/src/recommendations/validateRecommendations.js:12` | `validateAndNormalizeRecommendationsBundle` |

(31–40: `report/buildReport.js:60` cx=35, `services/parseCatalogUniboxes.ts:48` cx=35,
`hydraulics/resolveCirculationFlows.js:71` cx=34, `hydraulics/resolveSystemPumps.js:62` cx=34,
`logic/externalWallsValidate.js:20` cx=34, `api/validate.js:387` cx=33, `matching/boiler.js:326` cx=33,
`matching/internal/sizeForcedRoomEmitter.js:224` cx=33, `components/Header/Header.tsx:47` cx=33,
`matching/internal/summarizeRadiatorEmitters.js:71` cx=32. Полный список — `eslint-complexity-top.txt`.)

### ТОП-15 по длине функции

| # | Строк | Файл:строка | Функция |
|---|---|---|---|
| 1 | 907 | `frontend/src/components/RoomsForm/RoomAccordionItem.tsx:90` | `RoomAccordionItem` |
| 2 | 657 | `backend/src/matching/boiler.js:443` | `pickBoiler` |
| 3 | 641 | `backend/src/matching/internal/pickRadiatorsCore.js:226` | `pickRadiators` |
| 4 | 621 | `frontend/src/AppSurveyContent.tsx:90` | `AppSurveyContent` |
| 5 | 581 | `backend/src/api/projectsRoutes.js:125` | `createProjectsRouter` |
| 6 | 506 | `backend/src/report/buildReport.js:206` | `buildReport` |
| 7 | 475 | `frontend/src/components/ObjectMetaForm/ObjectMetaForm.tsx:45` | `ObjectMetaForm` |
| 8 | 473 | `frontend/src/components/UnderfloorHeatingReport/UnderfloorHeatingReportView.tsx:58` | `UnderfloorHeatingReportView` |
| 9 | 464 | `backend/src/dhw/validateAppliances.js:17` | `validateAndNormalizeApplianceDoc` |
| 10 | 461 | `frontend/src/hooks/useSurveyProject.ts:55` | `useSurveyProject` |
| 11 | 408 | `frontend/src/components/CatalogEquipmentReference/CatalogEquipmentReference.tsx:88` | `CatalogEquipmentReference` |
| 12 | 322 | `backend/src/logic/warmFloorCalc.js:38` | `calculateUnderfloorHeating` |
| 13 | 300 | `frontend/src/components/HotWaterForm/HotWaterForm.tsx:29` | `HotWaterForm` |
| 14 | 270 | `frontend/src/SurveyAppRoot.tsx:61` | `SurveyAppRoot` |
| 15 | 230 | `frontend/src/services/buildCalcRequestPayload.ts:31` | `buildCalcRequestPayload` |

### Прочие нарушения (полный список — их мало)

`max-depth > 4` — **всего 4**: `backend/src/auth/mapJwtPayload.js:24`, `backend/src/hydraulics/pickPipe.js:369`,
`backend/src/recommendations/validateRecommendations.js:69` и `:77` (все — глубина 5).

`max-params > 4` — **1** в backend: `backend/src/matching/boiler.js:157` `pickSingleOrCascadeProposal` (5 параметров).
Ещё 7 — во frontend.

`max-statements > 40` — топ-5: `pickRadiatorsCore.js:226` — 176 операторов, `boiler.js:443` — 166,
`buildReport.js:206` — 129, `buildTechnicalPrintHtml.ts:116` — 107, `warmFloorCalc.js:38` — 103.

**Существенная оговорка:** ни одно из этих правил **не включено ни в один из двух ESLint-конфигов проекта**
(`backend/eslint.config.js`, `frontend/eslint.config.js`). Гейта на сложность нет вообще.

---

## 8. Распределение файлов по размеру

`file-size-distribution.txt` (только git-tracked `.js/.mjs/.cjs/.ts/.tsx/.css`)

| Пакет | Файлов | > 1000 | 500–1000 | 200–499 | < 200 | Сумма строк | Медиана | Максимум |
|---|---|---|---|---|---|---|---|---|
| `backend/src` | 222 | **4** | 9 | 39 | 170 | 34 435 | 83 | 1 703 |
| `backend/scripts` | 68 | 0 | 6 | 14 | 48 | 13 311 | 154 | 728 |
| `frontend/src` | 365 | **1** | 5 | 26 | 333 | 35 818 | 65 | 1 030 |
| `frontend/scripts` | 12 | 0 | 0 | 0 | 12 | 1 233 | 106 | 173 |
| `shared` | 25 | 0 | 0 | 0 | 25 | 1 147 | 34 | 118 |
| `e2e` | 7 | 0 | 0 | 3 | 4 | 1 372 | 190 | 366 |
| `scripts` (корень) | 6 | 0 | 0 | 2 | 4 | 1 115 | 179 | 493 |

**Медиана файла — 83 строки в backend/src и 65 во frontend/src.** 91 % файлов frontend и 77 % файлов
backend — меньше 200 строк. Крупные модули — точечные исключения, а не общий стиль.

### ТОП-40 файлов по строкам

| # | Строк | Файл |
|---|---|---|
| 1 | 1 703 | `backend/src/types/shared-types.d.ts` |
| 2 | 1 569 | `backend/src/catalog/validateCatalog.js` |
| 3 | 1 165 | `backend/src/matching/boiler.js` |
| 4 | 1 030 | `frontend/src/components/RoomsForm/RoomAccordionItem.tsx` |
| 5 | 1 003 | `backend/src/logic/ufhLoopHydraulics.js` |
| 6 | 950 | `backend/src/matching/internal/pickRadiatorsCore.js` |
| 7 | 881 | `backend/src/api/projectsRoutes.js` |
| 8 | 786 | `backend/src/api/validate.js` |
| 9 | 772 | `backend/src/report/buildReport.js` |
| 10 | 763 | `frontend/src/AppSurveyContent.tsx` |
| 11 | 728 | `backend/scripts/verifyUniboxMatching.js` |
| 12 | 726 | `backend/src/report/buildFinancialBom.js` |
| 13 | 712 | `backend/scripts/verifyHydraulicsPipeline.js` |
| 14 | 673 | `backend/scripts/verifyUfhPresets.js` |
| 15 | 653 | `backend/scripts/fuzz-calc.ts` |
| 16 | 612 | `backend/scripts/verifyManifoldMatching.js` |
| 17 | 595 | `backend/src/hydraulics/types.d.ts` |
| 18 | 565 | `backend/scripts/verifyRadiatorSections.js` |
| 19 | 562 | `backend/src/matching/manifold.js` |
| 20 | 560 | `backend/src/dhw/validateAppliances.js` |
| 21 | 560 | `frontend/src/components/UnderfloorHeatingReport/UnderfloorHeatingReportView.tsx` |
| 22 | 550 | `frontend/src/hooks/useSurveyProject.ts` |
| 23 | 538 | `frontend/src/components/ObjectMetaForm/ObjectMetaForm.tsx` |
| 24 | 509 | `frontend/src/components/CatalogEquipmentReference/CatalogEquipmentReference.tsx` |
| 25 | 508 | `backend/src/matching/unibox.js` |
| 26 | 493 | `scripts/verifyBackendDocs.mjs` |
| 27 | 486 | `frontend/src/components/Header/Header.module.css` |
| 28 | 481 | `backend/src/matching/internal/sizeForcedRoomEmitter.js` |
| 29 | 479 | `backend/scripts/seed.js` |
| 30 | 463 | `frontend/src/components/HydraulicsReport/HydraulicsReportView.tsx` |
| 31 | 430 | `backend/src/logic/envelopePresets.js` |
| 32 | 403 | `backend/scripts/verifyFinancialBom.js` |
| 33 | 402 | `backend/scripts/verifyRadiatorEmitterKind.js` |
| 34 | 400 | `backend/src/hydraulics/pickPipe.js` |
| 35 | 398 | `backend/src/logic/warmFloorCalc.js` |
| 36 | 388 | `backend/src/matching/warmFloor.js` |
| 37 | 385 | `frontend/src/utils/parsers/parseUnderfloorHeatingFromReport.ts` |
| 38 | 381 | `backend/scripts/verifyBuiltinBoilerPump.js` |
| 39 | 373 | `backend/src/catalog/loadCatalog.js` |
| 40 | 370 | `backend/src/hydraulics/buildSnapshots.js` |

**8 из 40 крупнейших файлов — это `backend/scripts/verify*`,** т.е. самописный тестовый харнесс.

---

## 9. Размер бандла frontend

`frontend-build.txt`, `frontend-bundle-sizes.txt`, `frontend-bundle-visualizer.html`

**Сборка проходит.** `npm run build --prefix frontend` = `typecheck` → `vite build` → `postbuild`.
6 688 модулей, vite 8.2.0 (rolldown), **3.28 с суммарно**, `✓ built in 638ms`.

| | raw | gzip | brotli |
|---|---|---|---|
| Весь JS (39 чанков) | 877 048 Б (856 КиБ) | **251 226 Б (245 КиБ)** | 216 430 Б (211 КиБ) |
| Весь CSS (12 файлов) | 90 821 Б | 19 578 Б | 16 727 Б |
| **JS + CSS** | **967 869 Б (945 КиБ)** | **270 804 Б (264 КиБ)** | **233 157 Б (228 КиБ)** |
| `index.html` | 8 003 Б | 2 564 Б | 2 091 Б |

**Стартовый (entry) набор — то, что качается на первой отрисовке:**

| Файл | raw | gzip | brotli |
|---|---|---|---|
| `assets/react-dom-*.js` | 178 244 | 55 528 | 48 260 |
| `assets/index-*.js` | 119 570 | 36 025 | 30 487 |
| `assets/index-*.css` | 29 290 | 5 928 | 5 260 |
| `assets/rolldown-runtime-*.js` | 589 | 368 | 326 |
| **Итого entry** | **327 693 Б (320 КиБ)** | **97 849 Б (95.6 КиБ)** | **84 333 Б (82.4 КиБ)** |

**ТОП-8 чанков по raw:**

| Чанк | raw | gzip | brotli | Загружается |
|---|---|---|---|---|
| `AppSurveyContent-*.js` | 218 973 | 49 645 | 40 335 | лениво, при входе в анкету |
| `react-dom-*.js` | 178 244 | 55 528 | 48 260 | **сразу** |
| `clerk-*.js` | 171 392 | 44 376 | 39 045 | лениво (`ClerkLazyRoot`) |
| `index-*.js` | 119 570 | 36 025 | 30 487 | **сразу** |
| `AppSurveyContent-*.css` | 43 646 | 7 143 | 6 181 | с анкетой |
| `router-*.js` | 37 228 | 13 352 | 12 011 | лениво |
| `FinancialSummaryTable-*.js` | 30 706 | 8 893 | 7 990 | лениво |
| `query-*.js` | 30 573 | 9 328 | 8 496 | лениво |

**Голый факт:** 95.6 КиБ gzip на первую отрисовку — это хорошо. Clerk (44 КиБ gzip) и вся анкета
(50 КиБ gzip) вынесены в ленивые чанки. Code-splitting сделан осознанно, 43 чанка.
Единственный крупный монолит — `AppSurveyContent-*.js` 219 КБ raw.

---

## 10. Секреты

`secretlint.txt`, `secrets-manual-grep.txt`

`npx -y @secretlint/quick-start .` дал пустой вывод и EXIT=0. Я **не поверил** и проверил его на
контрольном файле с заведомыми ключами — quick-start промолчал и там. Заменил на явный вызов:

```
cat <1093 файла рабочего дерева, кроме node_modules/.git/dist/build/playwright-report/test-results> \
  | xargs npx -y -p secretlint -p @secretlint/secretlint-rule-preset-recommend secretlint --secretlintrc <rc>
```
На контрольном файле этот вызов находит `GITHUB_TOKEN` и `STRIPE_SECRET_KEY_LIVE` — детектор жив.

**Результат по репозиторию: 0 находок.**

Дополнительный ручной grep (паттерны, которых нет в preset-recommend):
- `mongodb(+srv)://user:pass@` — **0**
- `sk_live_ / sk_test_ / pk_live_` (Clerk/Stripe) — **0**
- JWT-подобные `eyJ…\.…` — **0**
- Файлов `.env*` в git — **только** `backend/.env.example` и `frontend/.env.example`; настоящих `.env`
  в рабочем дереве нет вообще.

Историю git не смотрел — это зона M2.

---

## 11. dependency-cruiser (`dependency-cruiser.txt`)

`dependency-cruiser@18.2.0`, набор `dependency-cruiser/configs/recommended-strict`, `typescript@6.0.3`.

**`backend/src` — 241 модуль, 555 связей, 3 нарушения:**
1. `no-orphans`: `backend/src/projects/migrateLegacyProjectOwnerId.js`
2. `no-circular`: `hydraulics/types.d.ts → types/shared-types.d.ts → hydraulics/types.d.ts`
3. `no-circular`: `catalog/types.d.ts → types/boiler-types.d.ts → catalog/types.d.ts`

Нарушений `not-to-unresolvable`, `no-duplicate-dep-types`, `not-to-dev-dep`, `no-non-package-json` — **ноль**.

**`shared` — 25 модулей, 5 связей, 9 нарушений `no-orphans`** (все `.js`; `.d.ts` правило по умолчанию
не проверяет). Это тот же артефакт границы скана, что и у madge (§2.1/2.4) — кроме
`shared/surveyMutationKinds.ts`, который сирота по-настоящему.

**`frontend/src` — 373 модуля, 1 119 связей, 21 нарушение. Из них 20 — ЛОЖНЫЕ.**
20 × `not-to-unresolvable: … → react-router`. Проверено: `react-router@8.3.0` установлен и объявлен
в `frontend/package.json`, но у него **нет полей `main`/`module`** — только `exports` с условиями
(`react-server`, `module-sync`, …), которые резолвер dependency-cruiser не раскрывает. Сборка vite
и `tsc` этот пакет резолвят без проблем. **Это дефект инструмента, а не кода.**
Настоящее нарушение одно: `no-circular` `utils/roomEnvelopeFields.ts ↔ utils/roomExteriorLayout.ts` —
тот же цикл, что нашёл madge.

---

## 12. Гейты качества: что реально происходит при запуске

`lint-typecheck.txt`, `backend-verify-run.txt`, `backend-verify-run2.txt`, `root-verify-scripts.txt`

| Команда | Результат | Время |
|---|---|---|
| `npm run typecheck --prefix shared` | **OK**, 0 ошибок | 0.73 с |
| `npm run typecheck --prefix backend` (`tsc --noEmit`, checkJs + strict) | **OK**, 0 ошибок | 2.21 с |
| `npm run lint --prefix backend` (eslint по `src` + `scripts`) | **OK**, 0 ошибок | 0.76 с |
| `npm run typecheck --prefix frontend` (`tsc -b`) | **OK**, 0 ошибок | 2.19 с |
| `npm run lint --prefix frontend` (strictTypeChecked) | **OK**, 0 ошибок | 7.63 с |
| `npm run verify:dead-code --prefix frontend` (knip) | **OK**, пусто | — |
| `npm run verify --prefix backend` — 52 шага (`lint` + `typecheck` + **50** `verify:*`) | **OK, все зелёные** (с рабочим Chromium) | **14.82 с** |
| `npm run build --prefix frontend` | **OK** | 3.28 с |
| `node scripts/verifyNoTypeBypass.mjs` | OK | 0.11 с |
| `node scripts/verifyAuthDocs.mjs` | OK | — |
| `node scripts/verifyDeployDocs.mjs` | OK | — |
| **`node scripts/verifyBackendDocs.mjs`** | **КРЭШ, необработанный `ENOENT`** | — |
| `node scripts/verifyLanguagePolicy.mjs` | OK | — |

### 12.1 Корневой `npm run verify` физически не может пройти

```
Error: ENOENT: no such file or directory, open
  '/…/heating-equipment-selection-service/.cursorrules'
    at readRepo (file:///…/scripts/verifyBackendDocs.mjs:60:10)
    at file:///…/scripts/verifyBackendDocs.mjs:195:21
```
`.cursorrules` в `.gitignore:9` и в репозитории отсутствует. `scripts/verifyBackendDocs.mjs` читает его
безусловно и падает необработанным исключением (не аккуратным `FAIL`, а стектрейсом).
`npm run verify` в корне = `verify:type-bypass && verify:auth-docs && verify:deploy-docs &&
**verify:backend-docs** && …` — то есть **вся корневая цепочка обрывается на 4-м шаге у любого,
кто клонировал репозиторий**. CI это не ловит, потому что `.github/workflows/verify.yml` запускает
только `verifyNoTypeBypass.mjs` (уже зафиксировано в `docs/qa/research/S1-risk-register.md` — не переоткрываю;
новое здесь — что скрипт не «предупреждает», а **крэшится**).

Тот же `.cursorrules` объявлен контрактом в `README.md:9` и `docs/project-structure.md:6,29,48`.

### 12.2 `verify:project-pdf` требует локальный Chromium

Первый прогон `npm run verify --prefix backend` упал:
```
Error: Не вдалося сформувати PDF: Failed to launch the browser process
dlopen … Google Chrome for Testing Framework … (no such file)
statusCode: 503, code: 'PDF_RENDER_FAILED'
```
Кэш puppeteer на машине битый. Повтор с `PDF_BROWSER_EXECUTABLE=/Applications/Google Chrome.app/…`
прошёл целиком за 14.82 с. Механизм подмены есть — `backend/src/projects/renderPdfFromHtml.js:21-31`.
Но список fallback-путей (`renderPdfFromHtml.js:41-52`) содержит только Linux и Windows — **macOS-пути нет**,
поэтому на маке без переменной окружения verify всегда красный.

### 12.3 Конфигурация гейтов — что включено и что нет

- **`tsconfig.strict-base.json`** (общий для трёх пакетов): `strict`, `noImplicitAny`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`,
  `isolatedModules`. Это **очень строгий** набор — строже, чем у большинства коммерческих команд.
- **`frontend/eslint.config.js`**: `tseslint.configs.strictTypeChecked` + явные
  `no-explicit-any`, `no-unsafe-*` (5 правил), `no-floating-promises`, `no-misused-promises`,
  `ban-ts-comment` с `ts-ignore: true` / `ts-nocheck: true`, запрет inline-`style` в JSX.
- **`backend/eslint.config.js`**: `js/recommended` + `no-unused-vars` + `no-restricted-imports`
  (границы `public.js`). **Нет** type-aware правил, **нет** правил сложности.
- **Правил `complexity` / `max-lines*` / `max-depth` / `max-params` нет ни в одном конфиге.**
- **`eslint-disable` во всём продуктовом коде — ровно 2 штуки**, обе с объяснением на той же строке:
  `frontend/src/components/RoomsForm/RoomsForm.tsx:65` и `frontend/src/hooks/useRoomsOrchestration.ts:57`.

---

## 13. Опровержение фактуры оркестратора: TODO/FIXME

В `_CONTEXT.md:124` заявлено: «**~122 вхождения** TODO/FIXME/HACK/XXX в `backend/src`, `frontend/src`, `shared`».

**Это неверно. Проверено четырьмя способами:**
```
grep -rE "TODO|FIXME|HACK|XXX" backend/src        → 0
grep -rE "TODO|FIXME|HACK|XXX" frontend/src       → 0
grep -rE "TODO|FIXME|HACK|XXX" shared --exclude-dir=node_modules → 0
git grep -nE "TODO|FIXME|HACK|XXX" -- backend/src frontend/src shared → 0
git grep -inE "todo|fixme"  (весь репозиторий)    → 4, и все 4 —
   внутри base64-блобов в frontend/lighthouse-*.json
```
**Во всём отслеживаемом коде проекта нет ни одного маркера TODO/FIXME/HACK/XXX.**
Осям A2/A3: не строить находку на этой цифре.

---

## 14. Мусор и вес репозитория (подтверждение фактуры)

`repo-size-and-junk.txt`

| Показатель | Значение |
|---|---|
| Рабочее дерево | **612 МБ** |
| `.git` | 15 МБ (`size-pack` 2.86 MiB, loose `size` 11.43 MiB, 146 loose-объектов, 4 326 in-pack) |
| `frontend/node_modules` | 356 МБ |
| `backend/node_modules` | 117 МБ |
| `shared/node_modules` | 26 МБ |
| `e2e/node_modules` | 18 МБ |
| `docs/` | 23 МБ |
| **Репозиторий без `node_modules`** | **~95 МБ** |

**Подтверждено (все три пункта фактуры — верны):**
- `backend/node` и `backend/heating-equipment-selection-service@1.0.0` — **есть в git, оба 0 байт**.
- 9 файлов `frontend/lighthouse-*.json` в git, **суммарно 4 696 945 байт**, ~85 000 строк JSON.
- `docs/qa/research/ux-screens/` — **76 файлов, 12 МБ**, в git.
- `.cursorrules` — в `.gitignore:9`, в репозитории отсутствует, объявлен в `README.md:9` и
  `docs/project-structure.md:6,29,48`. См. §12.1 — это не только висячая ссылка, но и крэш verify.

**ТОП-10 самых больших файлов в индексе git:**

| Байт | Файл |
|---|---|
| 2 137 052 | `docs/qa/heatcalc-audit.html` |
| 825 443 | `docs/qa/research/ux-screens/u4/u4-mobile-room-detail.jpg` |
| 644 810 | `docs/qa/research/ux-screens/u4/u4-mobile-step1-object.jpg` |
| 542 265 | `frontend/lighthouse-mobile.json` |
| 540 598 | `frontend/lighthouse-after-mobile.json` |
| 536 219 | `frontend/lighthouse-after-desktop.json` |
| 535 443 | `frontend/lighthouse-final2.json` |
| 530 801 | `frontend/lighthouse-desktop.json` |
| 529 401 | `frontend/lighthouse-baseline-mobile.json` |
| 525 909 | `frontend/lighthouse-final.json` |

## 15. Прочие числа, которые могут понадобиться осям

- **OpenAPI:** `openapi.yaml` — **25 путей**; `components/` — **118 YAML-файлов, 4 645 строк**.
- **Express:** 36 объявлений маршрутов (`.get/.post/.put/.patch/.delete`) в `backend/src/api/`,
  распределённых по 8 файлам роутеров.
- **`backend/scripts/`: 62 файла**, из них 53 с именем `verify*`. В `backend/package.json` объявлено
  **52 скрипта `verify:*`**, цепочка `npm run verify --prefix backend` — **52 шага** (`lint`, `typecheck`
  и 50 `verify:*`), одной строкой длиной **1 818 символов**.
- **2 объявленных verify-скрипта в цепочку НЕ подключены:** `verify:projects-admin-access`
  (`scripts/verifyProjectsAdminAccess.js`) и `verify:mongo-db` (`scripts/verifyMongoDatabase.mjs`).
  Первый проверяет админский доступ к чужим проектам — то есть проверка авторизации написана,
  но гейтом не запускается. Сигнал для A5.
- **CI:** один workflow `.github/workflows/verify.yml`, `ubuntu-latest`, `node-version: '22.22.0'`, без матрицы.
- **Расхождение версий node:** CI 22.22.0 / `frontend/package.json` engines `>=22.22.0 <23` / локально **26.7.0**.
  У `backend`, `shared`, `e2e` поля `engines` **нет вообще**.
- **`@types/node` в трёх пакетах — три разные мажорные версии:** backend 25.6.0, frontend 24.12.2, shared 25.9.5.

---

## 16. Что из этого требует интерпретации — адресно по осям

Это главный выход M1. Числа есть, смысла в них я не вкладываю.

### → A1 (архитектура и границы слоёв)
1. **36 кросс-доменных импортов в обход `public.js`** (§4). Ключевое: правило
   `no-restricted-imports` в `backend/eslint.config.js:28-35` само освобождает от себя 6 из 7
   барьерных доменов. Читать: `logic/ufhLoopHydraulics.js → hydraulics/pickPipe.js`,
   `report/buildReport.js → matching/warmFloor.js`, `auth/* → api/sendErrorEnvelope.js`.
2. **Барьеры `public.js` частично мертвы**: `hydraulics/public.js:9-12` реэкспортирует 5 символов,
   которых никто не импортирует; то же в `matching/public.js:9`, `api/public.js:6-7`, `reference/public.js:7` (§2.2).
3. **`shared/` — не двусторонний контракт.** 5 из 13 модулей потребляются только backend'ом,
   `heatingMatchingSchemes.js` — 13 файлов backend против 1 frontend (§2.4).
4. **Дубли типов через границу BE↔FE** — 6 клонов jscpd между `backend/src/*/types.d.ts` и
   `frontend/src/types/*.ts` (§3, группа 2). Это измеренная цена ручной синхронизации.
5. **`backend/src/types/shared-types.d.ts` — 1 703 строки**, самый большой файл проекта, участвует
   в обоих backend-циклах и в дублях с frontend.
6. Единственный **runtime**-цикл в монорепо: `frontend/src/utils/roomEnvelopeFields.ts ↔ roomExteriorLayout.ts`.
   Остальные 2 — только между `.d.ts`.

### → A2 (мёртвый код, мусор, дублирование)
7. **`shared/surveyMutationKinds.ts` — 100 % мёртв**, ноль импортов, при этом описан
   в `docs/project-structure.md:66` как живой модуль (§2.4).
8. **70 неиспользуемых экспортов в backend** (knip, прогон A) и **127** при взгляде «только продакшн» (§2.2).
   Дельта 57 — цена содержания `backend/scripts/`.
9. **45 «настоящих» неиспользуемых экспортов TS**: 16 в `frontend/src`, 29 в `shared` (ts-prune, §2.3).
   Целые файлы почти полностью не используются из frontend: `types/radiatorEmitterPreference.ts` (4 из 5 экспортов),
   `types/heatingThermalRegime.ts` (3), `types/radiatorConnection.ts` (2).
10. **`frontend/knip.json` ослаблен**: `ignoreIssues: {"**/*": ["types"]}` — неиспользуемые типы вне гейта;
    `project` не включает `shared/`. Зелёный knip ≠ отсутствие мёртвого кода (§2.3).
11. **CSS-дубляж 11.34 %** — 20 клонов, 740 строк, семь почти идентичных `*ReportDialog.module.css` (§3, группа 1).
12. **Дубли внутри одного файла**: `validateCatalog.js` дублирует себя дважды (`:986-1004`↔`:1102-1120`,
    `:1007-1034`↔`:1123-1150`), `projectsRoutes.js` дважды, `publicSharesRoutes.js` один раз (§3, группа 3).
13. **Мусор в git подтверждён**: 2 пустых файла, 9 lighthouse-JSON (4.7 МБ), 76 скриншотов (12 МБ),
    `docs/qa/heatcalc-audit.html` 2.1 МБ (§14).
14. **Не строить находку на TODO/FIXME — их ноль** (§13).

### → A3 (качество кода и стоимость сопровождения)
15. **Три функции с цикломатикой ≥ 148**: `buildReport` cx=256/506 строк, `pickRadiators` cx=195/641,
    `pickBoiler` cx=148/657. Это ядро расчёта — то, что чаще всего надо менять (§7).
16. **`RoomAccordionItem` — 907 строк в одной функции, cx=70.** Самая большая функция проекта (§7).
17. **235 функций с cx > 10, 156 функций > 60 строк, при этом гейта на сложность нет ни в одном
    ESLint-конфиге** (§7, §12.3).
18. **Асимметрия строгости backend/frontend**: frontend — `strictTypeChecked` + 5 `no-unsafe-*` правил;
    backend — `js/recommended` + 2 правила. При этом вся расчётная логика — в backend (§12.3).
19. **8 из 40 крупнейших файлов — `backend/scripts/verify*`**; `backend/scripts` = 11 271 строка,
    т.е. 46 % от объёма `backend/src` (§6, §8).
20. **Медиана файла 83/65 строк** — база здоровая, проблема локализована в ~25 файлах (§8).

### → A4 (производительность и ресурсы)
21. **Entry-бандл 95.6 КиБ gzip / 82.4 КиБ brotli**, весь JS+CSS 264 КиБ gzip, 43 чанка, Clerk и анкета
    ленивые (§9). Число для сравнения с Lighthouse-отчётами.
22. **`AppSurveyContent-*.js` — 219 КБ raw / 49.6 КиБ gzip** — крупнейший ленивый чанк; `AppSurveyContent.tsx`
    имеет fan-out 34 и функцию на 621 строку (§4, §7, §9).
23. **`buildReport` cx=256 / 129 операторов** — самая горячая точка синхронного расчёта на бесплатном Render (§7).
24. **`verify:project-pdf` и рантайм PDF зависят от Chromium**, fallback-список путей в
    `renderPdfFromHtml.js:41-52` не содержит macOS (§12.2).
25. Сборка frontend 3.3 с, backend verify 14.8 с — **гейты дёшевы**, ускорять нечего (§12).

### → A5 (безопасность и эксплуатационная зрелость)
26. **`mongoose@9.5.0` — prototype pollution GHSA-664h-wqgq-64gw**, прямая зависимость, фикс без мажора
    (9.9.3). Требует проверки: доходит ли пользовательский объект до `updateOne/findOneAndUpdate`
    в `PATCH /api/v1/projects/{id}` и `/api/v1/admin/users/{id}` (§5.2).
27. **`fast-uri` 5 × high внутри `ajv`**, а `ajv` валидирует публичный `POST /api/v1/calc`.
    Проверить, используется ли `format: uri` в схемах (**НЕ ПРОВЕРЕНО мной**) (§5.2).
28. **4 high в цепочке puppeteer**, закрываются только мажором 24→25 (§5.2, §5.3).
29. **`nanoid` high во frontend**, фикс без мажора (§5.2).
30. **Секретов нет**: secretlint (проверенный на контроле) + ручной grep по mongodb-URI / Clerk-ключам /
    JWT — 0 находок; `.env` в git нет (§10).
31. **`npm run verify` в корне обрывается крэшем на `.cursorrules`** — гейт, объявленный как основной,
    неработоспособен для любого, кто клонировал репозиторий (§12.1).
32. **Расхождение node: CI 22.22.0 vs локально 26.7.0**, `engines` только у frontend (§15).
33. **2 verify-скрипта объявлены, но не подключены к гейту**: `verify:projects-admin-access`
    (проверка админского доступа к чужим проектам!) и `verify:mongo-db` (§15).
34. **`express-serve-static-core` и `mongodb` не задекларированы**, приезжают транзитивно — сломаются
    при смене мажора `@types/express` / `mongoose` (§5.1).

### → A6 (архитектурная готовность к монетизации)
35. **`backend/src/report/buildFinancialBom.js` — 726 строк**; экспорты
    `FINANCIAL_BOM_SCHEMA_VERSION`, `FINANCIAL_LABOR_PERCENT`, `FINANCIAL_CONSUMABLES_PERCENT`,
    `collapseFinancialBomLines` **не используются никем из продакшн-графа** (knip, прогон B, §2.2) —
    ставки зашиты как константы, наружу не выведены.
36. **`PUBLISHER_SUBSCRIPTION_TIERS` (`backend/src/auth/authorizationPolicy.js:16`) — не используется**
    в продакшн-графе (knip, прогон B). Подтверждает фактуру «subscription — метка без квот».
37. **`resolveRateLimitKey` (`backend/src/api/middleware/rateLimiters.js:14`) — не используется**
    в продакшн-графе (knip, прогон B). Существенно для платного API.
38. **25 путей OpenAPI против 36 объявлений маршрутов** в `backend/src/api/` — расхождение требует
    проверки, какие ручки не описаны контрактом (§15).
39. **Модели `Product/Project/Calculation/User/Feedback`** — весь список того, что есть в
    `models/public.js`. Сущностей «поставщик», «заказ», «комиссия» нет (§2.1) — подтверждает фактуру.

---

## 17. Сильные стороны, видимые из метрик

Это не вежливость — это то, что метрики показали объективно.

1. **Все гейты качества зелёные, все до одного.** `tsc --noEmit` × 3 пакета — 0 ошибок при
   `strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes`. ESLint × 2 — 0 ошибок при
   `strictTypeChecked` на frontend. `knip` frontend — пусто. цепочка backend verify (52 шага) — все OK.
   Для проекта на 54 тысячи строк, написанного одним человеком за два месяца, это редкость.
   Якоря: `docs/audit/artifacts/lint-typecheck.txt`, `backend-verify-run2.txt`.
2. **Типобезопасность реально соблюдается, а не декларируется.** Во всём продуктовом коде —
   **ноль** `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `as any`, `: any`
   (проверено `git grep` по 538 отслеживаемым файлам). `eslint-disable` — **ровно 2 штуки**,
   обе с объяснением на той же строке (`RoomsForm.tsx:65`, `useRoomsOrchestration.ts:57`).
   Гейт `scripts/verifyNoTypeBypass.mjs` — OK.
3. **Дублирование кода — 0.88 % в JS и 0.95 % в TS.** Это очень низко. Весь дубляж (1.82 % общих)
   сидит в CSS-модулях, где цена ошибки минимальна. `jscpd-console.txt`.
4. **Циклов, по сути, нет.** 3 цикла на 631 модуль, два из них — между `.d.ts` (в рантайме отсутствуют).
   Средний fan-out 2.26 (backend) и 2.89 (frontend) — плоский, читаемый граф.
5. **Файлы маленькие.** Медиана 83 строки в `backend/src`, 65 во `frontend/src`; 91 % файлов frontend
   меньше 200 строк. Крупные модули — 25 штук на 587 файлов, точечные исключения.
6. **Комментарии в `backend/src` — 21.7 %** (6 775 строк на 24 440 кода). Это JSDoc, который несёт
   типы для `checkJs`, а не декоративный шум. В `shared` — 30.9 %.
7. **Барьеры слоёв не выдуманы задним числом**: `backend/eslint.config.js` содержит 6 групп
   `no-restricted-imports` с осмысленными сообщениями по-русски, включая запрет на legacy-кэши
   (`dhw/referenceCache.js`, `ufh/ufhPresetsCache.js` — «Legacy sync-кэш удалён»).
   Кто-то думал о границах и оставил автоматическую защиту.
8. **Code-splitting сделан руками и правильно.** 43 чанка, entry — 95.6 КиБ gzip. Clerk (44 КиБ gzip)
   и вся анкета (50 КиБ gzip) вынесены в ленивую загрузку. Сборка — 3.3 с.
9. **Зависимости свежие.** Мажорный лаг — только у 3 позиций, и одна из них (`typescript ~6.0.2`) —
   явно закреплена. `e2e` не отстаёт вообще. `depcheck` по frontend/shared/e2e — чисто.
10. **Секретов нет.** Проверенный на контроле secretlint + ручные паттерны: 0 находок,
    `.env` в git отсутствует, только `.env.example`.
11. **Гейты быстрые:** весь backend verify (52 шага, 50 проверок) — 14.8 с, frontend build — 3.3 с,
    backend lint+typecheck — 3.0 с. Обратная связь мгновенная; это то, почему гейты и соблюдаются.

---

## 18. Шокирующее — отдельным списком

Инструменты не выдали ничего с готовым публичным эксплойтом под этот сценарий.
Два пункта, которые стоит увидеть раньше остальных:

1. **`npm run verify` в корне обрывается необработанным крэшем** на отсутствующем `.cursorrules`
   (`scripts/verifyBackendDocs.mjs:60`). Не «FAIL с сообщением», а стектрейс `ENOENT`. Главный
   декларируемый гейт проекта неработоспособен у любого, кто склонировал репозиторий, и CI это
   не показывает, потому что не запускает этот скрипт (§12.1).
2. **`mongoose@9.5.0`, GHSA-664h-wqgq-64gw — prototype pollution через `__proto__`-путь в
   update-касте.** Прямая зависимость, лечится минорным апдейтом до 9.9.3. Вектор реален,
   если тело `PATCH`-запроса попадает в `updateOne`/`findOneAndUpdate` без белого списка полей —
   это должна проверить ось A5 чтением `backend/src/api/projectsRoutes.js` и `adminRoutes.js` (§5.2).

---

## 19. Артефакты

Все в `docs/audit/artifacts/` (файлы с префиксом `M2-` принадлежат другому агенту, не мои):

`madge-circular.txt`, `madge-orphans.txt`, `graph-backend.svg`, `graph-frontend.svg`, `graph-shared.svg`,
`graph-backend.json`, `graph-frontend.json`, `graph-shared.json`, `graph-metrics.txt`,
`backend-layer-boundaries.txt`, `jscpd-console.txt`, `jscpd-top.tsv`, `jscpd/jscpd-report.json`,
`knip-backend.txt`, `knip-backend-runtime-only.txt`, `knip-frontend.txt`, `ts-prune-frontend.txt`,
`shared-usage.txt`, `depcheck.txt`, `npm-audit-backend.json`, `npm-audit-frontend.json`,
`npm-audit-shared.json`, `npm-audit-e2e.json`, `npm-audit-summary.txt`, `npm-outdated.txt`,
`cloc-total.txt`, `cloc-by-dir.txt`, `eslint-complexity-backend.json`, `eslint-complexity-frontend.json`,
`eslint-complexity-top.txt`, `eslint-disable-occurrences.txt`, `todo-fixme.txt` (пустой — это и есть результат),
`file-size-distribution.txt`, `frontend-build.txt`, `frontend-bundle-sizes.txt`,
`frontend-bundle-visualizer.html`, `vite-bundle-visualizer.log`, `secretlint.txt`,
`secrets-manual-grep.txt`, `dependency-cruiser.txt`, `repo-size-and-junk.txt`,
`lint-typecheck.txt`, `backend-verify-run.txt`, `backend-verify-run2.txt`, `root-verify-scripts.txt`.

**Чистота за собой.** Созданы и удалены: `backend/knip.audit.json`, `backend/knip.audit2.json`,
`backend/knip.audit3.json`, `backend/eslint.audit.config.mjs`, `frontend/eslint.audit.config.mjs`
(проверено: `ls backend/knip*` и `ls */eslint.audit.config.mjs` → «no matches found»).
`package.json` проектов не изменялись. `git status --porcelain` показывает только
`?? docs/audit/` и три файла, существовавшие до моей работы (`.mcp.json`,
`AUDIT_ORCHESTRATOR_PROMPT.md`, `QA_ORCHESTRATOR_PROMPT.md`).
Побочно созданы `frontend/dist/` и `frontend/build/` — штатные артефакты `npm run build`,
оба в `.gitignore` (`frontend/.gitignore:12`, `.gitignore:5`).
В систему установлен `graphviz` (brew) — вне репозитория.
