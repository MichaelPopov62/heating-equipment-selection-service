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

## Runbook Production → Staging

1. Production Vercel: открыть проект, Dev → **📥 Експорт**.
2. Staging Vercel: войти в Clerk Staging, Dev → **📤 Імпорт**, выбрать файл.
3. Проверить анкету, отчёт, список проектов.

## Окружения

- Разные БД через `MONGODB_URI` (`heating-prod` / `heating-staging`).
- Frontend: `VITE_API_BASE_URL` на соответствующий Render API.
- DevPanel: `VITE_DEV_TOOLS=1` на Vercel.

## API

`POST /api/v1/projects/import` — см. [`projects-api.md`](projects-api.md).

## Код

- Export: `fetchProjectExportBundle.ts`, `buildProjectExportBundle.ts`
- Import: `parseProjectImportFile.ts`, `projectsApi.importProject`
- UI: `useSurveyProject.ts`, `DevPanel.tsx`
