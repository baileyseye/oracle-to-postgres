import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type DangerousAction = 'sync' | 'async' | 'apply' | 'seed';

const ACTION_META: Record<
  DangerousAction,
  {
    readonly title: string;
    readonly endpoint: string;
    readonly description: string;
    readonly warning: string;
    readonly confirmationWord: string;
  }
> = {
  sync: {
    title: 'Запустить синхронную миграцию',
    endpoint: 'POST /api/v1/migration/run',
    description:
      'Сервер выполнит реальный перенос в target-схему. Это не симуляция: ' +
      'строки в PostgreSQL будут изменены.',
    warning:
      'Это реально меняет БД. Убедитесь, что target-схема и окно миграции выбраны правильно.',
    confirmationWord: 'MIGRATE',
  },
  async: {
    title: 'Запустить async initial-load',
    endpoint: 'POST /api/v1/migration/run/async',
    description:
      'Сервер запустит реальный фоновый job и вернёт 202 + jobId. Target-схема ' +
      'будет изменяться по мере загрузки.',
    warning:
      'Это реально меняет БД. Убедитесь, что target-схема и окно миграции выбраны правильно.',
    confirmationWord: 'MIGRATE',
  },
  apply: {
    title: 'Применить DDL schema migration',
    endpoint: 'POST /api/v1/schema-migration/apply',
    description:
      'Сервер применит DDL к auto_migration. Таблицы и колонки в PostgreSQL ' +
      'будут реально созданы или изменены.',
    warning:
      'Это реально меняет БД. Убедитесь, что target-схема и окно миграции выбраны правильно.',
    confirmationWord: 'MIGRATE',
  },
  seed: {
    title: 'Загрузить большой демо-датасет',
    endpoint: 'POST /__dev/seed-large-oracle',
    description:
      'Локальный dev-скрипт заполнит Oracle до 2 000 000 users и 4 000 000 orders. ' +
      'Загрузка идёт батчами и может занять несколько минут.',
    warning:
      'Target-схема не меняется. Скрипт дополняет source Oracle до целевых counts.',
    confirmationWord: 'SEED',
  },
};

interface DangerConfirmModalProps {
  readonly action: DangerousAction | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

interface DialogProps {
  readonly action: DangerousAction;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ConfirmDialog({ action, onClose, onConfirm }: DialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const inputId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = ACTION_META[action];
  const valid = confirmation === meta.confirmationWord;

  useEffect(() => {
    const panel = panelRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
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

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-labelledby={`${inputId}-title`}
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-bg/80 p-4 pt-[12vh] backdrop-blur-md sm:items-center sm:pt-4"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      transition={{ duration: 0.18 }}
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="panel w-full max-w-lg overflow-hidden"
        exit={{ opacity: 0, y: 8 }}
        initial={{ opacity: 0, y: 10 }}
        ref={panelRef}
        transition={{ duration: 0.22 }}
      >
        <div className="migration-line opacity-80" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-danger/30 bg-danger/10 text-danger">
                <Shield aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h2
                  className="font-display text-lg font-medium leading-snug"
                  id={`${inputId}-title`}
                >
                  {meta.title}
                </h2>
                <p className="mt-1 font-mono text-micro text-danger/80">
                  {meta.endpoint}
                </p>
              </div>
            </div>
            <button
              aria-label="Закрыть подтверждение"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line text-muted hover:bg-surface-2 hover:text-text"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-4 rounded-md border border-danger/25 bg-danger/5 px-3 py-2.5 text-caption leading-relaxed text-text/80">
            {meta.description}{' '}
            <strong className="font-medium text-danger">
              {meta.warning}
            </strong>
          </p>

          <label
            className="mt-4 block font-mono text-micro text-muted/70"
            htmlFor={inputId}
          >
            введите {meta.confirmationWord} для подтверждения
          </label>
          <input
            aria-describedby={`${inputId}-hint`}
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-md border border-line bg-bg/55 px-3 font-mono text-caption tracking-[0.18em] text-text placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70 focus:border-danger/50 focus:ring-1 focus:ring-danger/30"
            id={inputId}
            onChange={(event) =>
              setConfirmation(event.target.value.toUpperCase())
            }
            placeholder={meta.confirmationWord}
            ref={inputRef}
            spellCheck={false}
            type="text"
            value={confirmation}
          />
          <p
            className="mt-1.5 font-mono text-micro text-muted/70"
            id={`${inputId}-hint`}
          >
            кнопка станет активной только при точном совпадении слова
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              className="inline-flex h-9 items-center rounded-md border border-line px-3.5 font-mono text-caption text-muted transition-colors hover:text-text"
              onClick={onClose}
              type="button"
            >
              Отмена
            </button>
            <button
              className={cn(
                'inline-flex h-9 items-center rounded-md px-3.5 font-mono text-caption font-semibold transition-colors',
                valid
                  ? 'border border-danger/45 bg-danger/15 text-danger hover:bg-danger/25'
                  : 'cursor-not-allowed border border-line bg-surface/40 text-muted/70',
              )}
              disabled={!valid}
              onClick={onConfirm}
              type="button"
            >
              Подтвердить и выполнить
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function DangerConfirmModal({
  action,
  onClose,
  onConfirm,
}: DangerConfirmModalProps) {
  return (
    <AnimatePresence>
      {action ? (
        <ConfirmDialog
          action={action}
          key={action}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </AnimatePresence>
  );
}
