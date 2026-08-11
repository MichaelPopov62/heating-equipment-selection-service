# Heating equipment selection service

REST API и фронтенд для подбора теплового оборудования (дом/квартира).

Правила — [`.cursorrules`](.cursorrules).  
Дерево папок (SSOT) — [`docs/project-structure.md`](docs/project-structure.md).  
Индекс модулей и доменных ссылок — [`Plan.md`](Plan.md).  
Контракт API — [`openapi.yaml`](openapi.yaml).

---

## Части монорепо

| Часть | README |
|-------|--------|
| Frontend | [`frontend/README.md`](frontend/README.md) — архитектура, команды, DevPanel, Vercel |
| Backend | [`backend/README.md`](backend/README.md) — quick start, seed, маршруты, verify |

Корневой README не дублирует quick start и доменные детали частей: только ссылки.

---

## Документация

| Документ | Назначение |
|----------|------------|
| [`docs/project-structure.md`](docs/project-structure.md) | SSOT: папки, entrypoints, слои |
| [`Plan.md`](Plan.md) | Краткий индекс модулей и доменных гайдов |
| [`docs/type-safety.md`](docs/type-safety.md) | Строгая типобезопасность, CI gate |
| [`frontend/README.md`](frontend/README.md) | Frontend: запуск, слои, verify |
| [`backend/README.md`](backend/README.md) | Backend: quick start, verify, маршруты |

Полный список доменных гайдов — [`Plan.md`](Plan.md) § «Доменная документация».

---

## Деплой

| Документ | Назначение |
|----------|------------|
| [`docs/deploy/README.md`](docs/deploy/README.md) | Hub: Vercel + Render, smoke |

---

## Приёмка (production gate)

```bash
npm run verify
```

Эквивалент по шагам:

```bash
node scripts/verifyNoTypeBypass.mjs
cd shared && npm run typecheck
cd backend && npm run verify
cd frontend && npm run verify
```

Подробности: [`docs/type-safety.md`](docs/type-safety.md). CI: `.github/workflows/verify.yml`.
