import { ArrowUpRight } from 'lucide-react';
import { BACKEND_MODULES, SITE } from '../../data/site';
import { GithubIcon } from '../ui/GithubIcon';
import { Brand } from './Brand';

const REPO_LINKS = [
  { label: 'GitHub', href: SITE.repoUrl },
  { label: 'README', href: SITE.readmeUrl },
  { label: 'GPL-3.0', href: SITE.licenseUrl },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 border-t border-line">
      <div aria-hidden="true" className="migration-line opacity-70" />
      <div className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
              Демонстрационный проект: независимые Spring Boot приложения на
              Oracle и PostgreSQL, schema-migration и data-migration с
              initial-load по умолчанию.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-md border border-line bg-surface/50 px-2.5 py-1.5 font-mono text-[10px] text-muted">
              <span aria-hidden="true" className="status-led text-ok" />
              {SITE.license}
              <span className="text-line">/</span>
              {SITE.author}
            </p>
          </div>

          <div>
            <h2 className="font-mono text-[11px] text-muted">Сервисы</h2>
            <ul className="mt-4">
              {BACKEND_MODULES.map((module) => (
                <li
                  className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-0"
                  key={module.name}
                >
                  <span className="truncate font-mono text-[11px] text-text/80">
                    {module.name}
                  </span>
                  <span className="font-mono text-[10px] text-muted/80">
                    :{module.port}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-[11px] text-muted">Репозиторий</h2>
            <ul className="mt-4 space-y-1">
              {REPO_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    className="group inline-flex items-center gap-1.5 py-1 text-sm text-muted transition-colors hover:text-text"
                    href={link.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link.label}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-muted/80 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </a>
                </li>
              ))}
            </ul>
            <a
              className="mt-6 inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface/50 px-3 text-xs text-muted transition-colors hover:border-electric/40 hover:text-text"
              href={SITE.repoUrl}
              rel="noreferrer"
              target="_blank"
            >
              <GithubIcon className="h-4 w-4" />
              Исходники
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted/80 sm:flex-row sm:items-center">
          <span>
            © {year} {SITE.author}
          </span>
          <span className="hidden text-line sm:inline">/</span>
          <a
            className="transition-colors hover:text-text"
            href={SITE.licenseUrl}
            rel="noreferrer"
            target="_blank"
          >
            {SITE.license}
          </a>
          <span className="font-mono text-[10px] text-muted/80 sm:ml-auto">
            Oracle → PostgreSQL
          </span>
        </div>
      </div>
    </footer>
  );
}
