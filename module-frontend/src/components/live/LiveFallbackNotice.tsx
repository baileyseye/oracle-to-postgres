import { X } from 'lucide-react';
import { useLiveMode } from '../../hooks/useLiveMode';

export function LiveFallbackNotice() {
  const { fallbackNotice, dismissFallback } = useLiveMode();

  if (!fallbackNotice) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-4 top-[84px] z-40 mx-auto flex max-w-md items-start gap-2.5 rounded-lg border border-danger/35 bg-surface/95 px-3.5 py-3 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur sm:left-auto sm:right-6 sm:mx-0"
      role="alert"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger"
      />
      <p className="flex-1 text-[11.5px] leading-relaxed text-text/85">
        {fallbackNotice}
      </p>
      <button
        aria-label="Скрыть уведомление"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted/60 hover:bg-surface-2 hover:text-text"
        onClick={dismissFallback}
        type="button"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
