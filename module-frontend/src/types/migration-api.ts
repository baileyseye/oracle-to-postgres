/**
 * Поля повторяют DTO модуля module-migration один в один.
 * LocalDateTime сериализуется Jackson в ISO-строку.
 */

export type MigrationModeName = 'MIRROR' | 'INITIAL_LOAD';
export type MigrationModeId = 'initial-load' | 'mirror';

export type MigrationJobStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface MigrationJobResponse {
  jobId: string;
  mode: MigrationModeName;
  status: MigrationJobStatus;
  phase: string;
  table: string | null;
  lastId: number | null;
  rowsLoaded: number;
  sourceMaxId: number | null;
  sourceScn: number | null;
  sourceIdle: boolean | null;
  tablesTotal: number | null;
  tablesCompleted: number;
  rowsPerSecond: number | null;
  etaSeconds: number | null;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  report: MigrationReport | null;
  error: string | null;
}

export interface MigrationReport {
  mode: MigrationModeName;
  sourceScn: number | null;
  sourceIdle: boolean | null;
  validation: MigrationValidationReport | null;
  startedAt: string;
  finishedAt: string;
  usersRead: number;
  usersInserted: number;
  usersUpdated: number;
  usersDeleted: number;
  ordersRead: number;
  ordersInserted: number;
  ordersUpdated: number;
  ordersDeleted: number;
  tables: TableLoadResult[];
}

export interface MigrationValidationReport {
  valid: boolean;
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  sourceValue: string | null;
  targetValue: string | null;
  passed: boolean;
  message: string | null;
}

export interface TableLoadResult {
  table: string;
  rows: number;
}

export interface MigrationStatus {
  sourceUsers: number;
  targetUsers: number;
  targetManagedUsers: number;
  sourceOrders: number;
  targetOrders: number;
  targetManagedOrders: number;
}

export type SchemaIssueSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type SchemaObjectType =
  | 'TABLE'
  | 'COLUMN'
  | 'PRIMARY_KEY'
  | 'FOREIGN_KEY'
  | 'UNIQUE'
  | 'INDEX'
  | 'CHECK'
  | 'DEFAULT';

export interface SchemaDiffReport {
  sourceSchema: string;
  targetSchema: string;
  checkedTables: number;
  missingTables: number;
  missingColumns: number;
  missingIndexes: number;
  errors: number;
  warnings: number;
  infos: number;
  valid: boolean;
  tables: TableDiff[];
}

export interface TableDiff {
  table: string;
  presentInTarget: boolean;
  missingColumns: string[];
  missingIndexes: IndexMetadata[];
  issues: SchemaIssue[];
}

export interface SchemaIssue {
  severity: SchemaIssueSeverity;
  objectType: SchemaObjectType;
  objectName: string;
  message: string;
  sourceValue: string | null;
  targetValue: string | null;
}

export interface IndexMetadata {
  unique: boolean;
  columns: string[];
}

export interface SchemaMigrationPlan {
  sourceSchema: string;
  targetSchema: string;
  targetEmpty: boolean;
  tables: number;
  statements: number;
  ddl: SchemaDdlStatement[];
  warnings: string[];
  unsupportedObjects: UnsupportedObject[];
}

export interface SchemaMigrationReport {
  sourceSchema: string;
  targetSchema: string;
  startedAt: string;
  finishedAt: string;
  appliedStatements: number;
  totalStatements: number;
  success: boolean;
  warnings: string[];
}

export interface SchemaMigrationStatus {
  sourceSchema: string;
  targetSchema: string;
  targetExists: boolean;
  sourceTables: number;
  targetTables: number;
  missingTables: number;
  missingColumns: number;
  valid: boolean;
  tables: TableSchemaStatus[];
  unsupportedObjects: UnsupportedObject[];
}

export interface TableSchemaStatus {
  table: string;
  presentInTarget: boolean;
  missingColumns: string[];
}

export interface SchemaDdlStatement {
  phase: string;
  objectType: string;
  objectName: string;
  sql: string;
}

export interface UnsupportedObject {
  type: string;
  count: number;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  report?: MigrationReport;
  validation?: MigrationValidationReport;
}
