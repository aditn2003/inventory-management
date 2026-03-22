import { CaretUp, CaretDown, ArrowsDownUp } from '@phosphor-icons/react';

export type TenantSortField = 'display_id' | 'name' | 'status' | 'created_at';
export type TenantSortState = { field: TenantSortField; dir: 'asc' | 'desc' } | null;

export function TenantSortHeader({
  label,
  field,
  sort,
  onSortClick,
}: {
  label: string;
  field: TenantSortField;
  sort: TenantSortState;
  onSortClick: (field: TenantSortField) => void;
}) {
  const active = sort?.field === field;
  const dir = active ? sort.dir : null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSortClick(field);
      }}
      className="inline-flex items-center gap-1 text-left text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider hover:text-slate-800 dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded px-0.5 -mx-0.5 transition-colors"
    >
      {label}
      {!active && <ArrowsDownUp size={12} className="text-slate-400 dark:text-neutral-500 shrink-0" aria-hidden />}
      {active && dir === 'asc' && <CaretUp size={12} className="text-primary-600 shrink-0" weight="bold" aria-hidden />}
      {active && dir === 'desc' && <CaretDown size={12} className="text-primary-600 shrink-0" weight="bold" aria-hidden />}
    </button>
  );
}
