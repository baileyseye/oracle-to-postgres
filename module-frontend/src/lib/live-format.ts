import type { ServiceHealthStatus } from '../types/live';

export const HEALTH_LABEL: Record<ServiceHealthStatus, string> = {
  up: 'UP',
  down: 'DOWN',
  checking: 'check',
  unknown: '—',
};

export function healthTextClass(status: ServiceHealthStatus): string {
  if (status === 'up') {
    return 'text-ok';
  }

  if (status === 'down') {
    return 'text-danger';
  }

  if (status === 'checking') {
    return 'text-electric';
  }

  return 'text-muted/60';
}

export function healthDotClass(status: ServiceHealthStatus): string {
  if (status === 'up') {
    return 'bg-ok';
  }

  if (status === 'down') {
    return 'bg-danger';
  }

  if (status === 'checking') {
    return 'status-led text-electric';
  }

  return 'bg-muted/30';
}

export function healthDescription(status: ServiceHealthStatus): string {
  if (status === 'up') {
    return 'доступен';
  }

  if (status === 'down') {
    return 'недоступен';
  }

  if (status === 'checking') {
    return 'проверяется';
  }

  return 'не проверен';
}

export function formatCheckedAt(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
