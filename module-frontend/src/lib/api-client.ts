import { LIVE_SERVICES } from '../data/live';
import type {
  MigrationJobResponse,
  MigrationReport,
  MigrationStatus,
  SchemaDiffReport,
  SchemaMigrationReport,
  SchemaMigrationStatus,
} from '../types/migration-api';
import type {
  LiveServiceDefinition,
  LiveServiceId,
  ServiceHealth,
} from '../types/live';

export type ApiErrorKind =
  | 'http'
  | 'network'
  | 'timeout'
  | 'cancelled';

export class ApiClientError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly body: unknown;

  constructor(
    message: string,
    kind: ApiErrorKind,
    status: number | null = null,
    body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends RequestInit {
  readonly timeoutMs?: number;
}

const READ_TIMEOUT_MS = 8000;
const HEALTH_TIMEOUT_MS = 3500;
const ACTION_TIMEOUT_MS = 600000;
const ASYNC_START_TIMEOUT_MS = 30000;
const JOB_TIMEOUT_MS = 15000;

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }

    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  return fallback;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    timeoutMs = READ_TIMEOUT_MS,
    signal: externalSignal,
    ...init
  } = options;
  const controller = new AbortController();
  let timedOut = false;

  if (externalSignal?.aborted) {
    throw new ApiClientError('Запрос отменён', 'cancelled');
  }

  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromOutside = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromOutside, {
    once: true,
  });

  try {
    const response = await fetch(joinUrl(baseUrl, path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new ApiClientError(
            'Ответ сервиса не является JSON. Проверьте VITE base URL и настройку proxy.',
            'http',
            response.status,
            text,
          );
        }

        body = text;
      }
    }

    if (!response.ok) {
      throw new ApiClientError(
        extractMessage(body, response.statusText || `HTTP ${response.status}`),
        'http',
        response.status,
        body,
      );
    }

    return body as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (externalSignal?.aborted) {
      throw new ApiClientError('Запрос отменён', 'cancelled');
    }

    if (timedOut) {
      throw new ApiClientError('Таймаут запроса к сервису', 'timeout');
    }

    throw new ApiClientError(
      'Сервис недоступен по сети',
      'network',
    );
  } finally {
    globalThis.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromOutside);
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function describeApiError(error: unknown): string {
  if (!isApiClientError(error)) {
    return 'Неизвестная ошибка LIVE-запроса';
  }

  if (error.kind === 'cancelled') {
    return 'Запрос отменён';
  }

  if (error.kind === 'timeout') {
    return 'Сервис не ответил вовремя. Проверьте, что модуль запущен.';
  }

  if (error.kind === 'network') {
    return 'Сервис недоступен. Проверьте, что модуль запущен и Vite proxy работает.';
  }

  if (error.status !== null && error.status < 300) {
    return error.message;
  }

  if (error.status === 409) {
    return 'Конфликт 409: уже выполняется другой запуск или данные конфликтуют с ограничениями PostgreSQL.';
  }

  if (error.status === 422) {
    return 'Validation не пройдена (422). Target нельзя открывать приложению; смотрите отчёт job.';
  }

  if (error.status === 404) {
    return 'Ресурс не найден (404). Проверьте имя таблицы или jobId.';
  }

  if (error.status === 503) {
    return 'Сервис или схема недоступны (503). Проверьте БД, креды и ownership target-схемы.';
  }

  if (error.status === 502 || error.status === 504) {
    return 'Backend недоступен через proxy (502/504). Проверьте запущенные модули и nginx.';
  }

  if (error.status === 500) {
    return 'Прикладная ошибка сервиса (500). Подробности могут быть в логах module-migration.';
  }

  if (error.status !== null) {
    return `HTTP ${error.status}: ${error.message}`;
  }

  return error.message;
}

export async function checkServiceHealth(
  service: LiveServiceDefinition,
  signal?: AbortSignal,
): Promise<ServiceHealth> {
  const startedAt = performance.now();

  try {
    const body = await request<{ status?: string }>(
      service.baseUrl,
      service.healthPath,
      { timeoutMs: HEALTH_TIMEOUT_MS, signal },
    );

    return {
      id: service.id,
      name: service.name,
      port: service.port,
      status: body.status === 'UP' ? 'up' : 'down',
      latencyMs: Math.round(performance.now() - startedAt),
      error: body.status === 'UP' ? null : 'health status не UP',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (isApiClientError(error) && error.kind === 'cancelled') {
      throw error;
    }

    return {
      id: service.id,
      name: service.name,
      port: service.port,
      status: 'down',
      latencyMs: Math.round(performance.now() - startedAt),
      error: describeApiError(error),
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function checkAllServiceHealth(
  signal?: AbortSignal,
): Promise<ServiceHealth[]> {
  return Promise.all(
    LIVE_SERVICES.map((service) =>
      checkServiceHealth(service, signal),
    ),
  );
}

export function getServiceBase(id: LiveServiceId): string {
  const service = LIVE_SERVICES.find((item) => item.id === id);

  if (!service) {
    throw new Error(`Неизвестный live-сервис: ${id}`);
  }

  return service.baseUrl;
}

export function getMigrationStatus(
  signal?: AbortSignal,
): Promise<MigrationStatus> {
  return request<MigrationStatus>(
    getServiceBase('migration'),
    '/status',
    { signal },
  );
}

export function getSchemaDiff(
  signal?: AbortSignal,
): Promise<SchemaDiffReport> {
  return request<SchemaDiffReport>(
    getServiceBase('migration'),
    '/schema/diff',
    { signal },
  );
}

export function getSchemaMigrationStatus(
  signal?: AbortSignal,
): Promise<SchemaMigrationStatus> {
  return request<SchemaMigrationStatus>(
    getServiceBase('schema'),
    '/status',
    { signal },
  );
}

export function getSourceTables(
  signal?: AbortSignal,
): Promise<string[]> {
  return request<string[]>(
    getServiceBase('migration'),
    '/tables',
    { signal },
  );
}

export function runMigration(
  signal?: AbortSignal,
): Promise<MigrationReport> {
  return request<MigrationReport>(
    getServiceBase('migration'),
    '/run',
    {
      method: 'POST',
      signal,
      timeoutMs: ACTION_TIMEOUT_MS,
    },
  );
}

export function runMigrationAsync(
  signal?: AbortSignal,
): Promise<MigrationJobResponse> {
  return request<MigrationJobResponse>(
    getServiceBase('migration'),
    '/run/async',
    {
      method: 'POST',
      signal,
      timeoutMs: ASYNC_START_TIMEOUT_MS,
    },
  );
}

export function getMigrationJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<MigrationJobResponse> {
  return request<MigrationJobResponse>(
    getServiceBase('migration'),
    `/run/${encodeURIComponent(jobId)}`,
    { signal, timeoutMs: JOB_TIMEOUT_MS },
  );
}

export function cancelMigrationJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<MigrationJobResponse> {
  return request<MigrationJobResponse>(
    getServiceBase('migration'),
    `/run/${encodeURIComponent(jobId)}/cancel`,
    {
      method: 'POST',
      signal,
      timeoutMs: JOB_TIMEOUT_MS,
    },
  );
}

export function applySchemaMigration(
  signal?: AbortSignal,
): Promise<SchemaMigrationReport> {
  return request<SchemaMigrationReport>(
    getServiceBase('schema'),
    '/apply',
    {
      method: 'POST',
      signal,
      timeoutMs: ACTION_TIMEOUT_MS,
    },
  );
}
