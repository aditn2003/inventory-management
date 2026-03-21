import { useEffect } from 'react';
import { Buildings } from '@phosphor-icons/react';
import { useAccessibleTenants } from '@/hooks/useAccessibleTenants';
import { useTenant } from '@/hooks/useTenant';
import type { Tenant } from '@/types/tenant';

export function TenantSelector() {
  const { data, loading } = useAccessibleTenants({ page_size: 100 });
  const { selectedTenant, selectTenant } = useTenant();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tenant = data?.find((t) => t.id === e.target.value) ?? null;
    selectTenant(tenant);
  };

  return (
    <div className="flex items-center gap-2">
      <Buildings size={18} className="text-gray-400 shrink-0" />
      <select
        value={selectedTenant?.id ?? ''}
        onChange={handleChange}
        disabled={loading}
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
      >
        <option value="">Select tenant...</option>
        {data?.map((t: Tenant) => (
          <option key={t.id} value={t.id}>
            {t.display_id} — {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
