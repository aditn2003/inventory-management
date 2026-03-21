interface Tile {
  label: string;
  value: number | string;
  colorClass?: string;
}

interface SummaryTilesProps {
  tiles: Tile[];
}

export function SummaryTiles({ tiles }: SummaryTilesProps) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
          <p className="text-sm text-gray-500 mb-1">{tile.label}</p>
          <p className={`text-2xl font-semibold ${tile.colorClass ?? 'text-gray-900'}`}>{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
