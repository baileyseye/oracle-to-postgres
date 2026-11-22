import type {
  FidelityFilter,
  TypeMappingRow,
  UnsupportedObjectInfo,
} from '../types/schema-fidelity';

function tokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function filterTypeMappings(
  rows: readonly TypeMappingRow[],
  query: string,
  filter: FidelityFilter,
): TypeMappingRow[] {
  const queryParts = tokens(query);

  return rows.filter((row) => {
    if (filter === 'unsupported') {
      return false;
    }

    if (filter !== 'all' && row.level !== filter) {
      return false;
    }

    if (queryParts.length === 0) {
      return true;
    }

    const haystack = [
      row.oracleType,
      row.postgresType,
      row.note,
      row.category,
    ]
      .join('\n')
      .toLowerCase();

    return queryParts.every((part) => haystack.includes(part));
  });
}

export function filterUnsupportedObjects(
  objects: readonly UnsupportedObjectInfo[],
  query: string,
): UnsupportedObjectInfo[] {
  const queryParts = tokens(query);

  return objects.filter((object) => {
    if (queryParts.length === 0) {
      return true;
    }

    const haystack = [
      object.title,
      object.detectedAs ?? '',
      object.note,
    ]
      .join('\n')
      .toLowerCase();

    return queryParts.every((part) => haystack.includes(part));
  });
}
