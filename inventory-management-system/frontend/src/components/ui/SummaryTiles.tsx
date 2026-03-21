import type { ReactNode } from 'react';

export interface SummaryTile {
  label: string;
  value: number | string;
  colorClass?: string;
  /** Hint or action under the value (e.g. “View in table” for large lists). */
  footer?: ReactNode;
}

interface SummaryTilesProps {
  tiles: SummaryTile[];
}

export function SummaryTiles({ tiles }: SummaryTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
          <p className="text-sm text-gray-500 mb-1">{tile.label}</p>
          <p className={`text-2xl font-semibold ${tile.colorClass ?? 'text-gray-900'}`}>{tile.value}</p>
          {tile.footer ? <div className="mt-3 text-sm text-gray-600">{tile.footer}</div> : null}
        </div>
      ))}
    </div>
  );
}
