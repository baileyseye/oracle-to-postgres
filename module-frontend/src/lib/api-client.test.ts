import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIVE_SERVICES } from '../data/live';
import {
  ApiClientError,
  applySchemaMigration,
  checkServiceHealth,
  describeApiError,
  getMigrationStatus,
  runMigration,
  runMigrationAsync,
} from './api-client';

function jsonResponse(
  body: unknown,
  status = 200,
  statusText = 'OK',
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads migration status through the alias base', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        sourceUsers: 2,
        targetUsers: 2,
        targetManagedUsers: 2,
        sourceOrders: 4,
        targetOrders: 4,
        targetManagedOrders: 4,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const status = await getMigrationStatus();

    expect(status.sourceUsers).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/migration/status');
  });

  it('posts dangerous operations to the documented paths', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1' }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await runMigrationAsync();
    await applySchemaMigration();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/migration/run/async',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/schema/apply');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
    });
  });

  it('maps health UP and network failure to service statuses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'UP' }))
      .mockRejectedValueOnce(new Error('connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    const service = LIVE_SERVICES[0];
    const up = await checkServiceHealth(service);
    const down = await checkServiceHealth(service);

    expect(up.status).toBe('up');
    expect(up.latencyMs).not.toBeNull();
    expect(down.status).toBe('down');
    expect(down.error).toBeTruthy();
  });

  it('rejects a successful HTML response instead of treating it as data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '<!doctype html><html></html>',
      } as Response),
    );

    const error = await getMigrationStatus().catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(describeApiError(error)).toContain('не является JSON');
  });

  it('turns 409 and 503 into human-readable messages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'Уже выполняется другой запуск миграции' },
          409,
          'Conflict',
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { message: 'Источник миграции недоступен' },
          503,
          'Service Unavailable',
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const conflict = await runMigration().catch((error) => error);
    const unavailable = await getMigrationStatus().catch((error) => error);

    expect(conflict).toBeInstanceOf(ApiClientError);
    expect(describeApiError(conflict)).toContain('409');
    expect(describeApiError(unavailable)).toContain('503');
  });
});
