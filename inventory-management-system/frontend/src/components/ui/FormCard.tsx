interface FormCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormCard({ title, children, className = '' }: FormCardProps) {
  return (
    <div className={`card p-6 sm:p-8 ${className}`}>
      {title && (
        <>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">{title}</h2>
          <div className="border-b border-slate-100 dark:border-neutral-700 mt-3 mb-6" />
        </>
      )}
      {children}
    </div>
  );
}
