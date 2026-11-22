import { ArrowUpRight } from 'lucide-react';
import { CODE_MODULES } from '../data/code-snippets';
import { SITE } from '../data/site';
import { CodeExplorer } from '../components/code/CodeExplorer';
import { Reveal } from '../components/ui/Reveal';

export function Code() {
  const fileCount = CODE_MODULES.reduce(
    (total, module) => total + module.files.length,
    0,
  );

  return (
    <section className="relative py-24 sm:py-28" id="code">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Код миграции
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                Реальные методы из module-migration и module-schema-migration:
                keyset, COPY, retry, async-job, set-based upsert, DDL и type
                mapping. Поиск идёт и по метаданным, и по тексту сниппетов.
              </p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[9px] text-muted/65 lg:items-end">
              <span>
                {CODE_MODULES.length} модуля · {fileCount} файлов
              </span>
              <a
                className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-text"
                href={SITE.repoUrl}
                rel="noreferrer"
                target="_blank"
              >
                исходники на GitHub
                <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10">
            <CodeExplorer />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
