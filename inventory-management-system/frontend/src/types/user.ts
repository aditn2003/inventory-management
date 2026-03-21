import type { Tenant } from './tenant';

export interface UserListItem {
  id: string;
  name: string;
  role: 'admin' | 'user';
  assigned_tenant_count: number;
  created_at: string;
}

export interface UserDetail {
  id: string;
  name: string;
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

export interface UserInviteInput {
  email: string;
}

export interface UserInviteResponse {
  message: string;
}

export interface UserListResponse {
  data: UserListItem[];
  meta: { total: number; page: number; page_size: number };
}
