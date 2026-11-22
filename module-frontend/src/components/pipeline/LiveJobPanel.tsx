import { ArrowUpRight, Ban, Check, Clock } from 'lucide-react';
import { LIVE_SERVICES } from '../../data/live';
import { useLiveMode } from '../../hooks/useLiveMode';
import {
  formatCheckedAt,
  healthDescription,
} from '../../lib/live-format';
import {
  formatCount,
  formatEta,
  formatRate,
} from '../../lib/format';
import { cn } from '../../lib/cn';
import { TrafficDots } from '../ui/TrafficDots';

export function LiveJobPanel() {
  const {
    data,
    health,
    healthSummary,
    lastHealthCheckedAt,
    job,
    cancelJob,
  } = useLiveMode();
  const jobData = job.data;
  const status = jobData?.status ?? null;
  const running = status === 'RUNNING';
  const progress =
    status === 'SUCCEEDED'
      ? 100
      : jobData?.tablesTotal && jobData.tablesTotal > 0
        ? Math.min(
            100,
            Math.round(
              (jobData.tablesCompleted / jobData.tablesTotal) * 100,
            ),
          )
        : 0;
  const migrationStatus = data.migrationStatus.data;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <TrafficDots />
          <span className="truncate font-mono text-[10px] text-muted">
            LIVE async job
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-mono text-[9px]',
            running
              ? 'text-electric'
              : status === 'SUCCEEDED'
                ? 'text-ok'
                : status === 'FAILED'
                  ? 'text-danger'
                  : status === 'CANCELLED'
                    ? 'text-warn'
                    : 'text-muted',
          )}
        >
          <span aria-hidden="true" className="status-led" />
          {status ?? 'idle'}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-[9px] text-muted">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            real API · /api/v1/migration
          </span>
          <span className="rounded border border-line bg-bg/30 px-2 py-1 font-mono text-[8.5px] text-muted/80">
            health {healthSummary.up}/{healthSummary.total}
          </span>
        </div>

        <p className="mt-2 font-mono text-[8.5px] text-muted/45">
          health проверен {formatCheckedAt(lastHealthCheckedAt)}
        </p>

        {!jobData ? (
          <div className="mt-4 rounded-md border border-line bg-bg/30 p-4">
            <p className="font-mono text-[10px] text-text/80">
              Async job не запущен
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted/70">
              Запуск и изменяющие операции выполняются в LIVE-консоли API.
              Кнопки опасных операций требуют armed-режима и подтверждения
              словом MIGRATE.
            </p>
            <a
              className="mt-3 inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 font-mono text-[9px] text-muted transition-colors hover:border-electric/40 hover:text-text"
              href="#api"
            >
              открыть LIVE-консоль
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[8.5px] text-muted/55">
                  jobId
                </p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-text/80">
                  {jobData.jobId}
                </p>
              </div>
              <span className="rounded border border-line bg-bg/30 px-2 py-1 font-mono text-[8.5px] text-muted/70">
                {jobData.mode}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  phase
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-text/85">
                  {jobData.phase}
                </div>
              </div>
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  table
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-text/85">
                  {jobData.table ?? '—'}
                </div>
              </div>
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  rows
                </div>
                <div className="mt-1 font-mono text-[10px] text-text/85">
                  {formatCount(jobData.rowsLoaded)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  lastId / sourceMaxId
                </div>
                <div className="mt-1 font-mono text-[10px] text-text/85">
                  {jobData.lastId ?? '—'} / {jobData.sourceMaxId ?? '—'}
                </div>
              </div>
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  tables
                </div>
                <div className="mt-1 font-mono text-[10px] text-text/85">
                  {jobData.tablesCompleted} / {jobData.tablesTotal ?? '—'}
                </div>
              </div>
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  rows/s
                </div>
                <div className="mt-1 font-mono text-[10px] text-text/85">
                  {formatRate(jobData.rowsPerSecond)}
                </div>
              </div>
              <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
                <div className="font-mono text-[8px] text-muted/60">
                  eta
                </div>
                <div className="mt-1 font-mono text-[10px] text-text/85">
                  {formatEta(jobData.etaSeconds)}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 flex justify-between font-mono text-[8.5px] text-muted/55">
                <span>tables progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-[image:var(--gradient-migration)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 font-mono text-[9px]">
              <div>
                <dt className="text-muted/50">sourceScn</dt>
                <dd className="mt-0.5 text-text/75">
                  {jobData.sourceScn ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted/50">source idle</dt>
                <dd className="mt-0.5 text-text/75">
                  {jobData.sourceIdle === null
                    ? '—'
                    : jobData.sourceIdle
                      ? 'yes'
                      : 'no'}
                </dd>
              </div>
              <div>
                <dt className="text-muted/50">duration</dt>
                <dd className="mt-0.5 text-text/75">
                  {jobData.durationSeconds}s
                </dd>
              </div>
              <div>
                <dt className="text-muted/50">finished</dt>
                <dd className="mt-0.5 truncate text-text/75">
                  {jobData.finishedAt ?? '—'}
                </dd>
              </div>
            </dl>

            {jobData.report ? (
              <div className="mt-3 rounded-md border border-ok/20 bg-ok/5 px-3 py-2">
                <p className="font-mono text-[9px] text-ok">
                  report · {jobData.report.mode}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted/75">
                  users: {jobData.report.usersInserted} inserted,{' '}
                  {jobData.report.usersUpdated} updated; orders:{' '}
                  {jobData.report.ordersInserted} inserted,{' '}
                  {jobData.report.ordersUpdated} updated.
                  {jobData.report.validation
                    ? ` validation ${jobData.report.validation.valid ? 'passed' : 'failed'}.`
                    : ' validation не запускалась.'}
                </p>
              </div>
            ) : null}

            {jobData.error ? (
              <p className="mt-3 rounded border border-danger/25 bg-danger/5 px-3 py-2 text-[11px] leading-relaxed text-danger/85">
                {jobData.error}
              </p>
            ) : null}

            {job.error ? (
              <p className="mt-3 rounded border border-warn/25 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn/85">
                {job.error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 font-mono text-[9px] text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!running || job.canceling}
                onClick={() => {
                  void cancelJob();
                }}
                type="button"
              >
                {job.canceling ? 'cancelling…' : 'Отменить job'}
              </button>
              <a
                className="inline-flex items-center gap-1.5 font-mono text-[9px] text-muted hover:text-text"
                href="#api"
              >
                LIVE-консоль
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </a>
              {jobData.report?.validation ? (
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[8.5px] text-ok">
                  <Check aria-hidden="true" className="h-3 w-3" />
                  validation
                </span>
              ) : null}
            </div>
          </>
        )}

        {!jobData && migrationStatus ? (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <div className="rounded border border-line bg-bg/25 px-2.5 py-2">
              <div className="font-mono text-[8px] text-muted/55">
                source users / orders
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-text/80">
                {migrationStatus.sourceUsers} / {migrationStatus.sourceOrders}
              </div>
            </div>
            <div className="rounded border border-line bg-bg/25 px-2.5 py-2">
              <div className="font-mono text-[8px] text-muted/55">
                target users / orders
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-text/80">
                {migrationStatus.targetUsers} / {migrationStatus.targetOrders}
              </div>
            </div>
          </div>
        ) : null}

        {!jobData && data.migrationStatus.status === 'offline' ? (
          <div className="mt-4 rounded border border-warn/20 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn/85">
            <span className="inline-flex items-center gap-1.5">
              <Ban aria-hidden="true" className="h-3.5 w-3.5" />
              {data.migrationStatus.error ?? 'migration status недоступен'}
            </span>
          </div>
        ) : null}

        <div className="mt-4 border-t border-line pt-3 font-mono text-[8px] text-muted/40">
          health:{' '}
          {LIVE_SERVICES.map(
            (service) =>
              `${service.name}=${healthDescription(health[service.id].status)}`,
          ).join(' · ')}
        </div>
      </div>
    </div>
  );
}
