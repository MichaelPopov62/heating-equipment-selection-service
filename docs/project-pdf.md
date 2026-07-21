# Серверный PDF сметы

Устранение pop-up печати (`window.open`): клиент **скачивает** готовый `.pdf`.

## Модули

| Файл | Роль |
|------|------|
| `backend/src/projects/buildEstimatePdfHtml.js` | HTML: таблица commercial + карточки Эконом/Эффективный |
| `backend/src/projects/buildTechnicalPdfHtml.js` | Опциональный техблок |
| `backend/src/projects/renderPdfFromHtml.js` | Chromium → PDF buffer |
| `backend/src/projects/renderEstimatePdf.js` | Оркестратор + Content-Disposition |
| `backend/Dockerfile` | node:20 + apt Chromium |

## Env

См. `backend/.env.example`: `PDF_BROWSER_EXECUTABLE`, `PDF_RENDER_TIMEOUT_MS`, `PDF_MAX_CONCURRENT`.

## Verify

```bash
cd backend && npm run verify:project-pdf
```

Без браузера HTML-проверки проходят; PDF-рендер — SKIP (или FAIL при `PDF_REQUIRE_BROWSER=1`).

## Файлы в репозитории

| Слой | Путь |
|------|------|
| Backend — HTML | `backend/src/projects/buildEstimatePdfHtml.js`, `buildTechnicalPdfHtml.js`, `pdfHtmlEscape.js` |
| Backend — render | `backend/src/projects/renderPdfFromHtml.js`, `renderEstimatePdf.js`, `pdfRenderSemaphore.js`, `pdfFilename.js` |
| Backend — роуты | `backend/src/api/projectsRoutes.js` (owner PDF), `backend/src/api/publicSharesRoutes.js` (public PDF) |
| Backend — verify | `backend/scripts/verifyProjectPdf.js` |
| Backend — infra | `backend/Dockerfile`, `backend/docker-compose.pdf.yml` |
| Frontend — download | `frontend/src/services/projectsApi.ts` (`downloadProjectPdf`), `publicShareApi.ts` (`downloadPublicSharePdf`) |
| Frontend — blob | `frontend/src/utils/downloadBlobFile.ts` |
| Frontend — UI | `frontend/src/hooks/useSurveyProject.ts` (`printPdf`), `SharePresentationPage` (public PDF) |
