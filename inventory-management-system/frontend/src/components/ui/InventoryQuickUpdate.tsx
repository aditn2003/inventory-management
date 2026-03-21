import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { Check, PencilSimple, X } from '@phosphor-icons/react';

interface InventoryQuickUpdateProps {
  current: number;
  unit: string;
  onSave: (value: number) => Promise<void>;
  /** Increment (e.g. from row "Edit" action) to open the inline editor. */
  externalEditVersion?: number;
  /** When set, stock text is red if current &lt; threshold (matches API below-reorder rule). */
  reorderThreshold?: number | null;
}

export function InventoryQuickUpdate({
  current,
  unit,
  onSave,
  externalEditVersion = 0,
  reorderThreshold = null,
}: InventoryQuickUpdateProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const lastExternalVersion = useRef(0);

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
        <span
          className={`text-sm font-medium ${belowReorder ? 'text-red-600' : 'text-gray-900'}`}
        >
          {current} {unit}
        </span>
        <button
          type="button"
          onClick={(e) => {
            stopRowNav(e);
            setValue(String(current));
            setEditing(true);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Edit stock"
        >
          <PencilSimple size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={stopRowNav}>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={stopRowNav}
        className={`w-20 text-sm border rounded px-2 py-0.5 focus:outline-none focus:ring-1 ${
          editingBelowReorder
            ? 'border-red-300 text-red-700 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
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
        className="p-1 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
        aria-label="Save"
      >
        <Check size={14} weight="bold" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          stopRowNav(e);
          setEditing(false);
        }}
        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Cancel"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
