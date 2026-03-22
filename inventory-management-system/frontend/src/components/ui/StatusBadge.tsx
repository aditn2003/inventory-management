import { STATUS_BADGE_COLORS, STATUS_DOT_COLORS } from '@/utils/constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = STATUS_BADGE_COLORS[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20';
  const dotClass = STATUS_DOT_COLORS[status] ?? 'bg-slate-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
}
