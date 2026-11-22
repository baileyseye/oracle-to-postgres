import type { SchemaOwnerId } from './architecture';

export type StartShell = 'bash' | 'powershell';

export interface StartShellOption {
  readonly id: StartShell;
  readonly label: string;
  readonly hint: string;
}

export interface StartCommand {
  readonly label: string;
  readonly value: string;
}

export type StartNoteTone = 'info' | 'warning';

export interface StartStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly commands: readonly StartCommand[];
  readonly note?: string;
  readonly noteTone?: StartNoteTone;
}

export interface StartScenario {
  readonly owner: SchemaOwnerId;
  readonly steps: readonly StartStep[];
  readonly checklist: readonly string[];
}
