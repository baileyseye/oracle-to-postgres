import type { MigrationModeId } from './migration-api';

export type ArchitectureNodeId =
  | 'oracle-db'
  | 'module-oracle'
  | 'module-migration'
  | 'module-schema-migration'
  | 'module-postgres'
  | 'postgres-db'
  | 'entity-map';

export type ArchitectureNodeKind = 'database' | 'service' | 'table';
export type ArchitectureAccent = 'oracle' | 'pg' | 'electric' | 'magenta';
export type ArchitectureEdgeVariant = 'route' | 'schema' | 'app';
export type SchemaOwnerId = 'public' | 'auto_migration';

export interface ArchitectureKeyItem {
  readonly name: string;
  readonly href: string;
}

export interface ArchitectureNode {
  readonly id: ArchitectureNodeId;
  readonly kind: ArchitectureNodeKind;
  readonly title: string;
  readonly subtitle: string;
  readonly role: string;
  readonly port?: string;
  readonly apiPrefix?: string;
  readonly description: string;
  readonly footer: string;
  readonly keyItemsLabel: string;
  readonly keyItems: readonly ArchitectureKeyItem[];
  readonly githubUrl: string;
  readonly accent: ArchitectureAccent;
  readonly modeNotes?: Partial<Record<MigrationModeId, string>>;
  readonly modeBadges?: Partial<Record<MigrationModeId, string>>;
  readonly activeForSchemaOwners?: readonly SchemaOwnerId[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ArchitectureEdge {
  readonly id: string;
  readonly from: ArchitectureNodeId;
  readonly to: ArchitectureNodeId;
  readonly path: string;
  readonly variant: ArchitectureEdgeVariant;
  readonly label?: string;
  readonly modeLabels?: Partial<Record<MigrationModeId, string>>;
  readonly labelX: number;
  readonly labelY: number;
  readonly modes?: readonly MigrationModeId[];
  readonly schemaOwners?: readonly SchemaOwnerId[];
}

export interface SchemaOwnerOption {
  readonly id: SchemaOwnerId;
  readonly label: string;
  readonly shortDescription: string;
  readonly ownerModule: string;
  readonly schemaStep: string;
  readonly detail: string;
}

export interface MigrationModeOption {
  readonly id: MigrationModeId;
  readonly label: string;
  readonly shortDescription: string;
  readonly route: string;
  readonly routeDetail: string;
}
