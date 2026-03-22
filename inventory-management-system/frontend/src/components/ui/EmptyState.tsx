interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  subtext?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center mb-5 text-slate-400 dark:text-neutral-500">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-700 dark:text-neutral-200">{heading}</h3>
      {subtext && (
        <p className="text-sm text-slate-400 dark:text-neutral-500 mt-1.5 max-w-xs leading-relaxed">{subtext}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
