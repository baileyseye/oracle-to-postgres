# oracle-to-postgres

Демонстрационный проект: **два независимых Spring Boot приложения** с идентичной структурой слоёв и
одинаковой бизнес-логикой (CRUD над `User` и `Order`), но разными СУБД — **Oracle** и **PostgreSQL**.
Четвёртый модуль — schema migration, который строит PostgreSQL-схему по Oracle. Третий —
data migration, который переносит данные в уже готовую схему.

Смысл проекта — сравнить поведение одного и того же JPA-кода на двух диалектах при полностью
разделённых схемах, конфигурациях и Liquibase-миграциях, а затем выполнить реальный перенос
схемы и данных. Есть два режима target:

- **Liquibase-owned**: схему `public` создаёт `module-postgres`;
- **schema-migration-owned**: схему `auto_migration` создаёт `module-schema-migration`.

Режим переноса данных выбирается env `MIGRATION_MODE`:

- `initial-load` (**по умолчанию**) — миграция с остановкой окружения: `COPY`, сохранение
  source id, чанковые коммиты, без upsert и stale-логики;
- `mirror` — альтернатива для зеркальной синхронизации без остановки по `migration_entity_map`,
  с upsert/adoption/stale.

> ⚠️ **Этот файл — карта проекта для разработчиков и ИИ-агентов.** Если вы меняете структуру,
> обновите карту в том же коммите.

---

## 1. Стек

| Компонент | Версия / решение |
|---|---|
| Java | 25 (toolchain `JavaLanguageVersion.of(25)` — задан в каждом модуле) |
| Spring Boot | 4.1.2 (в корне, `apply false`) |
| `io.spring.dependency-management` | 1.1.7 (в корне, `apply false`) |
| Spring Framework | 7.x — Web MVC, не WebFlux; стартер `spring-boot-starter-webmvc` (в SB4 он называется именно так, `spring-boot-starter-web` не используется) |
| Hibernate ORM, Liquibase, Lombok | версии **из BOM Spring Boot**, в `build.gradle.kts` явно не заданы |
| Сборка | Gradle 9.8.2 (`gradle/wrapper/gradle-wrapper.properties`), Kotlin DSL |
| Миграции | Liquibase, XML changelog, стартер `spring-boot-starter-liquibase` |
| Маппинг | MapStruct 1.6.3 (явная версия) + `lombok-mapstruct-binding:0.2.0` |
| AOP (`module-migration`) | `org.aspectj:aspectjweaver` без версии — из BOM |
| Драйверы | `com.oracle.database.jdbc:ojdbc17` (`runtimeOnly`); `org.postgresql:postgresql` (`implementation` в `module-migration` — нужен `CopyManager`) |

---

## 2. Карта верхнего уровня

```
oracle-to-postgres/
├── settings.gradle.kts          # include oracle, postgres, migration, schema-migration
├── build.gradle.kts             # только общие group/version/repositories; плагины apply false
├── gradle/wrapper/              # Gradle 9.8.2
├── docker-compose.yaml          # gvenzl/oracle-free:23-slim (1521) + postgres:17-alpine (5432)
├── module-frontend/             # standalone React 19 + Vite витрина и LIVE-панель
│
├── KODA.md                      # ПРАВИЛА КОДА — читать перед любой правкой (.gitignore)
├── LIQUIBASE-ARCHITECTURE.md    # ПРАВИЛА МИГРАЦИЙ — читать перед любой миграцией (.gitignore)
├── README.md                    # этот файл (карта проекта)
│
├── module-oracle/               # SOURCE (legacy), порт 8081, префикс /api/v1/oracle
├── module-postgres/             # TARGET (новая система), порт 8082, префикс /api/v1/postgres
├── module-migration/            # DATA MIGRATION, порт 8083, префикс /api/v1/migration
└── module-schema-migration/     # SCHEMA MIGRATION, порт 8084, префикс /api/v1/schema-migration
```

**Корневого `src/` нет.** Точки входа живут внутри модулей. Не ищите `OracleToPostgresApplication` —
он удалён при переходе на мультимодульную сборку (в git-индексе ещё числится как удалённый,
физического файла нет). `HELP.md` существует в корне, это артефакт Spring Initializr (см. раздел 11).

### 2.1 Семантическая модель: кто есть кто

| Модуль | Роль в миграции | Данные | Порт |
|---|---|---|---|
| `module-oracle` | **SOURCE** — старая система | есть: `users`, `orders` (4 строки), `insurance_program_users` (10 строк) | 8081 |
| `module-postgres` | **TARGET** — новая система, схему создаёт Liquibase | `public`; `orders` пуста до миграции, `insurance_program_users` не переносится | 8082 |
| `module-migration` | **DATA MIGRATION** — читает Oracle и пишет в уже готовую PostgreSQL-схему | своих данных нет; требует готовые таблицы и `migration_entity_map` | 8083 |
| `module-schema-migration` | **SCHEMA MIGRATION** — читает Oracle и создаёт PostgreSQL-схему с нуля | `auto_migration` | 8084 |

**Политика ownership:**

- схема `public` принадлежит Liquibase `module-postgres`;
- схема `auto_migration` принадлежит `module-schema-migration`;
- `module-migration` **не создаёт** таблицы и не владеет схемой: он только переносит данные
  и работает с тем target-схемой, которую ему указали через `TARGET_POSTGRES_SCHEMA`;
- `module-schema-migration` дополнительно создаёт служебную `migration_entity_map`, чтобы data-модуль
  мог работать с новой схемой без Liquibase.

Направление: **Oracle → PostgreSQL**.


---

## 3. Карта модуля (структура идентична в обоих CRUD-модулях)

Ниже — карта для `module-oracle`. В `module-postgres` всё то же самое, только
`oracle` → `postgres` в пакетах и именах классов-исключений.

```
module-oracle/
├── build.gradle.kts
└── src/main/
    ├── java/baileyseyes/oracletopostgres/oracle/
    │   │
    │   ├── OracleModuleApplication.java        ← @SpringBootApplication, main()
    │   │
    │   ├── common/exception/                   ← сквозная обработка ошибок
    │   │   ├── OracleModuleException.java      ← базовое RuntimeException модуля
    │   │   ├── UserNotFoundException.java      ← 404, пользователь не найден
    │   │   ├── DuplicateUserException.java     ← 409, конфликт username/email
    │   │   ├── OrderNotFoundException.java     ← 404, заказ не найден
    │   │   ├── DuplicateOrderException.java    ← 409, конфликт order_number
    │   │   └── OracleGlobalExceptionHandler.java ← @RestControllerAdvice, единый JSON ошибок
    │   │
    │   ├── user/                               ← вертикальный срез фичи "пользователи"
    │   │   ├── entity/UserEntity.java          ← @Entity, таблица users
    │   │   ├── repository/UserRepository.java  ← JpaRepository + existsBy*/findBy*
    │   │   ├── dto/UserRequestDto.java         ← вход, jakarta.validation
    │   │   ├── dto/UserResponseDto.java        ← выход, audit-поля
    │   │   ├── mapper/UserMapper.java          ← MapStruct, @Mapper(SPRING)
    │   │   ├── service/UserService.java        ← @Service, БЕЗ интерфейса, CRUD
    │   │   └── controller/UserController.java  ← @RestController, /api/v1/oracle
    │   │
    │   └── order/                              ← вертикальный срез фичи "заказы"
    │       ├── entity/OrderEntity.java         ← @Entity, таблица orders, @ManyToOne → users
    │       ├── entity/OrderStatus.java         ← enum NEW/PAID/SHIPPED/CANCELLED
    │       ├── repository/OrderRepository.java ← JpaRepository + findByOrderNumber
    │       ├── dto/OrderRequestDto.java        ← вход, jakarta.validation
    │       ├── dto/OrderResponseDto.java       ← выход + userId/username
    │       ├── mapper/OrderMapper.java         ← MapStruct, user → userId/username
    │       ├── service/OrderService.java       ← @Service, CRUD + проверка пользователя
    │       └── controller/OrderController.java ← @RestController, /api/v1/oracle
    │
    └── resources/
        ├── application.yaml                    ← datasource, dialect, ddl-auto=validate, liquibase
        └── db/changelog/                       ← см. раздел 6
```

### 3.1 Назначение каждого файла

| Файл | Роль | Когда править |
|---|---|---|
| `XModuleApplication` | точка входа, component scan от пакета модуля | никогда (кроме новых `@Enable*`) |
| `entity/UserEntity` | маппинг на таблицу `users`; поля `id, username, email, createdAt, updatedAt` | при изменении схемы (одновременно с миграцией!) |
| `repository/UserRepository` | Spring Data JPA, `Long` — тип PK | при новых запросах |
| `dto/UserRequestDto` | тело POST/PUT + валидация | при изменении контракта API |
| `dto/UserResponseDto` | тело ответа | при изменении контракта API |
| `mapper/UserMapper` | DTO ↔ Entity, **явные `@Mapping` для всех полей** | при добавлении поля в DTO/Entity |
| `service/UserService` | бизнес-логика, `@Transactional` **на методах** | при новой бизнес-логике |
| `controller/UserController` | REST, Javadoc-примеры для Postman | при новом эндпоинте |
| `entity/OrderEntity` + `OrderStatus` | таблица `orders`, `@ManyToOne` → `users`, enum-статус | при изменении схемы заказов |
| `dto/Order*` + `mapper/OrderMapper` | контракт заказа; `user` разворачивается в `userId`/`username` | при изменении контракта |
| `service/OrderService` | CRUD заказов + проверка существования пользователя | при новой бизнес-логике заказов |
| `controller/OrderController` | REST заказов, Javadoc-примеры | при новом эндпоинте заказов |
| `common/exception/*` | кастомные исключения + `@RestControllerAdvice` | при новом типе ошибки |
| `application.yaml` | подключение к СУБД, порт, Liquibase | при смене настроек подключения |

### 3.2 Карта `module-migration` (структура отличается от CRUD-модулей)

Модуль **не использует JPA**: только `JdbcTemplate`, `DatabaseMetaData` и два `DataSource`.

```
module-migration/
├── build.gradle.kts
└── src/main/
    ├── java/baileyseyes/oracletopostgres/migration/
    │   │
    │   ├── MigrationModuleApplication.java      ← @SpringBootApplication + @ConfigurationPropertiesScan
    │   │
    │   ├── common/
    │   │   ├── aspect/LoggingAspect.java        ← @Aspect: контроллеры и сервисы миграции
    │   │   ├── support/
    │   │   │   ├── CheckConstraintMetadata.java  ← CHECK-constraint: имя + выражение
    │   │   │   ├── ColumnMetadata.java           ← тип, размер, nullable, default, identity
    │   │   │   ├── ForeignKeyMetadata.java       ← колонки, ссылка и ON UPDATE/DELETE
    │   │   │   ├── IndexMetadata.java            ← описание индекса: уникальность + колонки
    │   │   │   ├── IndexMetadataReader.java      ← чтение индексов через DatabaseMetaData
    │   │   │   ├── JdbcTableMetadataReader.java  ← колонки, PK и FK через DatabaseMetaData
    │   │   │   ├── MigrationEntity.java          ← тип сущности: USER / ORDER
    │   │   │   ├── PrimaryKeyMetadata.java       ← имя и состав колонок PK
    │   │   │   ├── RowValues.java                ← извлечение колонок Oracle без учёта регистра
    │   │   │   └── SourceRowMapper.java          ← Oracle row → UserRow/OrderRow вне AOP-логирования
    │   │   └── exception/
    │   │       ├── MigrationException.java      ← базовое RuntimeException модуля
    │   │       ├── TableNotFoundException.java  ← 404, таблицы нет в метаданных
    │   │       ├── SourceAccessException.java   ← 503, источник недоступен
    │   │       ├── TargetAccessException.java   ← 503, приёмник недоступен
    │   │       ├── MigrationConflictException.java ← 409, конфликт данных в приёмнике
    │   │       └── MigrationGlobalExceptionHandler.java ← @RestControllerAdvice
    │   │
    │   ├── controller/MigrationController.java  ← чтение источника + /run + /status
    │   ├── dto/
    │   │   ├── MigrationReport.java             ← режим, counts, validation, generic tables
    │   │   ├── MigrationStatus.java             ← COUNT(*) и количество управляемых строк
    │   │   ├── SchemaDiffReport.java            ← итог сравнения: errors/warnings/infos
    │   │   ├── SchemaIssue.java                 ← одно расхождение с severity
    │   │   └── TableDiff.java                   ← расхождения по одной таблице
    │   │
    │   ├── service/                             ← бизнес-логика переноса
    │   │   ├── MigrationMode.java               ← MIRROR / INITIAL_LOAD
    │   │   ├── MigrationRunService.java         ← выбор режима через @Value migration.mode
    │   │   ├── UserMigrationService.java        ← mirror users: keyset-чанки + stale
    │   │   ├── OrderMigrationService.java       ← mirror orders: FK через карту в PostgreSQL
    │   │   ├── MigrationOrchestrationService.java ← mirror: lock → users → orders → cleanup
    │   │   ├── InitialLoadMigrationService.java ← initial-load: users/orders + generic tables
    │   │   ├── InitialLoadProperties.java       ← chunk/LOB/retry, truncate/resume, mapping
    │   │   ├── InitialLoadSourceGuard.java      ← v$session idle-check + SCN
    │   │   ├── InitialLoadScriptRunner.java     ← pre/post SQL
    │   │   ├── InitialLoadValidationService.java ← validation users/orders
    │   │   ├── GenericInitialLoadService.java   ← generic COPY-загрузка остальных таблиц
    │   │   ├── GenericInitialLoadValidationService.java ← агрегаты и orphan-FK
    │   │   ├── ChunkRetryExecutor.java          ← retry/backoff COPY-чанков
    │   │   ├── MigrationJobManager.java         ← async jobs, progress, cancel
    │   │   ├── MigrationStatisticsService.java  ← COUNT(*) в Oracle и PostgreSQL
    │   │   ├── SchemaDiffService.java           ← сравнение таблиц, колонок, PK/FK, индексов, CHECK
    │   │   ├── SchemaTypeCompatibility.java     ← Oracle→PostgreSQL type compatibility
    │   │   ├── SchemaValidationProperties.java  ← fail-on-warnings, check comparison
    │   │   ├── plan/                            ← plan builder, InitialLoadTablePlan, CSV formatter
    │   │   ├── row/                             ← UserRow / OrderRow: одна строка чанка
    │   │   └── result/                          ← record-результаты шагов
    │   │
    │   ├── source/                              ← слой доступа к источнику (Oracle)
    │   │   ├── config/
    │   │   │   ├── MigrationSourceProperties.java ← @ConfigurationProperties("migration.source")
    │   │   │   ├── SourceDataSourceProperties.java ← @ConfigurationProperties("spring.datasource")
    │   │   │   └── SourceDataSourceConfig.java  ← @Primary sourceDataSource + sourceJdbcTemplate
    │   │   ├── contract/
    │   │   │   ├── MetadataProvider.java        ← listTables, listColumns, listIndexes, qualifiedTableName
    │   │   │   └── RowReader.java               ← readRows, readRowsAfter (keyset), forEachRow
    │   │   ├── oracle/
    │   │   │   ├── OracleMetadataProvider.java  ← DatabaseMetaData + схема + wildcard-исключения
    │   │   │   └── OracleRowReader.java         ← keyset-страницы, ROWNUM, нормализация JDBC-типов
    │   │   └── service/MigrationSourceService.java ← оркестрация read-only эндпоинтов
    │   │
    │   └── target/                              ← слой записи в PostgreSQL
    │       ├── config/
    │       │   ├── MigrationTargetProperties.java ← @ConfigurationProperties("migration.target")
    │       │   └── TargetDataSourceConfig.java  ← targetDataSource, targetJdbcTemplate, targetTransactionManager
    │       └── service/
    │           ├── ChunkResult.java             ← inserted/updated одного чанка
    │           ├── PostgresChunkGateway.java    ← mirror: staging + set-based upsert/adoption/stale
    │           ├── InitialLoadTargetGateway.java ← initial-load users/orders: COPY, identity
    │           ├── GenericInitialLoadTargetGateway.java ← generic COPY, sequences
    │           └── PostgresTargetGateway.java   ← метаданные, таблицы, advisory lock, счётчики
    │
    └── resources/application.yaml               ← два datasource, migration.source.*, migration.target.*
```

**Ключевая идея расширения источника:** контроллер зависит **только** от `MetadataProvider` / `RowReader`.
Новая СУБД-источник = новый пакет `source/<db>/` с двумя реализациями, контроллер и сервис не меняются.

**Поток запроса чтения:**

```
HTTP
 ▼
MigrationController              /api/v1/migration
 ▼
MigrationSourceService           row-limit из MigrationSourceProperties
 ▼
MetadataProvider / RowReader     ← интерфейсы-контракты
 ▼
OracleMetadataProvider           DatabaseMetaData + схема источника
OracleRowReader                  SELECT * FROM "SCHEMA"."TABLE" WHERE ROWNUM <= ?
 ▼
Oracle (SOURCE)
```

**Поток зеркальной миграции:**

```
POST /api/v1/migration/run
 ▼
MigrationController
 ▼
MigrationOrchestrationService    @Transactional("targetTransactionManager")
 ├─ advisory xact lock           защита от параллельных запусков
 ├─ runId = txid_current()       идентификатор запуска для last_seen_run
 ├─ UserMigrationService         keyset-страницы users по id
 │    ├─ OracleRowReader         WHERE id > ? ORDER BY id, ROWNUM <= chunk-size
 │    ├─ temp staging users      batch INSERT только текущего чанка
 │    └─ set-based SQL           update mapped / adopt by username / insert new / mark seen
 ├─ OrderMigrationService        keyset-страницы orders по id
 │    ├─ temp staging orders     batch INSERT только текущего чанка
 │    └─ set-based SQL           user_id через join с migration_entity_map
 └─ UserMigrationService         DELETE ... WHERE last_seen_run <> runId
 ▼
PostgresChunkGateway             память ограничена одним чанком
```

**Память:** источник читается страницами (`migration.source.chunk-size`, по умолчанию 5000),
и каждая страница сразу уходит в PostgreSQL. В Java нет карт на всю таблицу; сопоставление
`source_id → target_id`, adoption по `username`/`order_number` и поиск stale-строк выполняются
SQL в приёмнике. Поэтому heap не зависит от числа записей в Oracle.

**Зеркальность:** для каждого типа сущности хранится соответствие `source_id → target_id`
в таблице `migration_entity_map` (создаёт Liquibase модуля `module-postgres`). Колонка
`last_seen_run` фиксирует, что строка встретилась в текущем запуске. Поэтому:

- при смене `username` или `order_number` обновляется **та же** целевая строка;
- строки, удалённые из Oracle, удаляются из PostgreSQL;
- заказы удаляются раньше пользователей, чтобы не нарушить FK;
- нативные строки PostgreSQL, которых нет в Oracle (например, `postgres_admin`/`postgres_reader`),
  не имеют записи в `migration_entity_map` и не затрагиваются.

**Идемпотентность:** повторный `/run` обновляет управляемые строки и не создаёт дубликаты.
В mirror-режиме исходные id Oracle в PostgreSQL не копируются — они хранятся только
в `migration_entity_map`. Все записи приёмника выполняются в одной транзакции: ошибка
на любом шаге откатывает весь перенос. Параллельный `/run` отклоняется advisory-блокировкой (409).

**Поток initial-load (`MIGRATION_MODE=initial-load`):**

```
POST /api/v1/migration/run
 ▼
MigrationController
 ▼
MigrationRunService              @Value("${migration.mode}")
 ▼
InitialLoadMigrationService
 ├─ planBuilder                 таблицы/колонки/PK, FK-порядок
 ├─ sourceGuard                 v$session idle-check + SCN
 ├─ pre-load.sql                опционально снять unique/FK
 ├─ users                       keyset-чанки → COPY (id сохраняется)
 ├─ orders                      keyset-чанки → COPY (id и user_id сохраняются)
 ├─ generic tables              keyset или stream → COPY (LOB-aware chunk)
 ├─ restartSequences            identity + nextval для всех таблиц
 ├─ populateMapping (optional)  source_id = target_id
 ├─ post-load.sql               вернуть unique/FK
 └─ validation                  агрегаты, null, orphan-FK, sequences
 ▼
InitialLoadTargetGateway / GenericInitialLoadTargetGateway
```

`initial-load` не использует upsert, adoption и stale-логику: target должен быть пустым,
очищенным через `truncate-target=true` или продолжаться с `resume=true`. Каждый чанк
коммитится отдельно, поэтому падение не откатывает уже загруженные данные, а повтор
продолжается с `MAX(id)`.

`MAX(id)` — это checkpoint **внутри одного initial-load**, а не требование постоянно
держать target пустым. После успешной загрузки target полный, и приложение работает с ним.
Пустым он должен быть только перед первым запуском загрузки (или его очищают явно
через `truncate-target=true`). Если загрузка упала на середине, `MAX(id)` показывает,
докуда дошли, и `resume=true` продолжает с этого места. Полноценная job/range-таблица
понадобится только для параллельных воркеров или нескольких инстансов.

Перед загрузкой проверяется, что в Oracle нет активных сессий в схеме источника
(`require-source-idle`), и фиксируется SCN (`capture-source-scn`). После загрузки
выполняется validation: counts, min/max/sum, длины строк, null-поля, orphan-FK и
sequence/identity. При расхождении job получает `FAILED`, а приложение нельзя открывать.

**Generic-таблицы:** `initial-load.include-tables` задаёт список source-таблиц для
generic-загрузки (пусто = все, кроме users/orders и `excluded-tables`). Колонки
сопоставляются по имени; `table-mapping` и `column-mapping` позволяют переименовать
таблицу/колонку. Для одиночного numeric PK используется keyset и resume по `MAX(id)`,
для остальных таблиц — потоковое чтение без resume. Таблицы с CLOB/BLOB читаются
чанком `lob-chunk-size` (по умолчанию 10), чтобы не держать большие LOB в памяти.
COPY-чанки ретраятся при transient SQLState 08/40/53 с exponential backoff.

**Защита от SQL-инъекций:** имя таблицы из path-параметра проходит через
`qualifiedTableName()`, который сверяет его со списком из `DatabaseMetaData`, добавляет схему
и экранирует имена. При промахе — `TableNotFoundException` (404) и `WARN` в лог.
Имена таблиц приёмника фиксированы в коде, схема приходит из конфигурации и экранируется.

**Слои логирования:** `LoggingAspect` покрывает pointcut'ы `controller..*`, `source.service..*`
и `service..*`. `INFO` — успешное завершение с длительностью, `DEBUG` — только типы аргументов
и результатов (без значений, чтобы не писать в лог персональные данные), `WARN` — исключения.

### 3.3 Карта `module-schema-migration`

Модуль **не использует JPA и Liquibase**: он читает Oracle через JDBC, генерирует PostgreSQL DDL
и применяет его через `JdbcTemplate` в target-транзакции.

```
module-schema-migration/
└── src/main/
    ├── java/baileyseyes/oracletopostgres/schema/
    │   ├── SchemaMigrationModuleApplication.java
    │   ├── common/exception/                 ← 503 source/target, 500 schema error
    │   ├── controller/SchemaMigrationController.java
    │   ├── dto/
    │   │   ├── SchemaMigrationPlan.java      ← DDL + warnings + unsupported
    │   │   ├── SchemaMigrationReport.java    ← результат apply
    │   │   ├── SchemaMigrationStatus.java    ← target tables/columns
    │   │   └── SchemaDdlStatement.java
    │   ├── model/                            ← Oracle table/column/PK/FK/index/check/sequence
    │   ├── source/
    │   │   ├── config/                       ← Oracle DataSource
    │   │   └── oracle/OracleSchemaReader.java
    │   ├── generator/
    │   │   ├── PostgresTypeMapper.java       ← Oracle→PostgreSQL types/defaults
    │   │   └── PostgresDdlGenerator.java     ← CREATE/ALTER/INDEX/COMMENT DDL
    │   ├── target/
    │   │   ├── config/                       ← PostgreSQL DataSource + transaction manager
    │   │   └── service/                      ← target snapshot + DDL applier
    │   └── service/SchemaMigrationService.java
    └── resources/application.yaml            ← port 8084, target schema auto_migration
```

**Поток schema migration:**

```
GET  /preview → OracleSchemaReader → PostgresDdlGenerator → SchemaMigrationPlan (DDL, без apply)
POST /apply   → preview → PostgresSchemaApplier → DDL в одной target-транзакции
GET  /status  → source schema vs target snapshot → missing tables/columns
```

**Что переносится автоматически:** таблицы, колонки, типы, defaults, identity, PK, unique,
FK, ordinary indexes, CHECK-constraints (простые выражения), комментарии и пользовательские sequences.
Для sequences используется Oracle `LAST_NUMBER` как `START WITH`.

**Fidelity warnings:** `NUMBER(1) → BOOLEAN`, BYTE-семантика `VARCHAR2/CHAR`, потеря
timezone-семантики `TIMESTAMP WITH LOCAL TIME ZONE`, точность timestamp больше 6,
`LONG/INTERVAL/JSON`, а также Oracle-специфичные CHECK/default-выражения. Такие места
попадают в warnings и требуют review, а не молча переносятся.

**Что не переносится автоматически и попадает в `unsupportedObjects`/warnings:** views, triggers,
PL/SQL (procedures/functions/packages/types), synonyms, grants/roles, partitioning, tablespaces.
Для production эти объекты требуют отдельного решения или ручного review.

**Drift:** для уже существующих таблиц модуль добавляет только отсутствующие колонки (nullable)
и не меняет типы/constraints автоматически. Остальной drift нужно разбирать вручную после
`GET /status`/schema validator.

---

## 4. Поток запроса (сквозной срез)

```
HTTP
 │
 ▼
UserController            @RestController, @RequestMapping("/api/v1/oracle")
 │  @Valid @RequestBody UserRequestDto        ← jakarta.validation
 ▼
UserService               @Service, @Transactional на методах
 │  ├─ validateUnique()   → DuplicateUserException (409)
 │  └─ findEntity()       → UserNotFoundException (404)
 ▼
UserMapper (MapStruct)    toEntity / toResponseDto, реализация генерируется в build/generated
 ▼
UserRepository            JpaRepository<UserEntity, Long>
 ▼
Hibernate (OracleDialect / PostgreSQLDialect)
 ▼
Oracle / PostgreSQL       схема создаётся ТОЛЬКО Liquibase, ddl-auto=validate
```

Срез заказов устроен так же: `OrderController → OrderService → OrderMapper → OrderRepository`,
дополнительно проверяется существование пользователя (`UserNotFoundException`, 404) и уникальность
`order_number` (`DuplicateOrderException`, 409).

Ошибки перехватывает `XGlobalExceptionHandler` и отдаёт JSON:

```json
{
  "timestamp": "2026-11-02T19:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Пользователь с идентификатором 5 не найден"
}
```

Для ошибок валидации добавляется блок `errors: { "поле": "сообщение" }` и статус 400.

---

## 5. REST API

### 5.1 CRUD-модули (`module-oracle` / `module-postgres`)

Оба модуля предоставляют одинаковый набор эндпоинтов. Отличается только префикс и порт.

| Метод | Oracle (8081) | PostgreSQL (8082) | Успех |
|---|---|---|---|
| POST | `/api/v1/oracle/users` | `/api/v1/postgres/users` | 201 + тело |
| GET | `/api/v1/oracle/users/{id}` | `/api/v1/postgres/users/{id}` | 200 / 404 |
| GET | `/api/v1/oracle/get-users` | `/api/v1/postgres/get-users` | 200 + `Page` |
| PUT | `/api/v1/oracle/users/{id}` | `/api/v1/postgres/users/{id}` | 200 / 404 / 409 |
| DELETE | `/api/v1/oracle/users/{id}` | `/api/v1/postgres/users/{id}` | 204 / 404 |

`get-users` поддерживает `page`, `size`, `sort` (по умолчанию `size=20`, `sort=id`).

Заказы (`orders`) повторяют тот же набор операций. В ответе есть `userId` и `username` владельца.

| Метод | Oracle (8081) | PostgreSQL (8082) | Успех |
|---|---|---|---|
| POST | `/api/v1/oracle/orders` | `/api/v1/postgres/orders` | 201 + тело |
| GET | `/api/v1/oracle/orders/{id}` | `/api/v1/postgres/orders/{id}` | 200 / 404 |
| GET | `/api/v1/oracle/get-orders` | `/api/v1/postgres/get-orders` | 200 + `Page` |
| PUT | `/api/v1/oracle/orders/{id}` | `/api/v1/postgres/orders/{id}` | 200 / 404 / 409 |
| DELETE | `/api/v1/oracle/orders/{id}` | `/api/v1/postgres/orders/{id}` | 204 / 404 |

`get-orders` дополнительно принимает `userId` для фильтрации по владельцу.

```bash
# создание пользователя
curl -X POST http://localhost:8081/api/v1/oracle/users \
  -H "Content-Type: application/json" \
  -d '{"username":"ivan_petrov","email":"ivan.petrov@example.com"}'

# список с пагинацией
curl "http://localhost:8082/api/v1/postgres/get-users?page=0&size=20&sort=id,desc"

# обновление
curl -X PUT http://localhost:8081/api/v1/oracle/users/1 \
  -H "Content-Type: application/json" \
  -d '{"username":"ivan_updated","email":"ivan.updated@example.com"}'

# удаление
curl -X DELETE http://localhost:8082/api/v1/postgres/users/1

# создание заказа
curl -X POST http://localhost:8081/api/v1/oracle/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"orderNumber":"ORD-ORACLE-2001","amount":1499.90,"status":"NEW"}'

# заказы пользователя
curl "http://localhost:8082/api/v1/postgres/get-orders?userId=3&page=0&size=20&sort=id,desc"
```

### 5.2 Сервис миграции (`module-migration`, порт 8083)

Читает Oracle-источник и записывает в PostgreSQL-приёмник. Префикс `/api/v1/migration`.

| Метод | Путь | Выход |
|---|---|---|
| GET | `/api/v1/migration/tables` | `String[]` — таблицы схемы источника (системные и Liquibase исключены) |
| GET | `/api/v1/migration/tables/{tableName}/columns` | `String[]` — колонки таблицы из `DatabaseMetaData` |
| GET | `/api/v1/migration/tables/{tableName}/rows` | `List<Map<String,Object>>` — `SELECT *` с лимитом из конфига |
| POST | `/api/v1/migration/run` | синхронный `MigrationReport` |
| POST | `/api/v1/migration/run/async` | `202 + MigrationJobResponse` — фоновый запуск |
| GET | `/api/v1/migration/run/{jobId}` | `MigrationJobResponse` — статус, progress, отчёт |
| POST | `/api/v1/migration/run/{jobId}/cancel` | отмена initial-load между чанками |
| GET | `/api/v1/migration/status` | `MigrationStatus` — `COUNT(*)` и число управляемых строк |
| GET | `/api/v1/migration/schema/diff` | `SchemaDiffReport` — таблицы, колонки, типы, PK/FK, индексы, CHECK |

```bash
# 1. список таблиц источника
curl "http://localhost:8083/api/v1/migration/tables"

# 2. колонки конкретной таблицы
curl "http://localhost:8083/api/v1/migration/tables/insurance_program_users/columns"

# 3. первые N строк (N = migration.source.row-limit, по умолчанию 100)
curl "http://localhost:8083/api/v1/migration/tables/insurance_program_users/rows"

# 4. сравнить количество строк до миграции
curl "http://localhost:8083/api/v1/migration/status"

# 5. сравнить схему Oracle и PostgreSQL
curl "http://localhost:8083/api/v1/migration/schema/diff"

# 6. запустить перенос в режиме из MIGRATION_MODE (по умолчанию initial-load)
curl -X POST "http://localhost:8083/api/v1/migration/run"

# 7. миграция с остановкой окружения
MIGRATION_MODE=initial-load \
  MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET=true \
  java -jar module-migration/build/libs/module-migration-0.0.1-SNAPSHOT.jar
curl -X POST "http://localhost:8083/api/v1/migration/run"

# 8. альтернатива без остановки — зеркальная синхронизация
MIGRATION_MODE=mirror java -jar module-migration/build/libs/module-migration-0.0.1-SNAPSHOT.jar
curl -X POST "http://localhost:8083/api/v1/migration/run"

# 9. длинная initial-load через async job
curl -X POST "http://localhost:8083/api/v1/migration/run/async"
curl "http://localhost:8083/api/v1/migration/run/{jobId}"
curl -X POST "http://localhost:8083/api/v1/migration/run/{jobId}/cancel"
```

`mode` в ответе показывает фактически выбранный режим (`MIRROR` или `INITIAL_LOAD`).
`MIGRATION_MODE` читается при старте приложения; неверное значение останавливает старт
с понятной ошибкой.

Состояние async job хранится в памяти процесса. После рестарта приложения job нужно
продолжить новым запуском с `MIGRATION_INITIAL_LOAD_RESUME=true`; история старых job
не переживает рестарт. Запускать два initial-load одновременно нельзя: второй получит `409`.

`MigrationJobResponse` содержит `phase`, `table`, `lastId`, `rowsLoaded` (всего),
`sourceMaxId`, `sourceScn`, `sourceIdle`, `tablesTotal`, `tablesCompleted`,
`rowsPerSecond`, `etaSeconds`, итоговый `report` и `error`. `MigrationReport.tables`
перечисляет generic-таблицы и число загруженных строк.

`GET /schema/diff` читает `DatabaseMetaData` Oracle и PostgreSQL и сравнивает:

- наличие таблиц и колонок;
- совместимость типов с учётом Oracle→PostgreSQL-преобразований;
- `nullable`, default-значения и identity/auto-increment;
- primary key по составу колонок;
- foreign key по колонкам, ссылочной таблице и правилам `ON UPDATE` / `ON DELETE`;
- unique- и обычные индексы по составу колонок и уникальности;
- CHECK-constraints (диалектные выражения требуют ручного review).

Имена constraints и индексов не сравниваются: в Oracle и PostgreSQL они различаются.
Дополнительные объекты приёмника не считаются ошибкой.

В отчёте три уровня:

- `ERROR` — validation не проходит;
- `WARNING` — требует внимания, но не блокирует validation;
- `INFO` — материал для ручного review, например различие текста CHECK-выражений.

`valid=true` означает отсутствие `ERROR`. Поведение можно ужесточить:

```yaml
migration.schema.validation.fail-on-warnings: true
migration.schema.validation.compare-check-constraints: true
```

Ограничения: validator не генерирует DDL, не проверяет views/sequences/PLSQL и не заменяет
ручной review диалектных CHECK-выражений.

Порядок запуска зависит от ownership:

- **Liquibase-owned `public`:** сначала `module-oracle` и `module-postgres` (Liquibase создаёт
  `users`, `orders`, `insurance_program_users` и `migration_entity_map`), затем `module-migration`.
- **schema-migration-owned `auto_migration`:** сначала `module-oracle`, затем
  `module-schema-migration` и `POST /apply`; `module-postgres` не нужен. После этого
  `module-migration` запускается с `TARGET_POSTGRES_SCHEMA=auto_migration` и делает `POST /run`.

`POST /run` требует, чтобы таблицы `users`, `orders` и `migration_entity_map` уже существовали
в выбранной target-схеме; иначе вернётся `503`, а точная причина будет в логе `module-migration`.

`/run` не только вставляет и обновляет строки, но и удаляет из PostgreSQL управляемые строки,
которые исчезли из Oracle. Нативные строки PostgreSQL без записи в `migration_entity_map`
сохраняются.

Коды ответов: `200` — успех; `404` — таблицы нет в метаданных источника;
`409` — конфликт данных в приёмнике (уникальность, FK, check-constraint);
`503` — источник, приёмник или служебная схема недоступны (сеть, креды, СУБД лежит,
`module-postgres` ещё не создал таблицы).

### 5.3 Сервис schema migration (`module-schema-migration`, порт 8084)

Создаёт PostgreSQL-схему из Oracle-схемы. По умолчанию target-схема — `auto_migration`.

| Метод | Путь | Выход |
|---|---|---|
| GET | `/api/v1/schema-migration/preview` | `SchemaMigrationPlan` — DDL, warnings, unsupported |
| POST | `/api/v1/schema-migration/apply` | `SchemaMigrationReport` — сколько statements применено |
| GET | `/api/v1/schema-migration/status` | `SchemaMigrationStatus` — target tables/columns |

```bash
# 1. Посмотреть DDL, ничего не применяя
curl "http://localhost:8084/api/v1/schema-migration/preview"

# 2. Создать схему auto_migration
curl -X POST "http://localhost:8084/api/v1/schema-migration/apply"

# 3. Проверить, что все таблицы/колонки созданы
curl "http://localhost:8084/api/v1/schema-migration/status"
```

Пример полного сценария «схема + данные»:

```bash
# 1. Создать схему из Oracle
curl -X POST "http://localhost:8084/api/v1/schema-migration/apply"

# 2. Запустить module-migration с TARGET_POSTGRES_SCHEMA=auto_migration
#    (через IDE env или переменную окружения), затем:
curl -X POST "http://localhost:8083/api/v1/migration/run"
```

---

## 6. Карта Liquibase-миграций

Схема каталогов одинакова в обоих модулях; различается только SQL внутри файлов миграций.

```
src/main/resources/db/changelog/
├── database-changelog-master.xml              ← ЕДИНСТВЕННАЯ точка входа для Spring Boot
│                                                 (spring.liquibase.change-log)
├── ddl/
│   ├── changelog-ddl-cumulative.xml           ← агрегатор всех версий DDL
│   └── 202611/
│       ├── 202611-changelog-ddl.xml           ← агрегатор файлов версии
│       ├── create-users-table.xml             ← CREATE TABLE users
│       ├── create-orders-table.xml            ← CREATE TABLE orders + FK на users
│       ├── create-insurance-program-users-table.xml  ← CREATE TABLE insurance_program_users
│       ├── create-migration-entity-map-table.xml    ← карта source id → target id (только TARGET)
│       └── add-migration-entity-map-last-seen-run.xml ← last_seen_run для stale-строк
└── dml/
    ├── changelog-dml-cumulative.xml           ← агрегатор всех версий DML
    └── 202611/
        ├── 202611-changelog-dml.xml           ← агрегатор файлов версии
        ├── insert-initial-users.xml           ← тестовые строки users
        ├── insert-orders.xml                  ← 4 заказа (только Oracle, SOURCE)
        └── insert-insurance-program-users.xml ← 10 строк (только Oracle, SOURCE)
```

Цепочка включений (порядок = порядок применения):

```
database-changelog-master.xml
 ├─ /db/changelog/ddl/changelog-ddl-cumulative.xml        абсолютный classpath-путь
 │    └─ /db/changelog/ddl/202611/202611-changelog-ddl.xml
 │         ├─ create-users-table.xml                      relativeToChangelogFile="true"
 │         ├─ create-orders-table.xml
 │         ├─ create-insurance-program-users-table.xml
 │         └─ create-migration-entity-map-table.xml       только в module-postgres
 └─ /db/changelog/dml/changelog-dml-cumulative.xml        DML строго после DDL
      └─ /db/changelog/dml/202611/202611-changelog-dml.xml
           ├─ insert-initial-users.xml
           ├─ insert-orders.xml
           └─ insert-insurance-program-users.xml
```

### 6.1 Таблица `users` и различия диалектов

| Колонка | Oracle | PostgreSQL |
|---|---|---|
| `id` | `NUMBER(19,0) GENERATED BY DEFAULT AS IDENTITY` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` |
| `username` | `VARCHAR2(100) NOT NULL` | `VARCHAR(100) NOT NULL` |
| `email` | `VARCHAR2(255) NOT NULL` | `VARCHAR(255) NOT NULL` |
| `created_at` | `TIMESTAMP NOT NULL` | `TIMESTAMP NOT NULL` |
| `updated_at` | `TIMESTAMP NOT NULL` | `TIMESTAMP NOT NULL` |
| unique | `uk_users_username`, `uk_users_email` | те же имена |

В DML: Oracle использует `LOCALTIMESTAMP`, PostgreSQL — `CURRENT_TIMESTAMP`.
Начальные данные: `oracle_admin` / `oracle_reader` и `postgres_admin` / `postgres_reader`.

### 6.1.1 Таблица `insurance_program_users` — демонстрационный объект чтения

| Колонка | Oracle (SOURCE) | PostgreSQL (TARGET) | Примечание |
|---|---|---|---|
| `id` | `NUMBER(19,0) ... AS IDENTITY` | `BIGINT ... AS IDENTITY` | PK добавлен для стабильной идентификации строки |
| `name` | `VARCHAR2(255) NOT NULL` | `VARCHAR(255) NOT NULL` | |
| `membership` | `NUMBER(10,0) NOT NULL` | `INTEGER NOT NULL` | |
| `extra_opts` | `NUMBER(1,0) DEFAULT 0 NOT NULL` | `BOOLEAN DEFAULT FALSE NOT NULL` | в Oracle нет табличного BOOLEAN |
| `created` | `TIMESTAMP DEFAULT LOCALTIMESTAMP NOT NULL` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL` | |

Сид 10 строк — **только в Oracle** (`insert-insurance-program-users.xml`). В PostgreSQL таблица
создаётся пустой. Эта таблица пока **не переносится** `module-migration`: она остаётся
демонстрационным объектом чтения.

### 6.1.2 Таблица `orders`

| Колонка | Oracle (SOURCE) | PostgreSQL (TARGET) | Примечание |
|---|---|---|---|
| `id` | `NUMBER(19,0) GENERATED BY DEFAULT AS IDENTITY` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | PK |
| `user_id` | `NUMBER(19,0) NOT NULL` | `BIGINT NOT NULL` | FK `fk_orders_user` → `users.id` |
| `order_number` | `VARCHAR2(50) NOT NULL` | `VARCHAR(50) NOT NULL` | unique `uk_orders_order_number` |
| `amount` | `NUMBER(12,2) NOT NULL` | `NUMERIC(12,2) NOT NULL` | сумма заказа |
| `status` | `VARCHAR2(20) DEFAULT 'NEW' NOT NULL` | `VARCHAR(20) DEFAULT 'NEW' NOT NULL` | `ck_orders_status`: NEW/PAID/SHIPPED/CANCELLED |
| `created_at` | `TIMESTAMP DEFAULT LOCALTIMESTAMP NOT NULL` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL` | |

Сид 4 заказов — **только в Oracle** (`insert-orders.xml`, привязаны к `oracle_admin` и `oracle_reader`).
В PostgreSQL таблица создаётся пустой; строки появляются после `POST /api/v1/migration/run`.
При переносе `user_id` не копируется напрямую: исходный id пользователя заменяется на целевой
по карте `migration_entity_map`; заказы, удалённые из Oracle, удаляются и из PostgreSQL.

### 6.1.3 Таблица `migration_entity_map` — служебная карта зеркала

Создаётся **только в PostgreSQL** модулем `module-postgres`:

| Колонка | Тип | Назначение |
|---|---|---|
| `entity_type` | `VARCHAR(20)` | `USER` или `ORDER` |
| `source_id` | `BIGINT` | id строки в Oracle |
| `target_id` | `BIGINT` | id соответствующей строки в PostgreSQL |
| `source_key` | `VARCHAR(255)` | последний известный `username` / `order_number` |
| `last_seen_run` | `BIGINT` | XID запуска, в котором source id встретился; stale-строки имеют другое значение |
| `updated_at` | `TIMESTAMP` | время последней синхронизации |

PK — `(entity_type, source_id)`, уникальность — `(entity_type, target_id)`.
Колонка `last_seen_run` добавляется отдельным changeSet'ом; для `auto_migration` её создаёт
schema-мигратор (включая `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` для уже существующей таблицы).
Таблица не является доменной таблицей CRUD-модулей, поэтому в Oracle её копии нет.

### 6.2 Как добавить миграцию

1. Определить месяц → папка `YYYYMM` в `ddl/` и/или `dml/`.
2. Создать агрегатор `YYYYMM-changelog-ddl.xml` (если папки ещё нет) и подключить его
   в `changelog-ddl-cumulative.xml` абсолютным путём.
3. Создать файл миграции (kebab-case: `create-*`, `add-*`, `update-*`, `insert-*`).
4. Подключить его **в конец** списка `<include>` в агрегаторе версии.
5. `<changeSet author="FStavcev" id="уникальное-имя">` + `<sql>` + **обязательный `<rollback>`**.
6. Повторить для второго модуля — SQL будет отличаться диалектом.
   Исключение — служебные таблицы мигратора (`migration_entity_map`): они существуют только
   в PostgreSQL-приёмнике.

Никогда не редактировать уже применённые changeSet'ы и не менять их `id`/`author`.

---

## 7. Конфигурация

`module-oracle/src/main/resources/application.yaml`

```yaml
spring.datasource.url:      jdbc:oracle:thin:@//localhost:1521/FREEPDB1
spring.jpa.hibernate.ddl-auto: validate
spring.jpa.properties.hibernate.jdbc.fetch_size: 100
spring.liquibase.change-log: classpath:/db/changelog/database-changelog-master.xml
server.port: 8081
```

`module-postgres/src/main/resources/application.yaml`

```yaml
spring.datasource.url:      jdbc:postgresql://localhost:5432/oracletopostgres
spring.jpa.hibernate.ddl-auto: validate
spring.jpa.properties.hibernate.jdbc.fetch_size: 100
spring.liquibase.change-log: classpath:/db/changelog/database-changelog-master.xml
server.port: 8082
```

`module-migration/src/main/resources/application.yaml` — JPA нет, два JDBC-подключения и HikariCP

```yaml
spring.datasource.url:      jdbc:oracle:thin:@//localhost:1521/FREEPDB1
spring.datasource.hikari.pool-name: migration-source-hikari
spring.datasource.hikari.connection-test-query: SELECT 1 FROM DUAL
migration.mode: ${MIGRATION_MODE:initial-load}  # альтернатива: mirror — зеркальная синхронизация без даунтайма
migration.initial-load.chunk-size: 50000
migration.initial-load.truncate-target: ${MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET:true}
migration.initial-load.resume: false
migration.initial-load.populate-mapping: false
migration.initial-load.validate: true
migration.initial-load.require-source-idle: true
migration.initial-load.capture-source-scn: true
migration.initial-load.include-tables: [insurance_program_users]
migration.initial-load.exclude-tables: []
migration.initial-load.table-mapping: {}
migration.initial-load.column-mapping: {}
migration.initial-load.lob-chunk-size: 10
migration.initial-load.workers: 4
migration.initial-load.retry-max-attempts: 3
migration.initial-load.retry-initial-backoff-ms: 500
migration.initial-load.retry-max-backoff-ms: 5000
migration.initial-load.analyze: true
migration.initial-load.vacuum: false
migration.source.row-limit: 100
migration.source.chunk-size: 5000
migration.source.fetch-size: 1000
migration.source.excluded-tables:
  - DATABASECHANGELOG
  - DATABASECHANGELOGLOCK
  - AQ$_*
  - HELP
  - MVIEW$_*
  - OL$*
  - REDO_*
  - SCHEDULER_*
  - SQLPLUS_PRODUCT_PROFILE

migration.schema.validation.fail-on-warnings: false
migration.schema.validation.compare-check-constraints: true

migration.target.url:       jdbc:postgresql://localhost:5432/oracletopostgres
migration.target.schema:    public   # или auto_migration

migration.target.hikari.pool-name: migration-target-hikari
migration.target.hikari.connection-test-query: SELECT 1
migration.target.rewrite-batched-inserts: true
server.port: 8083
```

`migration.source.chunk-size` задаёт размер keyset-страницы mirror-режима и, соответственно,
верхнюю границу памяти на чанк. `migration.initial-load.chunk-size` — размер COPY-чанка
initial-load-режима (по умолчанию 50 000). `row-limit` относится только к preview-эндпоинту
`/tables/{name}/rows`.

Env-переключатели initial-load: `MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET`,
`MIGRATION_INITIAL_LOAD_RESUME`, `MIGRATION_INITIAL_LOAD_POPULATE_MAPPING`,
`MIGRATION_INITIAL_LOAD_VALIDATE`, `MIGRATION_INITIAL_LOAD_REQUIRE_SOURCE_IDLE`,
`MIGRATION_INITIAL_LOAD_CAPTURE_SOURCE_SCN`, `MIGRATION_INITIAL_LOAD_ANALYZE`,
`MIGRATION_INITIAL_LOAD_INCLUDE_TABLES`, `MIGRATION_INITIAL_LOAD_LOB_CHUNK_SIZE`,
`MIGRATION_INITIAL_LOAD_RETRY_MAX_ATTEMPTS` (Spring relaxed binding).

`include-tables` по умолчанию содержит `insurance_program_users` для демо. В production
лучше перечислить таблицы явно: пустой список означает «все source-таблицы, кроме
users/orders и excluded», что на системной схеме Oracle может быть неожиданно много.

`workers` задаёт число параллельных диапазонов на таблицу. Для него нужен запас
в source/target Hikari pool (в YAML target pool поднят до 10). `workers=1` возвращает
строго последовательную загрузку. Параллельные диапазоны используют `MAX(key)`
в своём диапазоне как checkpoint; отдельная range-таблица не нужна.

Если после cutover планируется `mirror`, включайте `populate-mapping=true` и делайте
это в том же окне: set-based `source_id = target_id` для users/orders заметно дешевле,
чем первый mirror-прогон, который будет обновлять все строки и строить mapping через adoption.
Если mirror не нужен, оставляйте `false` — это экономит запись 100–200 млн строк mapping.

Для `public` уже лежат безопасные примеры скриптов:
`classpath:initial-load/public-pre-load.sql` — снимает unique/FK перед COPY;
`classpath:initial-load/public-post-load.sql` — возвращает их после загрузки.
Для `auto_migration` — `auto-migration-pre-load.sql` / `auto-migration-post-load.sql`.
Pre-script должен быть идемпотентным (`DROP CONSTRAINT IF EXISTS`): после падения
он выполнится повторно.

`module-schema-migration/src/main/resources/application.yaml` — schema migration, порт 8084

```yaml
spring.datasource.url:      jdbc:oracle:thin:@//localhost:1521/FREEPDB1
migration.schema.source.schema: ""
migration.schema.target.url:     jdbc:postgresql://localhost:5432/oracletopostgres
migration.schema.target.schema:  auto_migration
server.port: 8084
```

`migration.target.schema` можно менять прямо в `application.yaml` — env не обязателен.
Для переключения между `public` и `auto_migration` измени значение и перезапусти приложение.
Env `TARGET_POSTGRES_SCHEMA` (если задан) имеет приоритет над YAML.

`migration.source.excluded-tables` поддерживает точные имена и шаблоны с `*` в конце
(например, `AQ$_*`), чтобы не показывать системные объекты Oracle.

`sourceDataSource` помечен `@Primary`, поэтому `spring.datasource` остаётся основным подключением.
Приёмник настраивается отдельно через `migration.target.*` и имеет собственный
`targetTransactionManager`; `@Transactional` в `MigrationOrchestrationService` явно указывает его.
Служебную таблицу `migration_entity_map` создаёт Liquibase модуля `module-postgres`; без неё
`/run` и `/status` возвращают `503`.

Все креды переопределяются переменными окружения:
`ORACLE_URL`, `ORACLE_USERNAME`, `ORACLE_PASSWORD`,
`POSTGRES_URL`, `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`,
`SOURCE_ORACLE_URL`, `SOURCE_ORACLE_USERNAME`, `SOURCE_ORACLE_PASSWORD`, `SOURCE_ORACLE_SCHEMA`,
`TARGET_POSTGRES_URL`, `TARGET_POSTGRES_USERNAME`, `TARGET_POSTGRES_PASSWORD`, `TARGET_POSTGRES_SCHEMA`.
Schema-модуль использует те же имена переменных; для data-модуля в auto-схему задай
`TARGET_POSTGRES_SCHEMA=auto_migration`.

**Ownership:** `public` создаёт Liquibase `module-postgres`; `auto_migration` создаёт
`module-schema-migration`. Не запускай оба механизма на одну и ту же схему: либо Liquibase,
либо schema-мигратор.

`docker-compose.yaml` поднимает Oracle с `ORACLE_PASSWORD=oracle` и без `APP_USER`: приложение
ходит под встроенным `SYSTEM`, как и задано в `ORACLE_USERNAME`/`SOURCE_ORACLE_USERNAME` по умолчанию.

**Запрещено** менять `ddl-auto` на `update` / `create` / `create-drop`: схемой управляет только Liquibase.

---

## 8. Сборка и запуск

```bash
# 1. Поднять СУБД
docker compose up -d

# 2. Собрать все модули
./gradlew clean build

# 3. Собрать исполняемые jar
./gradlew :module-oracle:bootJar :module-postgres:bootJar \
    :module-migration:bootJar :module-schema-migration:bootJar
# → module-oracle/build/libs/module-oracle-0.0.1-SNAPSHOT.jar
# → module-postgres/build/libs/module-postgres-0.0.1-SNAPSHOT.jar
# → module-migration/build/libs/module-migration-0.0.1-SNAPSHOT.jar
# → module-schema-migration/build/libs/module-schema-migration-0.0.1-SNAPSHOT.jar
```

Запуск приложений — **Run/Debug конфигурации IntelliJ IDEA** (см. `KODA.md`, раздел «Сборка и запуск»).
`JAVA_HOME` должен указывать на JDK 25: Gradle 9.8.2 не запустится на Java 8, а toolchain
проекта требует 25. Проверьте `java -version` и Gradle JVM перед сборкой.

Проверка живости: `GET http://localhost:8081/actuator/health`,
`http://localhost:8082/actuator/health`, `http://localhost:8083/actuator/health`,
`http://localhost:8084/actuator/health`.

**Режим A — Liquibase-owned `public`:** поднимите `module-oracle` и `module-postgres`,
дождитесь `UP`, затем запустите `module-migration` и вызовите
`POST http://localhost:8083/api/v1/migration/run`.

**Режим B — schema-migration-owned `auto_migration`:** поднимите `module-oracle`,
запустите `module-schema-migration`, вызовите `POST http://localhost:8084/api/v1/schema-migration/apply`,
затем запустите `module-migration` с `TARGET_POSTGRES_SCHEMA=auto_migration` и вызовите
`POST http://localhost:8083/api/v1/migration/run`.

### 8.1 Runbook: initial-load с остановкой окружения

1. До окна создать target-схему. Для максимальной скорости включить pre/post SQL,
   которые снимают secondary unique/FK и возвращают их после COPY. PK оставить.
2. Остановить приложение и всех писателей Oracle, проверить отсутствие активных сессий.
   `require-source-idle=true` сделает это автоматически и не даст стартовать при живых сессиях.
3. Запустить `module-migration` с режимом initial-load и pre/post скриптами:

```bash
export MIGRATION_MODE=initial-load
export MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET=true
export MIGRATION_INITIAL_LOAD_PRE_LOAD_SQL=classpath:initial-load/public-pre-load.sql
export MIGRATION_INITIAL_LOAD_POST_LOAD_SQL=classpath:initial-load/public-post-load.sql
java -jar module-migration/build/libs/module-migration-0.0.1-SNAPSHOT.jar
```

4. Запустить async job и следить за progress:

```bash
JOB_ID=$(curl -s -X POST http://localhost:8083/api/v1/migration/run/async | jq -r .jobId)
curl "http://localhost:8083/api/v1/migration/run/$JOB_ID"
```

5. Если процесс упал, перезапустить его с `MIGRATION_INITIAL_LOAD_RESUME=true`
   и явно `MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET=false` (в демо-конфиге truncate
   по умолчанию `true`). Загрузка продолжит users и orders с `MAX(id)` в target;
   pre-load script выполнится повторно и должен быть идемпотентным.
6. Если после cutover планируется mirror-режим, задать `MIGRATION_INITIAL_LOAD_POPULATE_MAPPING=true`:
   карта заполнится как `source_id = target_id`.
7. Дождаться, пока validation станет `valid=true`; при `FAILED` приложение не запускать.
   Затем стартовать приложение и smoke-тесты.

Initial-load требует пустой target. В демо-конфиге `truncate-target` по умолчанию
`true` (env `MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET`), поэтому загрузка сама очищает
`users`, `orders` и `migration_entity_map` (`RESTART IDENTITY`). Это удаляет и native-строки
target, поэтому в окно cutover используется только для выделенного target.
Для production или продолжения с `resume=true` явно задайте
`MIGRATION_INITIAL_LOAD_TRUNCATE_TARGET=false`.

`MAX(id)` — checkpoint текущей загрузки, а не требование всегда держать target пустым.
После успешного cutover target остаётся полным и используется приложением.

**PostgreSQL tuning для окна.** Для индекс/FK-фазы в post-load SQL уже выставлены
`SET LOCAL maintenance_work_mem` и `max_parallel_maintenance_workers`; подгони их под железо.
На сервере имеет смысл заранее проверить `max_wal_size`, `wal_compression`, `shared_buffers`
и `work_mem`. `synchronous_commit=off` даёт ускорение коммитов, но при OS-crash может
потерять последние транзакции; для cutover с resume это допустимо только осознанно,
поэтому в приложении он не включён по умолчанию. После загрузки полезен `VACUUM (ANALYZE)`
(`migration.initial-load.vacuum=true`) или обычный `ANALYZE` (уже выполняется).

**Parallel ranges.** Для keyset-таблиц `workers` делит `MIN(id)..MAX(id)` на непересекающиеся
диапазоны. Каждый worker читает только свои колонки, пишет COPY-чанками и коммитит
отдельные транзакции; resume диапазона — `MAX(id)` внутри диапазона. Для таблиц без
одиночного integer PK остаётся последовательное потоковое чтение.

### 8.2 Frontend (DEMO / LIVE)

`module-frontend/` — отдельное npm-приложение, не входящее в Gradle build. Витрина
показывает архитектуру, режимы, код, типы и контракт API; DEMO работает без backend,
LIVE подключается к модулям через Vite proxy.

```bash
cd module-frontend
npm ci
npm run dev
# http://localhost:5173
```

- DEMO — детерминированная симуляция без запросов к 8081–8084.
- LIVE — health, status, schema diff, tables и async job; при частичной недоступности
  остаётся включённым, при полной — автоматически возвращается в DEMO.
- Изменяющие операции в `#api` требуют armed-режима и подтверждения словом `MIGRATE`.
- Команды запуска сценариев `public` и `auto_migration` собраны в секции `#start`.
- В dev-режиме в `#api` есть кнопка `demo dataset`, которая через
  `scripts/seed-large-oracle.ps1` заполняет Oracle до 2 000 000 users и
  4 000 000 orders. Target-схема не меняется; production/preview эту кнопку
  не получают.

Полная документация, env-переменные и proxy-таблица:
[`module-frontend/README.md`](module-frontend/README.md).

---

## 9. Правила, которым обязан следовать любой контрактор

Источник истины — `KODA.md` и `LIQUIBASE-ARCHITECTURE.md`. При конфликте приоритет у них.

**Код**
- Отступ 2 пробела, продолжение 4, максимум 130 символов, скобки обязательны в `if/for/while`.
- Lombok обязателен: `@Data`, `@Builder`, `@RequiredArgsConstructor`, `@FieldDefaults(level = PRIVATE)`.
- Сервис — **класс без интерфейса** (одна реализация → интерфейс не создаётся).
  Исключение — контракты `MetadataProvider` / `RowReader` в `module-migration`: там интерфейс нужен
  как точка расширения под другие СУБД, реализация не одна по замыслу.
- `@Transactional` только на методах, не на классе.
- MapStruct с **явным `@Mapping` для каждого поля**; DTO обязаны иметь `@NoArgsConstructor`.
- Комментарии к полям — только Javadoc (`/** */`), `//` запрещён. Смысл — техническая суть поля.
- Каждый метод контроллера — Javadoc с примером запроса для Postman (URL в `{@code ...}`).
- Логирование — отдельным слоем (`LoggingAspect`), не в контроллерах и не в бизнес-логике.

**Миграции**
- XSD всегда `dbchangelog-3.1.xsd`, отступ 2 пробела.
- DDL и DML физически разделены; DDL подключается раньше DML.
- Между уровнями — абсолютный путь `/db/changelog/...`, внутри версии — `relativeToChangelogFile="true"`.
- У каждого `changeSet` есть `<rollback>`, `author="FStavcev"`.
- `CREATE TABLE IF NOT EXISTS`; запятые в начале строк; явные имена констрейнтов.

**Границы модулей**
- Oracle-специфика только в `module-oracle` и `module-migration/source/oracle`,
  Postgres-специфика — только в `module-postgres`.
- Общего `common`-модуля нет и не планируется: модули намеренно независимы, дублирование слоёв —
  осознанное решение, а не недоработка. Не «оптимизировать» это объединением.
- `module-migration` пишет в PostgreSQL только через target-gateways
  (`PostgresTargetGateway`, `PostgresChunkGateway`, `InitialLoadTargetGateway`,
  `GenericInitialLoadTargetGateway`) и `targetJdbcTemplate`; JPA и entity здесь не появляются.

**Безопасность SQL**
- Имя таблицы из path-параметра **никогда** не подставляется в SQL напрямую: сначала сверка
  с `DatabaseMetaData` (`MetadataProvider.qualifiedTableName`), затем каноническое имя из СУБД
  со схемой и в кавычках. Обход невозможен.

---

## 10. Частые задачи → куда идти

| Задача | Файлы |
|---|---|
| Добавить поле в `User` | `entity/UserEntity` → `dto/UserRequestDto` + `dto/UserResponseDto` → `mapper/UserMapper` (явный `@Mapping`) → новая миграция в `ddl/YYYYMM/` **в обоих модулях** |
| Добавить поле в `Order` | `entity/OrderEntity` → `dto/OrderRequestDto` + `dto/OrderResponseDto` → `mapper/OrderMapper` → миграция **в обоих модулях** → при необходимости `PostgresTargetGateway` |
| Добавить эндпоинт | `controller/UserController` / `controller/OrderController` → соответствующий service (+ Javadoc с примером curl) |
| Добавить тип ошибки | новый класс в `common/exception/` → ветка в `XGlobalExceptionHandler` |
| Поменять подключение к БД | `application.yaml` соответствующего модуля (или env-переменные) |
| Изменить структуру таблицы | **только** новый changeSet в `db/changelog/ddl/YYYYMM/`; entity подтягивается под схему, не наоборот |
| Сравнить поведение СУБД | одинаковые файлы в `module-oracle` и `module-postgres`, различия — в SQL и `application.yaml` |
| Добавить источник миграции | новая реализация `MetadataProvider` + `RowReader` в `module-migration/source/<db>/`; контроллер не трогается |
| Добавить generic-таблицу в initial-load | target-таблица уже создана; добавить source-имя в `migration.initial-load.include-tables` |
| Переименовать таблицу/колонку при загрузке | `migration.initial-load.table-mapping` / `column-mapping` |
| Таблица с CLOB/BLOB | уменьшить `migration.initial-load.lob-chunk-size`; generic-загрузчик сам выберет его |
| Поменять retry COPY-чанка | `retry-max-attempts`, `retry-initial-backoff-ms`, `retry-max-backoff-ms` |
| Поменять лимит строк чтения | `migration.source.row-limit` в `application.yaml` модуля `module-migration` |
| Добавить эндпоинт миграции | `controller/MigrationController` → `source/service/MigrationSourceService` или `service/Migration*Service` (+ Javadoc) |

---

## 11. Известные особенности и ловушки

1. **Два одинаковых пакета-близнеца.** `baileyseyes.oracletopostgres.oracle.*` и
   `baileyseyes.oracletopostgres.postgres.*` содержат классы с одинаковыми именами
   (`UserService`, `OrderService`, `UserEntity`, `OrderEntity`, `UserController`…).
   При правке всегда проверяйте полный путь файла.
2. **`UserMapperImpl` / `OrderMapperImpl` генерируются** в `build/generated/sources/annotationProcessor/...` —
   в исходниках их нет, руками не создавать.
3. **`ddl-auto=validate`** — если Hibernate ругается на тип колонки, исправляется миграция (новым
   changeSet), а не `ddl-auto`.
4. **Oracle `NUMBER(19,0)`** выбран под `Long`/`BIGINT`; связка проверена на живом Oracle 23 Free
   (контейнер `gvenzl/oracle-free:23-slim`).
5. **Тестов нет.** Каталоги `src/test` удалены намеренно; при добавлении тестов создать
   `src/test/java/<тот же пакет>` и добавить тестовые зависимости в `build.gradle.kts` модуля.
6. **`HELP.md`** — артефакт генератора Spring Initializr, к архитектуре отношения не имеет.
7. **`module-migration` не использует JPA** — нет entity и нет Liquibase. В mirror-режиме
   `@Transactional` стоит только на методе оркестрации и явно указывает `targetTransactionManager`;
   в initial-load каждый COPY-чанк идёт через `TransactionTemplate` и коммитится отдельно.
   Схемы создают `module-oracle` и `module-postgres` каждый в своей БД.
8. **`spring-boot-starter-aop` в Spring Boot 4 отсутствует** — AOP подключён напрямую через
   `org.aspectj:aspectjweaver` (версия из BOM); `AopAutoConfiguration` активируется сам.
9. **Ограничение выборки в Oracle** — `WHERE ROWNUM <= ?`, а не `FETCH FIRST` (последний требует
   Oracle 12c+, `ROWNUM` работает везде).
10. **Два `DataSource` в `module-migration`.** Источник помечен `@Primary` и называется
    `sourceDataSource`; приёмник — `targetDataSource` с отдельным `targetJdbcTemplate` и
    `targetTransactionManager`. При добавлении бинов явно указывайте qualifier, иначе Spring
    выберет источник.
11. **Зеркальная миграция.** Соответствие `source_id → target_id` хранится в
    `migration_entity_map`, поэтому смена `username`/`order_number` обновляет ту же строку,
    а удаление в Oracle удаляет строку в PostgreSQL. Нативные строки PostgreSQL без записи
    в карте (`postgres_admin`/`postgres_reader`) сохраняются: зеркалится только управляемое
    миграцией множество. `last_seen_run` = XID текущего запуска; строки с другим значением
    удаляются после orders, чтобы не нарушить FK.
11.1. **Память не зависит от объёма.** Исходные таблицы читаются keyset-страницами
    (`migration.source.chunk-size`), страница пишется в `TEMP` staging и применяется
    set-based SQL. Полных карт source→target и списков source id в Java нет.
11.2. **Два режима.** По умолчанию `MIGRATION_MODE=initial-load` — миграция с остановкой:
    COPY с сохранением source id, `truncate-target`/`resume` и отдельным коммитом на чанк.
    Альтернатива `MIGRATION_MODE=mirror` — зеркальная синхронизация без остановки.
    `SourceRowMapper` вынесен из пакета `service..*`, иначе `LoggingAspect` писал бы
    строку лога на каждую запись.
11.3. **Async job.** `POST /run/async` возвращает `jobId`; `GET /run/{jobId}` отдаёт
    phase/lastId/rowsLoaded/sourceScn/report; `POST /run/{jobId}/cancel` отменяет
    initial-load между чанками. В процессе допускается один активный job (409 на второй).
11.4. **Source consistency и validation.** Перед загрузкой проверяются активные сессии
    Oracle в схеме источника и фиксируется SCN. После загрузки сравниваются counts,
    min/max/sum, длины строк, null-поля, orphan-FK и sequence. Несовпадение переводит job
    в `FAILED`, приложение не должно открываться.
11.5. **Pre/post SQL.** Индексы и FK снимаются и возвращаются внешними скриптами
    (`pre-load-sql`/`post-load-sql`), а не автоматическим DDL приложения. Готовые
    примеры лежат в `module-migration/src/main/resources/initial-load/`.
11.6. **Generic-таблицы.** users/orders загружаются специализированным путём, остальные —
    generic-сервисом. Колонки сопоставляются по имени, `table-mapping`/`column-mapping`
    позволяют переименования. Ключ keyset — одиночный integer PK (NUMBER с scale=0
    включая); остальные таблицы читаются потоком без resume. LOB-таблицы используют
    `lob-chunk-size`. Validation для BLOB проверяет count/null, но не побайтовый checksum;
    для критичных LOB нужна отдельная сверка.
11.7. **Повторы и мониторинг.** COPY-чанки ретраятся при SQLState 08/40/53; ошибки
    уникальности/FK/CHECK не ретраятся. Async job отдаёт `tablesTotal`, `tablesCompleted`,
    `lastId`, `rowsLoaded`, `rowsPerSecond`, `etaSeconds`, `sourceScn`.
11.8. **Schema fidelity.** Generator добавляет warnings для `NUMBER(1) → BOOLEAN`,
    BYTE-семантики VARCHAR2/CHAR, `TIMESTAMP WITH LOCAL TIME ZONE`, потери точности
    timestamp и Oracle-специфичных CHECK/default. Views, triggers, PL/SQL, synonyms,
    grants, partitioning и tablespaces по-прежнему переносятся вручную.
12. **Схема источника.** `migration.source.schema` используется и для метаданных, и для
    SQL-запросов через `qualifiedTableName()`. При пустом значении берётся текущая схема
    подключения. Системные таблицы Oracle отфильтровываются шаблонами `excluded-tables`.
13. **JDBC-типы Oracle.** `OracleRowReader` нормализует `TIMESTAMP`, `DATE`, `CLOB` и `BLOB`
    в обычные Java-типы, поэтому `/rows` отдаёт ISO-даты, а не внутренние объекты драйвера.
    Для миграции `RowValues` дополнительно поддерживает Oracle-специфичные значения.
14. **Ошибки записи.** Нарушение уникальности, FK или check-constraint при INSERT/UPDATE
    возвращается как `409`; недоступность БД или отсутствие таблиц — как `503`.
    Set-based шаги проверяют полноту карты после каждого чанка: если source-строку нельзя
    однозначно сопоставить с target-строкой, запуск падает с понятной ошибкой, а не теряет данные.
15. **Schema diff — диагностический, не миграционный.** `GET /schema/diff` проверяет таблицы,
    колонки, совместимость типов, nullable, defaults, identity, PK, FK, unique/индексы и CHECK.
    Ошибки блокируют validation; warnings и info выводятся отдельно. Validator не генерирует DDL
    и не переносит PL/SQL, sequences, views.
16. **Schema migration — отдельный модуль.** `module-schema-migration` создаёт/дополняет схему
    `auto_migration`; `module-postgres` Liquibase продолжает владеть `public`. На одну схему
    нельзя запускать оба механизма.
17. **Schema drift.** Schema-модуль добавляет отсутствующие таблицы и nullable-колонки, создаёт
    индексы/FK для новых таблиц. Типы существующих колонок, PK/unique/FK существующих таблиц
    автоматически не меняются — это осознанно, чтобы не делать destructive DDL.
18. **Unsupported Oracle-объекты.** Views, triggers, PL/SQL, synonyms, grants, partitioning,
    tablespaces не переносятся автоматически и попадают в `unsupportedObjects`/warnings.
19. **SYSTEM как source.** В демо Oracle-приложением используется `SYSTEM`, поэтому в
    unsupported-отчёт могут попадать системные views/synonyms/grants. Для production нужен
    отдельный Oracle-схема-пользователь.

---

## 12. Быстрый чек-лист для ИИ-агента

- [ ] Прочитал `KODA.md` и `LIQUIBASE-ARCHITECTURE.md`.
- [ ] Понял, в каком модуле работаю — правки не смешиваются между модулями.
- [ ] Помню направление миграции: **Oracle (SOURCE) → PostgreSQL (TARGET)**.
- [ ] Если меняю схему — сделал новый changeSet в `ddl/YYYYMM/` и продублировал во втором CRUD-модуле.
- [ ] Если меняю CRUD-API — синхронно обновил второй CRUD-модуль (структура должна остаться идентичной),
      включая `User` и `Order`.
- [ ] Если добавляю СУБД-источник в миграцию — только новая реализация контрактов, контроллер не трогаю.
- [ ] Если добавляю generic-таблицу initial-load — создал target-таблицу и добавил
      source-имя в `migration.initial-load.include-tables`.
- [ ] Если меняю mirror users/orders — обновил `MigrationOrchestrationService`, `MigrationStatus`
      и `PostgresTargetGateway`.
- [ ] `ddl-auto` остался `validate`.
- [ ] Имя таблицы источника в SQL проходит через `qualifiedTableName()` — прямой подстановки нет.
- [ ] Записи в PostgreSQL идут только через `targetJdbcTemplate` и `targetTransactionManager`.
- [ ] Запустил `./gradlew clean build` и сборка зелёная.
- [ ] Не делал `git commit` без явного запроса пользователя.
