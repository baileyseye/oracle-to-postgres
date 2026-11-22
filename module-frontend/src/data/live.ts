import type {
  LiveServiceDefinition,
  LiveServiceId,
} from '../types/live';
import type { ArchitectureNodeId } from '../types/architecture';

function normalizeBase(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value.trim().replace(/\/+$/, '');
}

/**
 * Dev использует Vite-прокси по этим alias.
 * Для production nginx должен проксировать те же пути,
 * либо переменные окружения задают абсолютные base URL.
 */
export const SERVICE_BASES: Record<LiveServiceId, string> = {
  oracle: normalizeBase(import.meta.env.VITE_ORACLE_BASE, '/api/oracle'),
  postgres: normalizeBase(
    import.meta.env.VITE_POSTGRES_BASE,
    '/api/postgres',
  ),
  migration: normalizeBase(
    import.meta.env.VITE_MIGRATION_BASE,
    '/api/migration',
  ),
  schema: normalizeBase(import.meta.env.VITE_SCHEMA_BASE, '/api/schema'),
};

export const LIVE_SERVICES: readonly LiveServiceDefinition[] = [
  {
    id: 'oracle',
    name: 'module-oracle',
    port: '8081',
    baseUrl: SERVICE_BASES.oracle,
    healthPath: '/actuator/health',
  },
  {
    id: 'postgres',
    name: 'module-postgres',
    port: '8082',
    baseUrl: SERVICE_BASES.postgres,
    healthPath: '/actuator/health',
  },
  {
    id: 'migration',
    name: 'module-migration',
    port: '8083',
    baseUrl: SERVICE_BASES.migration,
    healthPath: '/actuator/health',
  },
  {
    id: 'schema',
    name: 'module-schema-migration',
    port: '8084',
    baseUrl: SERVICE_BASES.schema,
    healthPath: '/actuator/health',
  },
];

export function getLiveService(
  id: LiveServiceId,
): LiveServiceDefinition {
  const service = LIVE_SERVICES.find((item) => item.id === id);

  if (!service) {
    throw new Error(`Неизвестный live-сервис: ${id}`);
  }

  return service;
}

export const NODE_HEALTH_SERVICE: Partial<
  Record<ArchitectureNodeId, LiveServiceId>
> = {
  'module-oracle': 'oracle',
  'module-postgres': 'postgres',
  'module-migration': 'migration',
  'module-schema-migration': 'schema',
};
