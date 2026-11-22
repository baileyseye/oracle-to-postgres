import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMigrationSimulation } from './useMigrationSimulation';

function Harness() {
  const { snapshot, start } = useMigrationSimulation();

  return (
    <div>
      <button onClick={start} type="button">
        start
      </button>
      <span>{snapshot.status}</span>
    </div>
  );
}

describe('useMigrationSimulation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the engine timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'start' }));

    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getByText('running')).toBeTruthy();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
