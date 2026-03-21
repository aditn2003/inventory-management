interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  subtext?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 mb-4">{icon}</div>}
      <h3 className="text-base font-medium text-gray-600">{heading}</h3>
      {subtext && <p className="text-sm text-gray-400 mt-1 max-w-xs">{subtext}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
