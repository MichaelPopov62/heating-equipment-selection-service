# Типобезопасность (production)

Единый контракт строгой проверки типов для `shared/`, `backend/` и `frontend/`.

## Цели

- Запрет явного и неявного `any` в TypeScript и JSDoc.
- Сырой ввод (`JSON.parse`, `fetch().json()`, HTTP body) — только `unknown` → guard / AJV → узкий тип.
- `exactOptionalPropertyTypes` и `noUncheckedIndexedAccess` включены во всех пакетах.
- Gate в `npm run verify` (корень) и в CI (`.github/workflows/verify.yml`).

## Конфигурация

| Пакет | Инструмент | Флаги |
|-------|------------|--------|
| Корень | `tsconfig.strict-base.json` | `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, … |
| `shared/` | `tsc --noEmit` + `checkJs` | extends base |
| `backend/` | `tsc --noEmit` + `checkJs` на `src/` и `scripts/` | extends base |
| `frontend/` | `tsc -b` + ESLint `strictTypeChecked` | extends base; `tsconfig.app.json` и `tsconfig.node.json` одинаково строгие |

## Скрипты

```bash
# Полная приёмка (production gate)
npm run verify

# По пакетам
npm run typecheck:shared
npm run typecheck:backend
npm run typecheck:frontend
npm run verify:type-bypass   # any / @ts-ignore / eslint-disable unsafe

cd frontend && npm run lint  # strictTypeChecked + no-unsafe-*
cd frontend && npm run build
cd backend && npm run verify # lint + typecheck + domain verify:*
```

## Правила для кода

1. **Нельзя:** `: any`, `as any`, `@param {any}`, `@ts-ignore`, `@ts-nocheck`, `eslint-disable` для `no-unsafe-*` / `no-explicit-any`.
2. **Можно:** `@ts-expect-error` только с описанием ≥ 10 символов (ESLint `ban-ts-comment`).
3. **Optional-поля** (`exactOptionalPropertyTypes`): не присваивать `undefined` — условный spread `...(v !== undefined ? { key: v } : {})`.
4. **Индексный доступ:** проверять `arr[i]` на `undefined`.
5. **JSON / API на frontend:** `utils/jsonGuards.ts` (`isRecord`, …).
6. **HTTP ошибки на backend:** `utils/createAppError.js` / `AppErrorLike` из `shared-types.d.ts`.
7. **JSDoc import():** относительные пути с расширением `.js` (для `.d.ts` файлов — `import('./types.js')`).

## CI

Workflow `verify` запускает: `verifyNoTypeBypass` → shared typecheck → backend verify → frontend verify → frontend build.

## Связанные документы

- [frontend-calc-runner.md](frontend-calc-runner.md) — приёмка frontend
- [survey-draft.md](survey-draft.md) — verify черновика
- [calc-runtime-context.md](calc-runtime-context.md) — DI справочников
