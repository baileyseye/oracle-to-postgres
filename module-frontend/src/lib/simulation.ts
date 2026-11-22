import { DEMO_TOTAL_ROWS, SIMULATION_EVENTS } from '../data/simulation';
import type { PipelinePhaseId } from '../types/pipeline';
import type {
  SimulationEvent,
  SimulationLog,
  SimulationSnapshot,
  SimulationSpeed,
  SimulationStatus,
} from '../types/simulation';

const BASE_TICK_MS = 420;
const VIRTUAL_EVENT_MS = 350;

type Listener = () => void;

function addUnique<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values : [...values, value];
}

export class MigrationSimulation {
  private readonly events: readonly SimulationEvent[];
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: SimulationStatus = 'idle';
  private speed: SimulationSpeed = 1;
  private eventIndex = 0;
  private elapsedMs = 0;
  private rowsLoaded = 0;
  private currentTable: string | null = null;
  private completedTables: string[] = [];
  private currentPhaseId: PipelinePhaseId | null = null;
  private completedPhaseIds: PipelinePhaseId[] = [];
  private validationPassed = false;
  private logs: SimulationLog[] = [];
  private snapshot: SimulationSnapshot;

  constructor(events: readonly SimulationEvent[] = SIMULATION_EVENTS) {
    this.events = events;
    this.snapshot = this.createSnapshot();
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): SimulationSnapshot => this.snapshot;

  readonly start = (): void => {
    if (this.status === 'running' || this.status === 'completed') {
      return;
    }

    this.status = 'running';
    this.emit();
    this.schedule();
  };

  readonly pause = (): void => {
    if (this.status !== 'running') {
      return;
    }

    this.clearTimer();
    this.status = 'paused';
    this.emit();
  };

  readonly reset = (): void => {
    this.clearTimer();
    this.resetState();
    this.status = 'idle';
    this.emit();
  };

  readonly restart = (): void => {
    this.clearTimer();
    this.resetState();
    this.status = 'running';
    this.emit();
    this.schedule();
  };

  readonly setSpeed = (speed: SimulationSpeed): void => {
    if (this.speed === speed) {
      return;
    }

    this.speed = speed;

    if (this.status === 'running') {
      this.schedule();
    }

    this.emit();
  };

  readonly dispose = (): void => {
    this.clearTimer();
  };

  private readonly tick = (): void => {
    this.timer = null;

    if (this.status !== 'running') {
      return;
    }

    const event = this.events[this.eventIndex];

    if (!event) {
      this.complete();
      return;
    }

    this.eventIndex += 1;
    this.elapsedMs += VIRTUAL_EVENT_MS;
    this.currentPhaseId = event.phaseId;

    if (event.table !== undefined) {
      this.currentTable = event.table;
    }

    if (event.tableComplete) {
      this.completedTables = addUnique(
        this.completedTables,
        event.tableComplete,
      );
    }

    if (event.rowsLoaded !== undefined) {
      this.rowsLoaded = event.rowsLoaded;
    }

    if (event.validationPassed) {
      this.validationPassed = true;
    }

    this.logs = [
      ...this.logs,
      {
        id: `${this.eventIndex}-${event.phaseId}`,
        atMs: this.elapsedMs,
        level: event.level ?? 'info',
        message: event.log,
      },
    ];

    const nextEvent = this.events[this.eventIndex];

    if (!nextEvent || nextEvent.phaseId !== event.phaseId) {
      this.completedPhaseIds = addUnique(
        this.completedPhaseIds,
        event.phaseId,
      );
    }

    if (!nextEvent) {
      this.complete();
      return;
    }

    this.emit();
    this.schedule();
  };

  private complete(): void {
    this.clearTimer();
    this.status = 'completed';
    this.currentPhaseId = 'validation';
    this.emit();
  }

  private resetState(): void {
    this.eventIndex = 0;
    this.elapsedMs = 0;
    this.rowsLoaded = 0;
    this.currentTable = null;
    this.completedTables = [];
    this.currentPhaseId = null;
    this.completedPhaseIds = [];
    this.validationPassed = false;
    this.logs = [];
  }

  private schedule(): void {
    this.clearTimer();
    this.timer = globalThis.setTimeout(
      this.tick,
      BASE_TICK_MS / this.speed,
    );
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emit(): void {
    this.snapshot = this.createSnapshot();

    for (const listener of this.listeners) {
      listener();
    }
  }

  private createSnapshot(): SimulationSnapshot {
    const elapsedSeconds = this.elapsedMs / 1000;
    const rowsPerSecond =
      this.rowsLoaded > 0 && elapsedSeconds > 0
        ? this.rowsLoaded / elapsedSeconds
        : null;
    const remainingRows = Math.max(
      DEMO_TOTAL_ROWS - this.rowsLoaded,
      0,
    );
    const etaSeconds =
      rowsPerSecond !== null && remainingRows > 0
        ? Math.ceil(remainingRows / rowsPerSecond)
        : this.status === 'completed'
          ? 0
          : null;

    return {
      status: this.status,
      speed: this.speed,
      progress: Math.round(
        (this.eventIndex / this.events.length) * 100,
      ),
      rowsLoaded: this.rowsLoaded,
      totalRows: DEMO_TOTAL_ROWS,
      rowsPerSecond,
      etaSeconds,
      currentPhaseId: this.currentPhaseId,
      completedPhaseIds: this.completedPhaseIds,
      currentTable: this.currentTable,
      completedTables: this.completedTables,
      logs: this.logs,
      validationPassed: this.validationPassed,
    };
  }
}
