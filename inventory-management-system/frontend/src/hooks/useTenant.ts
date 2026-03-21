import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setSelectedTenant } from '@/store/tenantSlice';
import type { Tenant } from '@/types/tenant';

export function useTenant() {
  const dispatch = useAppDispatch();
  const selectedTenant = useAppSelector((state) => state.tenant.selectedTenant);

  const selectTenant = (tenant: Tenant | null) => {
    dispatch(setSelectedTenant(tenant));
  };

  return { selectedTenant, selectTenant };
}
