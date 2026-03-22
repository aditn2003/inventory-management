import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { Check, PencilSimple, X } from '@phosphor-icons/react';

interface InventoryQuickUpdateProps {
  current: number;
  unit: string;
  onSave: (value: number) => Promise<void>;
  externalEditVersion?: number;
  reorderThreshold?: number | null;
  variant?: 'table' | 'card';
}

export function InventoryQuickUpdate({
  current,
  unit,
  onSave,
  externalEditVersion = 0,
  reorderThreshold = null,
  variant = 'table',
}: InventoryQuickUpdateProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const lastExternalVersion = useRef(0);
  const isCard = variant === 'card';
  const textClass = isCard ? 'text-lg font-semibold' : 'text-sm font-medium';
  const iconSize = isCard ? 20 : 14;
  const inputClass = isCard
    ? 'w-28 text-base rounded-lg px-2.5 py-1.5'
    : 'w-20 text-sm rounded-lg px-2 py-0.5';

  useEffect(() => {
    if (!editing) setValue(String(current));
  }, [current, editing]);

  useEffect(() => {
    if (externalEditVersion > lastExternalVersion.current) {
      lastExternalVersion.current = externalEditVersion;
      setValue(String(current));
      setEditing(true);
    }
  }, [externalEditVersion, current]);

  const handleSave = async () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setSaving(true);
    try {
      await onSave(num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const stopRowNav = (e: MouseEvent) => e.stopPropagation();

  const belowReorder =
    reorderThreshold != null && current < reorderThreshold;

  const editingBelowReorder =
    editing &&
    reorderThreshold != null &&
    !Number.isNaN(parseInt(value, 10)) &&
    parseInt(value, 10) < reorderThreshold;

  if (!editing) {
    return (
      <div className="flex items-center gap-2" onClick={stopRowNav}>
        <span className={`${textClass} ${belowReorder ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-neutral-100'}`}>
          {current} {unit}
        </span>
        <button
          type="button"
          onClick={(e) => {
            stopRowNav(e);
            setValue(String(current));
            setEditing(true);
          }}
          className="p-1 text-slate-400 hover:text-primary-600 transition-colors rounded-lg
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
          aria-label="Edit current inventory"
        >
          <PencilSimple size={iconSize} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={stopRowNav}>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={stopRowNav}
        className={`${inputClass} border focus:outline-none focus:ring-2 bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 ${
          editingBelowReorder
            ? 'border-rose-300 text-rose-700 dark:text-rose-400 focus:ring-rose-500/30'
            : 'border-slate-200 dark:border-neutral-700 focus:ring-primary-500/30 focus:border-primary-400'
        }`}
        min={0}
        autoFocus
      />
      <button
        type="button"
        onClick={(e) => {
          stopRowNav(e);
          void handleSave();
        }}
        disabled={saving}
        className="p-1 text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50
          rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        aria-label="Save"
      >
        <Check size={iconSize} weight="bold" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          stopRowNav(e);
          setValue(String(current));
          setEditing(false);
        }}
        className="p-1 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors
          rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30"
        aria-label="Cancel"
      >
        <X size={iconSize} weight="bold" />
      </button>
    </div>
  );
}
