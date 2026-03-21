import type { ReactNode } from 'react';

export type HoverTooltipAlign = 'center' | 'end' | 'start';

/**
 * Simple hover / focus-visible tooltip (no extra dependencies).
 * Use align="end" when the trigger sits on the right so the bubble stays on-screen.
 */
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
        className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-50 ${position} w-max max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-amber-200/90 bg-white px-3 py-2 text-left text-xs font-normal leading-snug text-amber-950 shadow-md shadow-amber-900/10 ring-1 ring-amber-900/5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
