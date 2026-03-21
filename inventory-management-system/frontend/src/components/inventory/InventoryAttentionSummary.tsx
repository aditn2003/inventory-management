import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { HoverTooltip } from "@/components/ui/HoverTooltip";

const SHOW_BELOW_REORDER_TOOLTIP =
  "Open a filtered, paginated view in the table for all products having inventory below the reorder threshold.";

interface InventoryAttentionSummaryProps {
  belowReorderCount: number;
  filterBelowReorderActive: boolean;
  onOpenBelowReorderView: () => void;
  onClearBelowReorderView: () => void;
}

/**
 * Summary for “below reorder” — one card; clear / apply actions stay in this strip.
 */
export function InventoryAttentionSummary({
  belowReorderCount,
  filterBelowReorderActive,
  onOpenBelowReorderView,
  onClearBelowReorderView,
}: InventoryAttentionSummaryProps) {
  const hasAttention = belowReorderCount > 0;

  if (!hasAttention) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <CheckCircle
            className="text-emerald-600 shrink-0 mt-0.5"
            size={22}
            weight="fill"
          />
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-emerald-950">
              Reorder status
            </p>
            <p className="text-sm text-emerald-900/90 mt-0.5">
              Every inventory line is at or above its reorder threshold.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (filterBelowReorderActive) {
    return (
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/80 px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="rounded-lg bg-white/80 border border-amber-100 p-2.5 shadow-sm shrink-0">
              <WarningCircle
                className="text-amber-600"
                size={24}
                weight="fill"
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/90">
                Below reorder only
              </p>
              <p className="text-sm text-gray-800 mt-1.5 leading-relaxed">
                The table is limited to{" "}
                <span className="font-semibold tabular-nums">
                  {belowReorderCount}
                </span>{" "}
                line
                {belowReorderCount === 1 ? "" : "s"} where current inventory is
                under the reorder threshold.
              </p>
            </div>
          </div>
          <div className="shrink-0 sm:self-center w-full sm:w-auto">
            <button
              type="button"
              onClick={onClearBelowReorderView}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-amber-950 bg-white border-2 border-amber-300 hover:bg-amber-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 transition-colors shadow-sm"
            >
              Show all inventory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/80 px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-white/80 border border-amber-100 p-2.5 shadow-sm shrink-0">
            <WarningCircle className="text-amber-600" size={24} weight="fill" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/90">
              Below reorder threshold
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl sm:text-4xl font-bold text-red-600 tabular-nums leading-none">
                {belowReorderCount}
              </span>
              <span className="text-sm sm:text-base text-gray-700">
                {belowReorderCount === 1 ? "items needs" : "items need"}{" "}
                restocking
              </span>
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:self-center w-full sm:w-auto">
          <HoverTooltip label={SHOW_BELOW_REORDER_TOOLTIP} align="end">
            <button
              type="button"
              onClick={onOpenBelowReorderView}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-700 hover:bg-amber-800 shadow-sm border border-amber-800/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 transition-colors"
            >
              Below reorder only
              <span aria-hidden className="opacity-90">
                →
              </span>
            </button>
          </HoverTooltip>
        </div>
      </div>
    </div>
  );
}
