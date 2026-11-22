# module-frontend

Standalone React-витрина проекта `oracle-to-postgres` с DEMO-симуляцией и
LIVE-панелью управления реальными Spring Boot модулями. Секция `#start`
содержит команды для сценариев `public` и `auto_migration` в bash и PowerShell.

Проект не входит в Gradle build: это отдельное npm-приложение. Java-модули,
`docker-compose`, Liquibase- и KODA-файлы не изменяются.

## Стек

- React 19, Vite 6, TypeScript strict
- Tailwind CSS 4
- framer-motion
- prism-react-renderer
- lucide-react
- Vitest + Testing Library

## Запуск

```bash
cd module-frontend
npm install
npm run dev
```

Dev-сервер: `http://localhost:5173`.

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Vite dev server с proxy на 8081–8084 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest, один прогон |
| `npm run test:watch` | Vitest в watch-режиме |
| `npm run build` | typecheck + production build в `dist/` |
| `npm run preview` | локальный preview production-сборки на 4173 |

## DEMO и LIVE

Переключатель `demo / live` находится в navbar и в мобильном меню.

- **DEMO** — режим по умолчанию. Работает без бэкенда: counters, architecture,
  stepper и simulation engine детерминированы.
- **LIVE** — читает реальные health, migration status, schema diff,
  schema-migration status и source tables. LIVE остаётся включённым при
  частичной недоступности сервисов.
- Если все четыре health-проверки вернули `down`, интерфейс автоматически
  возвращается в DEMO и показывает закрываемое уведомление. Приложение при
  этом не падает и не оставляет пустых экранов.

Health-индикаторы в navbar показывают четыре сервиса; на узких экранах
остаются только точки, полный список с задержками есть в мобильном меню и в
LIVE-консоли.

## Vite proxy

В dev-режиме запросы идут через alias путей, чтобы не хранить абсолютные
адреса в коде:

| Alias | Backend | Rewrite |
| --- | --- | --- |
| `/api/oracle` | `http://localhost:8081` | `/api/v1/oracle` |
| `/api/postgres` | `http://localhost:8082` | `/api/v1/postgres` |
| `/api/migration` | `http://localhost:8083` | `/api/v1/migration` |
| `/api/schema` | `http://localhost:8084` | `/api/v1/schema-migration` |
| `/api/*/actuator/health` | соответствующий порт | `/actuator/health` |

Если backend недоступен, proxy отвечает JSON `503` с сообщением
`Backend недоступен через Vite proxy`; UI переводит это в human-readable
состояние сервиса.

## Переменные окружения

Скопируйте `.env.example` в `.env` и при необходимости замените base URL:

```dotenv
VITE_ORACLE_BASE=/api/oracle
VITE_POSTGRES_BASE=/api/postgres
VITE_MIGRATION_BASE=/api/migration
VITE_SCHEMA_BASE=/api/schema
```

Переменные читаются в `src/data/live.ts`. Пустое значение использует
alias по умолчанию. `vite preview` локально использует тот же `server.proxy`,
поэтому проверка production-сборки тоже ходит на 8081–8084. На статическом
хостинге задайте абсолютные URL либо настройте reverse proxy на те же пути.

## Read-only LIVE API

| Метод | Путь | Данные |
| --- | --- | --- |
| GET | `/api/migration/actuator/health` | health module-migration |
| GET | `/api/migration/status` | `MigrationStatus` |
| GET | `/api/migration/schema/diff` | `SchemaDiffReport` |
| GET | `/api/migration/tables` | `string[]` |
| GET | `/api/schema/status` | `SchemaMigrationStatus` |

Health опрашивается каждые 15 секунд, read-only данные — каждые 20 секунд.
Все таймеры и `AbortController` очищаются при переключении в DEMO и при
размонтировании провайдера.

## Изменяющие операции

LIVE-консоль в секции `#api` открывает три операции:

- `initial-load sync` → `POST /api/migration/run`;
- `initial-load async` → `POST /api/migration/run/async`, затем polling job;
- `apply schema DDL` → `POST /api/schema/apply`.

Защита выстроена в два шага:

1. кнопки заблокированы, пока не включён `armed`-режим;
2. каждая операция требует отдельного подтверждения словом `MIGRATE`
   в модальном диалоге.

Async job опрашивается каждые 2 секунды. Панель показывает `phase`, `table`,
`lastId`, `rowsLoaded`, `sourceMaxId`, `sourceScn`, `sourceIdle`,
`tablesTotal`, `tablesCompleted`, `rowsPerSecond`, `etaSeconds`, `report` и
`error`. Отмена доступна только для `RUNNING` job и не требует `armed`.

Конфликты и отказы показываются человекочитаемо: `409` — уже выполняется
другой запуск, `422` — validation не пройдена, `503` — недоступен источник,
приёмник или БД, `502/504` — сбой proxy.

## Большой демо-датасет (dev only)

В LIVE-консоли есть блок `demo dataset` с кнопкой `Загрузить 2M / 4M`.
Она доступна только при запуске через `npm run dev` и заполняет source Oracle
до **2 000 000 users** и **4 000 000 orders**:

- target-схема не затрагивается;
- данные догружаются батчами, повторный запуск идемпотентен;
- скрипт занимает около 1–2 минут и требует запущенный Docker-контейнер Oracle;
- в production/preview кнопка и dev-endpoint отсутствуют.

Механика: Vite dev-server предоставляет `POST /__dev/seed-large-oracle`,
который запускает `../scripts/seed-large-oracle.ps1`. Endpoint принимает только
запросы с localhost и заголовком `X-Demo-Seed: SEED`; операция подтверждается
в модальном окне словом `SEED`. Java-модули не меняются.

Таймаут 15 минут и обрыв запроса (перезагрузка или закрытие вкладки)
останавливают seed целиком: на Windows снимается всё дерево процессов
`powershell.exe → docker.exe` через `taskkill /T`, а затем внутри контейнера
завершается sqlplus-сессия, читающая `seed-large-oracle.sql`. Поэтому после
остановки повторный запуск не блокируется; `409` означает, что предыдущая
загрузка ещё выполняется или завершает очистку.

Скрипт можно запустить и без UI:

```powershell
.\scripts\seed-large-oracle.ps1
```

Он требует, чтобы `module-oracle` уже создал таблицы через Liquibase.

## Проверки

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Тесты покрывают DTO-каталог и коды ответов, архитектурные данные, сниппеты,
simulation engine, API-клиент (алиасы, 409/503, не-JSON ответ), auto-fallback
и очистку polling-таймеров.
