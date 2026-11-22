import { useEffect, useState } from 'react';

export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(
    () => window.scrollY > threshold,
  );

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };

    const scheduleUpdate = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
    };
  }, [threshold]);

  return scrolled;
}
