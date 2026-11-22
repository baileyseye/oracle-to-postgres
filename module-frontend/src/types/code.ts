export type CodeLanguage = 'java' | 'yaml' | 'bash' | 'sql';

export interface CodeSnippet {
  readonly id: string;
  readonly title: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly code: string;
  readonly note: string;
}

export interface CodeFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly githubUrl: string;
  readonly language: CodeLanguage;
  readonly summary: string;
  readonly snippets: readonly CodeSnippet[];
}

export interface CodeModule {
  readonly id: 'migration' | 'schema-migration';
  readonly label: string;
  readonly port: string;
  readonly summary: string;
  readonly files: readonly CodeFile[];
}
