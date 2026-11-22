import { useCallback, useState } from 'react';
import { Menu } from 'lucide-react';
import { NAV_ITEMS, NAV_SECTION_IDS, SITE } from '../../data/site';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { useScrolled } from '../../hooks/useScrolled';
import { cn } from '../../lib/cn';
import { GithubIcon } from '../ui/GithubIcon';
import { RuntimeModeSwitch } from '../live/RuntimeModeSwitch';
import { ServiceHealthStrip } from '../live/ServiceHealth';
import { Brand } from './Brand';
import { MobileMenu } from './MobileMenu';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeId = useScrollSpy(NAV_SECTION_IDS);
  const scrolled = useScrolled(12);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
          scrolled
            ? 'border-line bg-bg/80 backdrop-blur-xl'
            : 'border-transparent',
        )}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center gap-3 px-5 sm:px-8">
          <Brand wordmarkClassName="hidden sm:block" />
          <nav aria-label="Разделы страницы" className="ml-5 hidden xl:block">
            <ul className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const active = item.id === activeId;

                return (
                  <li key={item.id}>
                    <a
                      aria-current={active ? 'location' : undefined}
                      className={cn(
                        'relative inline-flex items-center px-3 py-2 text-[13px] transition-colors',
                        active
                          ? 'text-text'
                          : 'text-muted hover:text-text',
                      )}
                      href={`#${item.id}`}
                    >
                      {item.label}
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="nav-active-line absolute inset-x-3 -bottom-px"
                        />
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <RuntimeModeSwitch />
            <ServiceHealthStrip />
            <a
              aria-label="Репозиторий на GitHub"
              className="hidden h-9 w-9 items-center justify-center rounded-md border border-line bg-surface/50 text-muted transition-colors hover:border-electric/40 hover:text-text sm:inline-flex"
              href={SITE.repoUrl}
              rel="noreferrer"
              target="_blank"
            >
              <GithubIcon className="h-[18px] w-[18px]" />
            </a>
            <button
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label="Открыть меню"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface/50 text-muted transition-colors hover:border-electric/40 hover:text-text xl:hidden"
              onClick={openMenu}
              type="button"
            >
              <Menu aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu
        activeId={activeId}
        onClose={closeMenu}
        open={menuOpen}
      />
    </>
  );
}
