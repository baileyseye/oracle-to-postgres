import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationSimulation } from './simulation';

describe('MigrationSimulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the deterministic pipeline to completion', () => {
    const simulation = new MigrationSimulation();

    simulation.start();
    expect(simulation.getSnapshot().status).toBe('running');
    expect(vi.getTimerCount()).toBe(1);

    vi.runAllTimers();

    const snapshot = simulation.getSnapshot();

    expect(snapshot.status).toBe('completed');
    expect(snapshot.progress).toBe(100);
    expect(snapshot.rowsLoaded).toBe(snapshot.totalRows);
    expect(snapshot.validationPassed).toBe(true);
    expect(snapshot.logs.at(-1)?.message).toBe('VALIDATION PASSED');
    expect(snapshot.etaSeconds).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses without advancing and clears the timer', () => {
    const simulation = new MigrationSimulation();

    simulation.start();
    vi.advanceTimersByTime(900);

    const beforePause = simulation.getSnapshot();
    expect(beforePause.logs.length).toBeGreaterThan(0);

    simulation.pause();
    expect(simulation.getSnapshot().status).toBe('paused');
    expect(vi.getTimerCount()).toBe(0);

    vi.runAllTimers();

    const afterPause = simulation.getSnapshot();
    expect(afterPause.logs.length).toBe(beforePause.logs.length);
    expect(afterPause.progress).toBe(beforePause.progress);
    expect(afterPause.status).toBe('paused');
  });

  it('resets state and does not leave timers behind', () => {
    const simulation = new MigrationSimulation();

    simulation.start();
    vi.advanceTimersByTime(1300);
    simulation.reset();

    const snapshot = simulation.getSnapshot();
    expect(snapshot.status).toBe('idle');
    expect(snapshot.progress).toBe(0);
    expect(snapshot.logs).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);

    simulation.start();
    expect(vi.getTimerCount()).toBe(1);
    simulation.pause();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports a correct restart after completion', () => {
    const simulation = new MigrationSimulation();

    simulation.start();
    vi.runAllTimers();

    const firstRun = simulation.getSnapshot();
    expect(firstRun.status).toBe('completed');

    simulation.restart();

    const restarted = simulation.getSnapshot();
    expect(restarted.status).toBe('running');
    expect(restarted.progress).toBe(0);
    expect(restarted.logs).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(1);

    vi.runAllTimers();

    const secondRun = simulation.getSnapshot();
    expect(secondRun.status).toBe('completed');
    expect(secondRun.logs).toHaveLength(firstRun.logs.length);
    expect(secondRun.logs.map((log) => log.message)).toEqual(
      firstRun.logs.map((log) => log.message),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('changes speed without duplicating the timer', () => {
    const simulation = new MigrationSimulation();

    simulation.start();
    simulation.setSpeed(4);

    expect(simulation.getSnapshot().speed).toBe(4);
    expect(vi.getTimerCount()).toBe(1);

    vi.runAllTimers();
    expect(simulation.getSnapshot().status).toBe('completed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
