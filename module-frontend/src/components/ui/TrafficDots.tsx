import { cn } from '../../lib/cn';

interface TrafficDotsProps {
  readonly className?: string;
}

export function TrafficDots({ className }: TrafficDotsProps) {
  return (
    <span aria-hidden="true" className={cn('flex items-center gap-1', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-danger/60" />
      <span className="h-1.5 w-1.5 rounded-full bg-warn/60" />
      <span className="h-1.5 w-1.5 rounded-full bg-ok/60" />
    </span>
  );
}
