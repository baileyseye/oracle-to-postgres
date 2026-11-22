export type FidelityLevel = 'auto' | 'warning';
export type FidelityFilter = 'all' | FidelityLevel | 'unsupported';

export type MappingCategory =
  | 'number'
  | 'string'
  | 'datetime'
  | 'lob'
  | 'binary'
  | 'other'
  | 'identity'
  | 'default';

export interface TypeMappingRow {
  readonly id: string;
  readonly oracleType: string;
  readonly postgresType: string;
  readonly level: FidelityLevel;
  readonly category: MappingCategory;
  readonly note: string;
}

export interface UnsupportedObjectInfo {
  readonly id: string;
  readonly title: string;
  readonly detectedAs: string | null;
  readonly note: string;
}
