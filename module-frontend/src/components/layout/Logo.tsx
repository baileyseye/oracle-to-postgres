import { useId } from 'react';

interface LogoProps {
  readonly className?: string;
}

export function Logo({ className }: LogoProps) {
  const gradientId = `logo-migration-${useId().replace(/:/g, '')}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 64 64"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#C74634" />
          <stop offset="0.38" stopColor="#D946EF" />
          <stop offset="0.72" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#336791" />
        </linearGradient>
      </defs>
      <path
        d="M9 20c0-2.2 4-4 9-4s9 1.8 9 4v22c0 2.2-4 4-9 4s-9-1.8-9-4V20Z"
        fill="#C74634"
        fillOpacity="0.14"
        stroke="#C74634"
        strokeWidth="2.6"
      />
      <ellipse
        cx="18"
        cy="20"
        rx="9"
        ry="4"
        stroke="#C74634"
        strokeWidth="2.6"
      />
      <path
        d="M9 31c0 2.2 4 4 9 4s9-1.8 9-4"
        stroke="#C74634"
        strokeOpacity="0.7"
        strokeWidth="2.2"
      />
      <path
        d="M37 26c0-2.2 4-4 9-4s9 1.8 9 4v22c0 2.2-4 4-9 4s-9-1.8-9-4V26Z"
        fill="#336791"
        fillOpacity="0.16"
        stroke="#336791"
        strokeWidth="2.6"
      />
      <ellipse
        cx="46"
        cy="26"
        rx="9"
        ry="4"
        stroke="#336791"
        strokeWidth="2.6"
      />
      <path
        d="M37 37c0 2.2 4 4 9 4s9-1.8 9-4"
        stroke="#336791"
        strokeOpacity="0.7"
        strokeWidth="2.2"
      />
      <path
        d="M26 33h12"
        stroke={`url(#${gradientId})`}
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <path
        d="m35 28.6 4.4 4.4-4.4 4.4"
        stroke="#38BDF8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
    </svg>
  );
}
