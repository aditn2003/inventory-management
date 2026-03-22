import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  Warning,
  Buildings,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { useInventory } from "@/hooks/useInventory";
import { useTenant } from "@/hooks/useTenant";
import { useTheme } from "@/contexts/ThemeContext";
import { StatusBadge } from "@/components/ui/StatusBadge";

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function KpiCard({ label, value, icon, color, bgColor }: KpiCardProps) {
  return (
    <div className="card px-5 py-5 flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}
      >
        <span className={color}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const tenantId = selectedTenant?.id ?? null;
  const isDark = theme === "dark";
  const tickFill = isDark ? "#9ca3af" : "#64748b";

  const { data: productsData } = useProducts(tenantId, { page_size: 50 });
  const { data: ordersData } = useOrders(tenantId, { page_size: 50 });
  const { data: inventoryData } = useInventory(tenantId, { page_size: 50 });

  const orderChartData = useMemo(() => {
    if (!ordersData?.summary) return [];
    const s = ordersData.summary;
    return [
      { name: "Created", value: s.created, fill: "#0ea5e9" },
      { name: "Pending", value: s.pending, fill: "#f59e0b" },
      { name: "Confirmed", value: s.confirmed, fill: "#10b981" },
      { name: "Cancelled", value: s.cancelled, fill: "#ef4444" },
    ];
  }, [ordersData]);

  const categoryData = useMemo(() => {
    if (!productsData?.data) return [];
    const counts: Record<string, number> = {};
    for (const p of productsData.data) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [productsData]);

  const recentOrders = useMemo(() => {
    if (!ordersData?.data) return [];
    return [...ordersData.data]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5);
  }, [ordersData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const hasTenant = !!selectedTenant;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Welcome banner */}
      <div className="card px-6 py-6 bg-gradient-to-r from-primary-600 to-primary-500 border-0">
        <h1 className="text-2xl font-bold text-white">
          Welcome, {user?.name || "there"}
        </h1>
        <p className="text-primary-100 mt-1 text-sm">
          {hasTenant
            ? `Overview for ${selectedTenant.name}`
            : "Select a tenant from the header to get started."}
        </p>
      </div>

      {hasTenant && (
        <>
          {/* KPI cards — ordered: Tenant, Products, Low Stock, Orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Tenant"
              value={selectedTenant?.name ?? "—"}
              icon={<Buildings size={20} />}
              color="text-violet-600 dark:text-violet-400"
              bgColor="bg-violet-50 dark:bg-violet-950/30"
            />
            <KpiCard
              label="Total Products"
              value={productsData?.summary?.total ?? "—"}
              icon={<Package size={20} />}
              color="text-sky-600 dark:text-sky-400"
              bgColor="bg-sky-50 dark:bg-sky-950/30"
            />
            <KpiCard
              label="Low Stock Items"
              value={inventoryData?.summary?.below_reorder_count ?? "—"}
              icon={<Warning size={20} />}
              color="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-50 dark:bg-amber-950/30"
            />
            <KpiCard
              label="Total Orders"
              value={
                ordersData?.summary
                  ? ordersData.summary.total - ordersData.summary.cancelled
                  : "—"
              }
              icon={<ShoppingCart size={20} />}
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-50 dark:bg-emerald-950/30"
            />
          </div>
        </>
      )}

      {hasTenant && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders by status bar chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
                Orders by Status
              </h2>
              <button
                onClick={() => navigate("/orders")}
                className="text-xs text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
              >
                View all →
              </button>
            </div>
            {orderChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={orderChartData} barSize={36} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: tickFill }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  >
                    {orderChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill={tickFill}
                      fontSize={13}
                      fontWeight={600}
                      formatter={(v) => (Number(v) > 0 ? v : '')}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-slate-400 dark:text-neutral-500">
                No order data available
              </div>
            )}
          </div>

          {/* Product category pie chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
                Products by Category
              </h2>
              <button
                onClick={() => navigate("/products")}
                className="text-xs text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
              >
                View all →
              </button>
            </div>
            {categoryData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke={isDark ? "#171717" : "#fff"}
                      strokeWidth={2}
                    >
                      {categoryData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {categoryData.map((entry, i) => (
                    <div
                      key={entry.name}
                      className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-400"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      {entry.name} ({entry.value})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-slate-400 dark:text-neutral-500">
                No product data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent orders */}
      {hasTenant && recentOrders.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200 mb-4">
            Recent Orders
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-neutral-700">
                  <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider pb-3 px-3">
                    Order ID
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider pb-3 px-3">
                    Product
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider pb-3 px-3">
                    Qty
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider pb-3 px-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider pb-3 px-3">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-slate-50 dark:border-neutral-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-neutral-300">
                      {order.display_id}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-600 dark:text-neutral-400">
                      {order.product?.name ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-600 dark:text-neutral-400 tabular-nums">
                      {order.requested_qty}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-500 dark:text-neutral-400">
                      {new Date(order.order_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
