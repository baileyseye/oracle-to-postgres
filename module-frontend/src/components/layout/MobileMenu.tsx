import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { NAV_ITEMS, SITE } from '../../data/site';
import { cn } from '../../lib/cn';
import { RuntimeModeSwitch } from '../live/RuntimeModeSwitch';
import { ServiceHealthList } from '../live/ServiceHealth';
import { GithubIcon } from '../ui/GithubIcon';
import { Brand } from './Brand';

interface MobileMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly activeId: string | null;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileMenu({ open, onClose, activeId }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const panel = panelRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      panel?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const media = window.matchMedia('(min-width: 1280px)');
    const handleChange = () => {
      if (media.matches) {
        onClose();
      }
    };

    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, [open, onClose]);

  return (
    <motion.div
      animate={{ opacity: open ? 1 : 0 }}
      aria-hidden={open ? undefined : true}
      aria-label="Меню навигации"
      aria-modal={open ? true : undefined}
      className={cn(
        'fixed inset-0 z-[60] focus:outline-none xl:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      id="mobile-navigation"
      inert={open ? undefined : true}
      initial={false}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        animate={{ y: open ? 0 : -16 }}
        className="flex h-full flex-col bg-bg/95 backdrop-blur-2xl"
        initial={false}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex h-[var(--nav-height)] shrink-0 items-center justify-between px-5 sm:px-8">
          <Brand onNavigate={onClose} />
          <button
            aria-label="Закрыть меню"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface/70 text-muted transition-colors hover:border-electric/40 hover:text-text"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="migration-line shrink-0 opacity-60" />
        <nav
          aria-label="Мобильные разделы страницы"
          className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8"
        >
          <ul>
            {NAV_ITEMS.map((item) => {
              const active = item.id === activeId;

              return (
                <li key={item.id}>
                  <a
                    aria-current={active ? 'location' : undefined}
                    className={cn(
                      'group flex items-center justify-between border-b border-line/60 py-4 font-display text-2xl tracking-[-0.03em] transition-colors',
                      active
                        ? 'text-text'
                        : 'text-muted hover:text-text',
                    )}
                    href={`#${item.id}`}
                    onClick={onClose}
                  >
                    <span>{item.label}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 rounded-full transition-colors',
                        active
                          ? 'bg-electric shadow-[0_0_12px_rgba(56,189,248,0.9)]'
                          : 'bg-line group-hover:bg-muted',
                      )}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 space-y-4 border-t border-line pt-6">
            <a
              className="flex items-center justify-between gap-4 text-sm text-muted transition-colors hover:text-text"
              href={SITE.repoUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span className="inline-flex items-center gap-2.5">
                <GithubIcon className="h-4 w-4" />
                GitHub
              </span>
              <span className="font-mono text-caption">репозиторий</span>
            </a>
            <a
              className="flex items-center justify-between gap-4 text-sm text-muted transition-colors hover:text-text"
              href={SITE.readmeUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span>README</span>
              <span className="font-mono text-caption">карта проекта</span>
            </a>
            <div className="border-t border-line/60 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-micro text-muted/80">
                  режим
                </span>
                <RuntimeModeSwitch size="md" />
              </div>
              <div className="mt-3">
                <ServiceHealthList />
              </div>
            </div>
          </div>
        </nav>
      </motion.div>
    </motion.div>
  );
}
