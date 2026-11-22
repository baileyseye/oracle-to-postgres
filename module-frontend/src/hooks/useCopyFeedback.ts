import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';

export function useCopyFeedback(resetAfterMs = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const success = await copyToClipboard(text);

      if (!success) {
        return false;
      }

      setCopied(true);

      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }

      timer.current = window.setTimeout(() => {
        setCopied(false);
        timer.current = null;
      }, resetAfterMs);

      return true;
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
