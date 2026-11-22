import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Ban,
  Info,
  Search,
  X,
} from 'lucide-react';
import {
  TYPE_MAPPINGS,
  TYPE_MAPPING_SOURCE_PATH,
  TYPE_MAPPING_SOURCE_URL,
  UNSUPPORTED_OBJECTS,
} from '../../data/type-mappings';
import {
  filterTypeMappings,
  filterUnsupportedObjects,
} from '../../lib/fidelity';
import { cn } from '../../lib/cn';
import type { FidelityFilter } from '../../types/schema-fidelity';

const AUTO_COUNT = TYPE_MAPPINGS.filter((row) => row.level === 'auto').length;
const WARNING_COUNT = TYPE_MAPPINGS.filter(
  (row) => row.level === 'warning',
).length;

const FILTERS: readonly {
  id: FidelityFilter;
  label: string;
  count: number;
}[] = [
  { id: 'all', label: 'все', count: TYPE_MAPPINGS.length },
  { id: 'auto', label: 'auto', count: AUTO_COUNT },
  { id: 'warning', label: 'warning', count: WARNING_COUNT },
  {
    id: 'unsupported',
    label: 'unsupported',
    count: UNSUPPORTED_OBJECTS.length,
  },
];

export function TypeFidelity() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FidelityFilter>('all');

  const rows = useMemo(
    () => filterTypeMappings(TYPE_MAPPINGS, query, filter),
    [query, filter],
  );
  const unsupported = useMemo(
    () => filterUnsupportedObjects(UNSUPPORTED_OBJECTS, query),
    [query],
  );
  const searchActive = query.trim().length > 0;
  const unsupportedView = filter === 'unsupported';

  return (
    <div className="space-y-4">
      <div className="panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/50"
            />
            <input
              aria-label="Поиск по типам и unsupported-объектам"
              className="h-9 w-full rounded-md border border-line bg-bg/45 pl-8 pr-16 font-mono text-[10px] text-text placeholder:text-muted/40 focus:border-electric/40 focus:ring-1 focus:ring-electric/30"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('');
                }
              }}
              placeholder="Поиск: NUMBER, CLOB, BYTEA, trigger…"
              type="text"
              value={query}
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchActive ? (
                <span
                  aria-live="polite"
                  className="font-mono text-[8px] text-muted/50"
                >
                  {unsupportedView ? unsupported.length : rows.length}
                </span>
              ) : null}
              {query ? (
                <button
                  aria-label="Очистить поиск"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface/70 hover:text-text"
                  onClick={() => setQuery('')}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>

          <div
            aria-label="Фильтр fidelity"
            className="flex shrink-0 flex-wrap gap-1"
            role="group"
          >
            {FILTERS.map((item) => (
              <button
                aria-pressed={filter === item.id}
                className={cn(
                  'relative inline-flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] transition-colors',
                  filter === item.id
                    ? 'bg-surface-2 text-text'
                    : 'text-muted hover:bg-surface/60 hover:text-text',
                )}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label}
                <span
                  className={cn(
                    'rounded border px-1 py-0.5 text-[8px]',
                    filter === item.id
                      ? 'border-electric/25 bg-electric/10 text-electric/80'
                      : 'border-line text-muted/45',
                  )}
                >
                  {item.count}
                </span>
                {filter === item.id ? (
                  <span
                    aria-hidden="true"
                    className="migration-line absolute inset-x-2 bottom-0"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {unsupportedView ? (
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-display text-lg font-medium">
              Unsupported → manual review
            </h3>
            <p className="mt-1 max-w-[75ch] text-[12px] leading-relaxed text-muted/75">
              Эти объекты не переносятся автоматически. Они попадают в
              unsupportedObjects/warnings и требуют отдельного решения до
              production.
            </p>
          </div>
          {unsupported.length > 0 ? (
            <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
              {unsupported.map((object) => (
                <article
                  className="bg-bg/70 p-4"
                  key={object.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-warn/25 bg-warn/10 text-warn">
                      <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                    </span>
                    {object.detectedAs ? (
                      <code className="rounded border border-line bg-surface/50 px-1.5 py-0.5 font-mono text-[8px] text-muted/65">
                        {object.detectedAs}
                      </code>
                    ) : (
                      <span className="font-mono text-[8px] text-muted/45">
                        manual review
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 font-display text-base font-medium">
                    {object.title}
                  </h4>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted/70">
                    {object.note}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="font-mono text-[10px] text-muted/65">
                Ничего не найдено
              </p>
              <p className="mt-1 text-[10.5px] text-muted/45">
                Измените запрос или очистите поиск.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="panel overflow-hidden">
            <p className="border-b border-line px-4 py-2 font-mono text-[8.5px] text-muted/45 sm:hidden">
              таблица прокручивается по горизонтали
            </p>
            <div
              aria-label="Таблица маппинга типов"
              className="scroll-area max-h-[560px] overflow-auto"
              role="region"
              tabIndex={0}
            >
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-line">
                    <th
                      className="px-4 py-3 font-mono text-[9px] font-normal text-muted"
                      scope="col"
                    >
                      Oracle
                    </th>
                    <th
                      className="px-4 py-3 font-mono text-[9px] font-normal text-muted"
                      scope="col"
                    >
                      PostgreSQL
                    </th>
                    <th
                      className="w-[18%] px-4 py-3 font-mono text-[9px] font-normal text-muted"
                      scope="col"
                    >
                      fidelity
                    </th>
                    <th
                      className="px-4 py-3 font-mono text-[9px] font-normal text-muted"
                      scope="col"
                    >
                      что проверить
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      className="border-b border-line/60 last:border-b-0 hover:bg-surface/20"
                      key={row.id}
                    >
                      <th
                        className="px-4 py-3 text-left align-top"
                        scope="row"
                      >
                        <code className="font-mono text-[10.5px] text-text/85">
                          {row.oracleType}
                        </code>
                        <span className="mt-1 block font-mono text-[8px] text-muted/45">
                          {row.category}
                        </span>
                        <span
                          className={cn(
                            'mt-1.5 inline-flex rounded border px-1.5 py-0.5 font-mono text-[8.5px] sm:hidden',
                            row.level === 'auto'
                              ? 'border-ok/25 bg-ok/10 text-ok'
                              : 'border-warn/25 bg-warn/10 text-warn',
                          )}
                        >
                          {row.level}
                        </span>
                      </th>
                      <td className="px-4 py-3 align-top">
                        <code className="font-mono text-[10.5px] text-electric/90">
                          {row.postgresType}
                        </code>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            'inline-flex rounded border px-1.5 py-0.5 font-mono text-[8.5px]',
                            row.level === 'auto'
                              ? 'border-ok/25 bg-ok/10 text-ok'
                              : 'border-warn/25 bg-warn/10 text-warn',
                          )}
                        >
                          {row.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-[11px] leading-relaxed text-muted/75">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-mono text-[10px] text-muted/65">
                  По фильтру ничего не найдено
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted/45">
                  {unsupported.length > 0
                    ? `Есть совпадения в unsupported: ${unsupported.length}. Откройте фильтр unsupported.`
                    : 'Измените запрос или очистите поиск.'}
                </p>
                {unsupported.length > 0 ? (
                  <button
                    className="mt-3 inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 font-mono text-[9px] text-muted hover:border-warn/40 hover:text-warn"
                    onClick={() => setFilter('unsupported')}
                    type="button"
                  >
                    показать unsupported
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-warn/20 bg-warn/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Info
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-warn/80"
              />
              <p className="max-w-[75ch] text-[11.5px] leading-relaxed text-muted/80">
                Views, triggers, PL/SQL, synonyms, grants, partitioning и
                tablespaces не переносятся автоматически — это manual review.
              </p>
            </div>
            <button
              className="shrink-0 rounded border border-line px-2.5 py-1.5 font-mono text-[9px] text-muted transition-colors hover:border-warn/40 hover:text-warn"
              onClick={() => setFilter('unsupported')}
              type="button"
            >
              открыть {UNSUPPORTED_OBJECTS.length} категорий
            </button>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8.5px] text-muted/50">
        <span className="max-w-full min-w-0 truncate">
          источник: {TYPE_MAPPING_SOURCE_PATH}
        </span>
        <a
          className="inline-flex items-center gap-1 hover:text-text"
          href={TYPE_MAPPING_SOURCE_URL}
          rel="noreferrer"
          target="_blank"
        >
          PostgresTypeMapper
          <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
