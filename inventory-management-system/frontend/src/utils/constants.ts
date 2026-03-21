export const STATUS_BADGE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  created: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-600',
};

export const CATEGORIES = ['Metals', 'Chemicals', 'Plastics'] as const;
export type Category = (typeof CATEGORIES)[number];

export const UNITS = ['units', 'kg', 'sheets', 'litres'] as const;
export type Unit = (typeof UNITS)[number];

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
