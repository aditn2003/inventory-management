import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface SummaryTile {
  label: string;
  value: number | string;
  colorClass?: string;
  icon?: ReactNode;
  iconBg?: string;
  footer?: ReactNode;
}

interface SummaryTilesProps {
  tiles: SummaryTile[];
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef({ start: 0, target: value, raf: 0 });

  useEffect(() => {
    const r = ref.current;
    r.target = value;
    const duration = 500;
    const startTime = performance.now();
    const startVal = r.start;

    function step(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (r.target - startVal) * eased);
      setDisplay(current);
      r.start = current;
      if (progress < 1) r.raf = requestAnimationFrame(step);
    }

    r.raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(r.raf);
  }, [value]);

  return <>{display}</>;
}

export function SummaryTiles({ tiles }: SummaryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="card px-5 py-4 flex items-start gap-3.5"
        >
          {tile.icon && (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tile.iconBg ?? 'bg-slate-100 dark:bg-neutral-800'}`}>
              {tile.icon}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-neutral-400 font-medium">{tile.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${tile.colorClass ?? 'text-slate-900 dark:text-neutral-100'}`}>
              {typeof tile.value === 'number' ? <AnimatedNumber value={tile.value} /> : tile.value}
            </p>
            {tile.footer && <div className="mt-2 text-sm text-slate-500 dark:text-neutral-400">{tile.footer}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
