import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MigrationModeId } from '../types/migration-api';

interface MigrationModeContextValue {
  readonly mode: MigrationModeId;
  readonly setMode: (mode: MigrationModeId) => void;
}

const MigrationModeContext = createContext<MigrationModeContextValue | null>(
  null,
);

interface MigrationModeProviderProps {
  readonly children: ReactNode;
}

export function MigrationModeProvider({ children }: MigrationModeProviderProps) {
  const [mode, setMode] = useState<MigrationModeId>('initial-load');
  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <MigrationModeContext.Provider value={value}>
      {children}
    </MigrationModeContext.Provider>
  );
}

export function useMigrationMode(): MigrationModeContextValue {
  const context = useContext(MigrationModeContext);

  if (!context) {
    throw new Error('useMigrationMode используется вне MigrationModeProvider');
  }

  return context;
}
