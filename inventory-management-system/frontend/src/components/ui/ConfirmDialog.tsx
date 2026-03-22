import { WarningCircle } from '@phosphor-icons/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

const variantStyles = {
  danger: {
    iconBg: 'bg-rose-100',
    icon: 'text-rose-500',
    button: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md',
  },
  warning: {
    iconBg: 'bg-amber-100',
    icon: 'text-amber-500',
    button: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow-md',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 animate-scale-in">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center shrink-0`}>
            <WarningCircle size={22} className={styles.icon} weight="fill" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5">
          <button onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg
              transition-all duration-200 ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
