# oracle-to-postgres

Демонстрационный проект: **два независимых Spring Boot приложения** с идентичной структурой слоёв и
одинаковой бизнес-логикой (CRUD над `User`), но разными СУБД — **Oracle** и **PostgreSQL**.

Смысл проекта — сравнить поведение одного и того же JPA-кода на двух диалектах при полностью
разделённых схемах, конфигурациях и Liquibase-миграциях.

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
| Драйверы | `com.oracle.database.jdbc:ojdbc17`, `org.postgresql:postgresql` — оба `runtimeOnly` |

---

## 2. Карта верхнего уровня

```
oracle-to-postgres/
├── settings.gradle.kts          # include("module-oracle", "module-postgres", "module-migration")
├── build.gradle.kts             # только общие group/version/repositories; плагины apply false
├── gradle/wrapper/              # Gradle 9.8.2
├── docker-compose.yaml          # gvenzl/oracle-free:23-slim (1521) + postgres:17-alpine (5432)
│
├── KODA.md                      # ПРАВИЛА КОДА — читать перед любой правкой (.gitignore)
├── LIQUIBASE-ARCHITECTURE.md    # ПРАВИЛА МИГРАЦИЙ — читать перед любой миграцией (.gitignore)
├── README.md                    # этот файл (карта проекта)
│
├── module-oracle/               # SOURCE (legacy), порт 8081, префикс /api/v1/oracle
├── module-postgres/             # TARGET (новая система), порт 8082, префикс /api/v1/postgres
└── module-migration/            # СЕРВИС МИГРАЦИИ, порт 8083, префикс /api/v1/migration
```

> `KODA.md` и `LIQUIBASE-ARCHITECTURE.md` добавлены в `.gitignore` (правила для AI/разработчиков, не код).

**Корневого `src/` нет.** Точки входа живут внутри модулей. Не ищите `OracleToPostgresApplication` —
он удалён при переходе на мультимодульную сборку (в git-индексе ещё числится как удалённый,
физического файла нет). `HELP.md` существует в корне, это артефакт Spring Initializr (см. раздел 11).

### 2.1 Семантическая модель: кто есть кто

| Модуль | Роль в миграции | Данные | Порт |
|---|---|---|---|
| `module-oracle` | **SOURCE** — старая система | есть, включая `insurance_program_users` (10 строк) | 8081 |
| `module-postgres` | **TARGET** — новая система | структура готова, `insurance_program_users` пуста | 8082 |
| `module-migration` | **СЕРВИС МИГРАЦИИ** — читает источник | своих данных нет | 8083 |

PostgreSQL **не «уже смигрирован»** — он «готов принять миграцию». Данные приезжают через
`module-migration`. Направление: **Oracle → PostgreSQL**.


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
    │   │   └── OracleGlobalExceptionHandler.java ← @RestControllerAdvice, единый JSON ошибок
    │   │
    │   └── user/                               ← вертикальный срез фичи "пользователи"
    │       ├── entity/UserEntity.java          ← @Entity, таблица users
    │       ├── repository/UserRepository.java  ← JpaRepository + existsBy*/findBy*
    │       ├── dto/UserRequestDto.java         ← вход, jakarta.validation
    │       ├── dto/UserResponseDto.java        ← выход, audit-поля
    │       ├── mapper/UserMapper.java          ← MapStruct, @Mapper(SPRING)
    │       ├── service/UserService.java        ← @Service, БЕЗ интерфейса, CRUD
    │       └── controller/UserController.java  ← @RestController, /api/v1/oracle
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
| `common/exception/*` | кастомные исключения + `@RestControllerAdvice` | при новом типе ошибки |
| `application.yaml` | подключение к СУБД, порт, Liquibase | при смене настроек подключения |

### 3.2 Карта `module-migration` (структура отличается от CRUD-модулей)

Модуль **не использует JPA**: только `JdbcTemplate`, `DatabaseMetaData` и `DataSource`.

```
module-migration/
├── build.gradle.kts
└── src/main/
    ├── java/baileyseyes/oracletopostgres/migration/
    │   │
    │   ├── MigrationModuleApplication.java      ← @SpringBootApplication + @ConfigurationPropertiesScan
    │   │
    │   ├── common/
    │   │   ├── aspect/LoggingAspect.java        ← @Aspect: логирование входа/выхода/длительности
    │   │   └── exception/
    │   │       ├── MigrationException.java      ← базовое RuntimeException модуля
    │   │       ├── TableNotFoundException.java  ← 404, таблицы нет в метаданных
    │   │       ├── SourceAccessException.java   ← 503, источник недоступен
    │   │       └── MigrationGlobalExceptionHandler.java ← @RestControllerAdvice
    │   │
    │   ├── controller/MigrationController.java  ← 3 read-only эндпоинта
    │   │
    │   └── source/                              ← слой доступа к источнику
    │       ├── config/MigrationSourceProperties.java ← @ConfigurationProperties("migration.source")
    │       ├── contract/
    │       │   ├── MetadataProvider.java        ← ИНТЕРФЕЙС: listTables, listColumns, resolveTableName
    │       │   └── RowReader.java               ← ИНТЕРФЕЙС: readRows
    │       ├── oracle/
    │       │   ├── OracleMetadataProvider.java  ← DatabaseMetaData.getTables/getColumns
    │       │   └── OracleRowReader.java         ← JdbcTemplate + ROWNUM, каноническое имя таблицы
    │       └── service/MigrationSourceService.java ← оркестрация для контроллера
    │
    └── resources/application.yaml               ← datasource, hikari, migration.source.*
```

**Ключевая идея расширения:** контроллер зависит **только** от `MetadataProvider` / `RowReader`.
Новая СУБД = новый пакет `source/<db>/` с двумя реализациями, контроллер и сервис не меняются.

**Поток запроса в `module-migration`:**

```
HTTP
 ▼
MigrationController              /api/v1/migration
 ▼
MigrationSourceService           row-limit из MigrationSourceProperties
 ▼
MetadataProvider / RowReader     ← интерфейсы-контракты
 ▼
OracleMetadataProvider           DatabaseMetaData (getTables / getColumns)
OracleRowReader                  SELECT * FROM "<канон. имя>" WHERE ROWNUM <= ?
 ▼
Oracle (SOURCE)
```

**Защита от SQL-инъекций:** имя таблицы из path-параметра проходит через
`resolveTableName()`, который сверяет его со списком из `DatabaseMetaData` и возвращает
каноническое имя СУБД; в SQL подставляется только оно, в двойных кавычках.
При промахе — `TableNotFoundException` (404) и `WARN` в лог.

**Слои логирования:** `LoggingAspect` покрывает pointcut'ы `controller..*` и `source.service..*`.
`INFO` — успешное завершение с длительностью, `DEBUG` — аргументы и результат,
`WARN` — исключения (включая попытки чтения таблицы вне метаданных).

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

```bash
# создание
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
```

### 5.2 Сервис миграции (`module-migration`, порт 8083)

Работает **только с источником (Oracle)**. Все эндпоинты read-only, префикс `/api/v1/migration`.

| Метод | Путь | Выход |
|---|---|---|
| GET | `/api/v1/migration/tables` | `String[]` — таблицы схемы источника (служебные исключены) |
| GET | `/api/v1/migration/tables/{tableName}/columns` | `String[]` — колонки таблицы из `DatabaseMetaData` |
| GET | `/api/v1/migration/tables/{tableName}/rows` | `List<Map<String,Object>>` — `SELECT *` с лимитом из конфига |

```bash
# 1. список таблиц источника
curl "http://localhost:8083/api/v1/migration/tables"

# 2. колонки конкретной таблицы
curl "http://localhost:8083/api/v1/migration/tables/insurance_program_users/columns"

# 3. первые N строк (N = migration.source.row-limit, по умолчанию 100)
curl "http://localhost:8083/api/v1/migration/tables/insurance_program_users/rows"
```

Коды ответов: `200` — успех; `404` — таблицы нет в метаданных источника;
`503` — источник недоступен (сеть, креды, СУБД лежит).

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
│       └── create-insurance-program-users-table.xml  ← CREATE TABLE insurance_program_users
└── dml/
    ├── changelog-dml-cumulative.xml           ← агрегатор всех версий DML
    └── 202611/
        ├── 202611-changelog-dml.xml           ← агрегатор файлов версии
        ├── insert-initial-users.xml           ← тестовые строки users
        └── insert-insurance-program-users.xml ← 10 строк (только Oracle, SOURCE)
```

Цепочка включений (порядок = порядок применения):

```
database-changelog-master.xml
 ├─ /db/changelog/ddl/changelog-ddl-cumulative.xml        абсолютный classpath-путь
 │    └─ /db/changelog/ddl/202611/202611-changelog-ddl.xml
 │         ├─ create-users-table.xml                      relativeToChangelogFile="true"
 │         └─ create-insurance-program-users-table.xml
 └─ /db/changelog/dml/changelog-dml-cumulative.xml        DML строго после DDL
      └─ /db/changelog/dml/202611/202611-changelog-dml.xml
           ├─ insert-initial-users.xml
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

### 6.1.1 Таблица `insurance_program_users` — объект миграции

| Колонка | Oracle (SOURCE) | PostgreSQL (TARGET) | Примечание |
|---|---|---|---|
| `id` | `NUMBER(19,0) ... AS IDENTITY` | `BIGINT ... AS IDENTITY` | PK добавлен для стабильной идентификации строки |
| `name` | `VARCHAR2(255) NOT NULL` | `VARCHAR(255) NOT NULL` | |
| `membership` | `NUMBER(10,0) NOT NULL` | `INTEGER NOT NULL` | |
| `extra_opts` | `NUMBER(1,0) DEFAULT 0 NOT NULL` | `BOOLEAN DEFAULT FALSE NOT NULL` | в Oracle нет табличного BOOLEAN |
| `created` | `TIMESTAMP DEFAULT LOCALTIMESTAMP NOT NULL` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL` | |

Сид 10 строк — **только в Oracle** (`insert-insurance-program-users.xml`). В PostgreSQL таблица
создаётся пустой: данные приедут миграцией в следующей итерации.

### 6.2 Как добавить миграцию

1. Определить месяц → папка `YYYYMM` в `ddl/` и/или `dml/`.
2. Создать агрегатор `YYYYMM-changelog-ddl.xml` (если папки ещё нет) и подключить его
   в `changelog-ddl-cumulative.xml` абсолютным путём.
3. Создать файл миграции (kebab-case: `create-*`, `add-*`, `update-*`, `insert-*`).
4. Подключить его **в конец** списка `<include>` в агрегаторе версии.
5. `<changeSet author="FStavcev" id="уникальное-имя">` + `<sql>` + **обязательный `<rollback>`**.
6. Повторить для второго модуля — SQL будет отличаться диалектом.

Никогда не редактировать уже применённые changeSet'ы и не менять их `id`/`author`.

---

## 7. Конфигурация

`module-oracle/src/main/resources/application.yaml`

```yaml
spring.datasource.url:      jdbc:oracle:thin:@//localhost:1521/FREEPDB1
spring.jpa.hibernate.ddl-auto: validate
spring.jpa.properties.hibernate.dialect: org.hibernate.dialect.OracleDialect
spring.liquibase.change-log: classpath:/db/changelog/database-changelog-master.xml
server.port: 8081
```

`module-postgres/src/main/resources/application.yaml`

```yaml
spring.datasource.url:      jdbc:postgresql://localhost:5432/oracletopostgres
spring.jpa.hibernate.ddl-auto: validate
spring.jpa.properties.hibernate.dialect: org.hibernate.dialect.PostgreSQLDialect
spring.liquibase.change-log: classpath:/db/changelog/database-changelog-master.xml
server.port: 8082
```

`module-migration/src/main/resources/application.yaml` — JPA нет, только JDBC и HikariCP

```yaml
spring.datasource.url:      jdbc:oracle:thin:@//localhost:1521/FREEPDB1
spring.datasource.hikari.pool-name: migration-hikari
spring.datasource.hikari.maximum-pool-size: 10
spring.datasource.hikari.connection-test-query: SELECT 1 FROM DUAL
migration.source.row-limit: 100
migration.source.excluded-tables: [DATABASECHANGELOG, DATABASECHANGELOGLOCK]
server.port: 8083
```

Все креды переопределяются переменными окружения:
`ORACLE_URL`, `ORACLE_USERNAME`, `ORACLE_PASSWORD`,
`POSTGRES_URL`, `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`,
`SOURCE_ORACLE_URL`, `SOURCE_ORACLE_USERNAME`, `SOURCE_ORACLE_PASSWORD`, `SOURCE_ORACLE_SCHEMA`.

**Запрещено** менять `ddl-auto` на `update` / `create` / `create-drop`: схемой управляет только Liquibase.

---

## 8. Сборка и запуск

```bash
# 1. Поднять СУБД
docker compose up -d

# 2. Собрать все модули
./gradlew clean build

# 3. Собрать исполняемые jar
./gradlew :module-oracle:bootJar :module-postgres:bootJar :module-migration:bootJar
# → module-oracle/build/libs/module-oracle-0.0.1-SNAPSHOT.jar
# → module-postgres/build/libs/module-postgres-0.0.1-SNAPSHOT.jar
# → module-migration/build/libs/module-migration-0.0.1-SNAPSHOT.jar
```

Запуск приложений — **Run/Debug конфигурации IntelliJ IDEA** (см. `KODA.md`, раздел «Сборка и запуск»).

Проверка живости: `GET http://localhost:8081/actuator/health`,
`http://localhost:8082/actuator/health`, `http://localhost:8083/actuator/health`.

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
- `module-migration` **не** подключается к target-постгресу в текущей итерации.

**Безопасность SQL**
- Имя таблицы из path-параметра **никогда** не подставляется в SQL напрямую: сначала сверка
  с `DatabaseMetaData` (`MetadataProvider.resolveTableName`), затем каноническое имя из СУБД
  в кавычках. Обход невозможен.

---

## 10. Частые задачи → куда идти

| Задача | Файлы |
|---|---|
| Добавить поле в `User` | `entity/UserEntity` → `dto/UserRequestDto` + `dto/UserResponseDto` → `mapper/UserMapper` (явный `@Mapping`) → новая миграция в `ddl/YYYYMM/` **в обоих модулях** |
| Добавить эндпоинт | `controller/UserController` → `service/UserService` (+ Javadoc с примером curl) |
| Добавить тип ошибки | новый класс в `common/exception/` → ветка в `XGlobalExceptionHandler` |
| Поменять подключение к БД | `application.yaml` соответствующего модуля (или env-переменные) |
| Изменить структуру таблицы | **только** новый changeSet в `db/changelog/ddl/YYYYMM/`; entity подтягивается под схему, не наоборот |
| Сравнить поведение СУБД | одинаковые файлы в `module-oracle` и `module-postgres`, различия — в SQL и `application.yaml` |
| Добавить источник/приёмник миграции | новая реализация `MetadataProvider` + `RowReader` в `module-migration/source/<db>/`; контроллер не трогается |
| Поменять лимит строк чтения | `migration.source.row-limit` в `application.yaml` модуля `module-migration` |
| Добавить эндпоинт миграции | `controller/MigrationController` → `source/service/MigrationSourceService` (+ Javadoc) |

---

## 11. Известные особенности и ловушки

1. **Два одинаковых пакета-близнеца.** `baileyseyes.oracletopostgres.oracle.*` и
   `baileyseyes.oracletopostgres.postgres.*` содержат классы с одинаковыми именами
   (`UserService`, `UserEntity`, `UserController`…). При правке всегда проверяйте полный путь файла.
2. **`UserMapperImpl` генерируется** в `build/generated/sources/annotationProcessor/...` —
   в исходниках его нет, руками не создавать.
3. **`ddl-auto=validate`** — если Hibernate ругается на тип колонки, исправляется миграция (новым
   changeSet), а не `ddl-auto`.
4. **Oracle `NUMBER(19,0)`** выбран под `Long`/`BIGINT`. Проверка на живом Oracle не выполнялась —
   проект валидировался на H2 в режиме `MODE=Oracle`.
5. **Тестов нет.** Каталоги `src/test` удалены намеренно; при добавлении тестов создать
   `src/test/java/<тот же пакет>` и добавить тестовые зависимости в `build.gradle.kts` модуля.
6. **`HELP.md`** — артефакт генератора Spring Initializr, к архитектуре отношения не имеет.
7. **`module-migration` не использует JPA** — нет entity, нет `@Transactional`, нет Liquibase.
   Схему `insurance_program_users` создают `module-oracle` и `module-postgres` каждый в своей БД.
8. **`spring-boot-starter-aop` в Spring Boot 4 отсутствует** — AOP подключён напрямую через
   `org.aspectj:aspectjweaver` (версия из BOM); `AopAutoConfiguration` активируется сам.
9. **Ограничение выборки в Oracle** — `WHERE ROWNUM <= ?`, а не `FETCH FIRST` (последний требует
   Oracle 12c+, `ROWNUM` работает везде и проверен на H2 в режиме `MODE=Oracle`).

---

## 12. Быстрый чек-лист для ИИ-агента

- [ ] Прочитал `KODA.md` и `LIQUIBASE-ARCHITECTURE.md`.
- [ ] Понял, в каком модуле работаю — правки не смешиваются между модулями.
- [ ] Помню направление миграции: **Oracle (SOURCE) → PostgreSQL (TARGET)**.
- [ ] Если меняю схему — сделал новый changeSet в `ddl/YYYYMM/` и продублировал во втором CRUD-модуле.
- [ ] Если меняю CRUD-API — синхронно обновил второй CRUD-модуль (структура должна остаться идентичной).
- [ ] Если добавляю СУБД в миграцию — только новая реализация контрактов, контроллер не трогаю.
- [ ] `ddl-auto` остался `validate`.
- [ ] Имя таблицы в SQL проходит через `resolveTableName()` — прямой подстановки нет.
- [ ] Запустил `./gradlew clean build` и сборка зелёная.
- [ ] Не делал `git commit` без явного запроса пользователя.
