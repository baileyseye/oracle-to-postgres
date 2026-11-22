import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { useScrolled } from '../../hooks/useScrolled';
import { scrollToTop } from '../../lib/navigation';

export function BackToTop() {
  const visible = useScrolled(640);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          aria-label="Вернуться наверх"
          className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface/90 text-muted shadow-[0_16px_48px_-16px_rgba(2,6,23,0.9)] backdrop-blur-md transition-colors hover:border-electric/50 hover:text-text sm:bottom-8 sm:right-8"
          exit={{ opacity: 0, y: 8 }}
          initial={{ opacity: 0, y: 8 }}
          onClick={scrollToTop}
          title="Наверх"
          transition={{ duration: 0.2 }}
          type="button"
        >
          <ArrowUp aria-hidden="true" className="h-[18px] w-[18px]" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
