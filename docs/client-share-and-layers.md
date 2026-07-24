# Клиентский слой, Dev-слой и публичная ссылка

SSOT по ТЗ: два слоя кнопок, **серверный PDF** (скачивание файла), публичная ссылка `/s/{shareToken}`.

## Клиент (production UI)

Видимые действия:

- имя клиента, проекты / открыть проект, новый расчёт;
- **зберегти проєкт** (анкета + збережений розрахунок на сервері, якщо анкета готова до calc);
- **скопировать публичную ссылку** (после publish; toast под кнопкой, URL только в буфере);
- **скачать PDF** (финансовый итог; опционально + технический расчёт);
- **выйти** на стартовый экран (без skeleton; локальная сессия очищается, проект на сервере сохраняется).

Клиенту **не** показывать: JSON-файл, «на сервер», Mongo ObjectId, private API URL, hash `#survey=`.

Клиенту **не** предлагать «разрешить всплывающие окна»: PDF **не** открывается через `window.open` / print pop-up.

## Developer (DevPanel)

Включается только при `import.meta.env.DEV` или `VITE_DEV_TOOLS=1`. В чистом production-билде без флага панель не монтируется.

Действия: draft JSON, server save, server+calc, calcInput, full report, report по модулям, project id, ручной POST `/api/v1/calc`, legacy hash-share.

## Публичная ссылка

| | Клиент | Developer |
|---|---|---|
| URL | `{origin}/s/{shareToken}` | `/api/v1/projects/{id}` |
| Auth | нет (знание токена) | JWT + ownerId |
| Режим | read-only презентация | CRUD |

### Backend

- `Project.shareToken` — случайный (≥128 bit), unique index; **не** ObjectId.
- `Project.shareSnapshot` — immutable whitelist для UI; опционально `publisherPresentation` (Pro/Marketplace).
- `Project.sharePublishedAt`.
- Owner: `POST /api/v1/projects/{id}/share`, `DELETE /api/v1/projects/{id}/share`.
- Public: `GET /api/v1/public/shares/{shareToken}` — только GET, rate limit по IP.
- Ответ public **не** содержит: `survey`, `lastCalcInput`, `ownerId`, полный сырой report без фильтра.

### Страница `/s/{shareToken}`

- Без полей анкеты и без SurveySession write/calc.
- Финансовый итог + аккордеоны оборудования + кнопка **Скачать PDF**.
- Опционально **`PublisherContactBlock`** — если в snapshot есть `publisherPresentation` (tier `pro` или `marketplace`: email и optional name публикатора).
- Опционально свёрнутый технический блок (read-only на экране).

### `publisherPresentation` (Pro / Marketplace)

При `POST /api/v1/projects/{id}/share` backend добавляет в snapshot контакт **текущего** `req.user`, если `subscription ∈ { pro, marketplace }`:

```json
{
  "tier": "pro",
  "contactEmail": "installer@example.com",
  "contactName": "Іван Монтажник"
}
```

- `free` — поле **отсутствует** (поведение как раньше).
- Republish после смены tier/email — snapshot обновляется.
- Public GET и public PDF отдают только whitelist; **без** subscription-gate на чтение.
- Схема: `components/schemas/SharePublisherPresentation.yaml`.

## PDF (серверная генерация)

Единственный продуктовый путь: **Chromium на сервере → `application/pdf` → скачивание blob** (без pop-up).

| Endpoint | Auth | Источник данных |
|---|---|---|
| `GET /api/v1/projects/{id}/pdf?includeTechnical=0\|1` | JWT (owner) | последний сохранённый `Calculation.report` → `buildShareSnapshot` |
| `GET /api/v1/public/shares/{shareToken}/pdf?includeTechnical=0\|1` | нет | только `shareSnapshot` |

Пайплайн backend:

1. `buildEstimatePdfHtml` — шапка, таблица `commercial`, карточки `proposalEconomy` / `proposalEfficient` (сравнение; **не** подменяют `grandTotal`), секция **контакта публикатора** (если `publisherPresentation`), опционально техблок (`buildTechnicalPdfHtml`).
2. `renderPdfFromHtml` — puppeteer-core + `PDF_BROWSER_EXECUTABLE` (Docker/apt Chromium) или bundled Chrome из `puppeteer`.
3. Ответ: `Content-Disposition: attachment` + имя `Смета_<client>_<label>.pdf`.

Инфра:

- `backend/Dockerfile` — `node:20` + `apt` Chromium, `PDF_BROWSER_EXECUTABLE=/usr/bin/chromium`.
- `backend/docker-compose.pdf.yml` — пример запуска.
- Env: `PDF_BROWSER_EXECUTABLE`, `PDF_RENDER_TIMEOUT_MS`, `PDF_MAX_CONCURRENT` (см. `backend/.env.example`).
- Verify: `npm run verify:project-pdf` (входит в `backend` `verify`).

Фронт: `downloadProjectPdf` / `downloadPublicSharePdf` → `<a download>` (`downloadBlobFile`). В редакторе нужен сохранённый `projectId` и расчёт на сервере.

## Файлы в репозитории

| Слой | Путь |
|------|------|
| Frontend — маршрут share | `frontend/src/App.tsx` → `SharePresentationPage` |
| Frontend — контакт Pro/Marketplace | `frontend/src/components/PublisherContactBlock/` |
| Frontend — клиент (Header) | `frontend/src/components/Header/Header.tsx` |
| Frontend — сессия / tier | `frontend/src/components/AccountBar/`, `SubscriptionTierBadge/` |
| Frontend — Dev | `frontend/src/components/DevPanel/DevPanel.tsx`, `frontend/src/utils/isDevToolsEnabled.ts` |
| Frontend — toast ссылки | `frontend/src/components/ShareLinkToast/ShareLinkToast.tsx` |
| Frontend — API share/PDF | `frontend/src/services/publicShareApi.ts`, `parsePublicShare.ts`, `projectsApi.ts` |
| Frontend — профиль `/me` | `frontend/src/services/meApi.ts`, `query/queries/useMeQuery.ts` |
| Frontend — оркестрация | `frontend/src/hooks/useSurveyProject.ts`, `frontend/src/AppRoot.tsx` |
| Backend — publish/revoke | `backend/src/api/projectsRoutes.js` |
| Backend — public GET | `backend/src/api/publicSharesRoutes.js` |
| Backend — snapshot | `backend/src/projects/buildShareSnapshot.js`, `buildPublisherPresentation.js`, `serializeShare.js`, `shareToken.js` |
| Backend — PDF | `backend/src/projects/renderEstimatePdf.js` (см. [`project-pdf.md`](project-pdf.md)) |
