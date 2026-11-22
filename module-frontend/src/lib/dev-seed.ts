const DEV_SEED_ENDPOINT = '/__dev/seed-large-oracle';
const DEV_SEED_TIMEOUT_MS = 15 * 60 * 1000;

export const DEV_SEED_AVAILABLE = import.meta.env.DEV;

export interface DevSeedResult {
  readonly ok: boolean;
  readonly exitCode?: number;
  readonly durationMs?: number;
  readonly output?: string;
  readonly message?: string;
}

interface DevSeedErrorBody {
  readonly message?: string;
  readonly output?: string;
}

export class DevSeedError extends Error {
  readonly output: string | null;

  constructor(message: string, output: string | null = null) {
    super(message);
    this.name = 'DevSeedError';
    this.output = output;
  }
}

export async function seedLargeOracleDataset(): Promise<DevSeedResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, DEV_SEED_TIMEOUT_MS);

  try {
    const response = await fetch(DEV_SEED_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Demo-Seed': 'SEED',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: DevSeedResult | DevSeedErrorBody = {};

    if (text) {
      try {
        body = JSON.parse(text) as DevSeedResult | DevSeedErrorBody;
      } catch {
        throw new DevSeedError(
          `Dev seed вернул не-JSON ответ: ${text.slice(0, 200)}`,
        );
      }
    }

    if (!response.ok) {
      const errorBody = body as DevSeedErrorBody;
      throw new DevSeedError(
        errorBody.message ?? `Dev seed HTTP ${response.status}`,
        errorBody.output ?? null,
      );
    }

    return body as DevSeedResult;
  } catch (error) {
    if (error instanceof DevSeedError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DevSeedError('Загрузка не завершилась за 15 минут');
    }

    throw new DevSeedError(
      'Dev seed недоступен. Запустите frontend через npm run dev.',
    );
  } finally {
    window.clearTimeout(timer);
  }
}
