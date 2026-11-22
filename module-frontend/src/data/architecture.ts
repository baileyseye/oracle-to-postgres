import { githubBlobUrl, githubTreeUrl } from '../lib/github';
import type {
  ArchitectureEdge,
  ArchitectureNode,
  MigrationModeOption,
  SchemaOwnerOption,
} from '../types/architecture';

const ORACLE_USER_CONTROLLER =
  'module-oracle/src/main/java/baileyseyes/oracletopostgres/oracle/user/controller/UserController.java';
const ORACLE_ORDER_CONTROLLER =
  'module-oracle/src/main/java/baileyseyes/oracletopostgres/oracle/order/controller/OrderController.java';
const ORACLE_USER_SERVICE =
  'module-oracle/src/main/java/baileyseyes/oracletopostgres/oracle/user/service/UserService.java';
const ORACLE_ORDER_SERVICE =
  'module-oracle/src/main/java/baileyseyes/oracletopostgres/oracle/order/service/OrderService.java';

const POSTGRES_USER_CONTROLLER =
  'module-postgres/src/main/java/baileyseyes/oracletopostgres/postgres/user/controller/UserController.java';
const POSTGRES_ORDER_CONTROLLER =
  'module-postgres/src/main/java/baileyseyes/oracletopostgres/postgres/order/controller/OrderController.java';
const POSTGRES_USER_SERVICE =
  'module-postgres/src/main/java/baileyseyes/oracletopostgres/postgres/user/service/UserService.java';
const POSTGRES_ORDER_SERVICE =
  'module-postgres/src/main/java/baileyseyes/oracletopostgres/postgres/order/service/OrderService.java';

const MIGRATION_CONTROLLER =
  'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/controller/MigrationController.java';
const INITIAL_LOAD_SERVICE =
  'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/InitialLoadMigrationService.java';
const JOB_MANAGER =
  'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/MigrationJobManager.java';
const USER_MIGRATION_SERVICE =
  'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/service/UserMigrationService.java';
const CHUNK_GATEWAY =
  'module-migration/src/main/java/baileyseyes/oracletopostgres/migration/target/service/PostgresChunkGateway.java';

const SCHEMA_CONTROLLER =
  'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/controller/SchemaMigrationController.java';
const SCHEMA_SERVICE =
  'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/service/SchemaMigrationService.java';
const DDL_GENERATOR =
  'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/generator/PostgresDdlGenerator.java';
const TYPE_MAPPER =
  'module-schema-migration/src/main/java/baileyseyes/oracletopostgres/schema/generator/PostgresTypeMapper.java';

const ORACLE_USERS_TABLE =
  'module-oracle/src/main/resources/db/changelog/ddl/202611/create-users-table.xml';
const ORACLE_ORDERS_TABLE =
  'module-oracle/src/main/resources/db/changelog/ddl/202611/create-orders-table.xml';
const ORACLE_INSURANCE_TABLE =
  'module-oracle/src/main/resources/db/changelog/ddl/202611/create-insurance-program-users-table.xml';

const POSTGRES_ENTITY_MAP =
  'module-postgres/src/main/resources/db/changelog/ddl/202611/create-migration-entity-map-table.xml';
const POSTGRES_ENTITY_MAP_LAST_SEEN =
  'module-postgres/src/main/resources/db/changelog/ddl/202611/add-migration-entity-map-last-seen-run.xml';
const POSTGRES_USERS_TABLE =
  'module-postgres/src/main/resources/db/changelog/ddl/202611/create-users-table.xml';
const POSTGRES_ORDERS_TABLE =
  'module-postgres/src/main/resources/db/changelog/ddl/202611/create-orders-table.xml';
const POSTGRES_INSURANCE_TABLE =
  'module-postgres/src/main/resources/db/changelog/ddl/202611/create-insurance-program-users-table.xml';

export const ARCHITECTURE_NODES: readonly ArchitectureNode[] = [
  {
    id: 'module-oracle',
    kind: 'service',
    title: 'module-oracle',
    subtitle: '/api/v1/oracle',
    role: 'приложение-источник',
    port: '8081',
    apiPrefix: '/api/v1/oracle',
    description:
      'SOURCE-приложение: CRUD над users и orders через JPA/Hibernate. ' +
      'Схема Oracle создаётся Liquibase этого модуля и не управляется мигратором.',
    footer: 'CRUD · JPA',
    keyItemsLabel: 'Ключевые классы',
    keyItems: [
      { name: 'UserController', href: githubBlobUrl(ORACLE_USER_CONTROLLER) },
      { name: 'OrderController', href: githubBlobUrl(ORACLE_ORDER_CONTROLLER) },
      { name: 'UserService', href: githubBlobUrl(ORACLE_USER_SERVICE) },
      { name: 'OrderService', href: githubBlobUrl(ORACLE_ORDER_SERVICE) },
    ],
    githubUrl: githubTreeUrl('module-oracle'),
    accent: 'oracle',
    x: 24,
    y: 28,
    width: 196,
    height: 112,
  },
  {
    id: 'oracle-db',
    kind: 'database',
    title: 'Oracle',
    subtitle: 'FREEPDB1 · SYSTEM',
    role: 'база-источник',
    port: '1521',
    description:
      'Источник данных. В демо-схеме живут users, orders и insurance_program_users. ' +
      'Перед initial-load sourceGuard проверяет активные сессии и фиксирует SCN.',
    footer: 'schema: SYSTEM',
    keyItemsLabel: 'Ключевые таблицы',
    keyItems: [
      { name: 'users', href: githubBlobUrl(ORACLE_USERS_TABLE) },
      { name: 'orders', href: githubBlobUrl(ORACLE_ORDERS_TABLE) },
      {
        name: 'insurance_program_users',
        href: githubBlobUrl(ORACLE_INSURANCE_TABLE),
      },
    ],
    githubUrl: githubTreeUrl(
      'module-oracle/src/main/resources/db/changelog',
    ),
    accent: 'oracle',
    modeNotes: {
      'initial-load':
        'Проверка v$session и захват SCN выполняются до первого COPY. ' +
        'Окружение обязано быть остановлено, иначе sourceGuard вернёт 409.',
      mirror:
        'Зеркальный режим работает без остановки: строки читаются keyset-страницами, ' +
        'а stale-строки удаляются по last_seen_run.',
    },
    x: 24,
    y: 232,
    width: 196,
    height: 134,
  },
  {
    id: 'module-migration',
    kind: 'service',
    title: 'module-migration',
    subtitle: '/api/v1/migration',
    role: 'миграция данных',
    port: '8083',
    apiPrefix: '/api/v1/migration',
    description:
      'Читает Oracle через sourceJdbcTemplate и пишет в готовую PostgreSQL-схему ' +
      'через targetJdbcTemplate. Таблицы не создаёт: запускается после того, как ' +
      'схему подготовил Liquibase или schema-мигратор. Владеет async-job initial-load.',
    footer: 'маршрут данных',
    keyItemsLabel: 'Ключевые классы',
    keyItems: [
      { name: 'MigrationController', href: githubBlobUrl(MIGRATION_CONTROLLER) },
      {
        name: 'InitialLoadMigrationService',
        href: githubBlobUrl(INITIAL_LOAD_SERVICE),
      },
      { name: 'MigrationJobManager', href: githubBlobUrl(JOB_MANAGER) },
      { name: 'UserMigrationService', href: githubBlobUrl(USER_MIGRATION_SERVICE) },
      { name: 'PostgresChunkGateway', href: githubBlobUrl(CHUNK_GATEWAY) },
    ],
    githubUrl: githubTreeUrl('module-migration'),
    accent: 'magenta',
    modeNotes: {
      'initial-load':
        'Пишет COPY-чанками напрямую в target, сохраняет source id и коммитит ' +
        'каждый чанк отдельно. Upsert, adoption и stale не используются.',
      mirror:
        'Читает keyset-страницы, загружает их в TEMP staging и применяет set-based ' +
        'upsert/adoption/stale. Все записи target идут в одной транзакции.',
    },
    modeBadges: {
      'initial-load': 'COPY',
      mirror: 'staging',
    },
    x: 330,
    y: 160,
    width: 240,
    height: 150,
  },
  {
    id: 'module-schema-migration',
    kind: 'service',
    title: 'module-schema-migration',
    subtitle: '/api/v1/schema-migration',
    role: 'миграция схемы',
    port: '8084',
    apiPrefix: '/api/v1/schema-migration',
    description:
      'Читает Oracle DatabaseMetaData, генерирует PostgreSQL DDL и применяет его ' +
      'в auto_migration. После apply module-migration загружает данные в готовую ' +
      'схему; существующие таблицы дополняются только nullable-колонками.',
    footer: 'auto_migration',
    keyItemsLabel: 'Ключевые классы',
    keyItems: [
      { name: 'SchemaMigrationController', href: githubBlobUrl(SCHEMA_CONTROLLER) },
      { name: 'SchemaMigrationService', href: githubBlobUrl(SCHEMA_SERVICE) },
      { name: 'PostgresDdlGenerator', href: githubBlobUrl(DDL_GENERATOR) },
      { name: 'PostgresTypeMapper', href: githubBlobUrl(TYPE_MAPPER) },
    ],
    githubUrl: githubTreeUrl('module-schema-migration'),
    accent: 'electric',
    activeForSchemaOwners: ['auto_migration'],
    x: 330,
    y: 390,
    width: 240,
    height: 130,
  },
  {
    id: 'module-postgres',
    kind: 'service',
    title: 'module-postgres',
    subtitle: '/api/v1/postgres',
    role: 'приложение-приёмник',
    port: '8082',
    apiPrefix: '/api/v1/postgres',
    description:
      'TARGET-приложение: CRUD над схемой public. Liquibase этого модуля создаёт ' +
      'users, orders, insurance_program_users и migration_entity_map; ddl-auto ' +
      'остаётся validate. При выборе auto_migration модуль не участвует.',
    footer: 'public · Liquibase',
    keyItemsLabel: 'Ключевые классы и файлы',
    keyItems: [
      {
        name: 'UserController',
        href: githubBlobUrl(POSTGRES_USER_CONTROLLER),
      },
      {
        name: 'OrderController',
        href: githubBlobUrl(POSTGRES_ORDER_CONTROLLER),
      },
      { name: 'UserService', href: githubBlobUrl(POSTGRES_USER_SERVICE) },
      { name: 'OrderService', href: githubBlobUrl(POSTGRES_ORDER_SERVICE) },
      {
        name: 'create-migration-entity-map-table.xml',
        href: githubBlobUrl(POSTGRES_ENTITY_MAP),
      },
    ],
    githubUrl: githubTreeUrl('module-postgres'),
    accent: 'pg',
    activeForSchemaOwners: ['public'],
    x: 680,
    y: 28,
    width: 196,
    height: 112,
  },
  {
    id: 'postgres-db',
    kind: 'database',
    title: 'PostgreSQL',
    subtitle: 'public · auto_migration',
    role: 'база-приёмник',
    port: '5432',
    description:
      'Приёмник. public принадлежит Liquibase module-postgres, auto_migration ' +
      'создаёт module-schema-migration. Используется ровно одна схема; ' +
      'module-migration пишет только в уже существующую выбранную схему.',
    footer: 'public / auto_migration',
    keyItemsLabel: 'Ключевые таблицы',
    keyItems: [
      { name: 'users', href: githubBlobUrl(POSTGRES_USERS_TABLE) },
      { name: 'orders', href: githubBlobUrl(POSTGRES_ORDERS_TABLE) },
      {
        name: 'insurance_program_users',
        href: githubBlobUrl(POSTGRES_INSURANCE_TABLE),
      },
      {
        name: 'migration_entity_map',
        href: githubBlobUrl(POSTGRES_ENTITY_MAP),
      },
    ],
    githubUrl: githubTreeUrl(
      'module-postgres/src/main/resources/db/changelog',
    ),
    accent: 'pg',
    modeNotes: {
      'initial-load':
        'Target должен быть пуст перед первым запуском либо очищен через ' +
        'truncate-target=true. Повтор после падения продолжается с MAX(id) при resume=true.',
      mirror:
        'Target-таблицы уже готовы; upsert обновляет управляемые строки, ' +
        'adoption находит существующие по source_key.',
    },
    x: 680,
    y: 232,
    width: 196,
    height: 134,
  },
  {
    id: 'entity-map',
    kind: 'table',
    title: 'migration_entity_map',
    subtitle: 'source_id → target_id',
    role: 'служебная таблица',
    description:
      'Служебная карта зеркала: entity_type, source_id, target_id, source_key, ' +
      'last_seen_run, updated_at. PK — (entity_type, source_id), уникальность — ' +
      '(entity_type, target_id). Для public её создаёт Liquibase, для ' +
      'auto_migration — schema-мигратор.',
    footer: 'карта зеркала',
    keyItemsLabel: 'Файлы и классы',
    keyItems: [
      {
        name: 'create-migration-entity-map-table.xml',
        href: githubBlobUrl(POSTGRES_ENTITY_MAP),
      },
      {
        name: 'add-migration-entity-map-last-seen-run.xml',
        href: githubBlobUrl(POSTGRES_ENTITY_MAP_LAST_SEEN),
      },
      { name: 'PostgresChunkGateway', href: githubBlobUrl(CHUNK_GATEWAY) },
      { name: 'PostgresDdlGenerator', href: githubBlobUrl(DDL_GENERATOR) },
    ],
    githubUrl: githubBlobUrl(POSTGRES_ENTITY_MAP),
    accent: 'magenta',
    modeNotes: {
      'initial-load':
        'Нужна только при populate-mapping=true: source id сохраняются, поэтому ' +
        'карта заполняется как source_id = target_id.',
      mirror:
        'Обязательна: хранит соответствие source_id → target_id, source_key и ' +
        'last_seen_run. Строки с чужим runId удаляются как stale.',
    },
    modeBadges: {
      'initial-load': 'опция',
      mirror: 'обязательна',
    },
    x: 640,
    y: 436,
    width: 236,
    height: 100,
  },
];

export const ARCHITECTURE_EDGES: readonly ArchitectureEdge[] = [
  {
    id: 'app-oracle',
    from: 'module-oracle',
    to: 'oracle-db',
    path: 'M 122 140 L 122 232',
    variant: 'app',
    labelX: 132,
    labelY: 190,
  },
  {
    id: 'app-postgres',
    from: 'module-postgres',
    to: 'postgres-db',
    path: 'M 778 140 L 778 232',
    variant: 'app',
    schemaOwners: ['public'],
    label: '1 · Liquibase',
    labelX: 788,
    labelY: 190,
  },
  {
    id: 'source-to-migration',
    from: 'oracle-db',
    to: 'module-migration',
    path: 'M 220 280 C 270 280, 290 244, 330 238',
    variant: 'route',
    modes: ['initial-load', 'mirror'],
    modeLabels: {
      'initial-load': 'JDBC · keyset',
      mirror: 'keyset',
    },
    labelX: 224,
    labelY: 252,
  },
  {
    id: 'source-to-schema',
    from: 'oracle-db',
    to: 'module-schema-migration',
    path: 'M 220 335 C 270 350, 285 450, 330 455',
    variant: 'schema',
    schemaOwners: ['auto_migration'],
    label: '1 · metadata',
    labelX: 246,
    labelY: 401,
  },
  {
    id: 'migration-to-postgres',
    from: 'module-migration',
    to: 'postgres-db',
    path: 'M 570 238 C 620 238, 640 278, 680 280',
    variant: 'route',
    modes: ['initial-load'],
    label: '2 · COPY',
    labelX: 610,
    labelY: 252,
  },
  {
    id: 'migration-to-map',
    from: 'module-migration',
    to: 'entity-map',
    path: 'M 540 310 C 590 340, 625 390, 660 436',
    variant: 'route',
    modes: ['mirror'],
    label: 'staging',
    labelX: 594,
    labelY: 365,
  },
  {
    id: 'map-to-postgres',
    from: 'entity-map',
    to: 'postgres-db',
    path: 'M 758 436 C 758 407, 770 385, 778 366',
    variant: 'route',
    modes: ['mirror'],
    label: '2 · upsert',
    labelX: 791,
    labelY: 404,
  },
  {
    id: 'schema-to-postgres',
    from: 'module-schema-migration',
    to: 'postgres-db',
    path: 'M 570 455 C 615 455, 645 340, 680 330',
    variant: 'schema',
    schemaOwners: ['auto_migration'],
    label: '1 · DDL',
    labelX: 608,
    labelY: 392,
  },
];

export const MIGRATION_MODE_OPTIONS: readonly MigrationModeOption[] = [
  {
    id: 'initial-load',
    label: 'initial-load',
    shortDescription: 'по умолчанию',
    route: 'Oracle → keyset + COPY → PostgreSQL',
    routeDetail: 'source id сохраняется · commit на каждый чанк',
  },
  {
    id: 'mirror',
    label: 'mirror',
    shortDescription: 'без простоя',
    route: 'Oracle → staging → migration_entity_map → PostgreSQL',
    routeDetail: 'upsert / adoption / stale · одна target-транзакция',
  },
];

export const SCHEMA_OWNER_OPTIONS: readonly SchemaOwnerOption[] = [
  {
    id: 'public',
    label: 'public',
    shortDescription: 'Liquibase',
    ownerModule: 'module-postgres',
    schemaStep: 'module-postgres → public',
    detail:
      'Liquibase создаёт таблицы и migration_entity_map. Schema-мигратор не участвует.',
  },
  {
    id: 'auto_migration',
    label: 'auto_migration',
    shortDescription: 'DDL',
    ownerModule: 'module-schema-migration',
    schemaStep: 'module-schema-migration → auto_migration',
    detail:
      'Сначала apply DDL, затем module-migration с TARGET_POSTGRES_SCHEMA=auto_migration загружает данные. Module-postgres не участвует.',
  },
];
