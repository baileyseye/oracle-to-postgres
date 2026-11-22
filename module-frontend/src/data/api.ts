import type {
  ApiEndpoint,
  ApiService,
  ApiStatusCode,
  HealthTarget,
} from '../types/api';
import {
  MIGRATION_JOB_SAMPLE,
  MIGRATION_REPORT_SAMPLE,
  SCHEMA_DIFF_SAMPLE,
} from './api-samples';

export const API_STATUS_CODES: readonly ApiStatusCode[] = [
  { code: 200, meaning: 'Успех' },
  { code: 202, meaning: 'Async job принят' },
  { code: 404, meaning: 'Таблица или job не найден' },
  { code: 409, meaning: 'Конфликт данных или уже выполняется другой запуск' },
  { code: 422, meaning: 'Validation initial-load не пройдена' },
  { code: 500, meaning: 'Прикладная ошибка сервиса' },
  { code: 503, meaning: 'Источник, приёмник или служебная схема недоступны' },
];

const MIGRATION_ENDPOINTS: readonly ApiEndpoint[] = [
  {
    id: 'migration-tables',
    service: 'migration',
    method: 'GET',
    path: '/api/v1/migration/tables',
    title: 'Таблицы источника',
    description:
      'Список таблиц Oracle-схемы без системных объектов и Liquibase-таблиц.',
    responseType: 'string[]',
    successStatus: 200,
    responseCodes: [200, 503],
    curl: 'curl "http://localhost:8083/api/v1/migration/tables"',
  },
  {
    id: 'migration-columns',
    service: 'migration',
    method: 'GET',
    path: '/api/v1/migration/tables/{tableName}/columns',
    title: 'Колонки таблицы',
    description:
      'Колонки таблицы из DatabaseMetaData. Имя проходит через qualifiedTableName().',
    responseType: 'string[]',
    successStatus: 200,
    responseCodes: [200, 404, 503],
    curl:
      'curl "http://localhost:8083/api/v1/migration/tables/insurance_program_users/columns"',
  },
  {
    id: 'migration-rows',
    service: 'migration',
    method: 'GET',
    path: '/api/v1/migration/tables/{tableName}/rows',
    title: 'Строки таблицы',
    description:
      'SELECT * с лимитом migration.source.row-limit (по умолчанию 100).',
    responseType: 'Array<Record<string, unknown>>',
    successStatus: 200,
    responseCodes: [200, 404, 503],
    curl:
      'curl "http://localhost:8083/api/v1/migration/tables/insurance_program_users/rows"',
  },
  {
    id: 'migration-status',
    service: 'migration',
    method: 'GET',
    path: '/api/v1/migration/status',
    title: 'Статус source/target',
    description:
      'COUNT(*) в Oracle и PostgreSQL, включая число управляемых миграцией строк.',
    responseType: 'MigrationStatus',
    successStatus: 200,
    responseCodes: [200, 503],
    curl: 'curl "http://localhost:8083/api/v1/migration/status"',
  },
  {
    id: 'migration-schema-diff',
    service: 'migration',
    method: 'GET',
    path: '/api/v1/migration/schema/diff',
    title: 'Schema diff',
    description:
      'Сравнение таблиц, колонок, типов, nullable, defaults, identity, PK/FK, ' +
      'индексов и CHECK. Имена constraints и индексов не сравниваются.',
    responseType: 'SchemaDiffReport',
    successStatus: 200,
    responseCodes: [200, 503],
    curl: 'curl "http://localhost:8083/api/v1/migration/schema/diff"',
    sampleResponse: SCHEMA_DIFF_SAMPLE,
  },
  {
    id: 'migration-run',
    service: 'migration',
    method: 'POST',
    path: '/api/v1/migration/run',
    title: 'Синхронный запуск',
    description:
      'Запускает режим из MIGRATION_MODE. Для initial-load validation с ошибкой ' +
      'возвращает 422 и отчёт; FAILED означает, что приложение открывать нельзя.',
    responseType: 'MigrationReport',
    successStatus: 200,
    responseCodes: [200, 409, 422, 500, 503],
    curl: 'curl -X POST "http://localhost:8083/api/v1/migration/run"',
    dangerous: true,
    sampleResponse: MIGRATION_REPORT_SAMPLE,
  },
  {
    id: 'migration-run-async',
    service: 'migration',
    method: 'POST',
    path: '/api/v1/migration/run/async',
    title: 'Async-запуск',
    description:
      'Фоновый initial-load: 202 + jobId. Второй активный job получает 409. ' +
      'Отмена mirror не поддерживается.',
    responseType: 'MigrationJobResponse',
    successStatus: 202,
    responseCodes: [202, 409, 500],
    curl: 'curl -X POST "http://localhost:8083/api/v1/migration/run/async"',
    dangerous: true,
  },
  {
    id: 'migration-job',
    service: 'migration',
    method: 'GET',
    path: '/api/v1/migration/run/{jobId}',
    title: 'Статус async job',
    description:
      'phase, table, lastId, rowsLoaded, sourceMaxId, sourceScn, sourceIdle, ' +
      'tablesTotal, tablesCompleted, rowsPerSecond, etaSeconds, report и error.',
    responseType: 'MigrationJobResponse',
    successStatus: 200,
    responseCodes: [200, 404],
    curl: 'curl "http://localhost:8083/api/v1/migration/run/{jobId}"',
    sampleResponse: MIGRATION_JOB_SAMPLE,
  },
  {
    id: 'migration-cancel',
    service: 'migration',
    method: 'POST',
    path: '/api/v1/migration/run/{jobId}/cancel',
    title: 'Отмена job',
    description:
      'Запрашивает отмену initial-load между чанками. Для mirror и финализации — 409.',
    responseType: 'MigrationJobResponse',
    successStatus: 200,
    responseCodes: [200, 404, 409],
    curl:
      'curl -X POST "http://localhost:8083/api/v1/migration/run/{jobId}/cancel"',
  },
];

const SCHEMA_ENDPOINTS: readonly ApiEndpoint[] = [
  {
    id: 'schema-preview',
    service: 'schema-migration',
    method: 'GET',
    path: '/api/v1/schema-migration/preview',
    title: 'Предпросмотр DDL',
    description:
      'Генерирует SchemaMigrationPlan: DDL, warnings и unsupportedObjects без применения.',
    responseType: 'SchemaMigrationPlan',
    successStatus: 200,
    responseCodes: [200, 500, 503],
    curl: 'curl "http://localhost:8084/api/v1/schema-migration/preview"',
  },
  {
    id: 'schema-apply',
    service: 'schema-migration',
    method: 'POST',
    path: '/api/v1/schema-migration/apply',
    title: 'Применить DDL',
    description:
      'Применяет DDL к auto_migration в одной target-транзакции. Для существующих ' +
      'таблиц добавляет только отсутствующие nullable-колонки.',
    responseType: 'SchemaMigrationReport',
    successStatus: 200,
    responseCodes: [200, 500, 503],
    curl: 'curl -X POST "http://localhost:8084/api/v1/schema-migration/apply"',
    dangerous: true,
  },
  {
    id: 'schema-status',
    service: 'schema-migration',
    method: 'GET',
    path: '/api/v1/schema-migration/status',
    title: 'Статус schema migration',
    description:
      'Сравнивает Oracle-схему с target snapshot: missing tables, columns и unsupported.',
    responseType: 'SchemaMigrationStatus',
    successStatus: 200,
    responseCodes: [200, 500, 503],
    curl: 'curl "http://localhost:8084/api/v1/schema-migration/status"',
  },
];

export const API_SERVICES: readonly ApiService[] = [
  {
    id: 'migration',
    name: 'module-migration',
    port: '8083',
    apiPrefix: '/api/v1/migration',
    description:
      'Перенос данных Oracle → PostgreSQL, read-only preview источника, ' +
      'async-job и schema diff. Не создаёт target-схему.',
    endpoints: MIGRATION_ENDPOINTS,
  },
  {
    id: 'schema-migration',
    name: 'module-schema-migration',
    port: '8084',
    apiPrefix: '/api/v1/schema-migration',
    description:
      'Читает Oracle-схему, генерирует PostgreSQL DDL и применяет его в auto_migration.',
    endpoints: SCHEMA_ENDPOINTS,
  },
];

export const HEALTH_TARGETS: readonly HealthTarget[] = [
  {
    id: 'oracle',
    name: 'module-oracle',
    port: '8081',
    path: '/actuator/health',
  },
  {
    id: 'postgres',
    name: 'module-postgres',
    port: '8082',
    path: '/actuator/health',
  },
  {
    id: 'migration',
    name: 'module-migration',
    port: '8083',
    path: '/actuator/health',
  },
  {
    id: 'schema-migration',
    name: 'module-schema-migration',
    port: '8084',
    path: '/actuator/health',
  },
];
