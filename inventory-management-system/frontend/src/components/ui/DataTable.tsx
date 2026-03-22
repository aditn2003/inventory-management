import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;
  loading?: boolean;
}

function ShimmerRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-slate-100/80 dark:border-neutral-800/80">
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="shimmer-line h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  emptyState,
  loading,
}: DataTableProps<T>) {
  const headRow = (
    <thead>
      <tr className="border-b border-slate-200/80 dark:border-neutral-700/80 bg-slate-50/80 dark:bg-neutral-800/80 backdrop-blur-sm sticky top-0 z-10">
        {columns.map((col) => (
          <th
            key={col.key}
            className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-neutral-400
              uppercase tracking-wider ${col.className ?? ''}`}
          >
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <table className="w-full">
          {headRow}
          <tbody>
            {[...Array(5)].map((_, i) => (
              <ShimmerRow key={i} cols={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (emptyState && data.length === 0) {
    return (
      <div className="card overflow-hidden">
        <table className="w-full">{headRow}</table>
        {emptyState}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        {headRow}
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={item.id}
              className={`border-b border-slate-100/60 dark:border-neutral-800/60 last:border-0 transition-colors duration-150
                ${idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-neutral-800/30' : 'bg-white dark:bg-neutral-900'}
                ${onRowClick
                  ? 'cursor-pointer hover:bg-primary-50/40 dark:hover:bg-primary-950/30'
                  : 'hover:bg-slate-50/50 dark:hover:bg-neutral-800/50'
                }`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3.5 text-sm text-slate-700 dark:text-neutral-300 ${col.className ?? ''}`}>
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
