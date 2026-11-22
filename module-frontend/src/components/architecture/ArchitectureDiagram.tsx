import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  ARCHITECTURE_EDGES,
  ARCHITECTURE_NODES,
} from '../../data/architecture';
import { NODE_HEALTH_SERVICE } from '../../data/live';
import { useLiveMode } from '../../hooks/useLiveMode';
import { useMigrationMode } from '../../hooks/useMigrationMode';
import {
  getArchitectureEdgeLabel,
  isArchitectureEdgeActive,
  isArchitectureNodeActive,
} from '../../lib/architecture';
import { cn } from '../../lib/cn';
import type {
  ArchitectureAccent,
  ArchitectureNode,
  ArchitectureNodeId,
  SchemaOwnerId,
} from '../../types/architecture';
import type { MigrationModeId } from '../../types/migration-api';
import type { ServiceHealthStatus } from '../../types/live';

const ACCENT_COLOR: Record<ArchitectureAccent, string> = {
  oracle: 'var(--color-oracle)',
  pg: 'var(--color-pg)',
  electric: 'var(--color-electric)',
  magenta: 'var(--color-magenta)',
};

const ACCENT_TEXT: Record<ArchitectureAccent, string> = {
  oracle: 'var(--color-oracle)',
  pg: 'var(--color-info)',
  electric: 'var(--color-electric)',
  magenta: 'var(--color-magenta)',
};

const HEALTH_COLOR: Record<ServiceHealthStatus, string> = {
  up: 'var(--color-ok)',
  down: 'var(--color-danger)',
  checking: 'var(--color-electric)',
  unknown: 'var(--color-muted)',
};

interface ArchitectureDiagramProps {
  readonly selectedId: ArchitectureNodeId;
  readonly schemaOwner: SchemaOwnerId;
  readonly onSelect: (id: ArchitectureNodeId) => void;
}

interface DiagramNodeProps {
  readonly node: ArchitectureNode;
  readonly selected: boolean;
  readonly routeActive: boolean;
  readonly mode: MigrationModeId;
  readonly schemaOwner: SchemaOwnerId;
  readonly healthStatus?: ServiceHealthStatus;
  readonly healthTitle?: string;
  readonly onSelect: (id: ArchitectureNodeId) => void;
}

function DiagramNode({
  node,
  selected,
  routeActive,
  mode,
  schemaOwner,
  healthStatus,
  healthTitle,
  onSelect,
}: DiagramNodeProps) {
  const accent = ACCENT_COLOR[node.accent];
  const accentText = ACCENT_TEXT[node.accent];
  const titleFont =
    node.kind === 'service' || node.kind === 'table'
      ? 'var(--font-mono)'
      : 'var(--font-display)';
  const titleSize =
    node.kind === 'database' ? 22 : node.kind === 'table' ? 14 : 13;
  const disabled = !isArchitectureNodeActive(node, schemaOwner);
  const isTargetDatabase = node.id === 'postgres-db';
  const subtitle = isTargetDatabase
    ? `active: ${schemaOwner}`
    : node.subtitle;
  const footer = disabled
    ? 'не участвует'
    : isTargetDatabase
      ? `owner: ${schemaOwner === 'public' ? 'Liquibase' : 'schema-migration'}`
      : node.footer;
  const badge = disabled ? undefined : node.modeBadges?.[mode];

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(node.id);
    }
  };

  return (
    <g
      aria-label={`${node.title}, ${node.role}${node.port ? `, порт ${node.port}` : ''}${disabled ? ', не участвует в выбранной схеме' : ''}`}
      aria-pressed={selected}
      className={cn(
        'arch-node',
        selected && 'is-selected',
        routeActive && 'is-route',
        disabled && 'is-disabled',
      )}
      data-node-id={node.id}
      onClick={() => onSelect(node.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <rect
        className="arch-node-focus"
        height={node.height + 6}
        rx={16}
        width={node.width + 6}
        x={node.x - 3}
        y={node.y - 3}
      />
      <rect
        className="arch-node-card"
        fill="var(--color-surface)"
        height={node.height}
        rx={12}
        stroke="var(--color-line)"
        width={node.width}
        x={node.x}
        y={node.y}
      />
      <rect
        fill={accent}
        height={2}
        opacity={0.85}
        rx={1}
        width={node.width - 2}
        x={node.x + 1}
        y={node.y + 1}
      />
      <circle cx={node.x + 17} cy={node.y + 20} fill={accent} r={2.6} />
      <text
        fill="var(--color-muted)"
        fontFamily="var(--font-mono)"
        fontSize={9.5}
        x={node.x + 25}
        y={node.y + 23}
      >
        {node.role}
      </text>
      {node.port ? (
        <text
          fill={accentText}
          fontFamily="var(--font-mono)"
          fontSize={11}
          textAnchor="end"
          x={node.x + node.width - 14}
          y={node.y + 23}
        >
          :{node.port}
        </text>
      ) : null}
      {healthStatus ? (
        <circle
          cx={node.x + node.width - 10}
          cy={node.y + 9}
          fill={HEALTH_COLOR[healthStatus]}
          r={2.4}
        >
          <title>{healthTitle ?? 'health'}</title>
        </circle>
      ) : null}
      <text
        fill="var(--color-text)"
        fontFamily={titleFont}
        fontSize={titleSize}
        fontWeight={node.kind === 'database' ? 600 : 500}
        letterSpacing={node.kind === 'database' ? '-0.04em' : '0'}
        x={node.x + 16}
        y={node.y + 51}
      >
        {node.title}
      </text>
      <text
        fill="var(--color-muted)"
        fontFamily="var(--font-mono)"
        fontSize={10.5}
        x={node.x + 16}
        y={node.y + 70}
      >
        {subtitle}
      </text>
      {node.id === 'module-migration' ? (
        <text
          fill={accentText}
          fontFamily="var(--font-mono)"
          fontSize={9.5}
          opacity={0.85}
          x={node.x + 16}
          y={node.y + 92}
        >
          {mode === 'initial-load' ? 'keyset → COPY' : 'staging → upsert'}
        </text>
      ) : null}
      <text
        fill="var(--color-muted)"
        fontFamily="var(--font-mono)"
        fontSize={9.5}
        opacity={0.8}
        x={node.x + 16}
        y={node.y + node.height - 14}
      >
        {footer}
      </text>
      {badge ? (
        <text
          fill={accentText}
          fontFamily="var(--font-mono)"
          fontSize={9.5}
          textAnchor="end"
          x={node.x + node.width - 14}
          y={node.y + node.height - 14}
        >
          {badge}
        </text>
      ) : null}
    </g>
  );
}

export function ArchitectureDiagram({
  selectedId,
  schemaOwner,
  onSelect,
}: ArchitectureDiagramProps) {
  const { mode } = useMigrationMode();
  const { mode: runtimeMode, health } = useLiveMode();
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const gridId = `arch-grid-${uid}`;
  const gradientId = `arch-gradient-${uid}`;
  const markerId = `arch-arrow-${uid}`;
  const markerActiveId = `arch-arrow-active-${uid}`;

  const activeRouteEdges = ARCHITECTURE_EDGES.filter(
    (edge) =>
      edge.variant === 'route' &&
      isArchitectureEdgeActive(edge, mode, schemaOwner),
  );
  const activeRouteNodeIds = new Set<ArchitectureNodeId>(
    activeRouteEdges.flatMap((edge) => [edge.from, edge.to]),
  );

  return (
    <svg
      aria-label="Топология миграции Oracle → PostgreSQL"
      className="block h-auto w-full"
      role="group"
      viewBox="0 0 900 570"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          height="28"
          id={gridId}
          patternUnits="userSpaceOnUse"
          width="28"
        >
          <circle cx="1.2" cy="1.2" fill="var(--color-line)" r="1" />
        </pattern>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-oracle)" />
          <stop offset="0.38" stopColor="var(--color-magenta)" />
          <stop offset="0.72" stopColor="var(--color-electric)" />
          <stop offset="1" stopColor="var(--color-pg)" />
        </linearGradient>
        <marker
          id={markerId}
          markerHeight="10"
          markerWidth="10"
          orient="auto"
          refX="8"
          refY="5"
          viewBox="0 0 10 10"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="rgba(148,163,184,0.55)" />
        </marker>
        <marker
          id={markerActiveId}
          markerHeight="10"
          markerWidth="10"
          orient="auto"
          refX="8"
          refY="5"
          viewBox="0 0 10 10"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--color-electric)" />
        </marker>
      </defs>

      <rect fill={`url(#${gridId})`} height="570" width="900" />

      {ARCHITECTURE_EDGES.map((edge, index) => {
        const permitted = isArchitectureEdgeActive(
          edge,
          mode,
          schemaOwner,
        );
        const routeActive = edge.variant === 'route' && permitted;
        const schemaActive =
          (edge.variant === 'schema' ||
            (edge.variant === 'app' && edge.schemaOwners !== undefined)) &&
          permitted;
        const inactive = !permitted;
        const label = getArchitectureEdgeLabel(edge, mode);

        return (
          <g key={edge.id}>
            <path
              className={cn(
                'arch-edge',
                routeActive && 'is-active',
                schemaActive && 'is-schema-active',
                inactive && 'is-inactive',
              )}
              d={edge.path}
              data-edge-id={edge.id}
              fill="none"
              markerEnd={
                permitted
                  ? edge.variant === 'route'
                    ? `url(#${markerActiveId})`
                    : `url(#${markerId})`
                  : undefined
              }
              stroke={
                routeActive
                  ? `url(#${gradientId})`
                  : schemaActive
                    ? 'rgba(56, 189, 248, 0.48)'
                    : inactive
                      ? 'rgba(148, 163, 184, 0.16)'
                      : 'rgba(148, 163, 184, 0.32)'
              }
              strokeDasharray={
                edge.variant === 'app'
                  ? undefined
                  : routeActive
                    ? '5 6'
                    : '2 6'
              }
              strokeWidth={routeActive || schemaActive ? 1.6 : 1.2}
              vectorEffect="non-scaling-stroke"
            />
            {routeActive && !reduceMotion ? (
              <circle
                className="flow-particle text-electric"
                fill="currentColor"
                r="2.2"
              >
                <animateMotion
                  begin={`${index * 0.9}s`}
                  dur="4.6s"
                  path={edge.path}
                  repeatCount="indefinite"
                />
              </circle>
            ) : null}
            {label && permitted ? (
              <text
                className="arch-edge-label"
                fill={
                  routeActive || schemaActive
                    ? 'var(--color-text)'
                    : 'var(--color-muted)'
                }
                fontFamily="var(--font-mono)"
                fontSize={10}
                opacity={routeActive || schemaActive ? 0.95 : 0.72}
                x={edge.labelX}
                y={edge.labelY}
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}

      {ARCHITECTURE_NODES.map((node) => {
        const serviceId = NODE_HEALTH_SERVICE[node.id];
        const serviceHealth =
          runtimeMode === 'live' && serviceId ? health[serviceId] : null;

        return (
          <DiagramNode
            healthStatus={
              serviceHealth ? serviceHealth.status : undefined
            }
            healthTitle={
              serviceHealth
                ? `${serviceHealth.name} :${serviceHealth.port} — ${serviceHealth.status}`
                : undefined
            }
            key={node.id}
            mode={mode}
            node={node}
            onSelect={onSelect}
            routeActive={activeRouteNodeIds.has(node.id)}
            schemaOwner={schemaOwner}
            selected={node.id === selectedId}
          />
        );
      })}
    </svg>
  );
}
