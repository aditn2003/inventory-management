interface FormCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormCard({ title, children, className = '' }: FormCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {title && <h2 className="text-lg font-medium text-gray-900 mb-5">{title}</h2>}
      {children}
    </div>
  );
}
