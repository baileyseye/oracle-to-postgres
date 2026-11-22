import { describe, expect, it } from 'vitest';
import { TYPE_MAPPINGS, UNSUPPORTED_OBJECTS } from '../data/type-mappings';
import {
  filterTypeMappings,
  filterUnsupportedObjects,
} from './fidelity';

describe('fidelity filters', () => {
  it('filters mappings by level', () => {
    const warnings = filterTypeMappings(TYPE_MAPPINGS, '', 'warning');
    const auto = filterTypeMappings(TYPE_MAPPINGS, '', 'auto');

    expect(warnings.length).toBeGreaterThan(0);
    expect(auto.length).toBeGreaterThan(0);
    expect(warnings.every((row) => row.level === 'warning')).toBe(true);
    expect(auto.every((row) => row.level === 'auto')).toBe(true);
    expect(filterTypeMappings(TYPE_MAPPINGS, '', 'unsupported')).toEqual([]);
  });

  it('searches Oracle and PostgreSQL types by all words', () => {
    const rows = filterTypeMappings(TYPE_MAPPINGS, 'varchar2 byte', 'all');

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) =>
      `${row.oracleType} ${row.postgresType}`.toLowerCase().includes('varchar2'),
    )).toBe(true);
  });

  it('filters unsupported objects independently', () => {
    expect(filterUnsupportedObjects(UNSUPPORTED_OBJECTS, 'plsql')).toHaveLength(
      1,
    );
    expect(
      filterUnsupportedObjects(UNSUPPORTED_OBJECTS, 'tablespace'),
    ).toHaveLength(1);
    expect(
      filterUnsupportedObjects(UNSUPPORTED_OBJECTS, 'not-found'),
    ).toEqual([]);
  });
});
