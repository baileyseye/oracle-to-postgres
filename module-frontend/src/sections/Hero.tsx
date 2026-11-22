import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUpRight, CodeXml } from 'lucide-react';
import { HERO_STATS, SITE } from '../data/site';
import { GithubIcon } from '../components/ui/GithubIcon';
import { SchemaFlow } from '../components/hero/SchemaFlow';
import { TelemetryRail } from '../components/hero/TelemetryRail';

const EASE = [0.22, 1, 0.36, 1] as const;

const HERO_CONTAINER: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.1,
    },
  },
};

const HERO_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

function InlineCode({ children }: { readonly children: string }) {
  return (
    <code className="font-mono text-[0.9em] text-text/90">{children}</code>
  );
}

export function Hero() {
  return (
    <section
      className="relative overflow-x-clip pb-20 pt-[112px] sm:pb-24 sm:pt-[132px]"
      id="top"
    >
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <motion.div
          animate="show"
          initial="hidden"
          variants={HERO_CONTAINER}
        >
          <motion.div variants={HERO_ITEM}>
            <div className="inline-flex items-center gap-2.5 rounded-md border border-line bg-surface/55 px-3 py-1.5 font-mono text-[10px] text-muted backdrop-blur">
              <span aria-hidden="true" className="status-led text-ok" />
              <span className="text-text/85">initial-load</span>
              <span aria-hidden="true" className="h-3 w-px bg-line" />
              <span>режим по умолчанию</span>
            </div>
            <h1
              aria-label="Oracle → PostgreSQL"
              className="migration-text mt-6 w-fit max-w-full font-display text-[clamp(2.75rem,8.4vw,7.25rem)] font-semibold leading-[0.92] tracking-[-0.055em]"
            >
              <span aria-hidden="true" className="block">
                Oracle →
              </span>
              <span aria-hidden="true" className="block">
                PostgreSQL
              </span>
            </h1>
          </motion.div>

          <div className="mt-9 grid gap-12 lg:mt-12 lg:grid-cols-12 lg:gap-10">
            <motion.div className="lg:col-span-6 lg:pr-6" variants={HERO_ITEM}>
              <p className="max-w-[58ch] text-[15px] leading-7 text-muted sm:text-base">
                <InlineCode>initial-load</InlineCode> — режим по умолчанию:
                остановка окружения, <InlineCode>COPY</InlineCode> с сохранением
                source id и отдельный коммит на каждый чанк. Нужен перенос без
                простоя — <InlineCode>mirror</InlineCode>: keyset-страницы,
                staging и upsert через <InlineCode>migration_entity_map</InlineCode>.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  className="cta-primary group inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 px-5 text-sm font-semibold text-white shadow-[0_18px_50px_-24px_rgba(217,70,239,0.8)] transition hover:brightness-110"
                  href="#pipeline"
                >
                  Как это работает
                  <ArrowDown
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                  />
                </a>
                <a
                  className="group inline-flex h-12 items-center gap-2 rounded-lg border border-line bg-surface/70 px-5 text-sm font-medium text-text transition-colors hover:border-electric/40 hover:bg-surface-2/80"
                  href="#code"
                >
                  <CodeXml
                    aria-hidden="true"
                    className="h-4 w-4 text-muted transition-colors group-hover:text-electric"
                  />
                  Код
                </a>
                <a
                  className="group inline-flex h-12 items-center gap-2 px-2 text-sm text-muted transition-colors hover:text-text"
                  href={SITE.repoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <GithubIcon className="h-4 w-4" />
                  GitHub
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-muted/80 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              </div>

              <p className="mt-7 flex items-start gap-2.5 font-mono text-[10px] leading-relaxed text-muted/80">
                <span
                  aria-hidden="true"
                  className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-electric"
                />
                DEMO работает без бэкенда. LIVE подключается к модулям на портах
                8081–8084.
              </p>
            </motion.div>

            <motion.div className="lg:col-span-6" variants={HERO_ITEM}>
              <SchemaFlow />
            </motion.div>
          </div>
        </motion.div>
      </div>

      <TelemetryRail stats={HERO_STATS} />
    </section>
  );
}
