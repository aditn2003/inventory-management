export const STATUS_BADGE_COLORS: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-500/20',
  inactive:  'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-600/20',
  created:   'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-500/20',
  pending:   'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-500/20',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-500/20',
  cancelled: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-500/20',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  active:    'bg-emerald-500',
  inactive:  'bg-slate-400 dark:bg-neutral-500',
  created:   'bg-sky-500',
  pending:   'bg-amber-500',
  confirmed: 'bg-emerald-500',
  cancelled: 'bg-rose-500',
};

export const DEFAULT_CATEGORIES: string[] = [
  'Metals', 'Chemicals', 'Plastics', 'Electronics',
  'Textiles', 'Packaging', 'Tools', 'Adhesives', 'Ceramics', 'Glass',
];

export const DEFAULT_UNITS: string[] = [
  'units', 'kg', 'sheets', 'litres', 'metres', 'rolls', 'pcs', 'boxes', 'tubes', 'bags',
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
