import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LIVE_SERVICES } from '../data/live';
import {
  applySchemaMigration,
  cancelMigrationJob,
  checkAllServiceHealth,
  describeApiError,
  getMigrationJob,
  getMigrationStatus,
  getSchemaDiff,
  getSchemaMigrationStatus,
  getSourceTables,
  isApiClientError,
  runMigration,
  runMigrationAsync,
} from '../lib/api-client';
import type {
  LiveActionState,
  LiveData,
  LiveResource,
  LiveServiceId,
  RuntimeMode,
  ServiceHealth,
  AsyncJobState,
} from '../types/live';

const HEALTH_POLL_MS = 15000;
const DATA_POLL_MS = 20000;
const JOB_POLL_MS = 2000;

interface LiveModeContextValue {
  readonly mode: RuntimeMode;
  readonly setMode: (mode: RuntimeMode) => void;
  readonly health: Record<LiveServiceId, ServiceHealth>;
  readonly healthSummary: {
    readonly status: 'idle' | 'checking' | 'up' | 'degraded' | 'down';
    readonly up: number;
    readonly total: number;
  };
  readonly lastHealthCheckedAt: string | null;
  readonly refreshHealth: () => void;
  readonly fallbackNotice: string | null;
  readonly dismissFallback: () => void;
  readonly armed: boolean;
  readonly setArmed: (armed: boolean) => void;
  readonly data: LiveData;
  readonly refreshData: () => void;
  readonly action: LiveActionState;
  readonly startSync: () => Promise<void>;
  readonly startAsync: () => Promise<void>;
  readonly applySchema: () => Promise<void>;
  readonly job: AsyncJobState;
  readonly cancelJob: () => Promise<void>;
}

const LiveModeContext = createContext<LiveModeContextValue | null>(null);

function createUnknownHealth(): Record<LiveServiceId, ServiceHealth> {
  return {
    oracle: initialServiceHealth('oracle'),
    postgres: initialServiceHealth('postgres'),
    migration: initialServiceHealth('migration'),
    schema: initialServiceHealth('schema'),
  };
}

function initialServiceHealth(id: LiveServiceId): ServiceHealth {
  const service = LIVE_SERVICES.find((item) => item.id === id);

  if (!service) {
    throw new Error(`Неизвестный live-сервис: ${id}`);
  }

  return {
    id,
    name: service.name,
    port: service.port,
    status: 'unknown',
    latencyMs: null,
    error: null,
    checkedAt: null,
  };
}

function createCheckingHealth(): Record<LiveServiceId, ServiceHealth> {
  const unknown = createUnknownHealth();

  return {
    oracle: { ...unknown.oracle, status: 'checking' },
    postgres: { ...unknown.postgres, status: 'checking' },
    migration: { ...unknown.migration, status: 'checking' },
    schema: { ...unknown.schema, status: 'checking' },
  };
}

function initialResource<T>(): LiveResource<T> {
  return {
    status: 'idle',
    data: null,
    error: null,
    updatedAt: null,
  };
}

function loadingResource<T>(): LiveResource<T> {
  return {
    status: 'loading',
    data: null,
    error: null,
    updatedAt: null,
  };
}

function createInitialData(): LiveData {
  return {
    migrationStatus: initialResource(),
    schemaDiff: initialResource(),
    schemaStatus: initialResource(),
    tables: initialResource(),
  };
}

function createLoadingData(): LiveData {
  return {
    migrationStatus: loadingResource(),
    schemaDiff: loadingResource(),
    schemaStatus: loadingResource(),
    tables: loadingResource(),
  };
}

function createInitialJob(): AsyncJobState {
  return {
    jobId: null,
    data: null,
    polling: false,
    canceling: false,
    error: null,
  };
}

function createInitialAction(): LiveActionState {
  return {
    running: false,
    kind: null,
    report: null,
    schemaReport: null,
    error: null,
    completedAt: null,
  };
}

async function loadLiveResource<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<LiveResource<T> | null> {
  try {
    const data = await fetcher(signal);

    return {
      status: 'ready',
      data,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (
      signal.aborted ||
      (isApiClientError(error) && error.kind === 'cancelled')
    ) {
      return null;
    }

    return {
      status: 'offline',
      data: null,
      error: describeApiError(error),
      updatedAt: new Date().toISOString(),
    };
  }
}

interface LiveModeProviderProps {
  readonly children: ReactNode;
}

export function LiveModeProvider({ children }: LiveModeProviderProps) {
  const [mode, setModeState] = useState<RuntimeMode>('demo');
  const [health, setHealth] = useState<Record<LiveServiceId, ServiceHealth>>(
    createUnknownHealth,
  );
  const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState<string | null>(
    null,
  );
  const [healthNonce, setHealthNonce] = useState(0);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [armed, setArmedState] = useState(false);
  const [data, setData] = useState<LiveData>(createInitialData);
  const [dataNonce, setDataNonce] = useState(0);
  const [action, setAction] = useState<LiveActionState>(createInitialAction);
  const [job, setJob] = useState<AsyncJobState>(createInitialJob);
  const actionInFlight = useRef(false);
  const cancelInFlight = useRef(false);

  const resetLiveState = useCallback(() => {
    setArmedState(false);
    setData(createInitialData());
    setJob(createInitialJob());
    setAction(createInitialAction());
  }, []);

  const forceDemo = useCallback(
    (notice: string) => {
      resetLiveState();
      setHealth(createUnknownHealth());
      setLastHealthCheckedAt(null);
      setFallbackNotice(notice);
      setModeState('demo');
    },
    [resetLiveState],
  );

  const setMode = useCallback(
    (next: RuntimeMode) => {
      setFallbackNotice(null);

      if (next === mode) {
        return;
      }

      resetLiveState();

      if (next === 'live') {
        setHealth(createCheckingHealth());
        setLastHealthCheckedAt(null);
        setData(createLoadingData());
        setHealthNonce((value) => value + 1);
        setDataNonce((value) => value + 1);
      } else {
        setHealth(createUnknownHealth());
        setLastHealthCheckedAt(null);
      }

      setModeState(next);
    },
    [mode, resetLiveState],
  );

  const refreshHealth = useCallback(() => {
    if (mode !== 'live') {
      return;
    }

    setHealth((current) => ({
      oracle: { ...current.oracle, status: 'checking' },
      postgres: { ...current.postgres, status: 'checking' },
      migration: { ...current.migration, status: 'checking' },
      schema: { ...current.schema, status: 'checking' },
    }));
    setHealthNonce((value) => value + 1);
  }, [mode]);

  const refreshData = useCallback(() => {
    if (mode !== 'live') {
      return;
    }

    setData((current) => ({
      migrationStatus: { ...current.migrationStatus, status: 'loading' },
      schemaDiff: { ...current.schemaDiff, status: 'loading' },
      schemaStatus: { ...current.schemaStatus, status: 'loading' },
      tables: { ...current.tables, status: 'loading' },
    }));
    setDataNonce((value) => value + 1);
  }, [mode]);

  const setArmed = useCallback(
    (value: boolean) => {
      setArmedState(mode === 'live' ? value : false);
    },
    [mode],
  );

  useEffect(() => {
    if (mode !== 'live') {
      return;
    }

    const controller = new AbortController();
    let disposed = false;

    const poll = async () => {
      try {
        const results = await checkAllServiceHealth(controller.signal);

        if (disposed || controller.signal.aborted) {
          return;
        }

        const nextHealth = createUnknownHealth();

        for (const result of results) {
          nextHealth[result.id] = result;
        }

        setHealth(nextHealth);
        setLastHealthCheckedAt(new Date().toISOString());

        if (results.every((result) => result.status === 'down')) {
          forceDemo(
            'LIVE недоступен: ни один сервис не ответил. Автоматически включён DEMO.',
          );
        }
      } catch (error) {
        if (
          disposed ||
          controller.signal.aborted ||
          (isApiClientError(error) && error.kind === 'cancelled')
        ) {
          return;
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, HEALTH_POLL_MS);

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [mode, healthNonce, forceDemo]);

  useEffect(() => {
    if (mode !== 'live') {
      return;
    }

    const controller = new AbortController();
    let disposed = false;

    const load = async () => {
      const [migrationStatus, schemaDiff, schemaStatus, tables] =
        await Promise.all([
          loadLiveResource(getMigrationStatus, controller.signal),
          loadLiveResource(getSchemaDiff, controller.signal),
          loadLiveResource(getSchemaMigrationStatus, controller.signal),
          loadLiveResource(getSourceTables, controller.signal),
        ]);

      if (disposed || controller.signal.aborted) {
        return;
      }

      setData((current) => ({
        migrationStatus: migrationStatus ?? current.migrationStatus,
        schemaDiff: schemaDiff ?? current.schemaDiff,
        schemaStatus: schemaStatus ?? current.schemaStatus,
        tables: tables ?? current.tables,
      }));
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, DATA_POLL_MS);

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [mode, dataNonce]);

  useEffect(() => {
    if (mode !== 'live' || job.jobId === null) {
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    let interval: number | null = null;

    const poll = async () => {
      try {
        const nextJob = await getMigrationJob(
          job.jobId as string,
          controller.signal,
        );

        if (disposed || controller.signal.aborted) {
          return;
        }

        setJob((current) => ({
          ...current,
          data: nextJob,
          polling: nextJob.status === 'RUNNING',
          error: null,
        }));

        if (nextJob.status !== 'RUNNING' && interval !== null) {
          window.clearInterval(interval);
          interval = null;
        }
      } catch (error) {
        if (
          disposed ||
          controller.signal.aborted ||
          (isApiClientError(error) && error.kind === 'cancelled')
        ) {
          return;
        }

        setJob((current) => ({
          ...current,
          polling: false,
          error: describeApiError(error),
        }));

        if (interval !== null) {
          window.clearInterval(interval);
          interval = null;
        }
      }
    };

    void poll();
    interval = window.setInterval(() => {
      void poll();
    }, JOB_POLL_MS);

    return () => {
      disposed = true;
      controller.abort();

      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [mode, job.jobId]);

  const startSync = useCallback(async () => {
    if (
      mode !== 'live' ||
      !armed ||
      action.running ||
      actionInFlight.current
    ) {
      return;
    }

    actionInFlight.current = true;

    setAction({
      running: true,
      kind: 'sync',
      report: null,
      schemaReport: null,
      error: null,
      completedAt: null,
    });

    try {
      const report = await runMigration();
      setAction({
        running: false,
        kind: 'sync',
        report,
        schemaReport: null,
        error: null,
        completedAt: new Date().toISOString(),
      });
      refreshData();
      refreshHealth();
    } catch (error) {
      setAction({
        running: false,
        kind: 'sync',
        report: null,
        schemaReport: null,
        error: describeApiError(error),
        completedAt: new Date().toISOString(),
      });
    } finally {
      actionInFlight.current = false;
    }
  }, [mode, armed, action.running, refreshData, refreshHealth]);

  const startAsync = useCallback(async () => {
    if (
      mode !== 'live' ||
      !armed ||
      action.running ||
      actionInFlight.current ||
      job.data?.status === 'RUNNING'
    ) {
      return;
    }

    actionInFlight.current = true;

    setAction({
      running: true,
      kind: 'async',
      report: null,
      schemaReport: null,
      error: null,
      completedAt: null,
    });

    try {
      const initialJob = await runMigrationAsync();
      setJob({
        jobId: initialJob.jobId,
        data: initialJob,
        polling: initialJob.status === 'RUNNING',
        canceling: false,
        error: null,
      });
      setAction({
        running: false,
        kind: 'async',
        report: null,
        schemaReport: null,
        error: null,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      setAction({
        running: false,
        kind: 'async',
        report: null,
        schemaReport: null,
        error: describeApiError(error),
        completedAt: new Date().toISOString(),
      });
    } finally {
      actionInFlight.current = false;
    }
  }, [mode, armed, action.running, job.data?.status]);

  const applySchema = useCallback(async () => {
    if (
      mode !== 'live' ||
      !armed ||
      action.running ||
      actionInFlight.current
    ) {
      return;
    }

    actionInFlight.current = true;

    setAction({
      running: true,
      kind: 'apply',
      report: null,
      schemaReport: null,
      error: null,
      completedAt: null,
    });

    try {
      const schemaReport = await applySchemaMigration();
      setAction({
        running: false,
        kind: 'apply',
        report: null,
        schemaReport,
        error: null,
        completedAt: new Date().toISOString(),
      });
      refreshData();
      refreshHealth();
    } catch (error) {
      setAction({
        running: false,
        kind: 'apply',
        report: null,
        schemaReport: null,
        error: describeApiError(error),
        completedAt: new Date().toISOString(),
      });
    } finally {
      actionInFlight.current = false;
    }
  }, [mode, armed, action.running, refreshData, refreshHealth]);

  const cancelJob = useCallback(async () => {
    const jobId = job.jobId;

    if (
      mode !== 'live' ||
      jobId === null ||
      job.canceling ||
      cancelInFlight.current
    ) {
      return;
    }

    cancelInFlight.current = true;

    setJob((current) => ({
      ...current,
      canceling: true,
      error: null,
    }));

    try {
      const updated = await cancelMigrationJob(jobId);
      setJob((current) => ({
        ...current,
        data: updated,
        polling: updated.status === 'RUNNING',
        canceling: false,
        error: null,
      }));
    } catch (error) {
      setJob((current) => ({
        ...current,
        canceling: false,
        error: describeApiError(error),
      }));
    } finally {
      cancelInFlight.current = false;
    }
  }, [mode, job.jobId, job.canceling]);

  const dismissFallback = useCallback(() => {
    setFallbackNotice(null);
  }, []);

  const healthSummary = useMemo(() => {
    const healthItems = LIVE_SERVICES.map((service) => health[service.id]);
    const up = healthItems.filter((item) => item.status === 'up').length;
    let status: 'idle' | 'checking' | 'up' | 'degraded' | 'down' = 'idle';

    if (mode === 'live') {
      if (
        healthItems.some(
          (item) =>
            item.status === 'checking' || item.status === 'unknown',
        )
      ) {
        status = 'checking';
      } else if (up === healthItems.length) {
        status = 'up';
      } else if (up > 0) {
        status = 'degraded';
      } else {
        status = 'down';
      }
    }

    return { status, up, total: healthItems.length };
  }, [health, mode]);

  const value = useMemo<LiveModeContextValue>(
    () => ({
      mode,
      setMode,
      health,
      healthSummary,
      lastHealthCheckedAt,
      refreshHealth,
      fallbackNotice,
      dismissFallback,
      armed,
      setArmed,
      data,
      refreshData,
      action,
      startSync,
      startAsync,
      applySchema,
      job,
      cancelJob,
    }),
    [
      mode,
      setMode,
      health,
      healthSummary,
      lastHealthCheckedAt,
      refreshHealth,
      fallbackNotice,
      dismissFallback,
      armed,
      setArmed,
      data,
      refreshData,
      action,
      startSync,
      startAsync,
      applySchema,
      job,
      cancelJob,
    ],
  );

  return (
    <LiveModeContext.Provider value={value}>
      {children}
    </LiveModeContext.Provider>
  );
}

export function useLiveMode(): LiveModeContextValue {
  const context = useContext(LiveModeContext);

  if (!context) {
    throw new Error('useLiveMode используется вне LiveModeProvider');
  }

  return context;
}
