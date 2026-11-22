import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevSeedError, seedLargeOracleDataset } from './dev-seed';

describe('dev seed client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the dev endpoint with the confirmation header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          exitCode: 0,
          output: 'Large Oracle dataset is ready',
        }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await seedLargeOracleDataset();

    expect(result.ok).toBe(true);
    expect(result.output).toContain('Large Oracle dataset');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/__dev/seed-large-oracle');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        'X-Demo-Seed': 'SEED',
      },
    });
  });

  it('keeps the dev error message and output for display', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({
            message: 'Скрипт seed завершился с ошибкой',
            output: 'ORA-00001: unique constraint violated',
          }),
      } as Response),
    );

    const error = await seedLargeOracleDataset().catch((reason) => reason);

    expect(error).toBeInstanceOf(DevSeedError);
    expect(error.message).toContain('Скрипт seed');
    expect(error.output).toContain('ORA-00001');
  });

  it('explains a 409 when another seed is still running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => '',
      } as Response),
    );

    const error = await seedLargeOracleDataset().catch((reason) => reason);

    expect(error).toBeInstanceOf(DevSeedError);
    expect(error.message).toContain('уже выполняется');
    expect(error.message).toContain('перезагрузите вкладку');
  });
});
