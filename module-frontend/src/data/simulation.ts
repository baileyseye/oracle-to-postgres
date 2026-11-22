import type {
  SimulationEvent,
  SimulationTable,
} from '../types/simulation';

export const DEMO_TABLES: readonly SimulationTable[] = [
  { name: 'users', rows: 2 },
  { name: 'orders', rows: 4 },
  { name: 'insurance_program_users', rows: 10 },
];

export const DEMO_TOTAL_ROWS = DEMO_TABLES.reduce(
  (total, table) => total + table.rows,
  0,
);

export const DEMO_SOURCE_SCN = 18574239910;

export const SIMULATION_EVENTS: readonly SimulationEvent[] = [
  {
    phaseId: 'plan',
    table: null,
    log: 'planBuilder: metadata Oracle и PostgreSQL прочитаны',
  },
  {
    phaseId: 'plan',
    log: 'generic-план: insurance_program_users; порядок по FK — users → orders → generic',
  },
  {
    phaseId: 'source-guard',
    table: null,
    log: 'sourceGuard: v$session — активных USER-сессий в схеме источника нет',
    level: 'ok',
  },
  {
    phaseId: 'source-guard',
    log: `SCN источника зафиксирован: ${DEMO_SOURCE_SCN}`,
  },
  {
    phaseId: 'pre-load',
    table: null,
    log: 'pre-load.sql: сняты fk_orders_user и secondary unique',
  },
  {
    phaseId: 'pre-load',
    log: 'PK сохранены; DROP CONSTRAINT IF EXISTS делает шаг идемпотентным',
  },
  {
    phaseId: 'users',
    table: 'users',
    log: 'users: keyset-страница по id, chunk 5000, source id сохраняется',
  },
  {
    phaseId: 'users',
    tableComplete: 'users',
    rowsLoaded: 2,
    log: 'users: COPY 2 / 2 строк, source id сохранён',
    level: 'ok',
  },
  {
    phaseId: 'orders',
    table: 'orders',
    log: 'orders: keyset-страница по id, chunk 5000',
  },
  {
    phaseId: 'orders',
    tableComplete: 'orders',
    rowsLoaded: 6,
    log: 'orders: COPY 4 / 4 строк, id и user_id сохранены',
    level: 'ok',
  },
  {
    phaseId: 'generic',
    table: 'insurance_program_users',
    log: 'generic: insurance_program_users, LOB-aware chunk 10',
  },
  {
    phaseId: 'generic',
    tableComplete: 'insurance_program_users',
    rowsLoaded: 16,
    log: 'insurance_program_users: COPY 10 / 10 строк',
    level: 'ok',
  },
  {
    phaseId: 'restart-sequences',
    table: null,
    log: 'restartSequences(users): next id = 3',
  },
  {
    phaseId: 'restart-sequences',
    log: 'restartSequences(orders): next id = 5; insurance_program_users: next id = 11',
  },
  {
    phaseId: 'populate-mapping',
    table: null,
    log: 'populate-mapping=false: шаг migration_entity_map пропущен',
  },
  {
    phaseId: 'post-load',
    table: null,
    log: 'post-load.sql: восстановлены unique-ограничения',
  },
  {
    phaseId: 'post-load',
    log: 'fk_orders_user: NOT VALID → VALIDATED; maintenance_work_mem=512MB',
  },
  {
    phaseId: 'validation',
    table: null,
    log: 'validation: counts, min/max/sum, длины и null-поля',
  },
  {
    phaseId: 'validation',
    log: 'validation: orphan-FK = 0; sequences не отстают от MAX(id)',
  },
  {
    phaseId: 'validation',
    validationPassed: true,
    log: 'VALIDATION PASSED',
    level: 'ok',
  },
];
