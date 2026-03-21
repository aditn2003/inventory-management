import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Tenant } from '@/types/tenant';

interface TenantState {
  selectedTenant: Tenant | null;
}

const storedTenant = localStorage.getItem('ims_selected_tenant');

const initialState: TenantState = {
  selectedTenant: storedTenant ? JSON.parse(storedTenant) : null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setSelectedTenant(state, action: PayloadAction<Tenant | null>) {
      state.selectedTenant = action.payload;
      if (action.payload) {
        localStorage.setItem('ims_selected_tenant', JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('ims_selected_tenant');
      }
    },
  },
});

export const { setSelectedTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
