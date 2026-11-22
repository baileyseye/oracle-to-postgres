import type {
  MigrationJobResponse,
  MigrationReport,
  SchemaDiffReport,
} from '../types/migration-api';

export const MIGRATION_JOB_SAMPLE: MigrationJobResponse = {
  jobId: 'cb0c0e0a-7a2f-4d4b-9c8e-6ed2f4f2f6a1',
  mode: 'INITIAL_LOAD',
  status: 'RUNNING',
  phase: 'ORDERS',
  table: 'orders',
  lastId: 3,
  rowsLoaded: 5,
  sourceMaxId: 4,
  sourceScn: 18574239910,
  sourceIdle: true,
  tablesTotal: 3,
  tablesCompleted: 1,
  rowsPerSecond: 5,
  etaSeconds: 0,
  startedAt: '2026-11-22T18:00:00',
  finishedAt: null,
  durationSeconds: 1,
  report: null,
  error: null,
};

export const MIGRATION_REPORT_SAMPLE: MigrationReport = {
  mode: 'INITIAL_LOAD',
  sourceScn: 18574239910,
  sourceIdle: true,
  validation: {
    valid: true,
    checks: [
      {
        name: 'users.count',
        sourceValue: '2',
        targetValue: '2',
        passed: true,
        message: null,
      },
      {
        name: 'users.minId',
        sourceValue: '1',
        targetValue: '1',
        passed: true,
        message: null,
      },
      {
        name: 'users.maxId',
        sourceValue: '2',
        targetValue: '2',
        passed: true,
        message: null,
      },
      {
        name: 'users.sumId',
        sourceValue: '3',
        targetValue: '3',
        passed: true,
        message: null,
      },
      {
        name: 'users.username',
        sourceValue: '24',
        targetValue: '24',
        passed: true,
        message: null,
      },
      {
        name: 'users.email',
        sourceValue: '60',
        targetValue: '60',
        passed: true,
        message: null,
      },
      {
        name: 'users.nullFields',
        sourceValue: '0',
        targetValue: '0',
        passed: true,
        message: null,
      },
      {
        name: 'users.sequence',
        sourceValue: '2',
        targetValue: '2',
        passed: true,
        message: null,
      },
      {
        name: 'orders.count',
        sourceValue: '4',
        targetValue: '4',
        passed: true,
        message: null,
      },
      {
        name: 'orders.orphanUsers',
        sourceValue: '0',
        targetValue: '0',
        passed: true,
        message: null,
      },
    ],
  },
  startedAt: '2026-11-22T18:00:00',
  finishedAt: '2026-11-22T18:00:02',
  usersRead: 2,
  usersInserted: 2,
  usersUpdated: 0,
  usersDeleted: 0,
  ordersRead: 4,
  ordersInserted: 4,
  ordersUpdated: 0,
  ordersDeleted: 0,
  tables: [
    {
      table: 'insurance_program_users',
      rows: 10,
    },
  ],
};

export const SCHEMA_DIFF_SAMPLE: SchemaDiffReport = {
  sourceSchema: 'SYSTEM',
  targetSchema: 'public',
  checkedTables: 3,
  missingTables: 0,
  missingColumns: 0,
  missingIndexes: 0,
  errors: 0,
  warnings: 1,
  infos: 1,
  valid: true,
  tables: [
    {
      table: 'users',
      presentInTarget: true,
      missingColumns: [],
      missingIndexes: [],
      issues: [],
    },
    {
      table: 'orders',
      presentInTarget: true,
      missingColumns: [],
      missingIndexes: [],
      issues: [
        {
          severity: 'INFO',
          objectType: 'CHECK',
          objectName: 'ck_orders_status',
          message:
            'CHECK-выражение отличается диалектом и требует ручного review',
          sourceValue:
            "status IN ('NEW', 'PAID', 'SHIPPED', 'CANCELLED')",
          targetValue:
            "status::text = ANY (ARRAY['NEW'::character varying, 'PAID'::character varying, 'SHIPPED'::character varying, 'CANCELLED'::character varying]::text[])",
        },
      ],
    },
    {
      table: 'insurance_program_users',
      presentInTarget: true,
      missingColumns: [],
      missingIndexes: [],
      issues: [],
    },
  ],
};
