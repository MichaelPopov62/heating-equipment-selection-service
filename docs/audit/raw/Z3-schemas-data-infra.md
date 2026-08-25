# Z3 · Схемы, справочники, инфраструктура

Зона: `components/schemas/` (120 файлов), `backend/data/*.json`, `shared/`, остаток `backend/src`,
инфраструктура сборки. Дата: 24.08.2026.

Метод: статическое чтение + **живой прогон бэкенда** (`CATALOG_SOURCE=file`, порт 3199) с валидацией
реальных ответов против объявленных схем через AJV. Команды и вывод — в разделе «Инструменты».

---

## Резюме

**Вход в API — исполняемый контракт. Выход — прозаический текст, который никто не сверял ни разу.**

Схемы ответов не проверяются ничем: линтера OpenAPI нет в зависимостях, шага в CI нет,
кодогенерации из спеки нет, ни один тест не сравнивает ответ маршрута с его схемой.
Следствие проверено экспериментально: **реальный ответ `POST /api/v1/calc` не проходит
собственную схему `CalcOkResponse` — 12 расхождений на двух базовых сценариях.**

Второе: инфраструктура рантайма. Версия Node не зафиксирована нигде (20 в образе, 22 в CI,
26 у автора, неизвестно в проде), `SIGTERM` не обрабатывается — каждый деплой рвёт запросы,
включая 30-секундный рендер PDF.

Третье: справочники. Числа вынесены из кода правильно, валидаторы плотные, файловый путь
защищён CI. Но **Mongo-путь не защищён ничем**, и там есть отказ без симптомов: пустая карта
расходов приборов проходит валидацию, мощность ГВС становится нулём, котёл подбирается только
под отопление, health зелёный. Отдельно — пол мощности ГВС в 24 кВт без источника, который
завышает котёл в полтора раза на малых объектах.

И хорошая новость: **XSS-вектора через PDF и публичную ссылку нет.** Защита двухслойная —
вырезание угловых скобок на входе и экранирование на выходе; проверено тремя типовыми
полезными нагрузками до самого стока.

**Блокеры зоны — пять. Всего записей 49 (48 находок + Z3-15, результат проверки XSS):**

| ID | Что | Категория | Цена |
|---|---|---|---|
| Z3-35 | `/health` не проверяет, загрузились ли справочники | БЛОКЕР-A | 1.5 ч |
| Z3-37 | Пол мощности ГВС 24 кВт без источника завышает котёл в 1.5× | БЛОКЕР-B | 0.5 ч + регресс |
| Z3-25 | Версия Node не зафиксирована нигде: 20 / 22 / 26 / неизвестно | БЛОКЕР-B | 30 мин |
| Z3-26 | `SIGTERM` не обрабатывается — каждый деплой рвёт запросы | БЛОКЕР-B | 1.5 ч |
| Z3-27 | Лимит памяти не задан ни в одном слое (якоря к P2-9) | БЛОКЕР-B | 30 мин |

Это всё, что тянет на блокер. Остальные 43 записи — долг и косметика.

---

## Инструменты: команды и вывод

**Формальная валидность спеки:**
```
$ npx -y @redocly/cli@latest lint openapi.yaml
openapi.yaml: validated in 65ms
Woohoo! Your API description is valid. 🎉
You have 13 warnings.
```
Все 13 — правило `spec-ref-siblings` (свойство рядом с `$ref`), разбор в Z3-08.

**Живая сверка ответов со схемами** (AJV 8, схемы дереференсятся `@apidevtools/json-schema-ref-parser`,
конверсия OAS 3.0 → draft-07 для `nullable` / булева `exclusiveMinimum`; сервер поднят на 3199
с `CATALOG_SOURCE=file`, без Mongo):

```
### GET /health                            vs HealthOkResponse.yaml                      : OK
### GET /api/v1/catalog                    vs CatalogGetResponse.yaml                    : OK
### GET /presets/envelope                  vs PresetsEnvelopeOkResponse.yaml             : MISMATCH (6)
### GET /presets/underfloor-heating        vs PresetsUnderfloorHeatingOkResponse.yaml    : OK
### GET /presets/underfloor-heating/bases  vs PresetsUnderfloorHeatingBasesOkResponse    : OK
### GET /presets/flooring-finishes         vs PresetsFlooringFinishesOkResponse.yaml     : OK
### POST /api/v1/calc  (payload #1)        vs CalcOkResponse.yaml                        : MISMATCH (7)
### POST /api/v1/calc  (payload #2)        vs CalcOkResponse.yaml                        : MISMATCH (12)
### ErrorEnvelope × 6 реальных ошибок (400/404/503×3/400)                                : OK
### GET /api/v1/me                         vs MeOkResponse.yaml                          : OK
```

Полезные нагрузки — существующие в репозитории: `backend/calc-payload.json` (дом) и
`backend/scripts/testApartmentScheme2Payload.json` (квартира, схема 2).

---

# Находки

## Контракт ответов

### Z3-01 · Схемы ответов не проверяются ничем — корень остальных находок раздела
**Категория: ДОЛГ** (высокий приоритет) · 3–5 ч · риск правки: нет

**Проблема.** `redocly`/`spectral`/`swagger-*` отсутствуют в зависимостях всех четырёх пакетов
(`package.json`, `backend/package.json`, `frontend/package.json` — ноль совпадений). В
`.github/workflows/verify.yml` шага валидации спеки нет. Кодогенерации нет: фронтенд держит
собственные рукописные типы (`frontend/src/types/`), из `openapi.yaml` ничего не выводится.
Единственные скрипты, вообще открывающие файлы схем, читают их как **текст** и проверяют
наличие подстрок: `scripts/verifyAuthDocs.mjs:80` (`SubscriptionTier.yaml`),
`scripts/verifyBackendDocs.mjs:316` (`UnderfloorHeatingReport.yaml`).

При этом контракт **входа** исполняемый: `backend/src/api/calcInputSchemaLoader.js:57` собирает
`CalcInput.yaml` и отдаёт в AJV (`backend/src/api/validate.js:243`). Асимметрия полная: вход
не может разойтись с документацией, выход не может с ней сойтись.

**Последствие.** 4 130 строк схем ответов имеют статус комментария. Расходятся молча и уже
разошлись (Z3-02…Z3-05). Цена наступает не сегодня, а в момент, когда спеку понадобится
предъявить: наём (человек будет писать по схеме и получать другое), интеграция с партнёром,
генерация клиента. Тогда обнаружится, что ни одному полю нельзя верить без проверки в коде.

**Решение.** Два шага, оба дешёвые:
1. `npx @redocly/cli lint openapi.yaml` шагом в CI — 15 минут, ловит структурные ошибки (Z3-04,
   Z3-08 нашлись бы им же).
2. Один сценарий-снимок: поднять сервер на файловом каталоге, дёрнуть 6 публичных маршрутов
   и `POST /api/v1/calc` на двух существующих payload'ах, провалидировать AJV против схем.
   Скрипт из этого аудита — ~40 строк, укладывается в существующий харнесс `backend/scripts/`.
   Он и обнаружил все 12 расхождений.

**Не делать.** Не заводить кодогенерацию типов из спеки. Фронтендовые типы рукописные и живые;
переезд на генерацию — недели, и он не нужен, пока схемы врут.

---

### Z3-02 · Реальный ответ `/api/v1/calc` не проходит собственную схему — 12 расхождений
**Категория: ДОЛГ** · 3–4 ч (все три класса разом) · риск правки: нет (правится только YAML)

Три механически разных класса. Ни один сегодня ничего не ломает — потому что схему никто
не исполняет (Z3-01). Каждый сломает первого же потребителя, который начнёт ей верить.

**Класс A — `additionalProperties: false` и поля, которые код реально отдаёт.**
Четыре поля возвращаются в проде и запрещены схемой:

| Поле в ответе | Якорь схемы, запрещающей его |
|---|---|
| `report.calculations.hydraulics.boilerPumpDesignFlowM3PerHour` | `components/schemas/HydraulicsReport.yaml:3` |
| `report.calculations.hydraulics.circulationTopology` (`"direct"`) | `components/schemas/HydraulicsReport.yaml:3` |
| `report.matching.hydraulics.builtinPumpDuty` (объект из 5 полей) | `components/schemas/HydraulicsMatchingReport.yaml:3` |
| `report.matching.hydraulics.resolvedRecommendations` | `components/schemas/HydraulicsMatchingReport.yaml:3` |

Показательно, что рукописные TS-типы эти поля **знают**: `backend/src/hydraulics/types.d.ts`
содержит все четыре, `resolvedRecommendations` доходит до UI
(`frontend/src/types/underfloorHeating.ts:147`). То есть YAML отстал от кода, а не наоборот.

**Класс B — `nullable: true` рядом с `enum` без `null` в списке (7 мест).**
По OAS 3.0.3 `null` обязан быть явным членом `enum`; сейчас он в нём отсутствует, и прод
отдаёт ровно `null`. Проверено на живом ответе: `combustionTypeFilterApplied: null`,
`orientation: null` (у элементов без ориентации), `resolvedEmitterKind: null`.

```
components/schemas/BoilerMatchingReport.yaml:113        enum: [turbo, atmospheric]
components/schemas/HeatLossElementReport.yaml:47        enum: [N, NE, E, SE, S, SW, W, NW]
components/schemas/RadiatorsMatchingReport.yaml:85      enum: [sectional, panel]
components/schemas/RadiatorsMatchingReport.yaml:98      enum: [ufh_only]
components/schemas/RadiatorsProposalLineReport.yaml:80  enum: [sectional, panel]
components/schemas/RadiatorsRoomEmitterDiff.yaml:20     enum: [sectional, panel, none]
components/schemas/RadiatorsRoomEmitterDiff.yaml:24     enum: [sectional, panel, none]
```
Особенно неприятен `HeatLossElementReport.yaml:47`: `orientation` — поле теплопотерь, оно
`null` в **каждом** расчёте, где есть элемент без ориентации (пол, потолок). То есть схема
раздела теплопотерь неверна практически всегда.

**Класс C — `nullable: true` рядом с `allOf` (10 мест).** `null` не проходит вложенный
`allOf`, требующий `type: object`. Прод отдаёт `null`: `matching.boiler.proposalEconomy: null`,
`matching.radiators.lineEconomy.chosen: null`.

```
components/schemas/BoilerMatchingReport.yaml:57,84,92,102
components/schemas/ManifoldsMatchingReport.yaml:60,81,104
components/schemas/RadiatorsMatchingReport.yaml:14
components/schemas/RadiatorsProposalLineReport.yaml:24
components/schemas/UniboxesMatchingReport.yaml:86
```

**Решение.** Класс A — добавить 4 поля в схемы (или снять `additionalProperties: false`,
но лучше добавить: закрытость здесь полезна, она эти расхождения и обнаружила). Класс B —
дописать `null` в 7 списков. Класс C — заменить `nullable: true` + `allOf` на
`oneOf: [$ref, {type: 'null'}]` либо (проще, тем же смыслом в OAS 3.0) убрать `allOf`-обёртку.
17 механических правок, ноль риска — трогается только документация.

---

### Z3-49 · `oneOf` в пресете ограждения отвергает 6 пресетов из 47
**Категория: ДОЛГ** · 15 мин · риск правки: нет
*(номер в конце — находка обнаружена последней, по смыслу относится к Z3-02)*

**Проблема.** `components/schemas/EnvelopePreset.yaml:26-28`:
```yaml
oneOf:
  - required: [uValue]
  - required: [uModel]
```
`oneOf` требует совпадения **ровно с одной** ветвью. Пресет, несущий оба поля, удовлетворяет
обеим и потому не проходит.

**Реальность на живом ответе `GET /api/v1/presets/envelope`:** 47 пресетов, из них **6 несут
и `uValue`, и `uModel`** — `wall_gas_concrete_d500`, `wall_brick_solid`, `wall_brick_hollow`,
`wall_monolithic_concrete_200`, `wall_limestone_400`, `wall_shell_400`. Это все пресеты
несущего слоя стены с пересчётом U по толщине, то есть **не краевой случай, а целая
категория** — ровно та, вокруг которой построена многослойная формула наружной стены.

**Последствие.** Схема утверждает, что такого пресета быть не может, а их шесть, и они
центральные для расчёта теплопотерь.

**Решение.** `anyOf` вместо `oneOf` — одно слово. Смысл («хотя бы один способ задать U»)
сохраняется, а описанное поведение начинает совпадать с фактическим.

---

### Z3-03 · `appliancesSchemaVersions` — закрытый список поверх сквозной карты
**Категория: ДОЛГ** · 15 мин · риск правки: нет

**Проблема.** `backend/src/report/buildReport.js:743` кладёт в отчёт
`appliancesSchemaVersions: appliances.schemaVersions` — карту целиком, как она пришла
из справочника. Схема `components/schemas/CalcReportMeta.yaml:55-57` объявляет её
`additionalProperties: false` с фиксированным перечнем ключей.

Реальность на живом ответе: `{indirect_water_heater, boiler, electric_storage, radiator,
underfloor_heating, hydraulics}` — **6 ключей, из них 2 схемой запрещены.**

**Последствие.** Это не разовое расхождение, а конструкция, гарантирующая расхождение:
каждый новый вид оборудования в справочнике добавляет ключ, о котором схема не знает.
Уже сработало дважды.

**Решение.** `additionalProperties: {type: integer, minimum: 1}` вместо перечня.
Одна строка, и класс ошибок закрывается навсегда.

---

### Z3-04 · Запись в карте компонентов указывает на чужой файл
**Категория: ДОЛГ** · 20 мин · риск правки: нет

**Проблема.** `openapi.yaml:1527-1528`:
```yaml
    UnderfloorHeatingAssemblyPreset:
      $ref: ./components/schemas/UnderfloorHeatingBasePreset.yaml
```
Имя одно, файл другой. Настоящий `components/schemas/UnderfloorHeatingAssemblyPreset.yaml`
(43 строки) не используется никем и описывает **другую структуру**: `kind:
underfloor_heating_system` против `underfloor_heating_base`, обязательные `mountType`,
`finishTypes`, `constraints`, поле `coveringResistanceM2KW` против
`baseCoveringResistanceM2KW`.

Ошибка продублирована в типах: `backend/src/types/shared-types.d.ts:157` —
`export type UnderfloorHeatingAssemblyPreset = UnderfloorHeatingBasePreset;`.

**Последствие.** Ни один инструмент это не ловит: оба файла — валидные схемы, `redocly lint`
молчит. Каскадом умирает и `UnderfloorHeatingAssemblyConstraints.yaml` — на него ссылается
только мёртвый файл. Кто откроет `UnderfloorHeatingAssemblyPreset.yaml`, чтобы понять формат
пресета, получит несуществующий формат.

**Проверено, какая сторона права:** реальные данные
(`backend/src/data/warmFloorAssemblyPresets.js:114-122`) отдают `usage:
'underfloor_heating_base'`, `baseCoveringResistanceM2KW`, `layers` — то есть
`UnderfloorHeatingBasePreset.yaml`. Живой ответ `GET /api/v1/presets/underfloor-heating/bases`
проходит эту схему чисто.

**Решение.** Удалить `UnderfloorHeatingAssemblyPreset.yaml`,
`UnderfloorHeatingAssemblyConstraints.yaml`, запись `openapi.yaml:1527-1528` и псевдоним
`shared-types.d.ts:157`.

---

### Z3-05 · Девять схем-сирот, 643 строки; одна из них — живая, но вне документа
**Категория: ДОЛГ** · 1–2 ч · риск правки: нет

Достижимость посчитана обходом от всех `$ref` в разделе `paths` вниз по относительным ссылкам:
**111 файлов из 120 достижимы**. Девять — нет:

| Файл | Строк | Диагноз |
|---|---:|---|
| `HydraulicsPipelineInput.yaml` | 326 | **живая**, см. ниже |
| `ReferenceDataSources.yaml` | 120 | в карте компонентов, не используется; упомянута только в прозе `openapi.yaml:425` |
| `ProjectShareSnapshot.yaml` | 48 | внутренний DTO, в ответы не попадает (в API отдаётся `PublicSharePayload`) |
| `UnderfloorHeatingAssemblyPreset.yaml` | 43 | мёртвая, Z3-04 |
| `AuthorizationErrorCode.yaml` | 14 | коды ошибок «Фазы 2», нигде не привязаны |
| `UfhCollectorTransit.yaml` | 14 | дубль `#/definitions/UfhCollectorTransit` внутри `HydraulicsPipelineInput.yaml:196` |
| `UnderfloorHeatingAssemblyConstraints.yaml` | 12 | сирота каскадом от Z3-04 |
| `ProjectsAuthErrorCode.yaml` | 12 | в карте, не используется |
| `WaterNormsStorage.yaml` | 54 | не достижима из `paths`, потребителей в коде нет |

**Особый случай — `HydraulicsPipelineInput.yaml`.** Это не мусор: файл загружается в рантайме
(`backend/src/hydraulics/pipelineSchemaLoader.js:22` → `validatePipelineInput.js:8`) и
валидирует вход гидравлического пайплайна через AJV. Но он лежит в `components/schemas/`,
не входит в OpenAPI-документ, и написан **в другом диалекте**: `$ref: '#/definitions/…'`
(`:79`) и числовой `exclusiveMinimum: 0` (`:102,106,129-132`) — JSON Schema draft-07,
а не OAS 3.0.

**Последствие.** 326 строк исполняемой схемы, которых не касается ни `redocly lint`
(файла нет в документе), ни ревью «схем API» (визуально файл неотличим от соседей).
Диалекты соседствуют в одной папке: `exclusiveMinimum: true` (OAS 3.0) в
`UniboxCatalogItem.yaml:42` и `exclusiveMinimum: 0` (draft-07) в `HydraulicsPipelineInput.yaml:102`.
Перенос фрагмента между файлами меняет смысл ограничения молча.

**Проверено, что сейчас это не баг:** бандл `CalcInput.yaml` (9 файлов) не содержит ни одной
булевой формы `exclusive*` — то есть рантайм-AJV (draft-07 по умолчанию, `ajv@8.18.0`)
не встречает чужого диалекта. Совпадение, а не защита.

**Решение.** Перенести `HydraulicsPipelineInput.yaml` и `UfhCollectorTransit.yaml` в
`backend/src/hydraulics/schema/` — туда, где они исполняются. Остальные 7 удалить.
Оставшиеся в `components/schemas/` станут ровно тем, чем называются: фрагментами OpenAPI.

---

### Z3-06 · `429` не объявлен на 13 путях с ограничителем; `401`/`403` — на 11 защищённых
**Категория: ДОЛГ** · 1–2 ч · риск правки: нет

**Проблема — 429.** `sendErrorEnvelope(res, {statusCode: 429, …})`
(`backend/src/api/middleware/rateLimiters.js:44-50`) срабатывает на всех маршрутах,
где навешен лимитер. В `openapi.yaml` объявлений `'429'` ровно три: `:257` (feedback),
`:1004` и `:1052` (публичные ссылки). Без объявления остались:
`POST /api/v1/calc` (`routes.js:196`), `GET`/`POST /api/v1/projects` (`projectsRoutes.js:135,210`),
`POST /projects/import` (`:246`), `GET`/`PUT`/`DELETE /projects/:id` (`:276,331,387`),
`POST /:id/calc` (`:435`), `GET /:id/calculations` (`:568`), `GET /:projectId/calculations/:calcId`
(`:614`), `GET /:id/pdf` (`:656`), `POST`/`DELETE /:id/share` (`:716,834`) — **13 путей.**

Для `POST /api/v1/calc` это не мелочь: лимит в проде — 20 запросов на 15 минут
(`rateLimiters.js:66`), то есть 429 у обычного пользователя вероятнее, чем объявленные
для этого пути `502` и `500`.

**Проблема — 401/403.** `router.use('/api/v1/projects', mongoMiddleware, requireAuth)`
(`projectsRoutes.js:128`) закрывает весь префикс. `PROJECTS_AUTH_REQUIRED` / 401 приходит из
`backend/src/auth/requireAuth.js:26`. В спеке `401` и `403` объявлены только у
`GET /api/v1/projects` и `POST /api/v1/projects`; у остальных 11 путей под тем же
`requireAuth` их нет, хотя `security: ProjectsBearerAuth` проставлен.

**Побочно (КОСМЕТИКА).** `mongoMiddleware` стоит **до** `requireAuth` (`:128`). Проверено живьём:
`GET /api/v1/projects` без токена при недоступной Mongo возвращает `503 MONGODB_UNAVAILABLE`,
а не `401`. Анонимный запрос узнаёт состояние базы, а объявленный `401` в этой ситуации
не наступает никогда. Перестановка двух аргументов.

**Решение.** Общий блок ответов через `$ref` на переиспользуемый `components/responses`
вместо копирования в каждый путь. Заодно снимутся ложные объявления `400` у `GET /health`
(`openapi.yaml:26`) и четырёх маршрутов пресетов — у них нет входа, `400` физически неоткуда.

---

### Z3-07 · Четыре группы маршрутов не задокументированы вовсе
**Категория: КОСМЕТИКА** · 30 мин · риск правки: нет

Отвечают, в спеке отсутствуют (проверено живьём):
- `GET /` → `{ok, status, service, health, api, endpoints}` (`backend/src/api/routes.js:44`)
- `GET /api` → `{ok, version, base, hint}` (`routes.js:67`)
- `GET /api/health` — алиас для мониторинга (`routes.js:36`)
- `/api/projects/*` → внутренний rewrite на `/api/v1/projects/*` (`routes.js:176-182`),
  то есть **13 legacy-алиасов** ко всем маршрутам проектов сразу

Последние опасны для оценки: судя по спеке, `/api/projects` — 404; фактически это полноценный
рабочий вход в приватный API. Любое рассуждение о поверхности атаки по спеке будет неполным.

---

### Z3-08 · Тринадцать предупреждений `spec-ref-siblings`; одно из них меняет смысл
**Категория: КОСМЕТИКА** (12 из 13) · 30 мин · риск правки: нет

В OAS 3.0 соседи `$ref` игнорируются. Двенадцать случаев — `description` рядом с `$ref`
(`ProjectDetail.yaml:10`, `PublicSharePayload.yaml:49`, `ProjectShareSnapshot.yaml:47`,
`CalcInput.yaml:101,106,191`, `RadiatorsMatchingReport.yaml:26,41,46`, `CalcReport.yaml:65`,
`EnvelopePreset.yaml:8`, `FlooringFinishMaterial.yaml:18`): текст просто не доедет до
читателя спеки.

Тринадцатый семантический: `components/schemas/CalcReport.yaml:38` — `nullable: true` рядом
с `$ref` у `calculations.underfloorHeating`. Поле объявлено обнуляемым, флаг игнорируется,
контракт утверждает обратное тому, что задумано.

**Решение.** Обернуть в `allOf: [$ref]` + сосед (для описаний) — либо просто перенести текст
в описываемую схему. Тринадцатый чинить вместе с классом C из Z3-02, механика та же.

---

### Z3-09 · У публичного (монетизируемого) документа два крупнейших раздела без контракта
**Категория: ДОЛГ** · оценка входит в P2-4, отдельно не считать · риск правки: средний

`components/schemas/PublicSharePayload.yaml:37-42` объявляет `matching` и `calculations` как
`type: object, additionalProperties: true` — то есть «произвольный JSON». Это ответ
`GET /api/v1/public/shares/{shareToken}` — ровно тот документ, который монтажник показывает
клиенту и который планируется продавать.

Сам механизм публикации сделан аккуратно: снимок собирается whitelist'ом
(`backend/src/projects/buildShareSnapshot.js:72-91`), сериализация — вторым whitelist'ом
(`serializeShare.js:57-74`), `ownerId`/`survey`/`calcInput` наружу не уходят. Схема ответа
соответствует реальности по всем 9 объявленным полям. Но два поля, где лежит сама смета,
контракта не имеют.

**Последствие.** Опубликованные ссылки разных поколений нельзя проверить на совместимость
автоматически — «что должно быть в снимке» нигде не записано. Это тот же шов, что и в P2-4,
и переписывать его дважды не нужно.

**Решение.** Не сейчас. Зафиксировать как границу: когда дойдёт очередь до контракта сметы
(P2-4), начинать надо **отсюда** — с публичного снимка, а не с внутренних структур: у него
уже есть жёсткая граница whitelist'ов и внешний потребитель.

---

## Схемы ответов: объявлено против реального

Прогон против живого сервера. «—» — маршрут требует Mongo, живьём не проверен (сверка по коду).

| Маршрут | Объявлено | Реально | Вердикт |
|---|---|---|---|
| `GET /health` | `HealthOkResponse` | `{ok:true,status:'up'}` | ✅ |
| `GET /api/v1/catalog` | `CatalogGetResponse` | совпадает целиком | ✅ |
| `GET /presets/envelope` | `PresetsEnvelopeOkResponse` | элемент удовлетворяет **обоим** ветвям `oneOf` в `EnvelopePreset` | ⚠ `oneOf`→`anyOf` |
| `GET /presets/underfloor-heating` | `PresetsUnderfloorHeatingOkResponse` | совпадает | ✅ |
| `GET /presets/underfloor-heating/bases` | `PresetsUnderfloorHeatingBasesOkResponse` | совпадает | ✅ |
| `GET /presets/underfloor-heating/modes` | inline (`openapi.yaml:150-183`) | совпадает | ✅ |
| `GET /presets/flooring-finishes` | `PresetsFlooringFinishesOkResponse` | совпадает | ✅ |
| `POST /api/v1/calc` | `CalcOkResponse` | **12 расхождений**, Z3-02 | ❌ |
| `POST /api/v1/calc` | 200/400/502/500 | плюс необъявленный **429** | ❌ |
| ошибки 400/404/503 (6 разных) | `ErrorEnvelope` | совпадает, включая `details` | ✅ |
| `GET /api/v1/me` | `MeOkResponse` | совпадает (в т.ч. `devMode`) | ✅ |
| `GET /api/v1/projects` | `ProjectsListResponse` | `{ok,projects,total,limit,skip}` — совпадает | ✅ (по коду) |
| `GET /api/v1/projects/:id` | `ProjectGetResponse`→`ProjectDetail` | `serializeProjectDetail` — поля совпадают | ✅ (по коду) |
| `DELETE /api/v1/projects/:id` | `ProjectDeleteResponse` | `{ok,deleted,calculationsRemoved}` | ✅ (по коду) |
| `POST /:id/share` | `ProjectSharePublishResponse` | совпадает по 5 полям | ✅ (по коду) |
| `DELETE /:id/share` | `ProjectShareRevokeResponse` | совпадает | ✅ (по коду) |
| `GET /public/shares/{token}` | `PublicShareResponse`→`PublicSharePayload` | 9 полей совпадают; `matching`/`calculations` без контракта | ⚠ Z3-09 |
| `GET /:id/pdf`, `/public/.../pdf` | `application/pdf`, binary | так и есть | ✅ |
| `GET /admin/feedback/stream` | `text/event-stream` | SSE, `res.write` (`adminFeedbackRoutes.js:142-148`) | ✅ |
| 13 путей с лимитером | без `429` | 429 достижим | ❌ Z3-06 |
| 11 путей под `requireAuth` | без `401`/`403` | достижимы | ❌ Z3-06 |
| `GET /`, `GET /api`, `GET /api/health`, `/api/projects/*` | не объявлены | отвечают | ❌ Z3-07 |

---

## `shared/` — рукописные пары `.js` + `.d.ts`

### Z3-10 · `typecheck:shared` не сверяет `.js` с `.d.ts` — гейт декоративный
**Категория: ДОЛГ** (высокий приоритет) · 3 ч (гейт) или 6–8 ч (снос `.d.ts`) · риск: средний

**Проблема.** `shared/tsconfig.json:14` включает и `**/*.js`, и `**/*.d.ts`. При совпадении
имён TypeScript резолвит модуль в `.d.ts`, а `.js` проверяет отдельным островом — **сравнения
между ними не происходит никогда**. Плюс `tsconfig.strict-base.json:11` ставит
`skipLibCheck: true`, из-за чего сами декларации не типизируются и в них проходят импорты
несуществующих типов.

Доказано экспериментом: в копию `shared/` положены `__mismatch.js` (`export const ONLY_IN_JS`,
`function f(a,b)`) и `__mismatch.d.ts` (`declare const ONLY_IN_DTS`, `function f(a: number)`) —
полностью противоречащие. `npx tsc -p tsconfig.json --noEmit` → пустой вывод, exit 0.
Контрольная проба (`/** @type {string} */ export const B = 123;`) даёт `TS2322`, то есть
`checkJs` работает — просто изолированно.

**Почему это важно именно здесь.** `frontend/tsconfig.app.json:16` включает
`["src", "../shared/**/*.d.ts", "../shared/**/*.ts"]` — **без `*.js` и без `allowJs`**.
Для фронтенда `.d.ts` является единственным источником истины о `shared/`, и этот источник
не верифицирован ничем.

**Последствие.** Найдено **6 расхождений в 12 парах** (таблица ниже). Ни одно не видно гейту.

**Решение.** Дешевле всего — второй скрипт в `shared/package.json`: генерировать декларации
из `.js` во временную папку (`tsc --allowJs --declaration --emitDeclarationOnly`) и падать
при расхождении **состава экспортов** (полный дифф типов даст ложные срабатывания на
литеральных сужениях). Радикальнее и дешевле в поддержке — снести `.d.ts` совсем: проба
показала, что tsc выводит из JSDoc почти всё нужное; тогда во `frontend/tsconfig.app.json:16`
добавляются `../shared/**/*.js` и `allowJs`.

---

### Z3-11 · Импорт несуществующего типа схлопывает денежное поле в `any` — мимо гейта `verifyNoTypeBypass`
**Категория: ДОЛГ** · 20 мин · риск правки: нет

**Проблема.** `shared/waterHeaterFormContract.d.ts:5` импортирует
`HotWaterBoilerPowerMatchingScheme` из `./heatingMatchingSchemes.js`. Такого типа в
`shared/heatingMatchingSchemes.d.ts` нет. `skipLibCheck` гасит ошибку, тип разрешается
в error-type, и `HotWaterBoilerPowerMatchingScheme | string` схлопывается в `any`.

Проверено: `const x: WaterHeaterFormContractValue['hotWaterBoilerPowerMatchingScheme'] = 12345`
и `= {nonsense: true}` компилируются без ошибок.

**Последствие.** Схема подбора мощности котла под ГВС — параметр, напрямую определяющий,
какой котёл попадёт в смету. `scripts/verifyNoTypeBypass.mjs:17` сканирует `shared/` и
запрещает `: any` / `as any`, но ищет **текст**, а не эффективный тип: дыра проходит гейт,
формально созданный ровно против неё.

**Решение.** Одна строка в `shared/heatingMatchingSchemes.d.ts`:
`export type HotWaterBoilerPowerMatchingScheme = (typeof HOT_WATER_BOILER_MATCHING_SCHEME_ENUM)[number];`
Побочно снимается дублирующий вывод того же типа во `frontend/src/types/heatingMatching.ts:17`.

---

### Z3-12 · `objectMetaForCalcPayload`: декларация обещает `T`, реализация возвращает `Omit<T, …>`
**Категория: ДОЛГ** · 30 мин · риск правки: средний (вскроет ошибки на call-site — это и есть польза)

`shared/waterHeaterFormContract.d.ts:19` — `<T extends Record<string, unknown>>(objectMeta: T, …): T`.
Реализация `shared/waterHeaterFormContract.js:30` деструктурирует поле наружу
(`const { indirectDhwSpaceAvailable: _legacy, ...rest }`) и на `:42` возвращает `rest` —
без ключа. Тип утверждает, что поле сохраняется; рантайм его удаляет.

Сегодня безопасно только потому, что во `frontend/src/types/envelope.ts:62` поле опционально.
Сделать его обязательным — и в теле `POST /api/v1/calc` появится тихий `undefined`.

**Решение.** В `.d.ts`: `Omit<T, 'indirectDhwSpaceAvailable'> & { indirectDhwSpaceAvailable?: true }`.

---

### Z3-13 · Мёртвый реэкспорт, который TypeScript отрицает, а рантайм отдаёт
**Категория: ДОЛГ** · 20 мин · риск правки: нет

`shared/heatingThermalRegimePresets.js:8-13` реэкспортирует четыре символа
(`allowedThermalRegimePresetsForScheme`, `recommendedThermalRegimePresetForScheme`,
`thermalRegimeRecommendationHint`, `SURVEY_THERMAL_REGIME_PRESET_IDS`), которых нет в
одноимённом `.d.ts`. Потребитель получает `TS2305`.

Все текущие потребители обращаются к модулю рекомендаций напрямую
(`frontend/src/types/heatingThermalRegime.ts:14-17`, `backend/src/logic/normalizeHeatingUfhPreset.js:6`),
то есть реэкспорт мёртв целиком. Удалить блок, а не дописывать декларацию.

---

### Z3-14 · Пороговое значение унибокса живёт в двух местах
**Категория: ДОЛГ** · 1 ч · риск правки: нет

`frontend/src/types/rooms.ts:45,47` держит посимвольную копию
`UfhTerminalControl = 'collector' | 'unibox'` и `UFH_TERMINAL_CONTROL_MAX_AREA_SQM = 20`
из `shared/ufhTerminalControl.js:7`. Фронтенд этот модуль вообще не импортирует; единственный
потребитель `shared`-версии — `backend/src/api/validate.js`.

**Последствие.** Порог по площади решает, доступна ли опция унибокса. Поднять его в
`shared/ufhTerminalControl.js:7` — и UI останется на старом пороге: форма покажет то, что
AJV отклонит четырёхсотым. Механика та же, что в известной P1-5, объект другой.

Родственные копии (дешевле, но того же класса): `backend/src/types/shared-types.d.ts:108`
(`UfhCircuitPresetId`) и `:459-461` (`HeatingThermalRegimePreset`).

**Решение.** `frontend/src/types/rooms.ts:45,47` → реэкспорт из `shared/ufhTerminalControl.js`.

---

### Все 12 пар `.js` / `.d.ts`

| Пара | Расхождение | Какое |
|---|:--:|---|
| `heatingMatchingSchemes` | **да** | нет `export type HotWaterBoilerPowerMatchingScheme` → `any` (Z3-11) |
| `heatingThermalRegimePresets` | **да** | 4 реэкспорта из `js:8-13` отсутствуют в `.d.ts` (Z3-13); `label: string` фактически `any`/потенциальный `undefined` (`js:42,63`) |
| `heatingThermalRegimeRecommendations` | нет | состав и сигнатуры совпадают |
| `radiatorConnection` | сигнатура | `isRadiatorConnection`: `.js` → `boolean`, `.d.ts` → предикат `value is …` |
| `radiatorEmitterPreference` | сигнатура | то же ×2 (`js:38,46`) |
| `roomDesignAirTemp` | **да** | опциональность параметров и `undefined`/`''` в `bathroomAirTempC` при `exactOptionalPropertyTypes` |
| `roomTypeNormalization` | ослабление | `.d.ts:5` даёт `readonly string[]` там, где tsc выводит литералы → `frontend/src/types/rooms.ts:6-16` дублирует 10 значений вручную |
| `ufhCircuitPresets` | сигнатура | `isUfhCircuitPresetId`: `boolean` vs предикат (`js:36`) |
| `ufhDistributionPresets` | ослабление | `resolveUfhDistributionPreset`: `@param {object} ctx` в `js:76` против типизированного `UfhDistributionResolveCtx` в `.d.ts:39`; `objectType` обязателен в `js:52`, опционален в `.d.ts:12` |
| `ufhModePresetIds` | нет | синхронны |
| `ufhTerminalControl` | нет | сгенерированная декларация ≡ рукописной символ в символ |
| `waterHeaterFormContract` | **да** | возврат `T` против `Omit<…>` (Z3-12) + битый импорт (Z3-11) |

Ни одного случая «объявлено в `.d.ts`, отсутствует в `.js`» — то есть сценарий
рантайм-`undefined` у потребителя не реализовался ни разу. Все расхождения — в обратную
сторону или в сигнатурах.

---

## Санитайзинг, middleware, модели

### Z3-15 · XSS через PDF и публичную ссылку — НЕ НАЙДЕН (проверено до стока)
**Не находка. Результат проверки, который стоит зафиксировать.**

Прослежен полный путь `clientName`, `label`, `location.address`, `rooms[].name`,
`envelopeElements[].name`, полей обратной связи.

*Слой 1, вход.* `sanitizeTrimAngleBrackets` вырезает `<` и `>`
(`backend/src/utils/sanitizeString.js:12`). Применён к `clientName`/`label`
(`backend/src/projects/validateProjectBody.js:20,40`), к адресу и именам комнат/элементов
(`backend/src/api/validate.js:315,318-319,328-332`), ко всему каталогу.

*Слой 2, сток (а) — PDF.* `renderEstimatePdf` → `buildEstimatePdfHtml` → `page.setContent(html)`
(`backend/src/projects/renderPdfFromHtml.js:90`). Все интерполяции проходят `escapeHtml`
(`backend/src/projects/pdfHtmlEscape.js:9-15`): `buildEstimatePdfHtml.js:107,110,116,152-156,215,308,309`,
техблок — `buildTechnicalPdfHtml.js:49,68,120,206`.

*Слой 2, сток (б) — публичная страница.* Единственный `dangerouslySetInnerHTML` во всём
фронтенде — `frontend/src/components/SharePresentationPage/SharePresentationPage.tsx:187`,
источник `frontend/src/utils/buildTechnicalPrintHtml.ts:116`, где экранирование встроено
в конструкторы таблиц (`:37-43,54,71,75,203,346`).

Проверенные полезные нагрузки: `<img src=x onerror=alert(1)>` → `img src=x onerror=alert(1)`
(текст); `</script><script>` → `/script script`; `"><svg onload=` → `&quot; svg onload=`
внутри `<td>`. Останавливается **дважды**.

Смежное чисто: имя PDF-файла санитизируется до формирования заголовка, включая коды < 32
(`backend/src/projects/pdfFilename.js:9-23`) — инъекция `Content-Disposition` невозможна.
Выгрузок CSV/Excel в проекте нет вовсе (grep `csv|xlsx|exceljs|sheetjs` — пусто), формульная
инъекция неприменима. В админке `href={pageUrl}` защищён whitelist'ом схем
(`frontend/src/pages/AdminFeedbackPage/AdminFeedbackPage.tsx:58-66`).

---

### Z3-16 · `trust proxy` включается в проде безусловно — обход всех IP-лимитов одним заголовком
**Категория: ДОЛГ** · 30 мин · риск правки: низкий

**Проблема.** `backend/src/index.js:51-53`: при `NODE_ENV=production` и незаданном
`TRUST_PROXY` ставится `app.set('trust proxy', 1)`. Ключ ограничителя — `req.ip`
(`backend/src/api/middleware/rateLimiters.js:19`).

**Последствие.** Если контейнер окажется достижим минуя обратный прокси, `X-Forwarded-For`
подделывается, и все IP-лимиты обходятся: `POST /api/v1/calc` (20/15 мин), публичные ссылки,
обратная связь. Это прямо усиливает известную P1-1: там дорогой запрос без верхней границы,
здесь — снятие счётчика.

Слушатель поднят на `0.0.0.0` (`backend/src/index.js:257`), то есть достижимость зависит
целиком от настроек хостинга.

**Решение.** Требовать `TRUST_PROXY` явно в проде (падать при отсутствии, как уже сделано
для настроек авторизации в `:26-30`), либо слушать внутренний интерфейс.
**НЕ ПРОВЕРЕНО:** фактическая сетевая конфигурация Render — определяет, теоретический
это риск или боевой.

---

### Z3-17 · Приватные ответы отдаются без `Cache-Control`
**Категория: ДОЛГ** · 30 мин · риск правки: низкий

`setNoStoreCacheHeaders` вызывается ровно в одном месте — `backend/src/api/routes.js:102-105`,
для `/api/v1/presets`, то есть **для справочников, которые как раз не приватны**.
`/api/v1/projects*`, `/api/v1/me`, `/api/v1/admin/feedback` отдают JSON с ETag и без
`Cache-Control` → эвристическое кэширование браузером, кнопка «назад» после выхода
на общем компьютере.

**Решение.** `Cache-Control: private, no-store` внутри `requireAuth` — одно место,
покрывает все приватные маршруты сразу.

---

### Z3-18 · `sanitizeString` — чёрный список из двух символов
**Категория: ДОЛГ** · 1 ч · риск правки: низкий

`backend/src/utils/sanitizeString.js:12` — весь санитайзер: `trim` + `replace(/[<>]/g, '')`.
Нет нормализации Unicode, нет фильтра управляющих символов внутри строки, нет фильтра
bidi-override `U+202E` и zero-width `U+200B`.

Двойное кодирование его **не обходит**: `<` разворачивается `JSON.parse` до фильтра,
`&#60;` после `escapeHtml` остаётся текстом. То есть XSS здесь нет (Z3-15).

**Реальное последствие — спуфинг и порча данных.** Имя клиента с `U+202E` переворачивает
строку в PDF и на публичной странице. Zero-width символы ломают поиск по `clientName`
(`backend/src/api/projectsRoutes.js:157`). Отдельно: длина режется в UTF-16 code units
(`backend/src/feedback/validateFeedbackBody.js:19`, `slice(0, 4000)`) — может разрезать
суррогатную пару и записать битый символ.

Плюс санитайзер задублирован: `backend/src/feedback/validateFeedbackBody.js:15-20` — вторая,
расходящаяся реализация (режет длину, возвращает `null`). Правка политики применится
к половине входов.

**Решение.** В общий хелпер: `.normalize('NFC')` и
`.replace(/[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\uFEFF]/g, '')`; feedback переводится
на него + отдельный `clampLen` по code points.

---

### Z3-19 · `escapeHtml` не экранирует апостроф
**Категория: ДОЛГ** · 15 мин · риск правки: нет

Обе копии (`backend/src/projects/pdfHtmlEscape.js:10-14` и
`frontend/src/utils/buildTechnicalPrintHtml.ts:38-42`) покрывают `& < > "`, но не `'`.
Сегодня безопасно: все атрибуты с интерполяцией — в двойных кавычках
(`buildEstimatePdfHtml.js:215`).

**Последствие.** Первая же строка вида `<td title='${v}'>` даст XSS одновременно в PDF
и на публичной странице — то есть защита, описанная в Z3-15, держится на соглашении
о стиле кавычек, а не на коде. Дописать `.replace(/'/g, '&#39;')` в обе функции.

---

### Z3-20 · Публичный PDF: новый Chromium на каждый запрос при лимите 120/15 мин
**Категория: ДОЛГ** · 2–3 ч · риск правки: средний

`puppeteer.launch()` вызывается внутри каждого рендера
(`backend/src/projects/renderPdfFromHtml.js:76`), семафор — 2
(`backend/src/projects/pdfRenderSemaphore.js:15`), таймаут 30 с. Лимитер на
неаутентифицированном `GET /api/v1/public/shares/:token/pdf`
(`backend/src/api/publicSharesRoutes.js:112-115`) — **120 запросов на 15 минут на IP**
(`rateLimiters.js:101`).

**Последствие.** Имея валидный (то есть публично разосланный) токен и несколько IP,
можно гарантированно исчерпать CPU и память контейнера. Смыкается с известной P2-9:
там два PDF не влезают в 512 МБ, здесь — способ вызвать это снаружи без авторизации.

**Решение.** Отдельный лимитер на `/pdf` — 5–10 на 15 минут. Это 15 минут работы и снимает
основную часть риска. Переиспользуемый инстанс браузера **не делать** — согласуется с
уже принятым решением аудита (постоянный пул держал бы память занятой всегда).

---

### Z3-21 · Данные обратной связи хранятся бессрочно, включая IP
**Категория: ДОЛГ** · 30 мин · риск правки: низкий

`email`, `name`, `clientIp` пишутся в коллекцию `feedback`
(`backend/src/api/feedbackRoutes.js:42-43`, схема `backend/src/models/Feedback.js:20,21,26`).
TTL-индекса нет — `:37-40` только сортировочные, процедуры удаления нет.
Часть известной P2-12; здесь — конкретный якорь и самая дешёвая её половина:
`feedbackSchema.index({createdAt: 1}, {expireAfterSeconds: 31536000})`, одна строка.

---

### Z3-22 · `users.email` не уникален
**Категория: ДОЛГ** · 30 мин · риск правки: средний (уникальный индекс упадёт при существующих дублях)

`backend/src/models/User.js:55` — `userSchema.index({email: 1})` без `unique`; уникальна только
пара `(authProvider, providerUserId)` (`:54`). Это усиливает известную P1-2: два аккаунта
разных провайдеров с одинаковым email легитимно сосуществуют в базе, а роль `admin`
выдаётся по совпадению строки email.

**Решение.** Если провайдер один — `unique: true` + разбор дублей. Если планируется второй —
задокументировать явно и **закрыть P1-2 по `sub`**, а не по email; тогда эта находка отпадает.

---

### Z3-23 · `survey` сохраняется в базу без санитизации строк
**Категория: ДОЛГ** · 1 ч · риск правки: низкий

`assertSurveyShape` проверяет только «это объект» и размер JSON
(`backend/src/projects/validateProjectSurveyShape.js:15-21`); поле — `Mixed`
(`backend/src/models/Project.js:24`). Имена комнат с угловыми скобками лежат в базе сырыми;
чистятся только при расчёте (`backend/src/api/validate.js:319`).

Сегодня безвредно — все стоки экранируют (Z3-15). Но это единственный разрыв в
эшелонированной защите на пути к PDF и публичной ссылке, и он ровно в том поле, которое
пользователь наполняет свободнее всего.

---

### Z3-24 · Присвоение по ключу из пользовательского JSON без фильтра `__proto__`
**Категория: КОСМЕТИКА** · 15 мин · риск правки: нет

`backend/src/projects/stripMongoExportFields.js:43,80` — `out[key] = value`, где `key` берётся
из `Object.entries` пользовательского импорта проекта. `out` создан как `{}`, поэтому ключ
`__proto__` уходит в setter и подменяет прототип **этого** объекта. Глобального загрязнения
`Object.prototype` нет (`{...rest}` на `:57` безопасен), эксплуатации сегодня нет.
`if (key === '__proto__' || key === 'constructor') continue;` — две строки, снимают класс.

---

## Инфраструктура сборки

### Z3-25 · Версия Node не зафиксирована нигде — разброс 20 / 22 / 26 / неизвестно
**Категория: БЛОКЕР-B** · 30 мин · риск правки: низкий

`.nvmrc` отсутствует во всех пакетах. `engines` есть только у фронтенда
(`frontend/package.json`, `>=22.22.0 <23`); у `backend`, `shared`, `e2e` и корня — нет.
Фактически:

| Где | Версия | Источник |
|---|---|---|
| CI | 22.22.0 | `.github/workflows/verify.yml:16` |
| Образ | **20** | `backend/Dockerfile:4` (`node:20-bookworm-slim`) |
| Машина автора | **26.7.0** | наблюдалось в трейсе |
| Прод (Render) | **неизвестно** | только Dashboard; `render.yaml` отсутствует (`docs/deploy/render.md:23`) |
| Vercel | **неизвестно** | только Dashboard; корневой `package.json` без `engines` |

**Последствие.** Версия Node в проде может смениться при любом ребилде без единого коммита.
Код проверяется на трёх разных наборах семантики (`fetch`, `structuredClone`, глобальный
`File`, поведение ESM-резолвера) и ни один из них не совпадает с продом гарантированно.

Усугубляет `@types/node`: `^25.6.0` в `backend` и `shared`, `^24.12.2` во фронтенде —
на 3–5 мажоров впереди любого реального рантайма. `tsc` разрешает API, которых в Node 20/22
нет: типы зелёные, рантайм падает. Дыра ровно в том гейте, который призван её ловить.

**Решение.** `.nvmrc` = `22.22.0` в корне; `engines` в `backend`, `shared`, корень;
`node:22.22.0-bookworm-slim` в `backend/Dockerfile:4`; свести `@types/node` к `^22`;
проверить и зафиксировать версию в панелях Render и Vercel.

---

### Z3-26 · `SIGTERM` не обрабатывается — каждый деплой рвёт запросы
**Категория: БЛОКЕР-B** · 1.5 ч · риск правки: средний

`grep -rn "SIGTERM|SIGINT|gracefulShutdown" backend/src backend/scripts` → в продуктовом коде
пусто (единственное совпадение — тестовый харнесс `backend/scripts/verifyAdminFeedback.mjs:191`).
Единственный `process.on` — `unhandledRejection` (`backend/src/index.js:33`).
Сервер создан на `backend/src/index.js:257`, `server.close()` не вызывается нигде.

**Последствие.** Render шлёт `SIGTERM` при каждом деплое и рестарте. Процесс без обработчика
убивается немедленно — рвутся все запросы в полёте. Здесь это дороже обычного: PDF-рендер
держит соединение до 30 с (`backend/Dockerfile:17`), очередь ждёт слот
(`backend/src/projects/pdfRenderSemaphore.js`), плюс SSE админки и долгие расчёты.

В контейнере хуже: `CMD ["node", "src/index.js"]` (`backend/Dockerfile:30`) делает Node PID 1,
а у PID 1 нет обработчиков сигналов по умолчанию — `SIGTERM` **игнорируется**, контейнер
висит до `SIGKILL` по таймауту.

**Решение.** ~20 строк в `backend/src/index.js`: `process.on('SIGTERM')` → `server.close()`
+ закрытие соединения Mongo + `setTimeout(…).unref()` на принудительный выход.

---

### Z3-27 · Лимит памяти не задан ни в одном слое
**Категория: БЛОКЕР-B** · 30 мин · риск правки: низкий

`grep -rn "max-old-space|NODE_OPTIONS"` по репозиторию → ноль. `backend/docker-compose.pdf.yml`
(16 строк целиком) не содержит ни `mem_limit`, ни `deploy.resources`. Дефолт параллелизма
PDF — 2, продублирован в трёх местах: `backend/src/projects/pdfRenderSemaphore.js:15`,
`backend/Dockerfile:18`, `backend/docker-compose.pdf.yml:15`.

**Последствие.** Известная P2-9 («два PDF не влезают в 512 МБ») имеет здесь свои три якоря.
Дополнительно: Node без `--max-old-space-size` и без видимого cgroup-лимита размеряет
old space от **хостовой** RAM, а не от квоты сервиса — вместо давления на GC получается
внешний OOM-kill процесса целиком.

**Решение.** `PDF_MAX_CONCURRENT=1` (это и есть решение P2-9, но менять надо в трёх местах,
иначе локальный прогон разойдётся с продом) + `NODE_OPTIONS=--max-old-space-size=320` в
переменных Render + `mem_limit: 512m` в compose, чтобы локальный прогон воспроизводил прод,
а не проходил молча на 32 ГБ ноутбука.

---

### Z3-28 · Chromium не запиннен: смена базового образа гарантированно ломает PDF
**Категория: ДОЛГ** · 1 ч · риск правки: низкий

`backend/Dockerfile:6-12` — `apt-get install` без версий, база — плавающий тег
`node:20-bookworm-slim` (`:4`), не digest. Подтверждено линтером:
```
$ docker run --rm -i hadolint/hadolint:latest hadolint --no-color - < backend/Dockerfile
-:6 DL3008 warning: Pin versions in apt get install.
```
(единственное замечание hadolint на весь файл)

Три источника дрейфа в одной строке: (а) пакет `chromium` есть только в репозиториях Debian —
переезд на `-alpine` или `trixie` меняет либо наличие пакета, либо мажор браузера, и
`PDF_BROWSER_EXECUTABLE=/usr/bin/chromium` (`:16`) начинает давать 503 `PDF_BROWSER_MISSING`
(`backend/src/projects/renderPdfFromHtml.js:24-30`) — **в рантайме, а не на сборке**;
(б) версия Chromium из репозитория меняется между билдами — вёрстка PDF плывёт без изменения
кода; (в) шрифты тоже неверсионированы, а PDF рендерится с кириллицей.

**Решение.** Минимально окупающееся: строка `RUN /usr/bin/chromium --version` в Dockerfile —
падение на сборке вместо 503 в проде. Digest-пин базы — по желанию.

---

### Z3-29 · Контейнер работает под root, Chromium запускается без песочницы
**Категория: ДОЛГ** · 45 мин · риск правки: средний

В `backend/Dockerfile` (30 строк, прочитан целиком) нет ни `USER`, ни `HEALTHCHECK`.
При этом Chromium стартует с `--no-sandbox --disable-setuid-sandbox`
(`backend/src/projects/renderPdfFromHtml.js:80-81`) — эти флаги нужны **именно потому**,
что процесс root, и они же снимают песочницу с процесса, который парсит HTML, собранный
из пользовательских данных проекта.

**Оговорка, снижающая приоритет.** Прод по документации — Render native runtime, а не этот
образ (`docs/deploy/render.md:14-17`); Dockerfile помечен как справочный
(`docs/project-pdf.md:35`). То есть находка боевая только если образ пойдёт в прод.

**Решение.** `useradd` + `USER` перед `CMD`; после этого `--no-sandbox` можно убрать.
`HEALTHCHECK` на `/health` — эндпоинт уже есть (`backend/src/api/routes.js:34`).

---

### Z3-30 · CI гоняет 1 корневой гейт из 8; один из восьми неисполним конструктивно
**Категория: ДОЛГ** · 45 мин · риск правки: низкий · *фиксация известного, не переоткрытие*

Корневой `verify` (`package.json:27`) — цепочка из 8 гейтов. В `.github/workflows/verify.yml`
запускается **ровно один**: `node scripts/verifyNoTypeBypass.mjs` (`:36-37`). Никогда
не запускаются `verify:auth-docs`, `verify:deploy-docs`, `verify:backend-docs`,
`verify:language-policy` (`package.json:17-20`).

Прогнаны по отдельности:
```
npm run verify:type-bypass      → verifyNoTypeBypass: OK
npm run verify:auth-docs        → verify:auth-docs OK
npm run verify:deploy-docs      → verify:deploy-docs OK
npm run verify:language-policy  → verifyLanguagePolicy: OK
npm run verify:backend-docs     → Error: ENOENT: no such file or directory, open '.../.cursorrules'
                                    at readRepo (scripts/verifyBackendDocs.mjs:60:10)
                                    at scripts/verifyBackendDocs.mjs:195:21
```
Механика: `scripts/verifyBackendDocs.mjs:195` читает `.cursorrules`, а `.cursorrules` — **в
`.gitignore:9`**. Файла нет ни локально, ни в клоне, ни в CI. Гейт неисполним конструктивно,
а не «временно сломан».

**Последствие.** CI зелёный, корневой `verify` красный. Три работающих doc-гейта не защищают
ничего, потому что в PR не выполняются. При этом Z3-25 показывает, что расхождения в
документации по версиям Node уже есть.

**Решение.** Заменить `verifyBackendDocs.mjs:195-204` на guard по `existsSync` со SKIP,
затем добавить один шаг в воркфлоу с четырьмя doc-гейтами — зависимостей у них нет,
`npm ci` в корне не нужен.

---

### Z3-31 · Цепочка `vercel-build` не исполняется в CI ни разу
**Категория: ДОЛГ** · 15 мин · риск правки: нет

CI доходит до фронтового `npm run verify` (`.github/workflows/verify.yml:55`), внутри
которого есть `build`. Но `scripts/vercelPrepareOutput.mjs` — второе звено
`"vercel-build": "npm run build --prefix frontend && node scripts/vercelPrepareOutput.mjs"`
(`package.json:26`) — не вызывается никогда.

Поломка копирования `frontend/dist` → `build/` или рассинхрон с `"outputDirectory": "build"`
(`vercel.json:5`) обнаруживается упавшим деплоем. Цена обнаружения — цикл деплоя вместо 10 с
в CI. Плюс дубль: `frontend/package.json` объявляет `postbuild`, копирующий тот же `dist`
в `frontend/build` — мёртвый артефакт, полная копия бандла пишется дважды за сборку.

---

### Z3-32 · `e2e/package-lock.json` в `.gitignore` — новый набор персон невоспроизводим
**Категория: ДОЛГ** · 15 мин · риск правки: нет

`.gitignore:40` игнорирует `e2e/package-lock.json`; из пяти пакетов закоммичено 4 lock-файла.
`e2e/package.json` объявляет `"@playwright/test": "^1.56.0"`, локальный незакоммиченный lock
разрешён в **1.62.1**. Корневой `e2e:install` (`package.json:30`) делает `npm --prefix e2e
install`, не `ci`.

**Последствие.** Свежий клон получит другую версию Playwright и другой Chromium.
Оракул персон (коммит `8f6a35d`) сравнивает **на уровне сети** — расхождение версии браузера
даст нестабильные диффы, которые прочитаются как регрессии продукта. Это ровно тот сценарий,
ради которого набор и написан, — и он единственный в репозитории, чья воспроизводимость
не закреплена.

Смежно (**КОСМЕТИКА**, 15 мин): кэш браузера Puppeteer в CI не кэшируется — `cache: npm`
(`.github/workflows/verify.yml:17`) покрывает только `~/.npm`, а `npm ci` в backend
(`:29-30`) на каждом прогоне выкачивает bundled Chrome в `~/.cache/puppeteer`
(~150–180 МБ, 40–90 с на каждый push).

---

### Z3-33 · Гигиена воркфлоу: нет `permissions`, `timeout-minutes`, `concurrency`
**Категория: КОСМЕТИКА** · 30 мин · риск правки: нет

`.github/workflows/verify.yml` — блок `permissions:` отсутствует целиком (`GITHUB_TOKEN`
получает дефолт репозитория), `timeout-minutes` не задан ни на job, ни на шаг,
`concurrency` не задан, actions по плавающим тегам (`:12` `checkout@v4`, `:14` `setup-node@v4`).

Из перечисленного окупается ровно два пункта: `timeout-minutes: 20` (зависший `verify`
с ~55 backend-скриптами жжёт дефолтные 6 часов раннера) и `concurrency` с
`cancel-in-progress` (серия push подряд гоняет N полных прогонов с загрузкой Chrome).
`permissions: contents: read` — одна строка, берётся заодно.

**Не делать.** Пиннинг actions по SHA — профит наименьший: секретов в job нет, запись
не нужна. Dependabot — согласуется с уже принятым решением аудита не заводить
автообновление ботом.

---

### Z3-34 · `backend/.dockerignore` — мёртвый файл
**Категория: КОСМЕТИКА** · 10 мин · риск правки: нет

Контекст сборки — корень монорепо (`backend/Dockerfile:2`, `backend/docker-compose.pdf.yml:6`
→ `context: ..`). Docker читает `.dockerignore` только из корня контекста, то есть работает
`/.dockerignore`; `backend/.dockerignore` (6 строк) не применяется никогда.

Опасно ложным чувством защиты: строка `.env` в `backend/.dockerignore:3` не делает ничего,
секрет спасает корневой `.dockerignore:10-11`. Правка «не того» файла приведёт к утечке.

---

## Справочники `backend/data/`

Общая картина: **числа действительно вынесены из кода, и это главный актив зоны.**
`backend/src/dhw/validateWaterNorms.js` (253 строки) и `validateAppliances.js` (559 строк) —
не `JSON.parse` и надежда, а плотная ручная схема с говорящими путями ошибок
(`water_norms.storage.typicalTankSizes[3]: ожидается целое > 0`). Zod/ajv не нужен.
Всё найденное ниже — края этой схемы, а не отсутствие фундамента.

Важное разделение: **файловый путь защищён, Mongo-путь не защищён ничем.**
`backend/scripts/fixtures/calcRuntimeContextFromFiles.js:42-52` прогоняет все четыре файла
через настоящие валидаторы, и это входит в `npm run verify` → CI. То есть битый JSON
**в файле** до прода не доедет. Все находки ниже реализуемы через Mongo: частичный upsert,
ручная правка в редакторе, недокатившаяся миграция.

---

### Z3-35 · `/health` не проверяет, загрузились ли справочники
**Категория: БЛОКЕР-A** · 1.5 ч · риск правки: нет · *подтверждение намёка из P1-7 с якорями*

**Проблема.** Три звена, каждое по отдельности разумное:
1. `backend/src/api/routes.js:33` — `/health` статичен: `res.status(200).json({ok: true, status: 'up'})`.
   Состояние bundle не проверяется.
2. `backend/src/index.js:127-129` — блокирующий прогрев включается только явным
   `REFERENCE_WARMUP_BLOCK_STARTUP=true`; в `backend/.env.example:88` строка **закомментирована**,
   то есть дефолт — не блокировать.
3. `backend/src/index.js:158-163` — при неблокирующем режиме ошибка прогрева логируется
   и глотается, `app.listen` (`:257`) выполняется безусловно.

**Последствие.** Битый или отсутствующий справочник в Mongo → живой контейнер, зелёный
монитор, **100 % отказов на `POST /api/v1/calc`** (`backend/src/reference/configCache.js:144-152`
бросает при `cachedBundle === null`, и так на каждом запросе). Оркестратор не перезапустит
и не откатит деплой. Внешний аптайм-монитор из P1-7, поставленный на этот эндпоинт, тоже
не заметит — он опрашивает ровно ту заглушку.

**Уточнение к P1-7:** справочник при этом не «пустой», а вовсе отсутствующий, и расчёты
падают громко (500). Тихий вариант — Z3-36.

**Решение.** Дешевле всего — `REFERENCE_WARMUP_BLOCK_STARTUP=true` в переменных прода:
механика уже написана (`index.js:154-159`, `process.exit(1)` при неудаче). Правильнее —
readiness-эндпоинт, отвечающий 503 при `cachedBundle === null`: переживает и падение
TTL-обновления, а не только старт. 20 минут против 1.5 часа; брать второе, потому что
именно TTL-обновление и есть вероятный сценарий.

**НЕ ПРОВЕРЕНО:** выставлен ли `REFERENCE_WARMUP_BLOCK_STARTUP=true` в реальном проде —
деплой-манифеста в репозитории нет.

---

### Z3-36 · Пустая карта расходов приборов проходит валидацию — мощность ГВС молча становится нулём
**Категория: ДОЛГ** (высокий приоритет) · 30 мин · риск правки: нет

**Проблема.** `backend/src/dhw/validateWaterNorms.js:65-74` перебирает
`Object.entries(fixtureHotFlowLps)` и **не требует ни одного ключа**. Обратная сверка
`hotThermalFixtureKeys` с этой картой отсутствует — хотя симметричная проверка для
исключённых ключей рядом есть (`:94-100`). Потребитель промах гасит:
`norms.fixtureHotFlowLps[key] ?? 0` и `if (unitFlow <= 0) continue`
(`backend/src/logic/hotWater.js:94-95`).

Проверено прогоном валидатора: `fixtureHotFlowLps: {}` при восьми ключах в
`hotThermalFixtureKeys` — **валидно**; `hotThermalFixtureKeys: ["nonexistent_fixture"]` —
тоже валидно.

**Последствие.** Вот это и есть настоящий «сервис работает с пустым справочником»: health
зелёный, прогрев успешен, расчёт идёт — но пиковый расход ГВС = 0, мощность ГВС = 0
(`backend/src/dhw/waterCalc.js:16`), котёл подобран **только под отопление**. Отказ без
единого симптома, в отличие от Z3-35. Смета уходит клиенту, и никто — ни код, ни монтажник —
не знает, что она неполна. Прямое пополнение класса P1-4.

**Решение.** Требовать непустоту `fixtureHotFlowLps` и наличие в ней каждого ключа из
`hotThermalFixtureKeys`. Шесть строк, симметрично уже написанной проверке `:94-100`.

---

### Z3-37 · Пол мощности ГВС 24 кВт без источника завышает котёл в полтора раза на малых объектах
**Категория: БЛОКЕР-B** · 0.5 ч на решение + 1 ч на регресс · риск правки: **средний**

**Проблема.** `backend/src/logic/hotWater.js:183-185` — `hotWaterPowerKw =
Math.max(dhwMinKw, storageIndirectHeatPowerKw)`, где `dhwMinKw` берётся из
`backend/data/water_norms.json:70` (`"boilerDhwPowerMinKw": 24`). Для схемы «один котёл + БКН»
требуемая мощность складывается: `heat + hw` (`backend/src/utils/boilerMatchingByType.js:37`).

Арифметика: 2 жильца без ванны → бак 100 л, ΔT 55 K, 30 мин → физически **12.8 кВт**,
в отчёт идёт **24**. Дом с теплопотерями 8 кВт получает `requiredKw` 32 кВт вместо 20.8.

**Последствие.** На малых объектах котёл в коммерческом предложении завышается примерно
в полтора раза. Дальше это же число течёт в гидравлику
(`backend/src/hydraulics/resolveCirculationFlows.js:95`, `buildGraph.js:275`) — раздуваются
диаметры и насос. Продукт при этом в другом месте прямо предупреждает о вреде избыточной
мощности.

Источника у числа нет. Более того, `components/schemas/WaterNormsStorage.yaml:40`
документирует его как «MVP — 24», то есть заглушка признана заглушкой и уехала в прод.

**Решение — не переписывать формулу, а принять решение по числу.** Либо обосновать
(ссылка на норму или на практику монтажников), либо снизить/убрать пол, оставив физику плюс
запас. Что бы ни выбрали, **прогнать на регресс-наборе персон** — правка двигает подбор
котла на всех сценариях с накопительным баком.

**Почему БЛОКЕР-B, а не ДОЛГ.** Брать деньги за смету, которая систематически завышает
главную позицию, — это не технический долг, а претензия покупателя. При этом решение
может быть «оставить как есть, обосновав» — блокирует именно необоснованность, а не значение.

---

### Z3-38 · Дубль вида оборудования в Mongo — побеждает последний, порядок недетерминирован
**Категория: ДОЛГ** · 30 мин · риск правки: нет

`backend/src/dhw/validateAppliances.js:503-535` пишет `byKind.boiler = rec` **без проверки
занятости**. Порядок задаёт `Appliance.find({isActive: true})` без `.sort()`
(`backend/src/dhw/loadAppliances.js:34`) — natural order Mongo, то есть обновлённый документ
может переехать в конец коллекции.

Проверено прогоном: два документа `applianceKind: "boiler"` → побеждает второй, без ошибки
и без предупреждения.

**Последствие.** Типовой сценарий «залил новую версию правил котла, старую забыл отключить»
даёт **недетерминированный подбор: расчёт меняется между рестартами сервиса**. Воспроизвести
жалобу клиента невозможно в принципе.

Контраст: два соседних справочника этот класс ловят —
`backend/src/recommendations/validateRecommendations.js:30-32` бросает на дубле `code`,
`backend/src/ufh/validateUnderfloorHeatingPresets.js:138-140` — на дубле `presetId`.
Здесь просто забыли.

**Решение.** Три строки по образцу соседей. Файловый путь чист, `seedReferenceData.js:51`
делает `deleteMany` первым.

---

### Z3-39 · Ряд типовых объёмов баков обязан быть отсортирован — валидатор этого не проверяет
**Категория: ДОЛГ** · 30 мин · риск правки: нет

Оба потребителя опираются на порядок массива: `sizes.find(t => t >= need) ?? sizes[sizes.length - 1]`
(`backend/src/utils/apartmentMatching.js:105,109` и `backend/src/logic/hotWater.js:156,161`) —
первый подходящий по порядку, последний как «максимум». Валидатор проверяет только
«целое > 0» поэлементно (`backend/src/dhw/validateWaterNorms.js:119-125`).

Проверено: `[300, 30, 30]` принимается без единой жалобы.

**Последствие.** Одна перестановка при ручной правке (добавили 400 л в начало, отсортировали
по алфавиту в редакторе Mongo) — и потребность 40 л снапится к **300 л**. Бак с завышением
на порядок уходит прямо в смету и в закупку.

**Решение.** Проверка монотонности и уникальности — пять строк рядом с существующим циклом.

---

### Z3-40 · Валидатор подставляет магические числа при неполном документе — вопреки собственной документации
**Категория: ДОЛГ** · 1 ч · риск правки: средний (обязательность полей сломает старые
документы в Mongo, если они есть — сначала посмотреть прод-коллекцию)

**Проблема.** Проверено прогоном: документ `hydraulics` без `mainTransitMinInternalDiameterMm`,
`branchMinInternalDiameterMm` и `radiatorBranchGrouping` проходит валидацию и получает
`{main: 20, branch: 12, grp: {0.019, 150, 2, 1.5}}` — из хардкодов
`backend/src/dhw/validateAppliances.js:342,346,366-372`. `velocityLimitsMps.branchMin`
при отсутствии → `0` (`:363`).

При этом `components/schemas/ReferenceDataSources.yaml:9-10` утверждает буквально:
«Числовые нормы только в seed/Mongo; `validateWaterNorms.js` и `validateAppliances.js`
**без fallback `??` в коде**». Утверждение ложно.

**Последствие.** Урезанный документ не отклоняется — расчёт идёт по невидимым числам из кода.
Расследование расхождения «что в базе» против «что посчитали» будет долгим именно потому,
что документация уверяет: таких чисел не существует. Ложная документация здесь дороже
самих дефолтов.

**Решение.** Либо сделать поля обязательными (шесть строк), либо, если дефолты нужны для
совместимости со старыми документами, — логировать факт подстановки
(`logger.warn('appliances.default_applied', …)`) **и поправить `ReferenceDataSources.yaml`**.
Второе обязательно в любом случае.

---

### Z3-41 · Нет перекрёстных проверок «min ≤ max»
**Категория: ДОЛГ** · 1 ч · риск правки: нет

Проверено прогоном, всё принимается: `velocityLimitsMps.mainMin=5` при `mainMax=0.1`;
`ufhLoopVelocityMinMps=9` при `Max=0.1`; `bufferTankLitersMin=500` при `Max=50`;
`coilWeakerThanBoilerToleranceKw=1e9`. Валидатор проверяет каждое поле по отдельности
(`backend/src/dhw/validateAppliances.js:349-364,415-416,131-141,54-58`).

Прецедент правильной проверки — в том же файле: `panelLengthRangeMm.max >= min`
(`:203-207`), и в `validateWaterNorms.js:129-131,136-138`.

**Последствие.** Перевёрнутая пара скоростей делает недопустимым любой диаметр трубы —
каталог не подбирает ничего либо сыплет предупреждение на каждый участок. Диагностируется
по симптому, а не по сообщению валидатора: часы вместо секунд.

**Решение.** Четыре парные проверки по образцу `:203-207`.

---

### Z3-42 · Ключи справочника, сцепленные с типами помещений, не проверяются на принадлежность канону
**Категория: ДОЛГ** · 1 ч · риск правки: нет

`backend/data/appliances.json:26` — `"boilerRoomType": "котельная"` — сравнивается строгим
равенством с `rooms[].type` (`backend/src/utils/boilerMountingConstraints.js:51`),
а валидируется только как непустая строка (`backend/src/dhw/validateAppliances.js:87`).
То же для `microLoad.entryRoomTypes: ["прихожая","коридор","тамбур"]`
(`appliances.json:73`, потребитель
`backend/src/matching/internal/resolveMicroLoadRadiatorStrategy.js:37`,
валидация `validateAppliances.js:216-223`).

Канон живёт в `shared/roomTypeNormalization.js:7-18`, причём «котельня», «топочная»,
«boiler_room» — валидные **синонимы на входе**, но не канонические значения (`:39-41`).

**Последствие.** Правка «котельная» → «котельня» в Mongo выглядит безобидной украинизацией,
а на деле **навсегда выключает проверку объёма и высоты котельной** (7.5 м³ / 2.2 м):
газовый котёл проходит подбор в помещении, не соответствующем нормам, без единого
предупреждения. Отказ втихую в вопросе, где норма существует ради пожарной безопасности.
Родственник P1-9 по классу цены ошибки.

**Решение.** `requireEnum(..., CANONICAL_ROOM_TYPES, ...)` для обоих полей — прецедент импорта
`shared/` в валидатор уже есть (`backend/src/ufh/validateUnderfloorHeatingPresets.js:5`).

---

### Z3-43 · Порог паразитного потока продублирован константой в коде
**Категория: ДОЛГ** · 1 ч · риск правки: нет

`backend/data/appliances.json:130` задаёт `ufhParasiticDownTriggerWm2: 5`, его читает
гидравлика (`backend/src/logic/ufhLoopHydraulics.js:80`). Но пользовательское предупреждение
срабатывает по хардкоду `const PARASITIC_DOWN_WARN_WM2 = 5`
(`backend/src/matching/warmFloor.js:18`) — с комментарием, прямо признающим дублирование.

**Последствие.** Правка справочника меняет расчётную логику, но не текст предупреждения.
Клиент получает предупреждение там, где расчёт его уже не считает проблемой, — или молчание
при реальном перегреве вниз. Ровно тот класс расхождений, ради устранения которого справочник
и выносили из кода.

**Решение.** Прокинуть `hydraulicsRules.ufhParasiticDownTriggerWm2` в
`applyUnderfloorHeatingRecommendations` — у вызывающего доступ к `byKind.hydraulics` уже есть.

*Того же класса, мельче:* `Δt = 10 K` живёт в четырёх местах
(`backend/src/ufh/validateUnderfloorHeatingPresets.js:7`, `appliances.json:93`,
`appliances.json:125`, `backend/src/hydraulics/resolveCirculationFlows.js:41`).

---

### Z3-44 · Частично залитые рекомендации проходят валидацию — клиент видит служебные коды
**Категория: ДОЛГ** · 2 ч + 1 ч · риск правки: нет

Обязательными объявлены **3 кода из 38**
(`backend/src/recommendations/validateRecommendations.js:98-107`). Коллекция с этими тремя
валидна. Ненайденный код не бросает, а пишет в пользовательские предупреждения литерал:
``warnings.push(`[${code}] Текст рекомендації не знайдено в довіднику.`)``
(`backend/src/recommendations/recommendationResolver.js:69`).

Сценарий достижим: `backend/scripts/seedReferenceData.js:58-65` делает `deleteMany` +
`insertMany` **без транзакции**, а живой сервер обновляет кэш по TTL
(`backend/src/reference/configCache.js:181-184`) — окно между удалением и вставкой реально.

**Последствие.** В платном отчёте и в PDF вместо предупреждения появляется
`[WARN_UFH_COVERAGE_LOW] Текст рекомендації не знайдено в довіднику.` Технически расчёт
верен, репутационно — брак, причём именно в документе, который показывают клиенту.

**Решение.** Расширить `required` до полного списка, генерируя его verify-скриптом (список
де-факто уже существует: коды в JSON и в коде совпадают 38/38). Отдельно — в
`seedReferenceData` сначала вставлять, потом удалять старое.

---

### Z3-45 · Два справочника описывают один и тот же бак разными числами
**Категория: ДОЛГ** · 2 ч · риск правки: средний (меняет и текст, и смету по квартирной схеме)

Текст рекомендации `REC_APT_COMBI_SERIAL_BUFFER` говорит «невеликий електричний бойлер
(30–50 л)» — подстановка из `backend/data/appliances.json:41-43`. Когда пользователь применяет
ту же схему, объём считается по `water_norms.combiBufferElectricStorage` = 25 л/чел, минимум 30
(`backend/data/water_norms.json:57-60` → `backend/src/utils/apartmentMatching.js:141-145` →
`backend/src/report/buildReport.js:374-383`). Для 3 жильцов: 75 л → снап к **80**; для 4 — **100**.

**Последствие.** Пользователь читает «поставьте 30–50 л», нажимает «Застосувати схему»
и получает в смете 80–100 л. Ни один валидатор их не сверяет — и не может: файлы
валидируются независимо.

**Решение.** Выбрать один источник. Дешевле — считать `bufferTankLitersMin/Max` границами
клампа для формулы из `water_norms`, а не независимым диапазоном, и подставлять в текст
фактический объём.

---

### Z3-46 · Ни одного нормативного числа с указанием источника
**Категория: ДОЛГ** · 3 ч · риск правки: нет

Во всех четырёх файлах нет ни одного поля вида `source`/`normRef`/`basis`
(grep `ДБН|ДСТУ|СНиП|DBN|DSTU|ГОСТ|source` → ноль совпадений). При этом числа явно
нормативные:

| Значение | Якорь | Что это |
|---|---|---|
| `maxSurfaceTemperatureC: 29` | `underfloor_heating_presets.json:11,28` | предел температуры пола зоны постоянного пребывания |
| `minBoilerRoomVolumeM3: 7.5`, `minBoilerRoomHeightM: 2.2`, `maxApartmentNominalKw: 30` | `appliances.json:26-28` | требования к помещению для газового котла |
| `hotWaterC: {min: 55, max: 60}` | `water_norms.json:48-52` | антилегионеллёзный минимум |
| `coldWaterDesignC: {winter: 5, summer: 15}` | `water_norms.json:44-47` | расчётная температура холодной воды |

Отдельно подозрительны непрозрачные подгонки: `boilerBelowMinSourceToleranceKw: 0.49` рядом
с `coilWeakerThanBoilerToleranceKw: 0.5` (`appliances.json:10-11`) — 0.49 выглядит как значение,
подобранное под конкретный тест; `heatTimeParasiticHintMinutes: 95` (`:9`) без пары и без
пояснения. Консервативные `mainMax: 0.8`, `branchMax: 0.5` м/с (`:107-108`) напрямую
увеличивают диаметры и стоимость труб в смете — тоже без обоснования.

**Последствие.** Через полгода автор не отличит «число из ДБН, менять нельзя» от «прикинул
на глаз». Для платного инженерного сервиса это ещё и вопрос защиты расчёта перед клиентом.

**Решение — не менять числа, а подписать их.** Строковое `note`/`source` рядом с каждым
нормативным полем. Инфраструктура готова: `strict: false` в mongoose-схеме
(`backend/src/models/WaterNorms.js:22`) лишние поля пропустит, валидаторы игнорируют
неизвестные ключи. Начать с десятка полей из таблицы.

---

### Z3-47 · Даты актуальности нет ни в одном файле, а в отчёт подставляется правдоподобная подделка
**Категория: ДОЛГ** · 3 ч · риск правки: нет · *распространение P2-14 и P2-7 на эти файлы*

Ни в одном из четырёх файлов нет `updatedAt`/`validUntil`/`effectiveFrom` (grep → ноль).
Есть только `schemaVersion` — версия **формата**, не данных — и `label: "MVP default"`
(`water_norms.json:2-4`).

Mongo проставляет `updatedAt` (`backend/src/models/WaterNorms.js:22`, `{timestamps: true}`),
но загрузчик **выбрасывает его до валидации**:
`const { _id, __v, createdAt, updatedAt, ...rest } = doc`
(`backend/src/reference/loadReferenceCollection.js:20`).

Дальше актуальность данных подменяется временем загрузки кэша: `referenceBundleLoadedAt`
(`backend/src/report/buildReport.js:744-746`) — это `Date.now()` момента чтения
(`backend/src/reference/configCache.js:79`). Он **свежий всегда**, даже для норм двухлетней
давности.

**Последствие.** В отчёте стоит правдоподобный свежий ISO-таймстамп, не значащий ничего
о возрасте норм. Это хуже отсутствия поля: создаёт ложную уверенность у того, кто будет
защищать смету перед клиентом.

**Решение.** `dataUpdatedAt` в каждый файл, проброс в bundle и в `meta` рядом с уже
существующими `waterNormsSchemaVersion`/`ufhPresetsSchemaVersion`
(`buildReport.js:741,749-751`). Маршрут до фронта уже проложен для версии
(`frontend/src/components/HotWaterReport/HotWaterReportView.tsx:80-83`) — достаточно
повторить его для даты. Плюс перестать выбрасывать mongo-`updatedAt` в `stripMongoDocMeta`.

*Смежно:* у `recommendations` версия вообще не доходит до `meta` — в отчёт идёт только
`recommendationsSource` (`buildReport.js:747`), хотя `schemaVersion` есть у каждого
из 38 документов. У трёх остальных справочников версия в `meta` есть.

---

### Z3-48 · Мелочи справочников
**Категория: КОСМЕТИКА** · 1.5 ч суммарно · риск правки: нет

- **Обязательный документ-пустышка.** `{"applianceKind": "electric_storage", "matching": {}}`
  (`backend/data/appliances.json:55-61`) требуется валидатором
  (`backend/src/dhw/validateAppliances.js:541`), потребителей `byKind.electric_storage`
  в коде нет ни одного. Лишний шаг в любом сценарии восстановления справочника
  и ложный сигнал «здесь есть правила».
- **Идентификатор контура ТП зашит литералом.** В режиме `ufh_only` контур перезаписывается
  из режимного пресета, но `id` подставляется константой `'ufh_dt10_40_30'`
  (`backend/src/logic/warmFloorCalc.js:110`), тогда как `supplyC/returnC` берутся из
  справочника (`:111-113` ← `underfloor_heating_presets.json:10`). Правка
  `maxSupplyTemperatureC` на 38 даст контур 38/28, подписанный в отчёте как «40/30».
  Расчёт верен, подпись врёт.

---

## Проверено и чисто

**Контракт и схемы**
- `openapi.yaml` формально валиден (`redocly lint` → 0 ошибок, 13 предупреждений одного класса).
- Ни одной висячей ссылки: все 35 `#/components/schemas/X`, используемых в `paths`, объявлены
  в карте компонентов; ни одной битой относительной `$ref` при обходе 111 достижимых файлов.
- `operationId` уникальны — 29 штук, дублей нет.
- `ErrorEnvelope` соблюдается **точно**: проверены 6 реальных ошибок разных источников
  (валидация AJV с `details`, 404 роутера, три 503 из разных модулей, 400 обратной связи) —
  все проходят схему, включая необязательный `details` (`ErrorEnvelope.yaml:12-20`).
- `MeUser.yaml` полон, включая `devMode` (`:28`) — синтетический dev-профиль объявлен честно.
- Диалект входного контракта согласован: бандл `CalcInput.yaml` (9 файлов) не содержит ни одной
  булевой формы `exclusive*` и ни одного `nullable`, то есть AJV draft-07 читает его корректно.
- Публичный DTO расшаривания собирается whitelist'ом дважды
  (`buildShareSnapshot.js:72-91` → `serializeShare.js:57-74`); схема `PublicSharePayload.yaml`
  соответствует реальности по всем 9 объявленным полям, `ownerId`/`survey`/`calcInput` наружу
  не уходят.
- SSE-поток админки объявлен как `text/event-stream` (`openapi.yaml:1203-1206`) и таким
  и является (`adminFeedbackRoutes.js:142-148`) — редкий случай, когда нестандартный ответ
  задокументирован правильно.
- Схемы `PresetsUnderfloorHeating*`, `PresetsFlooringFinishes`, `CatalogGetResponse`,
  `HealthOkResponse` совпали с живым ответом до последнего поля, включая
  `additionalProperties: false`.

**Безопасность**
- NoSQL-инъекция в обратной связи закрыта: `typeof value !== 'string' → null` для каждого поля
  (`validateFeedbackBody.js:16`), `{"message":{"$ne":null}}` → 400. Документ собирается
  whitelist'ом (`:56-64`) — лишние поля не «стрипаются», а просто не копируются.
- Токен публичной ссылки — `randomBytes(24).toString('base64url')`, 192 бита
  (`backend/src/projects/shareToken.js:8,16`); нормализация whitelist'ом `^[A-Za-z0-9_-]+$`
  (`:28-29`); в логи пишется только 6-символьный префикс. `Math.random` в backend отсутствует
  полностью.
- Метасимволы экранируются перед `$regex` в поиске по проектам (`projectsRoutes.js:157`).
- `ObjectId`-параметры проверяются с round-trip (`backend/src/projects/parseObjectId.js:13-15`) —
  объект в `:id` не пролезает.
- Обработчик ошибок: 500 маскируется, `err.message`/stack только в лог
  (`backend/src/index.js:215-221,230-237`); `entity.too.large` и ошибки разбора JSON
  перехвачены (`:193-209`).
- CORS: список origin из окружения, wildcard невозможен (`index.js:58-67`), `credentials: true`
  только с явным списком. Лимит тела `1mb` (`:121`). Порядок middleware корректный.
- Админские маршруты закрыты `requireAuth` + `requireRole('admin')` на всём префиксе,
  включая SSE (`backend/src/api/adminRoutes.js:57-58`).
- Прочитаны все 20 моделей. Индексы осмысленны и покрывают реальные запросы
  (`Project.js:47-49`, `Feedback.js:37-40`, `Calculation.js:48`, `productSchemas.js:32`
  уникальный `kind+catalogKey`, `Recommendation.js` уникальный `code`). `strict: false`
  стоит только там, где контракт держит `validateCatalog.js`, и это задокументировано
  (`productSchemas.js:8-10,30`).
- В `backend/src/utils/` нет ни `eval`, ни `JSON.parse` без `try`, ни динамического доступа
  по пользовательскому ключу, ни регулярок с катастрофическим бэктрекингом на пользовательском
  вводе (регулярка email `validateFeedbackBody.js:5` — без вложенных квантификаторов,
  вход ограничен 200 символами).

**Инфраструктура**
- `npm ci` везде, где важно: CI (`verify.yml:26,30,34`), образ (`Dockerfile:23`),
  Vercel (`vercel.json:3`), Render (`docs/deploy/render.md:15`). Единственное исключение —
  e2e (Z3-32).
- Слоистость Dockerfile правильная: `COPY package.json + lock` (`:22`) → `npm ci` (`:23`) →
  только потом `COPY backend/ .` (`:25`). Типового антипаттерна `COPY . .` перед install нет.
  `ENV PUPPETEER_SKIP_DOWNLOAD=true` стоит на `:15`, до `npm ci` — порядок верный.
- Корневой `.dockerignore` закрывает `.git`, `**/node_modules`, `**/.env`, `**/.env.*`,
  `.vercel`, `frontend/`, `docs/`. Секретов в конфигах нет: пять `ENV` в Dockerfile
  (`:14-18`) неспорны, `vercel.json` (11 строк) чист, compose подтягивает секреты через
  `env_file` в рантайме, не в слой образа.
- В `verify.yml` (57 строк, прочитан целиком) нет `continue-on-error`, `|| true`,
  `if: always()`, `set +e` — красный шаг честно валит job. `pull_request_target`
  не используется, секреты в job не пробрасываются.
- `cache-dependency-path` для монорепо настроен верно (`verify.yml:18-22`, 4 lock-файла).
- `npx -y @action-validator/cli@latest .github/workflows/verify.yml` → пустой вывод, exit 0.
- Все ~68 verify-скриптов из `backend/package.json` и `frontend/package.json` существуют
  на диске; единственный отсутствующий вход во всей цепочке — `.cursorrules` (Z3-30).
- `.npmrc` отсутствует во всех пакетах — скрытых реестров и токенов нет.
- Схемы дереференсятся: `HydraulicsPipelineInput.yaml` действительно грузится и валидируется
  в рантайме (`pipelineSchemaLoader.js:18-27`), не мёртвый файл.

**Справочники**
- **Коды рекомендаций: 38 в JSON, 38 в коде, пересечение полное.** Ни мёртвых записей,
  ни кодов, которые упадут в «текст не найден». Сверка `jq -r '.[].code'` против grep
  по `backend/src` + `shared` + `frontend/src`, `comm` в обе стороны пуст. При 38 кодах
  в трёх подсистемах это дисциплина, а не везение.
- **Дублей внутри самих файлов нет:** 38 уникальных `code`, 2 уникальных `presetId`,
  6 уникальных `applianceKind`. Для двух справочников из трёх дубли ловятся валидатором
  (исключение — Z3-38).
- **Плейсхолдеры в текстах покрыты переменными на всех вызовах** — прогнана автоматическая
  сверка 38 шаблонов против аргументов `pushRecommendation`/`resolveRecommendation`;
  все первичные срабатывания ложные, переменные идут через общие билдеры
  (`backend/src/matching/warmFloor.js:63-99`, `logic/ufhLoopHydraulics.js:883-889`,
  `utils/apartmentCombiSerialBufferHint.js:71-77`), каждый покрывает свой набор ключей полностью.
- **CI валидирует все 4 файла настоящими валидаторами**
  (`backend/scripts/fixtures/calcRuntimeContextFromFiles.js:42-52` →
  `verifyCalcRuntimeContext.js`, `verifyCalcInputValidation.js` → `npm run verify` →
  `.github/workflows/verify.yml:52`). Битый JSON **в файле** до прода не доедет.
- **Единицы измерения согласованы между файлом, кодом и OpenAPI.** Точечно сверено:
  `storage` (`water_norms.json:65-73` ↔ `WaterNormsStorage.yaml:14-53`, все 7 полей,
  примеры совпадают со значениями), Вт/м², °C, м/с, кПа, бар, м³/ч. Единица закодирована
  в имени поля во всех четырёх файлах — разночтений нет.
  `physics: {cpKjPerKgK: 4.18, rhoKgPerL: 1}` (`water_norms.json:84-87`) корректно:
  размерности сходятся в `q · ρ · cp · Δt` (`backend/src/dhw/waterCalc.js:18`).
- **Температурные пресеты ТП непротиворечивы.** `ufh_only` 40/30 и `ufh_mixed_radiators` 45/35
  (`underfloor_heating_presets.json:10,27` + Δt=10) точно соответствуют enum
  `ufh_dt10_40_30`/`ufh_dt10_45_35` (`UfhCircuitPresetId.yaml:6-10`) и дефолтам финишных
  покрытий (`backend/src/data/flooringFinishMaterials.js:18,28,37,46`). Конфликта «плитка
  требует 45, а режим ограничен 40» нет — режим корректно перекрывает контур
  (`logic/warmFloorCalc.js:103-119`).
- **Отрицательных значений и подозрительных нулей в текущих данных нет.** Два нуля осмысленны:
  `fixtureHotFlowLps.toilet: 0` (`water_norms.json:31` — унитаз не потребляет ГВС и корректно
  исключён из `hotThermalFixtureKeys`) и `velocityLimitsMps.branchMin: 0` (`appliances.json:110`).
  Порядки величин по всем 4 файлам просмотрены — грубых промахов (кВт вместо Вт, л вместо м³) нет.
- **Обязательность записей на уровне коллекции обеспечена для 3 справочников из 4:** отсутствие
  любого из 6 `applianceKind` (`validateAppliances.js:538-550`), любого из 2 `presetId`
  (`validateUnderfloorHeatingPresets.js:145-149`), 3 ключевых кодов
  (`validateRecommendations.js:98-107`) — бросает. Пустой массив не проходит нигде.
- **Bundle заморожен** (`deepFreeze`, `backend/src/reference/configCache.js:82`) — случайная
  мутация справочника из логики расчёта невозможна. Инвалидация кэша защищена от гонки
  монотонным `cacheGeneration` (`:37-38,127,134-141`), stale-снимок переживает неудачное
  обновление (`:144-152`).

**`shared/`**
- Составы всех union/enum сверены с массивами и ключами объектов в `.js` — построчно,
  все 12 пар. Случая «в `.d.ts` 4 варианта, в `.js` 3» нет нигде.
- Числовые значения совпадают: 5 схем котла, 3 пресета графика с точными supply/return/ΔT,
  2 пресета контура ТП с `finishMaterialIds`, `UFH_TERMINAL_CONTROL_MAX_AREA_SQM = 20`,
  `BATHROOM_DESIGN_AIR_TEMP_FLOOR_C = 24`, пороги автовыбора 50 кВт / 7 комнат.
- `Object.freeze` применён последовательно ко всем экспортируемым коллекциям, включая
  вложенные (`ufhCircuitPresets.js:16,21`).
- Циклический импорт `heatingThermalRegimePresets ↔ heatingThermalRegimeRecommendations`
  корректен: значение в одну сторону, тип в обратную — рантайм-цикла нет.

---

## Сильные стороны

**Двухслойная защита от XSS сделана правильно и не случайно.** Вырезание на входе плюс
экранирование на выходе, причём единственный `dangerouslySetInnerHTML` во фронтенде питается
функцией, где экранирование встроено в конструкторы таблиц, а не размазано по вызовам.
Так его нельзя забыть при добавлении строки. Для продукта, чей главный артефакт — HTML,
собранный из пользовательских данных и скормленный браузеру, это ровно то место, где
обычно находят дыру. Здесь её нет.

**Публичный документ собирается whitelist'ом дважды.** Снимок → сериализация, оба раза
перечисление разрешённых полей, а не вычёркивание запрещённых. Именно поэтому в публичной
ссылке нет `ownerId` и анкеты — не потому, что о них вспомнили, а потому, что архитектура
не даёт им туда попасть.

**Токен расшаривания криптостойкий и не логируется целиком.** 192 бита, whitelist при
нормализации, 6-символьный префикс в логах. `Math.random` в бэкенде отсутствует как класс.

**Схемы ответов написаны подробно и с намерением.** 4 130 строк — это не заглушки: там
описания «почему так», ссылки между разделами, `x-notes` с инженерным контекстом
(например `openapi.yaml:100-113` про сборку U наружной стены). Все найденные расхождения —
дрейф от кода, а не небрежность автора. Стоимость Z3-01 — это стоимость **удержания**
уже написанного, а не написания заново.

**Идея единого источника истины в `shared/` доведена до конца по существу.** Обе стороны
реально едят одни и те же массивы, enum для AJV собирается из `Object.keys` того же конфига
(`heatingThermalRegimePresets.js:55`) — рассинхрон валидации и UI структурно невозможен.
Нормализаторы устроены как тотальные функции с явным дефолтом, а не как бросающие lookup'ы.

**Справочники — не конфиг, а подсистема.** Единый шаблон загрузки `file|mongo|auto`
(`backend/src/reference/loadReferenceCollection.js`) с честным логированием решения
и причины (`decision: 'file', reason: 'mongo_error'`); все четыре справочника берутся одним
`Promise.all` и замораживаются вместе (`configCache.js:52-82`) — расчёт **не может** увидеть
каталог новой версии с нормами старой. `CalcRuntimeContext` как composition root убирает
глобальные синглтоны из расчётного кода — та же изоляция ядра, что отмечена в основном
отчёте, доведённая и до данных.

**Источник и версия справочника доезжают до отчёта и до интерфейса**
(`buildReport.js:739-751` → `HotWaterReportView.tsx:80-83`, «water_norms v1»).
Прослеживаемость расчёта заложена архитектурно — не хватает только даты (Z3-47),
и маршрут для неё уже проложен.

**Порядок слоёв в Dockerfile выдаёт понимание кэша** — редкость для однопользовательского
проекта. И `PUPPETEER_SKIP_DOWNLOAD` выставлен до `npm ci`, а не после.

**Деградация PDF предсказуема.** Отсутствие браузера даёт типизированный 503
`PDF_BROWSER_MISSING` (`renderPdfFromHtml.js:26-28`), а не 500 с трейсом; семафор
на Chromium вообще существует.

**Бэкенд сознательно не поехал в serverless.** `docs/deploy/architecture.md` фиксирует, что
API — долгоживущий процесс, а PDF/SSE/долгие расчёты не проксируются через Vercel.
Для приложения с 30-секундными PDF это верное решение, принятое **до** того, как оно стало
инцидентом.

---

## НЕ ПРОВЕРЕНО

- **Маршруты, требующие Mongo, живьём не проверялись.** Сервер поднимался без базы; ответы
  `/api/v1/projects*`, `/public/shares/*`, `/admin/*` сверялись по коду сериализаторов,
  не по фактическому JSON. Это ~40 % таблицы «объявлено против реального». Полная сверка —
  ещё 2–3 часа с поднятой базой, и её стоит сделать вместе с Z3-01.
- **Покрытие сценариев расчёта.** Проверены два payload'а из репозитория (дом, квартира-схема 2).
  Второй дал на 5 расхождений больше первого — то есть число 12 является **нижней границей**.
  Сценарии с тёплым полом, каскадом, БКН, коллекторами и унибоксами не прогонялись.
- **Настройки панелей Render и Vercel**: версия Node, план и лимит памяти, `PDF_BROWSER_EXECUTABLE`,
  Root Directory. Вся конфигурация прод-бэкенда находится вне версионирования
  (`render.yaml` отсутствует по дизайну, `docs/deploy/render.md:23`). Определяет, боевые
  ли Z3-25 и Z3-27 или теоретические.
- **Сетевая конфигурация Render** — определяет, боевой ли Z3-16 (`trust proxy`).
- **Работает ли PDF на Render в принципе.** `npm ci --omit=dev` там качает bundled Chrome
  в `~/.cache/puppeteer`, но переживает ли этот каталог переход build → runtime,
  из репозитория не установить.
- **Сборка не запускалась**: `docker build`, `npm run vercel-build`, `npm ci` не выполнялись
  (read-only). Выводы о слоях и кэше сделаны статически.
- **Расход памяти на рендер** (275 МБ) взят из предыдущего аудита, не перемерялся.
- **Соответствие значений `shared/` тому, что лежит в MongoDB** (`underfloor_heating_presets`,
  коллекции `ui.*`) — `roomTypeNormalization.js:3` прямо просит синхронизировать с OpenAPI,
  не сверялось.
- **Физическая корректность** температурных графиков, ΔT и порогов автовыбора гидрострелки
  (50 кВт / 7 комнат) — инженерная область, не предмет этого аудита.
- **Не читались**: `backend/src/auth/*` (верификация JWT), `catalog/validateCatalog.js`
  (1 568 строк — только на предмет вызовов санитайзера), `report/*`, `logic/*`, `matching/*`,
  `climate/snipClimate.js` (исходящий HTTP с пользовательским адресом — потенциальный SSRF
  и передача адреса объекта третьей стороне, **заслуживает отдельного взгляда**),
  `reference/*`, фронтенд вне двух проверенных страниц.
