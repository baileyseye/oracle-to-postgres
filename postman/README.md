# Postman: проверка миграции Oracle → PostgreSQL

## Предусловия

1. Docker Desktop запущен, контейнеры healthy:

   ```powershell
   docker compose up -d --wait
   ```

2. Запущены три приложения:

   - `module-oracle` — http://localhost:8081
   - `module-postgres` — http://localhost:8082
   - `module-migration` — http://localhost:8083

3. Для эталонного прогона базы должны быть чистыми:

   ```powershell
   docker compose down -v
   docker compose up -d --wait
   ```

   После очистки БД приложения нужно запустить заново, чтобы Liquibase создал схемы,
   включая `migration_entity_map`.

## Импорт

1. Postman → **Import** → файл `postman/oracle-to-postgres.postman_collection.json`.
2. Postman → **Environments** → **Import** → файл `postman/local.postman_environment.json`.
3. Выбери окружение `Oracle to Postgres - local`.

Адреса также заданы переменными коллекции, поэтому окружение опционально.

### Schema migration (`module-schema-migration`, порт 8084)

Для нового модуля есть отдельная коллекция:

1. **Import** → `postman/schema-migration.postman_collection.json`.
2. **Environments** → **Import** → `postman/schema-migration.local.postman_environment.json`.
3. Запусти коллекцию `Oracle → PostgreSQL: schema migration`.

Она проверяет:

- health schema-модуля;
- `GET /status` до apply;
- `GET /preview` — DDL не пустой;
- `POST /apply` — схема создана;
- `GET /status` после apply — `valid=true`;
- повторный `POST /apply` — идемпотентность;
- финальный `GET /status`.

Ожидаемо: **7 запросов, 25 assertions, 0 failed**.

Чтобы проверить создание схемы с нуля, удали её и запусти коллекцию:

```powershell
docker exec oracle-to-postgres-postgres psql -U postgres -d oracletopostgres `
  -c "DROP SCHEMA IF EXISTS auto_migration CASCADE;"
```

После `apply` схема `auto_migration` будет создана заново.

Для end-to-end data migration в `auto_migration` запусти data-модуль с:

```powershell
$env:TARGET_POSTGRES_SCHEMA='auto_migration'
```

и отдельным портом, например `--server.port=8086`. Затем используй основную data-коллекцию,
заменив `migrationBaseUrl` на `http://localhost:8086`.

## Запуск

Вариант 1 — вручную: открывай папки по порядку и нажимай **Send**.

Вариант 2 — автоматически: выдели коллекцию → **Run** → **Run Oracle → PostgreSQL: migration check**.

Папки:

| Папка | Что проверяет |
|---|---|
| `0. Health` | все три приложения отвечают `UP` |
| `1. Состояние до миграции` | seed-данные, метаданные Oracle, read-only API, 404 |
| `2. Миграция и проверка` | перенос users/orders, пересчёт FK, managed-счётчики |
| `3. Идемпотентность` | повторный запуск не создаёт дубликаты и ничего не удаляет |
| `4. Обновление данных из Oracle` | изменения в Oracle доезжают до PostgreSQL |
| `5. Schema diff` | таблицы, колонки и индексы Oracle присутствуют в PostgreSQL |

## Ожидаемые значения для чистой БД

До миграции:

- Oracle: `users = 2`, `orders = 4`;
- PostgreSQL: `users = 2` (`postgres_admin`, `postgres_reader`), `orders = 0`;
- migration status:
  `sourceUsers=2`, `targetUsers=2`, `targetManagedUsers=0`,
  `sourceOrders=4`, `targetOrders=0`, `targetManagedOrders=0`.

После миграции:

- в PostgreSQL появляются `oracle_admin`, `oracle_reader` с новыми id (`3`, `4`);
- `orders = 4`, все заказы ссылаются на id `3` или `4`;
- migration status:
  `targetUsers=4` (2 seed + 2 перенесённых),
  `targetManagedUsers=2`,
  `targetOrders=4`, `targetManagedOrders=4`;
- `migration_entity_map` содержит 2 записи `USER` и 4 записи `ORDER`.

Повторный запуск:

- `usersInserted = 0`, `ordersInserted = 0`, `usersDeleted = 0`, `ordersDeleted = 0`;
- `usersUpdated = 2`, `ordersUpdated = 4`;
- количество строк и target id не меняются.

## Schema diff

Запрос `GET /api/v1/migration/schema/diff` сравнивает Oracle и PostgreSQL через
`DatabaseMetaData`. На чистой согласованной схеме ожидается:

```json
{
  "checkedTables": 3,
  "missingTables": 0,
  "missingColumns": 0,
  "missingIndexes": 0,
  "errors": 0,
  "warnings": 0,
  "infos": 1,
  "valid": true
}
```

Сравниваются таблицы, колонки, типы, nullable, defaults, identity, PK, FK,
unique/индексы и CHECK-constraints. Имена constraints и индексов не сравниваются.
`infos` может быть больше нуля: например, диалектное CHECK-выражение Oracle и PostgreSQL
требует ручного review, но не блокирует validation.

## Зеркальная семантика

Мигратор хранит соответствие `source_id → target_id` в `migration_entity_map`, поэтому:

- смена `username` или `order_number` в Oracle обновляет ту же строку PostgreSQL,
  а не создаёт новую;
- удаление строки в Oracle удаляет соответствующую строку в PostgreSQL;
- нативные строки PostgreSQL (`postgres_admin`, `postgres_reader`) не имеют записи
  в карте и сохраняются.

Зеркалится только множество строк, которыми управляет мигратор. Полное стирание
нативных строк приёмника не выполняется намеренно.

## Read-only эндпоинт `/rows`

`GET /api/v1/migration/tables/{table}/rows` нормализует Oracle `TIMESTAMP`, `DATE`,
`CLOB` и `BLOB` в обычные Java-типы. Даты отдаются в ISO-формате, а не в виде
объекта `{"bytes": "...", "length": 11}`.
