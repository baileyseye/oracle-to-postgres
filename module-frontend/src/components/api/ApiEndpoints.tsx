import { Fragment, useState } from 'react';
import { ChevronDown, Terminal } from 'lucide-react';
import {
  API_STATUS_CODES,
} from '../../data/api';
import { cn } from '../../lib/cn';
import type { ApiEndpoint, ApiService } from '../../types/api';
import { CopyBlock } from '../ui/CopyBlock';

const STATUS_MEANING = new Map(
  API_STATUS_CODES.map((status) => [status.code, status.meaning]),
);

function MethodBadge({ method }: { readonly method: ApiEndpoint['method'] }) {
  return (
    <span
      className={cn(
        'inline-flex rounded border px-1.5 py-0.5 font-mono text-micro',
        method === 'GET'
          ? 'border-electric/25 bg-electric/10 text-electric'
          : 'border-magenta/25 bg-magenta/10 text-magenta',
      )}
    >
      {method}
    </span>
  );
}

function EndpointRow({
  endpoint,
  open,
  onToggle,
}: {
  readonly endpoint: ApiEndpoint;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const sample =
    endpoint.sampleResponse === undefined
      ? null
      : JSON.stringify(endpoint.sampleResponse, null, 2);

  return (
    <>
      <tr className={cn('border-b border-line/60', open && 'bg-surface/20')}>
        <td className="px-3 py-3 align-top">
          <MethodBadge method={endpoint.method} />
        </td>
        <td className="px-3 py-3 align-top">
          <code className="break-all font-mono text-micro text-text/80">
            {endpoint.path}
          </code>
          {endpoint.dangerous ? (
            <span
              className="mt-1 block font-mono text-micro text-danger/75"
              title="Изменяет БД; доступно только в LIVE с armed-режимом и подтверждением"
            >
              dangerous · изменяет БД
            </span>
          ) : null}
        </td>
        <td className="px-3 py-3 align-top">
          <p className="text-micro leading-snug text-text/80">
            {endpoint.title}
          </p>
          <p className="mt-1 max-w-[46ch] text-caption leading-relaxed text-muted/80">
            {endpoint.description}
          </p>
        </td>
        <td className="px-3 py-3 align-top">
          <code className="font-mono text-micro text-muted/80">
            {endpoint.responseType}
          </code>
        </td>
        <td className="px-3 py-3 align-top">
          <span className="flex flex-wrap gap-1">
            {endpoint.responseCodes.map((code) => (
              <span
                className={cn(
                  'rounded border px-1 py-0.5 font-mono text-micro',
                  code === endpoint.successStatus
                    ? 'border-ok/25 bg-ok/10 text-ok'
                    : 'border-line bg-surface/40 text-muted/70',
                )}
                key={code}
                title={STATUS_MEANING.get(code) ?? String(code)}
              >
                {code}
              </span>
            ))}
          </span>
        </td>
        <td className="px-3 py-3 text-right align-top">
          <button
            aria-expanded={open}
            aria-label={open ? 'Скрыть curl' : 'Показать curl'}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-line text-muted transition-colors hover:border-electric/40 hover:text-text"
            onClick={onToggle}
            type="button"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
            />
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-line/60 bg-bg/20">
          <td className="px-3 py-3" colSpan={6}>
            <div className="grid gap-3 lg:grid-cols-2">
              <CopyBlock
                label="curl"
                maxHeightClass="max-h-[180px]"
                value={endpoint.curl}
              />
              {sample ? (
                <CopyBlock
                  label="пример ответа"
                  maxHeightClass="max-h-[240px]"
                  value={sample}
                />
              ) : (
                <div className="flex items-center gap-2 rounded border border-line bg-bg/30 px-3 py-2 font-mono text-micro text-muted/70">
                  <Terminal aria-hidden="true" className="h-3.5 w-3.5" />
                  пример ответа не приложен; тип: {endpoint.responseType}
                </div>
              )}
            </div>
            {endpoint.dangerous ? (
              <p className="mt-2 font-mono text-micro leading-relaxed text-danger/65">
                изменяющая операция: для UI требуется LIVE + armed + ввод
                MIGRATE; прямой curl меняет БД без дополнительного гейта.
              </p>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface ApiEndpointsProps {
  readonly service: ApiService;
}

export function ApiEndpoints({ service }: ApiEndpointsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-mono text-micro text-text/85">
            {service.name}
          </h3>
          <p className="mt-1 max-w-[75ch] text-micro leading-relaxed text-muted/70">
            {service.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-micro text-muted/70">
          <span>:{service.port}</span>
          <code className="rounded border border-line bg-bg/35 px-1.5 py-0.5 text-muted/70">
            {service.apiPrefix}
          </code>
        </div>
      </div>
      <p className="border-b border-line px-4 py-2 font-mono text-micro text-muted/70 sm:hidden">
        таблица прокручивается по горизонтали
      </p>
      <div
        aria-label={`Эндпоинты ${service.name}`}
        className="scroll-area overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[840px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface/40">
              <th className="px-3 py-2 font-mono text-micro font-normal text-muted/80">
                метод
              </th>
              <th className="px-3 py-2 font-mono text-micro font-normal text-muted/80">
                путь
              </th>
              <th className="px-3 py-2 font-mono text-micro font-normal text-muted/80">
                описание
              </th>
              <th className="px-3 py-2 font-mono text-micro font-normal text-muted/80">
                ответ
              </th>
              <th className="px-3 py-2 font-mono text-micro font-normal text-muted/80">
                коды
              </th>
              <th className="w-8 px-3 py-2">
                <span className="sr-only">curl</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {service.endpoints.map((endpoint) => (
              <Fragment key={endpoint.id}>
                <EndpointRow
                  endpoint={endpoint}
                  open={openId === endpoint.id}
                  onToggle={() =>
                    setOpenId(
                      openId === endpoint.id ? null : endpoint.id,
                    )
                  }
                />
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-4 py-2 font-mono text-micro text-muted/70">
        ответы: {API_STATUS_CODES.map((status) => status.code).join(' · ')} —
        только реальные коды контроллеров и exception handlers
      </div>
    </div>
  );
}
