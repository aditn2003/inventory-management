import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';

interface DetailHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
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
            className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-neutral-500 hover:text-primary-600
              mb-2.5 transition-colors duration-200 group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-0.5 transition-transform duration-200"
            />
            {backLabel}
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">{title}</h1>
        {subtitle != null && subtitle !== '' && (
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2.5">{actions}</div>}
    </div>
  );
}
