import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ScrollFadeProps {
  readonly 'aria-label': string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function ScrollFade({
  'aria-label': ariaLabel,
  className,
  children,
}: ScrollFadeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);

  useLayoutEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const update = () => {
      setAtEnd(
        element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <div
        aria-label={ariaLabel}
        className={cn(
          'scroll-area overscroll-x-contain',
          className,
        )}
        onScroll={(event) => {
          const element = event.currentTarget;
          setAtEnd(
            element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
          );
        }}
        ref={scrollRef}
        role="region"
        tabIndex={0}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-2 w-12 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200',
          atEnd && 'opacity-0',
        )}
      />
    </div>
  );
}
