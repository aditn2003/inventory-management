import { CaretUp, CaretDown, ArrowsDownUp } from '@phosphor-icons/react';

export type InventorySortField =
  | 'product_name'
  | 'sku'
  | 'cost_per_unit'
  | 'current_stock'
  | 'reorder_threshold';
export type InventorySortState = { field: InventorySortField; dir: 'asc' | 'desc' } | null;

export function InventorySortHeader({
  label,
  field,
  sort,
  onSortClick,
}: {
  label: string;
  field: InventorySortField;
  sort: InventorySortState;
  onSortClick: (field: InventorySortField) => void;
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
      className="inline-flex items-center gap-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-0.5 -mx-0.5"
    >
      {label}
      {!active && <ArrowsDownUp size={12} className="text-gray-400 shrink-0" aria-hidden />}
      {active && dir === 'asc' && <CaretUp size={12} className="text-blue-600 shrink-0" weight="bold" aria-hidden />}
      {active && dir === 'desc' && <CaretDown size={12} className="text-blue-600 shrink-0" weight="bold" aria-hidden />}
    </button>
  );
}
