<!-- Назначение: аудит docs ↔ код до реорганизации deploy — URL, vercel.json, issues I1–I5, SSOT сборки. -->

# Фаза 0: аудит деплоя (2026-08-09)

Документ фиксирует снимок Vercel/Render на 2026-08-09 (аудит перед и во время реорганизации `docs/deploy/`).  
Hub раздела: [`README.md`](README.md).

---

## 0.1. Живые URL и ветки Git

### HTTP-проверка (curl, 2026-08-09)

| URL | HTTP | Назначение |
|-----|------|------------|
| `https://heatcalc-staging-mp62.vercel.app/` | **200** | Staging frontend |
| `https://heatcalc-api-staging-mp62.onrender.com/health` | **200** | Staging API |
| `https://heatcalc-mp62.vercel.app/` | **200** | Production frontend |
| `https://heatcalc-api-mp62.onrender.com/health` | **200** | Production API |

Все четыре сервиса **активны**. Ранее в legacy-доке «deployment-architecture» §3 утверждалось, что все четыре адреса возвращали 404 — **устарело**.

### Ветки репозитория

```text
* main
  staging
  remotes/origin/main
  remotes/origin/staging
```

**Предполагаемое соответствие** (не зафиксировано в репозитории — уточнить в Vercel/Render Dashboard):

| Ветка Git | Окружение |
|-----------|-----------|
| `staging` | Staging (Vercel + Render) |
| `main` | Production (Vercel + Render) |

> **TODO (ops):** подтвердить Production Branch / Auto-Deploy в настройках обоих Vercel-проектов и обоих Render Web Services.

---

## 0.2. Сверка кода и документации

### Три источника конфигурации Vercel

| Источник | Install | Build | Output |
|----------|---------|-------|--------|
| Legacy doc «deployment-architecture» §6 (удалён) | `npm ci --prefix frontend` | `npm run build --prefix frontend` | `frontend/dist` |
| Корневой [`vercel.json`](../../vercel.json) | `npm ci --prefix frontend` | `npm run vercel-build` | **`build`** |

### Фактическая цепочка сборки в коде

**Корень репозитория** ([`package.json`](../../package.json)):

```json
"build": "npm run vercel-build",
"vercel-build": "npm run build --prefix frontend && node scripts/vercelPrepareOutput.mjs"
```

**Frontend** ([`frontend/package.json`](../../frontend/package.json)):

```json
"postbuild": "node scripts/prepareVercelBuildOutput.mjs"
```

**Скрипты копирования:**

| Скрипт | Когда | Откуда → куда |
|--------|-------|---------------|
| [`scripts/vercelPrepareOutput.mjs`](../../scripts/vercelPrepareOutput.mjs) | после root `vercel-build` | `frontend/dist` → **`build/`** (корень репо) |
| [`frontend/scripts/prepareVercelBuildOutput.mjs`](../../frontend/scripts/prepareVercelBuildOutput.mjs) | postbuild frontend | `frontend/dist` → **`frontend/build/`** |

**Локальная проверка** (`npm run vercel-build`, 2026-08-09): сборка OK; артефакты в `frontend/dist`, `frontend/build`, **`build/`** (корень). Каталога **`dist/`** в корне репозитория **нет**.

### Зависимость от `shared/`

Frontend импортирует [`shared/`](../../shared/) (`../shared/...` в tsconfig и исходниках).
Сборка **требует** checkout монорепозитория с доступом к `shared/` относительно `frontend/`.

- При **Root Directory = корень репо** — `shared/` доступен как `./shared`.
- При **Root Directory = `frontend/`** — `shared/` доступен как `../shared` (полный clone на диске Vercel сохраняется).

### Расхождения (issues)

| # | Проблема | Критичность |
|---|----------|-------------|
| I1 | ~~`vercel.json` → `outputDirectory: "dist"`~~ | ✅ фаза 4: **`build/`** |
| I2 | ~~Legacy doc §6 → `frontend/dist`~~ | ✅ контент в `vercel.md`, legacy удалён |
| I3 | ~~Корневой `npm ci` без `frontend/`~~ | ✅ фаза 4: `npm ci --prefix frontend` |
| I4 | ~~Два `vercel.json`~~ | ✅ фаза 4: `frontend/vercel.json` удалён |
| I5 | `postbuild` → `frontend/build/` дублирует копирование | Низкая (не блокер) |

**Вывод (до фазы 4):** staging/production работали (HTTP 200), вероятно Dashboard переопределял Install/Build/Output. **Фаза 4:** `vercel.json` в репозитории приведён к SSOT — docs и код совпадают.

---

## 0.3. Решение SSOT для Vercel (на фазу 4)

### Принятый вариант: **A — Root Directory = корень репозитория**

Обоснование:

1. Явный скрипт [`vercel-build`](../../package.json) в корне — задуман для monorepo.
2. [`shared/`](../../shared/) — общий контракт BE�FE; root-сборка предсказуемее в документации.
3. Контент legacy §6 перенесён в [`vercel.md`](vercel.md); output в коде — **`build/`**.

### Целевые команды (SSOT для `docs/deploy/vercel.md`, фаза 2)

```text
Root Directory:     repository root (не frontend/)
Node.js Version:    22.22+ (engines frontend, CI .github/workflows/verify.yml)
Install Command:    npm ci --prefix frontend
Build Command:      npm run vercel-build
Output Directory:   build
```

SPA rewrites — из корневого [`vercel.json`](../../vercel.json) (`/(.*)` → `/index.html`).

### Изменения кода (фаза 4 ✅)

| Файл | Действие |
|------|----------|
| [`vercel.json`](../../vercel.json) | ✅ `outputDirectory`: **`build`**, `installCommand`: **`npm ci --prefix frontend`**, `buildCommand`: **`npm run vercel-build`** |
| `frontend/vercel.json` | ✅ **удалён**; SSOT — корневой `vercel.json` |
| [`vercel.md`](vercel.md) | ✅ SSOT команд Vercel |

### Альтернатива B (не выбрана)

Root Directory = `frontend/`, Output = `dist`, без root `vercelPrepareOutput`.
Работает при `../shared`, но дублирует второй `vercel.json` и расходится с root `vercel-build`.

---

## 0.4. Render (кратко, для полноты фазы 0)

Зафиксировано в [`render.md`](render.md):

```text
Root Directory: backend
Build Command:  npm ci --omit=dev
Start Command:  npm start
Health Check:   /health
```

Auto-deploy после push — по настройке Render (не в репозитории). `render.yaml` **отсутствует**.

---

## 0.5. Критерии завершения фазы 0

- [x] Проверены живые URL (4/4 → 200)
- [x] Зафиксированы ветки `main` / `staging`
- [x] Сверены `vercel.json`, `package.json`, prepare-скрипты vs docs
- [x] Локально прогнан `npm run vercel-build`
- [x] Выбран SSOT Vercel: **вариант A**, output **`build/`**
- [x] Список issues I1–I5 для фаз 2 и 4
- [ ] **Ops:** подтвердить branch → environment в Dashboard (вне репозитория)

---

## Ops (вне репозитория)

Чеклист после push / смены env — [`smoke-tests.md`](smoke-tests.md) (A1–A7):

- [ ] Vercel: Root Directory = **корень репо**; Install/Build/Output совпадают с [`vercel.md`](vercel.md)
- [ ] Vercel: staging ↔ ветка `staging`, production ↔ `main`
- [ ] Render: `/health` → 200 на staging и production
- [ ] Smoke curl + login admin + «Звернення» / Dev (staging)
