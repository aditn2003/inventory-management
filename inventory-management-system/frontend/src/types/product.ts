export interface InventorySnapshot {
  id: string;
  current_stock: number;
  unit: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  cost_per_unit: number;
  reorder_threshold: number;
  status: 'active' | 'inactive';
  inventory: InventorySnapshot | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSummary {
  total: number;
  active: number;
  inactive: number;
}

export interface ProductListResponse {
  data: Product[];
  meta: { total: number; page: number; page_size: number };
  summary: ProductSummary;
}

export interface ProductCreateInput {
  sku: string;
  name: string;
  description?: string;
  category: string;
  cost_per_unit: number;
  reorder_threshold: number;
  status?: string;
  unit?: string;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  category?: string;
  cost_per_unit?: number;
  reorder_threshold?: number;
  status?: string;
}
