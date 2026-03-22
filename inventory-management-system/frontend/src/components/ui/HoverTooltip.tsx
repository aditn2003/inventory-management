import type { ReactNode } from 'react';

export type HoverTooltipAlign = 'center' | 'end' | 'start';

export function HoverTooltip({
  label,
  children,
  align = 'center',
}: {
  label: string;
  children: ReactNode;
  align?: HoverTooltipAlign;
}) {
  const position =
    align === 'end'
      ? 'right-0 left-auto translate-x-0'
      : align === 'start'
        ? 'left-0 right-auto translate-x-0'
        : 'left-1/2 -translate-x-1/2';

  return (
    <span className="group relative flex w-full max-w-full sm:inline-flex sm:w-auto">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-50 ${position}
          w-max max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg
          border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-left text-xs
          font-normal leading-snug text-slate-700 dark:text-neutral-300 shadow-elevated
          opacity-0 transition-opacity duration-150
          group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
