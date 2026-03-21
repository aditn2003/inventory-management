interface InfoCard {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  /** Use for custom controls (e.g. inline editors) instead of default title typography. */
  valuePlain?: boolean;
}

interface InfoCardGridProps {
  cards: InfoCard[];
  columns?: 2 | 3 | 4 | 5;
}

const gridCols: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export function InfoCardGrid({ cards, columns = 4 }: InfoCardGridProps) {
  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{card.label}</p>
          {card.valuePlain ? (
            <div className={card.valueClassName ?? ''}>{card.value}</div>
          ) : (
            <p
              className={`text-lg font-semibold ${card.valueClassName ?? 'text-gray-900'}`}
            >
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
