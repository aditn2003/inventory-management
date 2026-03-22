interface InfoCard {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  valuePlain?: boolean;
}

interface InfoCardGridProps {
  cards: InfoCard[];
  columns?: 2 | 3 | 4 | 5;
}

const gridCols: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export function InfoCardGrid({ cards, columns = 4 }: InfoCardGridProps) {
  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="card px-5 py-4 border-l-2 border-l-primary-200 dark:border-l-primary-700"
        >
          <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium mb-1.5 uppercase tracking-wide">{card.label}</p>
          {card.valuePlain ? (
            <div className={card.valueClassName ?? ''}>{card.value}</div>
          ) : (
            <p className={`text-lg font-semibold ${card.valueClassName ?? 'text-slate-900 dark:text-neutral-100'}`}>
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
