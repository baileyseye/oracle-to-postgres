import type { MigrationModeId } from './migration-api';

export interface ModeCard {
  readonly id: MigrationModeId;
  readonly title: string;
  readonly badge: string;
  readonly summary: string;
  readonly facts: readonly string[];
}

export interface ModeComparisonRow {
  readonly criterion: string;
  readonly initialLoad: string;
  readonly mirror: string;
}

export type StrategyStatus = 'implemented' | 'supported' | 'external';

export interface StrategyMetric {
  readonly label: string;
  readonly value: string;
}

export interface StrategyCard {
  readonly id: string;
  readonly title: string;
  readonly status: StrategyStatus;
  readonly statusLabel: string;
  readonly summary: string;
  readonly metrics: readonly StrategyMetric[];
  readonly note: string;
}
