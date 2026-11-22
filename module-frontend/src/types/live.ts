import type {
  MigrationJobResponse,
  MigrationReport,
  MigrationStatus,
  SchemaDiffReport,
  SchemaMigrationReport,
  SchemaMigrationStatus,
} from './migration-api';

export type RuntimeMode = 'demo' | 'live';

export type LiveServiceId =
  | 'oracle'
  | 'postgres'
  | 'migration'
  | 'schema';

export type ServiceHealthStatus = 'unknown' | 'checking' | 'up' | 'down';

export interface LiveServiceDefinition {
  readonly id: LiveServiceId;
  readonly name: string;
  readonly port: string;
  readonly baseUrl: string;
  readonly healthPath: string;
}

export interface ServiceHealth {
  readonly id: LiveServiceId;
  readonly name: string;
  readonly port: string;
  readonly status: ServiceHealthStatus;
  readonly latencyMs: number | null;
  readonly error: string | null;
  readonly checkedAt: string | null;
}

export type LiveResourceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'offline'
  | 'error';

export interface LiveResource<T> {
  readonly status: LiveResourceStatus;
  readonly data: T | null;
  readonly error: string | null;
  readonly updatedAt: string | null;
}

export interface LiveData {
  readonly migrationStatus: LiveResource<MigrationStatus>;
  readonly schemaDiff: LiveResource<SchemaDiffReport>;
  readonly schemaStatus: LiveResource<SchemaMigrationStatus>;
  readonly tables: LiveResource<string[]>;
}

export type LiveActionKind = 'sync' | 'async' | 'apply' | null;

export interface LiveActionState {
  readonly running: boolean;
  readonly kind: LiveActionKind;
  readonly report: MigrationReport | null;
  readonly schemaReport: SchemaMigrationReport | null;
  readonly error: string | null;
  readonly completedAt: string | null;
}

export interface AsyncJobState {
  readonly jobId: string | null;
  readonly data: MigrationJobResponse | null;
  readonly polling: boolean;
  readonly canceling: boolean;
  readonly error: string | null;
}
