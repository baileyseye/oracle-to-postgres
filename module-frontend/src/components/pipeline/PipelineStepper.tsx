import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PIPELINE_STEPS } from '../../data/pipeline';
import { cn } from '../../lib/cn';
import type { PipelinePhaseId } from '../../types/pipeline';
import type { SimulationSnapshot } from '../../types/simulation';
import { CodeBlock } from '../ui/CodeBlock';

interface PipelineStepperProps {
  readonly snapshot: SimulationSnapshot;
}

export function PipelineStepper({ snapshot }: PipelineStepperProps) {
  const [openStepId, setOpenStepId] = useState<PipelinePhaseId | null>(
    'plan',
  );

  return (
    <ol className="relative space-y-1.5">
      <span
        aria-hidden="true"
        className="absolute bottom-8 left-[13px] top-5 w-px bg-[linear-gradient(180deg,rgba(199,70,52,0.5),rgba(217,70,239,0.3),rgba(56,189,248,0.38),rgba(51,103,145,0.16))]"
      />

      {PIPELINE_STEPS.map((step, index) => {
        const open = openStepId === step.id;
        const completed = snapshot.completedPhaseIds.includes(step.id);
        const running =
          snapshot.currentPhaseId === step.id &&
          (snapshot.status === 'running' || snapshot.status === 'paused');
        const number = String(index + 1).padStart(2, '0');

        return (
          <li
            aria-current={running ? 'step' : undefined}
            className="relative pl-10"
            key={step.id}
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-3.5 inline-flex h-7 w-7 items-center justify-center rounded-full border font-mono text-micro',
                completed
                  ? 'border-ok/40 bg-ok/10 text-ok'
                  : running
                    ? 'border-electric/50 bg-electric/10 text-electric'
                    : 'border-line bg-surface text-muted/70',
              )}
            >
              {completed ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                number
              )}
            </span>

            <article
              className={cn(
                'overflow-hidden rounded-lg border transition-colors',
                open
                  ? 'border-line bg-surface/30'
                  : 'border-transparent hover:border-line/70 hover:bg-surface/20',
                running && 'border-electric/25 bg-electric/[0.035]',
              )}
            >
              <h3>
                <button
                  aria-controls={
                    open ? `pipeline-step-${step.id}` : undefined
                  }
                  aria-expanded={open}
                  className="w-full px-3.5 py-3 text-left sm:px-4"
                  onClick={() => setOpenStepId(open ? null : step.id)}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-micro text-muted/75">
                          {step.kicker}
                        </span>
                        {step.optional ? (
                          <span className="rounded border border-magenta/25 bg-magenta/10 px-1.5 py-0.5 font-mono text-micro text-magenta/90">
                            optional
                          </span>
                        ) : null}
                        {running ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-micro text-electric">
                            <span
                              aria-hidden="true"
                              className="status-led"
                            />
                            {snapshot.status === 'paused'
                              ? 'пауза'
                              : 'выполняется'}
                          </span>
                        ) : null}
                        {completed && !running ? (
                          <span className="font-mono text-micro text-ok">
                            готово
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block font-display text-[15px] font-medium leading-snug text-text sm:text-base">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-caption leading-relaxed text-muted/80">
                        {step.summary}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'mt-1 h-4 w-4 shrink-0 text-muted/80 transition-transform',
                        open && 'rotate-180 text-text/80',
                      )}
                    />
                  </span>
                </button>
              </h3>

              {open ? (
                <div
                  className="border-t border-line/70 px-3.5 pb-4 pt-3 sm:px-4"
                  id={`pipeline-step-${step.id}`}
                >
                  <ul className="space-y-1.5">
                    {step.details.map((detail) => (
                      <li
                        className="flex gap-2.5 text-caption leading-relaxed text-muted/85"
                        key={detail}
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-electric/70"
                        />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 rounded-md border border-line/60 bg-bg/30 px-3 py-2">
                    <p className="font-mono text-micro leading-relaxed text-muted/70">
                      <span className="text-text/70">важно: </span>
                      {step.note}
                    </p>
                  </div>

                  <div className="mt-3">
                    <CodeBlock
                      code={step.snippet.code}
                      endLine={step.snippet.endLine}
                      fileName={step.snippet.fileName}
                      filePath={step.snippet.filePath}
                      githubUrl={step.snippet.githubUrl}
                      language={step.snippet.language}
                      startLine={step.snippet.startLine}
                    />
                  </div>
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
