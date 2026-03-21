interface InfoCard {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

interface InfoCardGridProps {
  cards: InfoCard[];
  columns?: 2 | 3 | 4;
}

const gridCols: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export function InfoCardGrid({ cards, columns = 4 }: InfoCardGridProps) {
  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{card.label}</p>
          <p className={`text-lg font-semibold text-gray-900 ${card.valueClassName ?? ''}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
