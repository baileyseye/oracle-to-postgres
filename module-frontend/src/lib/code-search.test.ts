import { describe, expect, it } from 'vitest';
import { CODE_MODULES } from '../data/code-snippets';
import { searchCode } from './code-search';

describe('searchCode', () => {
  it('finds a file by class name', () => {
    const results = searchCode(CODE_MODULES, 'PostgresChunkGateway');

    expect(results.map((result) => result.file.name)).toContain(
      'PostgresChunkGateway.java',
    );
  });

  it('searches inside snippet code, not only metadata', () => {
    const results = searchCode(CODE_MODULES, 'markSeenUserMappings');

    expect(results.map((result) => result.file.name)).toContain(
      'PostgresChunkGateway.java',
    );
  });

  it('matches all query words in any order and ignores case', () => {
    const results = searchCode(CODE_MODULES, 'keyset rOWNUM');

    expect(results.some((result) =>
      result.file.path.endsWith('OracleRowReader.java'),
    )).toBe(true);
  });

  it('returns an empty list for an empty query or a miss', () => {
    expect(searchCode(CODE_MODULES, '   ')).toEqual([]);
    expect(searchCode(CODE_MODULES, 'zzzz-not-found')).toEqual([]);
  });
});
