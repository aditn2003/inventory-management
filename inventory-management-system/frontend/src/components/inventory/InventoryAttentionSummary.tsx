import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { HoverTooltip } from '@/components/ui/HoverTooltip';

const SHOW_BELOW_REORDER_TOOLTIP =
  'Open a filtered, paginated view in the table for all products having inventory below the reorder threshold.';

interface InventoryAttentionSummaryProps {
  belowReorderCount: number;
  filterBelowReorderActive: boolean;
  onOpenBelowReorderView: () => void;
  onClearBelowReorderView: () => void;
}

export function InventoryAttentionSummary({
  belowReorderCount,
  filterBelowReorderActive,
  onOpenBelowReorderView,
  onClearBelowReorderView,
}: InventoryAttentionSummaryProps) {
  const hasAttention = belowReorderCount > 0;

  if (!hasAttention) {
    return (
      <div className="card border-l-4 border-l-emerald-400 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
            <CheckCircle className="text-emerald-600" size={20} weight="fill" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Reorder status</p>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">
              Every inventory line is at or above its reorder threshold.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (filterBelowReorderActive) {
    return (
      <div className="card px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <WarningCircle className="text-amber-500 shrink-0" size={20} weight="fill" />
            <p className="text-sm text-slate-700 dark:text-neutral-300">
              Showing <span className="font-semibold tabular-nums">{belowReorderCount}</span>{' '}
              {belowReorderCount === 1 ? 'item' : 'items'} below reorder threshold
            </p>
          </div>
          <div className="shrink-0 sm:self-center w-full sm:w-auto">
            <button type="button" onClick={onClearBelowReorderView} className="btn-secondary w-full sm:w-auto">
              Show all inventory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <WarningCircle className="text-amber-500 shrink-0" size={20} weight="fill" />
          <p className="text-sm text-slate-700 dark:text-neutral-300">
            <span className="font-bold text-slate-900 dark:text-neutral-100 tabular-nums">{belowReorderCount}</span>{' '}
            {belowReorderCount === 1 ? 'item needs' : 'items need'} restocking
          </p>
        </div>
        <div className="shrink-0 sm:self-center w-full sm:w-auto">
          <HoverTooltip label={SHOW_BELOW_REORDER_TOOLTIP} align="end">
            <button
              type="button"
              onClick={onOpenBelowReorderView}
              className="btn-secondary w-full sm:w-auto"
            >
              Below reorder only →
            </button>
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}
