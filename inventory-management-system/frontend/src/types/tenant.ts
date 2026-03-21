export interface Tenant {
  id: string;
  display_id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface TenantSummary {
  total: number;
  active: number;
  inactive: number;
}

export interface TenantListResponse {
  data: Tenant[];
  meta: { total: number; page: number; page_size: number };
  summary: TenantSummary;
}

export interface TenantCreateInput {
  name: string;
  status?: string;
}

export interface TenantUpdateInput {
  name?: string;
  status?: string;
}
