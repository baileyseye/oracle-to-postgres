import { useEffect, useState } from 'react';

export function useScrollSpy(
  sectionIds: readonly string[],
  offset = 104,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(
    sectionIds[0] ?? null,
  );

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;

      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter((section): section is HTMLElement => section !== null);

      if (sections.length === 0) {
        setActiveId(null);
        return;
      }

      const documentHeight = document.documentElement.scrollHeight;
      const isAtBottom =
        window.innerHeight + window.scrollY >= documentHeight - 2;

      let current = sections[0].id;

      if (isAtBottom) {
        current = sections[sections.length - 1].id;
      } else {
        for (const section of sections) {
          if (section.getBoundingClientRect().top <= offset) {
            current = section.id;
          }
        }
      }

      setActiveId((previous) => (previous === current ? previous : current));
    };

    const scheduleUpdate = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
    };
  }, [sectionIds, offset]);

  return activeId;
}
