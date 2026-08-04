# Dev: экспорт и импорт проектов между окружениями

SSOT для переноса проектов Production ↔ Staging через JSON-файлы в DevPanel.

## Кнопки DevPanel

| Кнопка | Действие | MongoDB |
|--------|----------|---------|
| **Зберегти JSON** | Локальный SurveyDraft → файл | Нет |
| **Відкрити JSON** | Файл → сессия + localStorage | Нет |
| **📥 Експорт (Save JSON)** | Проект + полная история `calculations` → файл | Чтение |
| **📤 Імпорт (Load JSON)** | Файл → `POST /api/v1/projects/import` | Запись |

## Формат `ProjectExportBundle v1`

```json
{
  "exportSchemaVersion": 1,
  "exportedAt": "2026-08-03T12:00:00.000Z",
  "source": { "projectId": "…", "calculationsTotal": 2 },
  "project": {
    "clientName": "…",
    "survey": { },
    "lastCalcInput": { }
  },
  "calculations": [
    {
      "calcInput": { },
      "report": { },
      "summary": { },
      "sourceCreatedAt": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

Служебные поля Mongo (`_id`, `shareToken`, `survey.projectId`, …) **не** включаются.

Legacy `heatcalc-*.json` (SurveyDraft без `exportSchemaVersion`) также принимается импортом.

## Runbook Staging → Production (перенос проекта)

1. **Staging** (admin): Dev → **📥 Експорт** → файл на ПК.
2. **Production**: admin → `/projects` → **«Перенос проєкту»** → **«Обрати JSON-файл»**; або
   - **curl** `POST /api/v1/projects/import` з JWT admin і тілом JSON (legacy).
3. На **целевом** окружении: «Оновити список» на `/projects`.

## Runbook Production → Staging

1. Экспорт через **curl** с production JWT admin (Dev на master нет) или из Mongo.
2. **Staging** (admin): Dev → **📤 Імпорт**, выбрать файл.
3. Проверить анкету, отчёт, список проектов.

## Окружения

- Разные БД: `heatcalc_staging` / `heatcalc_production`.
- Frontend: `VITE_API_BASE_URL` на соответствующий Render API.
- DevPanel: только **staging Vercel** — `VITE_DEV_TOOLS=1` + `VITE_APP_ENV=staging` + admin.
- Bootstrap admin (legacy): `cd backend && npm run promote:user-admin -- --email user@example.com`
- **Platform admin (deploy):** `PLATFORM_ADMIN_EMAILS` на Render — см. [`auth.md`](auth.md)

## API

`POST /api/v1/projects/import` — см. [`projects-api.md`](projects-api.md).

## Код

- Export: `fetchProjectExportBundle.ts`, `buildProjectExportBundle.ts`
- Import: `parseProjectImportFile.ts`, `projectsApi.importProject`
- UI: `useSurveyProject.ts`, `DevPanel.tsx`
