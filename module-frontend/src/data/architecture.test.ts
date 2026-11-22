import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_EDGES,
  ARCHITECTURE_NODES,
  MIGRATION_MODE_OPTIONS,
  SCHEMA_OWNER_OPTIONS,
} from './architecture';
import {
  getArchitectureEdgeLabel,
  getMigrationModeOption,
  getSchemaOwnerOption,
  isArchitectureEdgeActive,
  isArchitectureNodeActive,
} from '../lib/architecture';
import { GITHUB_REPO_URL } from '../lib/github';
import type { ArchitectureEdge, SchemaOwnerId } from '../types/architecture';
import type { MigrationModeId } from '../types/migration-api';

function activeRouteEdgeIds(
  mode: MigrationModeId,
  schemaOwner: SchemaOwnerId = 'public',
): string[] {
  return ARCHITECTURE_EDGES.filter(
    (edge) =>
      edge.variant === 'route' &&
      isArchitectureEdgeActive(edge, mode, schemaOwner),
  ).map((edge) => edge.id);
}

function activeEdgeIds(
  mode: MigrationModeId,
  schemaOwner: SchemaOwnerId,
): string[] {
  return ARCHITECTURE_EDGES.filter((edge) =>
    isArchitectureEdgeActive(edge, mode, schemaOwner),
  ).map((edge) => edge.id);
}

describe('architecture graph', () => {
  it('has unique nodes and every edge points to an existing node', () => {
    const nodeIds = ARCHITECTURE_NODES.map((node) => node.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);

    for (const edge of ARCHITECTURE_EDGES) {
      expect(nodeIds).toContain(edge.from);
      expect(nodeIds).toContain(edge.to);
    }
  });

  it('provides full details for every clickable node', () => {
    for (const node of ARCHITECTURE_NODES) {
      expect(node.keyItems.length).toBeGreaterThan(0);
      expect(node.footer.length).toBeGreaterThan(0);
      expect(node.githubUrl.startsWith(GITHUB_REPO_URL)).toBe(true);

      for (const item of node.keyItems) {
        expect(item.href.startsWith(GITHUB_REPO_URL)).toBe(true);
      }
    }
  });

  it('rebuilds the data route for initial-load and mirror', () => {
    const initialLoad = activeRouteEdgeIds('initial-load');
    const mirror = activeRouteEdgeIds('mirror');

    expect(initialLoad).toContain('migration-to-postgres');
    expect(initialLoad).not.toContain('migration-to-map');
    expect(initialLoad).not.toContain('map-to-postgres');

    expect(mirror).toContain('migration-to-map');
    expect(mirror).toContain('map-to-postgres');
    expect(mirror).not.toContain('migration-to-postgres');

    expect(initialLoad).toContain('source-to-migration');
    expect(mirror).toContain('source-to-migration');
  });

  it('keeps both mode options and their route copy', () => {
    expect(MIGRATION_MODE_OPTIONS.map((option) => option.id)).toEqual([
      'initial-load',
      'mirror',
    ]);

    for (const mode of ['initial-load', 'mirror'] as const) {
      const option = getMigrationModeOption(mode);
      expect(option.route.length).toBeGreaterThan(0);
      expect(option.routeDetail.length).toBeGreaterThan(0);
    }
  });

  it('switches route labels with the mode', () => {
    const sourceEdge = ARCHITECTURE_EDGES.find(
      (edge) => edge.id === 'source-to-migration',
    ) as ArchitectureEdge;

    expect(getArchitectureEdgeLabel(sourceEdge, 'initial-load')).toBe(
      'JDBC · keyset',
    );
    expect(getArchitectureEdgeLabel(sourceEdge, 'mirror')).toBe('keyset');
  });

  it('selects exactly one schema owner path', () => {
    const publicEdges = activeEdgeIds('initial-load', 'public');
    const autoMigrationEdges = activeEdgeIds(
      'initial-load',
      'auto_migration',
    );

    expect(publicEdges).toContain('app-postgres');
    expect(publicEdges).not.toContain('source-to-schema');
    expect(publicEdges).not.toContain('schema-to-postgres');

    expect(autoMigrationEdges).not.toContain('app-postgres');
    expect(autoMigrationEdges).toContain('source-to-schema');
    expect(autoMigrationEdges).toContain('schema-to-postgres');

    expect(publicEdges).toContain('source-to-migration');
    expect(autoMigrationEdges).toContain('source-to-migration');
  });

  it('marks the inactive schema module while keeping it inspectable', () => {
    const postgresModule = ARCHITECTURE_NODES.find(
      (node) => node.id === 'module-postgres',
    );
    const schemaModule = ARCHITECTURE_NODES.find(
      (node) => node.id === 'module-schema-migration',
    );

    if (!postgresModule || !schemaModule) {
      throw new Error('Ожидаемые узлы архитектуры не найдены');
    }

    expect(isArchitectureNodeActive(postgresModule, 'public')).toBe(true);
    expect(isArchitectureNodeActive(postgresModule, 'auto_migration')).toBe(
      false,
    );
    expect(isArchitectureNodeActive(schemaModule, 'public')).toBe(false);
    expect(isArchitectureNodeActive(schemaModule, 'auto_migration')).toBe(
      true,
    );
  });

  it('keeps both schema owner options and their order', () => {
    expect(SCHEMA_OWNER_OPTIONS.map((option) => option.id)).toEqual([
      'public',
      'auto_migration',
    ]);
    expect(getSchemaOwnerOption('auto_migration').ownerModule).toBe(
      'module-schema-migration',
    );
  });
});
