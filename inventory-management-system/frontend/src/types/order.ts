export type OrderStatus = 'created' | 'pending' | 'confirmed' | 'cancelled';

export interface OrderProductInventory {
  id: string;
  current_stock: number;
  unit: string;
}

export interface OrderProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  cost_per_unit: number;
  reorder_threshold: number;
  status: string;
  inventory: OrderProductInventory | null;
}

export interface Order {
  id: string;
  display_id: string;
  tenant_id: string;
  product_id: string;
  requested_qty: number;
  status: OrderStatus;
  notes: string | null;
  order_date: string;
  product: OrderProduct | null;
  created_at: string;
  updated_at: string;
}

export interface OrderSummary {
  total: number;
  pending: number;
  created: number;
  confirmed: number;
  cancelled: number;
}

export interface OrderListResponse {
  data: Order[];
  meta: { total: number; page: number; page_size: number };
  summary: OrderSummary;
}

export interface OrderCreateInput {
  product_id: string;
  requested_qty: number;
  notes?: string;
}

export interface OrderUpdateInput {
  requested_qty?: number;
  notes?: string;
}
