## Сводная оценка

| Ось | Оценка | Вердикт |
|---|---:|---|
| Фактическая корректность | **3/5** | Большинство ссылок на код точны, но несколько сильных выводов не доказаны или сформулированы существенно шире эксперимента |
| Полнота | **3/5** | Хорошо разобраны код и эксплуатация, но недооценены миграции данных, совместимость старых документов, восстановление после частичных платежей и реальная стратегия релиза |
| Соразмерность | **2/5** | План превращает первую платную функцию в 4–7-недельную платформенную программу; часть работ не нужна для проверки спроса |
| Приоритизация | **3/5** | Риски данных и неполных смет подняты правильно, но внутренний verify и теоретический admin-сценарий переоценены, а регрессионная безопасность недооценена |
| Безопасность правок | **2/5** | Есть предупреждения о рисках, но мало обязательных механизмов shadow-mode, feature flags, миграций и проверки старых снапшотов |
| Готовность к монетизации | **3/5** | Первый сценарий выбран правильно, сценарии 2–3 разумно признаны дорогими; оценка первого сценария чрезмерна и опирается на необязательную архитектуру |

## Конкретные претензии

1. **«Единственная проверка изоляции данных» — фактически неверно.**  
   Аудит повторяет это в [TECH_AUDIT.md:599](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:599) и [REMEDIATION_PLAN.md:109](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:109). Но подключённый `verify:projects-auth` уже проверяет production-фильтр строго по `ownerId` в [verifyProjectsAuth.js:168](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/scripts/verifyProjectsAuth.js:168). Неподключённый скрипт проверяет в основном admin bypass и role-dependent query в [verifyProjectsAdminAccess.js:66](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/scripts/verifyProjectsAdminAccess.js:66).  
   **Правка:** переименовать находку в «не подключена проверка admin bypass», убрать слова «единственная» и понизить её из БЛОКЕР-A в дешёвый ДОЛГ/quick win.

2. **Падение от двух PDF выдано за доказанный production-инцидент, хотя эксперимент этого не доказывает.**  
   Утверждение «два человека кладут сервис» находится в [TECH_AUDIT.md:57](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:57). Артефакт показывает расход памяти Chromium в 512-МБ cgroup и арифметическое сложение с RSS backend, но не полноценный прогон двух реальных HTTP-запросов через Render с наблюдением OOM/restart. Сам код уже имеет очередь и таймаут 503 в [pdfRenderSemaphore.js:52](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/projects/pdfRenderSemaphore.js:52).  
   **Правка:** формулировать как «высокая вероятность исчерпания памяти при concurrency=2». До изменения env выполнить staging-тест через реальный endpoint и зафиксировать RSS, HTTP-результаты и рестарт контейнера.

3. **Рекомендация `PDF_QUEUE_WAIT_MS=40000` внутренне не согласована с описанным результатом.**  
   План обещает, что два запроса оба дадут 200, но затем пишет про «трети пользователей быстрый 503» в [REMEDIATION_PLAN.md:145](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:145). При этом код не ограничивает длину массива `waiters`, а только время ожидания — [pdfRenderSemaphore.js:36](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/projects/pdfRenderSemaphore.js:36) и [pdfRenderSemaphore.js:87](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/projects/pdfRenderSemaphore.js:87). Увеличение таймаута увеличивает число висящих соединений.  
   **Правка:** оставить короткий таймаут, добавить `PDF_MAX_QUEUE`, `Retry-After` и отдельный rate limit. Проверять 2, 3 и 20 конкурентных запросов, а не только два.

4. **Отсутствие backup и мониторинга нельзя установить по репозиторию как факт.**  
   Категоричные заявления находятся в [TECH_AUDIT.md:598](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:598) и [TECH_AUDIT.md:600](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:600). Отсутствие конфигурации в git не доказывает отсутствие Atlas backup, Render notifications или внешнего uptime-monitor. Сам аудит признаёт, что Clerk Dashboard не проверен, но аналогичную оговорку здесь не применяет.  
   **Правка:** заменить на «в репозитории нет документированного backup/monitoring; состояние внешних панелей не проверено» и добавить короткий production checklist с полями «проверено/дата/ссылка/restore test».

5. **Предложенный backup через GitHub Actions artifacts небезопасен и операционно слаб.**  
   Это предлагается в [REMEDIATION_PLAN.md:549](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:549). Дамп содержит проекты, client data и потенциальные координаты; artifact не является полноценным backup-хранилищем с ожидаемой моделью доступа и retention. Кроме того, cron Actions не доказывает восстановимость.  
   **Правка:** предпочесть managed backup MongoDB либо зашифрованный дамп в отдельное object storage; зафиксировать retention, отдельные credentials и обязательный квартальный restore drill. Не ставить `$0` как гарантированную цену.

6. **Admin-уязвимость правильно найдена в коде, но неправильно поставлена в БЛОКЕР-A до проверки Clerk.**  
   Повышение действительно происходит только по email без `emailVerified`: [resolveUser.js:53](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/auth/resolveUser.js:53) и [resolveUser.js:79](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/auth/resolveUser.js:79). Однако сам аудит говорит, что атака сейчас не воспроизводится, в [TECH_AUDIT.md:826](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:826).  
   **Правка:** первая задача БЛОКЕР-A — проверить claims и провайдеры Clerk. Кодовую правку делать независимо как hardening, но категоризацию определить после проверки. Самая безопасная модель — admin только по immutable `sub`, а не по email.

7. **«Корневой verify — БЛОКЕР-A» переоценивает влияние developer tooling на живых пользователей.**  
   Ошибка воспроизводится: скрипт читает игнорируемый `.cursorrules` в [verifyBackendDocs.mjs:195](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/scripts/verifyBackendDocs.mjs:195), а файл игнорируется в [.gitignore:9](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/.gitignore:9). Но это не production blocker и CI частично выполняет проверки.  
   **Правка:** оставить первым техническим действием, но категоризировать как «разблокирует разработку», а не БЛОКЕР-A продукта. Удалить проверки `.cursorrules` из продуктового verify, а не восстанавливать локальный IDE-файл в репозитории.

8. **БЛОКЕР-A `rooms.maxItems` обоснован, но предложенный предел `60` не выведен из продуктового контракта.**  
   В `CalcInput` ограничение действительно отсутствует — [CalcInput.yaml:49](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/components/schemas/CalcInput.yaml:49), а `/calc` публичен — [routes.js:196](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/api/routes.js:196). Но число 60 выбрано без данных о реальных многоквартирных объектах и импортируемых проектах.  
   **Правка:** сначала ввести серверный cost budget и отдельные лимиты вложенных `envelopeElements`, UFH loops и hydraulics branches. `maxItems` сделать конфигурируемым и вернуть структурированную ошибку. Добавить тесты на 60/61 и на малое число комнат с экстремально большой вложенностью.

9. **План неполной сметы может сломать уже работающую публикацию старых и частично рассчитанных проектов.**  
   Предлагается заставить `buildShareSnapshot` отказывать при `complete=false` в [REMEDIATION_PLAN.md:704](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:704). Сейчас guard проверяет только наличие `commercial` — [buildShareSnapshot.js:47](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/projects/buildShareSnapshot.js:47). Немедленный hard reject изменит пользовательский контракт и может заблокировать документы, которые раньше публиковались.  
   **Правка:** сначала аддитивно записывать `completeness.status/reasons`, показывать warning и собирать частоту причин. Hard block включать feature flag только для платной выгрузки; бесплатный режим может выдавать документ с заметным watermark «неполный».

10. **Перепись через `bomItems` до первой оплаты несоразмерна цели.**  
    План требует 44–76 часов на новый контракт в [REMEDIATION_PLAN.md:1163](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:1163), хотя сам аудит уже предлагает дешёвый completeness guard. Для проверки спроса на PDF достаточно запретить платную выгрузку при известных failure/warning states и добавить несколько инвариантов к существующему `commercial`.  
    **Правка:** перенести полный `bomItems` в ДОЛГ после первых продаж. До монетизации сделать compatibility validator: обязательные категории, согласование totals, наличие цены либо явный `priceStatus`, и golden-тест PDF.

11. **Закрытие публичного `/catalog` ошибочно объявлено обязательным условием продажи PDF.**  
    Аргумент «гейт обходится одним GET» находится в [TECH_AUDIT.md:612](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:612). Endpoint действительно публичен и отдаёт каталог — [routes.js:82](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/api/routes.js:82). Но доступ к исходным ценам не эквивалентен доступу к рассчитанной, оформленной и экспортированной смете.  
    **Правка:** если продаётся именно экспорт, гейт ставить на publish/PDF endpoint. Каталог закрывать только если сами данные лицензируются или являются отдельной платной ценностью. Это убирает из критического пути auth/redaction перед `/calc` и `/catalog`.

12. **Платёжный контур спроектирован до выбора модели продажи и провайдера.**  
    Оценка 45–75 часов находится в [REMEDIATION_PLAN.md:858](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:858), а глобальный `express.json` действительно создаст проблему для провайдеров, которым нужен raw body, — [index.js:121](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/index.js:121). Но неизвестно, будет ли это подписка, единичная покупка, пакет экспортов, hosted checkout или ручная активация после счёта.  
    **Правка:** сначала выбрать один SKU и провайдера. Для первых клиентов допустим hosted payment link плюс ручная выдача credits/admin entitlement. Вебхук, ledger и автоматическую сверку добавлять после подтверждения повторяемого спроса.

13. **Не учтена совместимость уже сохранённых `shareSnapshot` и расчётов.**  
    План меняет `report.commercial`, completeness, price date и контракт позиций, но в критериях закрытия нет corpus-теста старых Mongo-документов. При этом снапшот сохраняется как вложенная структура и публикуется из проекта — [projectsRoutes.js:785](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend/src/api/projectsRoutes.js:785).  
    **Правка:** до П5/P6 выгрузить обезличенную выборку всех существующих schema generations; добавить fixture corpus и тест «старый snapshot открывается и PDF строится». Новые поля читать с backward-compatible defaults.

14. **Волна 1 не означает готовность к живым монтажникам, хотя заголовки утверждают обратное.**  
    Таблица обещает это за 17–31 час в [TECH_AUDIT.md:1540](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/TECH_AUDIT.md:1540), но ниже признаётся, что QA release gate требует ещё 56–112 часов исправлений физики, 130–246 часов проходимости и живой раунд — [REMEDIATION_PLAN.md:1145](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:1145). Это существенное внутреннее противоречие.  
    **Правка:** переименовать волну 1 в «эксплуатационный минимум перед пилотом». Готовность к публичному выпуску определять QA gate; для пяти контролируемых монтажников использовать отдельный pilot gate с ручным разбором каждого результата.

15. **Оценки трёх сценариев выглядят точнее, чем позволяет постановка задачи.**  
    Сценарий 1 оценён в 4–7 недель в [A6-monetization-readiness.md:647](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/raw/A6-monetization-readiness.md:647), сценарий 2 — ещё 10–16 недель в [A6-monetization-readiness.md:682](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/raw/A6-monetization-readiness.md:682), сценарий 3 — 24–40 недель в [A6-monetization-readiness.md:705](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/raw/A6-monetization-readiness.md:705). Для сценариев 2–3 нет требований к объёму транзакций, кабинетам, выплатам и модерации, поэтому это скорее order-of-magnitude, чем инженерная оценка. Для сценария 1 выбран максимально автоматизированный вариант вместо минимального продаваемого.  
    **Правка:** дать диапазоны по уровням: manual paid pilot — 2–5 дней; автоматизированная единичная покупка — 2–4 недели; полноценная подписка/ledger — 4–7 недель. Сценарии 2–3 обозначить как discovery, а не commitment estimate.

## Три вещи, которые я бы вычеркнул

1. **Полный контракт `bomItems` до первой оплаты** — [REMEDIATION_PLAN.md:747](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:747). Заменить временным completeness validator и golden PDF fixtures.

2. **Обязательное закрытие `/catalog` как предусловие платного PDF** — [REMEDIATION_PLAN.md:498](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:498). Это отдельное продуктовое решение, не технический блокер экспорта.

3. **Backup MongoDB в GitHub Actions artifact** — [REMEDIATION_PLAN.md:549](/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/docs/audit/REMEDIATION_PLAN.md:549). Нужен managed либо зашифрованный backup с проверенным restore.

## Три вещи, которые я бы добавил

1. **Paid-pilot path:** один SKU «экспорт сметы», hosted payment link или счёт, ручная выдача 1–N credits, аудит операций. Это позволяет проверить готовность платить до строительства полного billing-контура.

2. **Regression corpus старых данных:** обезличенные реальные `Project`, calculation и `shareSnapshot` разных поколений плюс обязательный тест открытия и генерации PDF до любых изменений коммерческого контракта.

3. **Безопасный rollout:** feature flags для `commercial.complete`, платного PDF и нового entitlement; shadow-validation без блокировки; метрики причин неполноты; canary на staging и явный rollback для каждой схемной правки.

Итог: аудит сильнее среднего по сбору фактов и поиску конкретных швов, но как план для соло-разработчика он слишком быстро превращает проверку спроса в строительство законченной платформы. Перед пилотом действительно нужны лимиты входа, восстановимый backup, наблюдаемость и явная маркировка неполных расчётов. Для первых денег не нужны ни перепись BOM, ни закрытый каталог, ни сразу полноценная подписочная бухгалтерия.