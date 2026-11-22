import type { PipelinePhaseId } from './pipeline';

export type SimulationSpeed = 1 | 2 | 4;
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed';
export type SimulationLogLevel = 'info' | 'ok' | 'warn' | 'error';

export interface SimulationLog {
  readonly id: string;
  readonly atMs: number;
  readonly level: SimulationLogLevel;
  readonly message: string;
}

export interface SimulationSnapshot {
  readonly status: SimulationStatus;
  readonly speed: SimulationSpeed;
  readonly progress: number;
  readonly rowsLoaded: number;
  readonly totalRows: number;
  readonly rowsPerSecond: number | null;
  readonly etaSeconds: number | null;
  readonly currentPhaseId: PipelinePhaseId | null;
  readonly completedPhaseIds: readonly PipelinePhaseId[];
  readonly currentTable: string | null;
  readonly completedTables: readonly string[];
  readonly logs: readonly SimulationLog[];
  readonly validationPassed: boolean;
}

export interface SimulationTable {
  readonly name: string;
  readonly rows: number;
}

export interface SimulationEvent {
  readonly phaseId: PipelinePhaseId;
  readonly log: string;
  readonly level?: SimulationLogLevel;
  readonly table?: string | null;
  readonly tableComplete?: string;
  readonly rowsLoaded?: number;
  readonly validationPassed?: boolean;
}
