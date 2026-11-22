import type { CodeLanguage } from './code';

export type PipelinePhaseId =
  | 'plan'
  | 'source-guard'
  | 'pre-load'
  | 'users'
  | 'orders'
  | 'generic'
  | 'restart-sequences'
  | 'populate-mapping'
  | 'post-load'
  | 'validation';

export interface PipelineCodeSnippet {
  readonly id: string;
  readonly fileName: string;
  readonly filePath: string;
  readonly githubUrl: string;
  readonly language: CodeLanguage;
  readonly startLine: number;
  readonly endLine: number;
  readonly code: string;
}

export interface PipelineStep {
  readonly id: PipelinePhaseId;
  readonly title: string;
  readonly kicker: string;
  readonly summary: string;
  readonly details: readonly string[];
  readonly note: string;
  readonly optional?: boolean;
  readonly snippet: PipelineCodeSnippet;
}
