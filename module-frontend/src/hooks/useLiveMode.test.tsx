import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LiveModeProvider, useLiveMode } from './useLiveMode';
import { LiveFallbackNotice } from '../components/live/LiveFallbackNotice';

function Harness() {
  const { mode, setMode } = useLiveMode();

  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('live')} type="button">
        live
      </button>
      <button onClick={() => setMode('demo')} type="button">
        demo
      </button>
      <LiveFallbackNotice />
    </div>
  );
}

function unavailableResponse(): Response {
  return {
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
    text: async () =>
      JSON.stringify({ message: 'Сервис недоступен' }),
  } as Response;
}

async function flushMicrotasks(times = 10): Promise<void> {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('LiveModeProvider', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('clears polling timers when switching back to DEMO', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      ),
    );

    render(
      <LiveModeProvider>
        <Harness />
      </LiveModeProvider>,
    );

    fireEvent.click(screen.getByText('live'));
    await flushMicrotasks(2);

    expect(screen.getByTestId('mode').textContent).toBe('live');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('demo'));
    await flushMicrotasks();

    expect(screen.getByTestId('mode').textContent).toBe('demo');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('falls back to DEMO when every service is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(unavailableResponse()),
    );

    render(
      <LiveModeProvider>
        <Harness />
      </LiveModeProvider>,
    );

    fireEvent.click(screen.getByText('live'));
    await flushMicrotasks(24);

    expect(screen.getByTestId('mode').textContent).toBe('demo');
    expect(
      screen.getByText(/LIVE недоступен/i),
    ).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
