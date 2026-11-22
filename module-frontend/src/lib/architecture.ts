import type {
  ArchitectureEdge,
  ArchitectureNode,
  MigrationModeOption,
  SchemaOwnerId,
  SchemaOwnerOption,
} from '../types/architecture';
import type { MigrationModeId } from '../types/migration-api';
import {
  MIGRATION_MODE_OPTIONS,
  SCHEMA_OWNER_OPTIONS,
} from '../data/architecture';

export function isArchitectureEdgeActive(
  edge: ArchitectureEdge,
  mode: MigrationModeId,
  schemaOwner: SchemaOwnerId,
): boolean {
  const dataActive = edge.modes === undefined || edge.modes.includes(mode);
  const schemaActive =
    edge.schemaOwners === undefined ||
    edge.schemaOwners.includes(schemaOwner);

  return dataActive && schemaActive;
}

export function isArchitectureNodeActive(
  node: ArchitectureNode,
  schemaOwner: SchemaOwnerId,
): boolean {
  return (
    node.activeForSchemaOwners === undefined ||
    node.activeForSchemaOwners.includes(schemaOwner)
  );
}

export function getArchitectureEdgeLabel(
  edge: ArchitectureEdge,
  mode: MigrationModeId,
): string {
  return edge.modeLabels?.[mode] ?? edge.label ?? '';
}

export function getMigrationModeOption(
  mode: MigrationModeId,
): MigrationModeOption {
  const option = MIGRATION_MODE_OPTIONS.find((item) => item.id === mode);

  if (!option) {
    throw new Error(`Неизвестный режим миграции: ${mode}`);
  }

  return option;
}

export function getSchemaOwnerOption(
  schemaOwner: SchemaOwnerId,
): SchemaOwnerOption {
  const option = SCHEMA_OWNER_OPTIONS.find(
    (item) => item.id === schemaOwner,
  );

  if (!option) {
    throw new Error(`Неизвестный владелец схемы: ${schemaOwner}`);
  }

  return option;
}
