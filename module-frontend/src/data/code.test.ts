import { describe, expect, it } from 'vitest';
import { CODE_MODULES } from './code-snippets';
import { GITHUB_REPO_URL } from '../lib/github';
import { TYPE_MAPPINGS, UNSUPPORTED_OBJECTS } from './type-mappings';

describe('code explorer data', () => {
  it('keeps snippet line ranges consistent with their code', () => {
    for (const module of CODE_MODULES) {
      for (const file of module.files) {
        expect(file.githubUrl.startsWith(GITHUB_REPO_URL)).toBe(true);
        expect(file.snippets.length).toBeGreaterThan(0);

        for (const snippet of file.snippets) {
          const lines = snippet.code.split('\n').length;
          const expected = snippet.endLine - snippet.startLine + 1;

          expect(lines).toBe(expected);
          expect(snippet.note.length).toBeGreaterThan(0);
          expect(snippet.title.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has unique snippet and file identifiers', () => {
    const fileIds = CODE_MODULES.flatMap((module) =>
      module.files.map((file) => file.id),
    );
    const snippetIds = CODE_MODULES.flatMap((module) =>
      module.files.flatMap((file) =>
        file.snippets.map((snippet) => snippet.id),
      ),
    );

    expect(new Set(fileIds).size).toBe(fileIds.length);
    expect(new Set(snippetIds).size).toBe(snippetIds.length);
  });
});

describe('type fidelity data', () => {
  it('has unique mapping rows and known levels', () => {
    const ids = TYPE_MAPPINGS.map((row) => row.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const row of TYPE_MAPPINGS) {
      expect(['auto', 'warning']).toContain(row.level);
      expect(row.oracleType.length).toBeGreaterThan(0);
      expect(row.postgresType.length).toBeGreaterThan(0);
    }
  });

  it('lists every unsupported category from the source and README', () => {
    expect(UNSUPPORTED_OBJECTS.map((item) => item.id)).toEqual([
      'view',
      'trigger',
      'plsql',
      'synonym',
      'partitioned-table',
      'table-grant',
      'tablespace',
    ]);
  });
});
