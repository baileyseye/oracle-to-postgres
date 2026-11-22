import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { MigrationSimulation } from '../lib/simulation';
import type { SimulationSpeed } from '../types/simulation';

export function useMigrationSimulation() {
  const [engine] = useState(() => new MigrationSimulation());
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  useEffect(() => () => engine.dispose(), [engine]);

  const actions = useMemo(
    () => ({
      start: () => engine.start(),
      pause: () => engine.pause(),
      reset: () => engine.reset(),
      restart: () => engine.restart(),
      setSpeed: (speed: SimulationSpeed) => engine.setSpeed(speed),
    }),
    [engine],
  );

  return { snapshot, ...actions };
}

export type MigrationSimulationController = ReturnType<
  typeof useMigrationSimulation
>;
