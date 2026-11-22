const GROUP_SEPARATOR = '\u00A0';

export function formatCount(value: number): string {
  const normalized = Math.trunc(Math.abs(value)).toString();
  const grouped = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);

  return value < 0 ? `-${grouped}` : grouped;
}

export function formatRate(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }

  return `${Math.max(0, Math.ceil(seconds))}s`;
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((milliseconds % 1000) / 100);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
