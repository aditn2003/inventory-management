import { useState, useRef, useEffect, useMemo } from 'react';
import { MagnifyingGlass, CaretDown, Check, Plus, X } from '@phosphor-icons/react';

interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  createLabel?: string;
}

export function CreatableCombobox({
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  disabled = false,
  createLabel = 'Add',
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = search.trim();
  const normalised = trimmed.toLowerCase();

  const filtered = useMemo(() => {
    if (!normalised) return options;
    return options.filter((o) => o.toLowerCase().includes(normalised));
  }, [options, normalised]);

  const exactMatch = options.some((o) => o.toLowerCase() === normalised);
  const canCreate = trimmed.length > 0 && !exactMatch;
  const displayLabel = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  const totalItems = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => setHighlightIdx(0), [search, open]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (canCreate && highlightIdx === filtered.length) {
        select(displayLabel);
      } else if (filtered[highlightIdx]) {
        select(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        disabled={disabled}
        className={`input-field w-full text-left flex items-center gap-2 pr-3
          disabled:bg-slate-50 dark:disabled:bg-neutral-800 disabled:cursor-not-allowed
          ${open ? 'ring-2 ring-primary-500/20 border-primary-400' : ''}`}
      >
        <span className={`flex-1 truncate ${value ? 'text-slate-700 dark:text-neutral-200' : 'text-slate-400 dark:text-neutral-500'}`}>
          {value || placeholder}
        </span>
        <CaretDown
          size={14}
          className={`text-slate-400 dark:text-neutral-500 shrink-0 transition-transform duration-200
            ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 rounded-xl border border-slate-200/80 dark:border-neutral-700/80
          shadow-elevated z-50 overflow-hidden animate-scale-in origin-top">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-neutral-700">
            <div className="relative">
              <MagnifyingGlass
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 pointer-events-none"
              />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Search or create...`}
                className="w-full pl-8 pr-8 py-2 text-sm bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-700/80 rounded-lg
                  text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
                  focus:border-primary-400 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500
                    hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div ref={listRef} className="max-h-52 overflow-y-auto overscroll-contain py-1">
            {filtered.map((opt, i) => {
              const isSelected = opt === value;
              const isHighlighted = i === highlightIdx;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between
                    transition-colors
                    ${isHighlighted ? 'bg-primary-50/80 dark:bg-primary-950/30' : 'hover:bg-slate-50 dark:hover:bg-neutral-700'}
                    ${isSelected ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-slate-700 dark:text-neutral-300'}`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check size={15} weight="bold" className="text-primary-500 shrink-0" />}
                </button>
              );
            })}

            {/* Create new option */}
            {canCreate && (
              <button
                type="button"
                onClick={() => select(displayLabel)}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2
                  transition-colors border-t border-slate-100 dark:border-neutral-700
                  ${highlightIdx === filtered.length
                    ? 'bg-primary-50/80 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                    : 'hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300'
                  }`}
              >
                <Plus size={15} weight="bold" className="text-primary-500 shrink-0" />
                <span>
                  {createLabel} "<span className="font-semibold">{displayLabel}</span>"
                </span>
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
