const NAV_HEIGHT = 72;
const SCROLL_OFFSET = NAV_HEIGHT + 24;

export function scrollToTop(): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.scrollTo({
    top: 0,
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}

export function scrollToSection(id: string): void {
  const section = document.getElementById(id);

  if (!section) {
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = section.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;

  window.scrollTo({
    top,
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}
