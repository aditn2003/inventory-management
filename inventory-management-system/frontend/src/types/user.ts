import type { Tenant } from './tenant';

export interface UserListItem {
  id: string;
  email: string;
  role: 'admin' | 'user';
  assigned_tenant_count: number;
  created_at: string;
}

export interface UserDetail {
  id: string;
  email: string;
  role: 'admin' | 'user';
  assigned_tenants: Pick<Tenant, 'id' | 'display_id' | 'name'>[];
  created_at: string;
}

export interface TenantAssignment {
  user_id: string;
  tenant_id: string;
}

export interface UserRoleUpdate {
  role: 'admin' | 'user';
}

export interface UserListResponse {
  data: UserListItem[];
  meta: { total: number; page: number; page_size: number };
}
