import { useState, useRef, useEffect, useMemo } from 'react';
import { Buildings, MagnifyingGlass, CaretDown, Check, X } from '@phosphor-icons/react';
import { useAccessibleTenants } from '@/hooks/useAccessibleTenants';
import { useTenant } from '@/hooks/useTenant';
import type { Tenant } from '@/types/tenant';

export function TenantSelector() {
  const { data, loading } = useAccessibleTenants({ page_size: 100 });
  const { selectedTenant, selectTenant } = useTenant();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.display_id.toLowerCase().includes(q),
    );
  }, [data, search]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSelect = (tenant: Tenant | null) => {
    selectTenant(tenant);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { if (!loading) setOpen((o) => !o); }}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700/80
          hover:bg-slate-100 dark:hover:bg-neutral-700 hover:border-slate-300/80 dark:hover:border-neutral-600/80 transition-all duration-150
          disabled:cursor-not-allowed disabled:opacity-50 min-w-[200px] text-left group"
      >
        <Buildings size={16} className="text-slate-400 dark:text-neutral-500 shrink-0" />
        <span className="text-sm text-slate-700 dark:text-neutral-200 truncate flex-1">
          {selectedTenant
            ? `${selectedTenant.display_id} — ${selectedTenant.name}`
            : 'Select tenant...'}
        </span>
        <CaretDown
          size={14}
          className={`text-slate-400 dark:text-neutral-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-white dark:bg-neutral-800 rounded-xl border border-slate-200/80 dark:border-neutral-700/80
          shadow-elevated z-50 overflow-hidden animate-scale-in origin-top">
          {/* Search input */}
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
                placeholder="Search tenants..."
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

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {/* Clear selection option */}
            {selectedTenant && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="w-full px-3 py-2 text-left text-sm text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-700
                  transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-neutral-700"
              >
                <X size={14} className="shrink-0" />
                Clear selection
              </button>
            )}

            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
                {search ? 'No tenants match your search' : 'No tenants available'}
              </div>
            )}

            {filtered.map((t) => {
              const isSelected = selectedTenant?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t)}
                  className={`w-full px-3 py-2.5 text-left transition-colors flex items-center gap-3 group/item
                    ${isSelected
                      ? 'bg-slate-50 dark:bg-neutral-700/60'
                      : 'hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300'
                    }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold
                    ${isSelected
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                      : 'bg-slate-100 dark:bg-neutral-700 text-slate-500 dark:text-neutral-400 group-hover/item:bg-slate-200 dark:group-hover/item:bg-neutral-600 group-hover/item:text-slate-600 dark:group-hover/item:text-primary-400'
                    } transition-colors`}
                  >
                    {t.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-slate-900 dark:text-neutral-100' : 'text-slate-700 dark:text-neutral-200'}`}>
                      {t.name}
                    </div>
                    <div className={`text-xs truncate ${isSelected ? 'text-slate-500 dark:text-neutral-400' : 'text-slate-400 dark:text-neutral-500'}`}>
                      {t.display_id}
                      {t.status === 'inactive' && (
                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium
                          bg-slate-200 dark:bg-neutral-700 text-slate-500 dark:text-neutral-400">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={16} weight="bold" className="text-primary-500 dark:text-primary-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
