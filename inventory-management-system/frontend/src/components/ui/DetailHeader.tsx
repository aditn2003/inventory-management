import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function DetailHeader({ title, subtitle, backTo, backLabel = 'Back', actions }: DetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </button>
        )}
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
