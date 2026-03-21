import type { Product } from './product';

export interface Inventory {
  id: string;
  product_id: string;
  tenant_id: string;
  current_stock: number;
  unit: string;
  product: Product | null;
  created_at: string;
  updated_at: string;
}

export interface InventorySummary {
  below_reorder_count: number;
}

export interface InventoryListResponse {
  data: Inventory[];
  meta: { total: number; page: number; page_size: number };
  summary: InventorySummary;
}

export interface StockUpdateInput {
  current_stock: number;
}
