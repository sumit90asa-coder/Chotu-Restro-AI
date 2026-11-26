"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Receipt, 
  UtensilsCrossed, 
  Grid3X3, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Users, 
  ShoppingBag,
  ArrowRight,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { fetchSalesOverview, fetchTopDishes } from "@/lib/api/analytics";
import { fetchTables } from "@/lib/api/tables";
import { fetchKDSTickets } from "@/lib/api/kds";
import { fetchLowStockIngredients } from "@/lib/api/inventory";
import { Table, KOT } from "@/types/restaurant";
import { wsClient } from "@/lib/api/websocket";
import { useAuth } from "@/lib/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<number>(0);
  const [growthPercent, setGrowthPercent] = useState<number>(0);
  const [prepPace, setPrepPace] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeKots, setActiveKots] = useState<KOT[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [topDishes, setTopDishes] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [overviewRes, tablesRes, kdsRes, lowStockRes] = await Promise.allSettled([
          fetchSalesOverview(),
          fetchTables(),
          fetchKDSTickets(),
          fetchLowStockIngredients(),
        ]);

        if (overviewRes.status === "fulfilled" && overviewRes.value) {
          const ov = overviewRes.value;
          setRevenue(Number(ov.today_revenue || 0));
          setGrowthPercent(Number(ov.revenue_growth_percent ?? 0));
          setPrepPace(Number(ov.prep_pace_minutes ?? ov.avg_prep_time_minutes ?? 0));
          setOrderCount(Number(ov.completed_orders_today ?? ov.orders_count ?? 0));
          if (ov.top_dishes && ov.top_dishes.length > 0) {
            setTopDishes(
              ov.top_dishes.map((d) => ({
                name: d.name,
                quantity: d.quantity_sold,
                revenue: Number(d.revenue),
              }))
            );
          } else {
            setTopDishes([]);
          }
        }

        if (tablesRes.status === "fulfilled" && tablesRes.value) {
          setTables(tablesRes.value);
        }

        if (kdsRes.status === "fulfilled" && kdsRes.value) {
          setActiveKots(kdsRes.value);
        }

        if (lowStockRes.status === "fulfilled" && lowStockRes.value) {
          setLowStockCount(lowStockRes.value.length);
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();

    wsClient.connect();
    const unsubscribe = wsClient.subscribe((evt) => {
      if (
        evt.type === "order_created" ||
        evt.type === "order_updated" ||
        evt.type === "kot_created" ||
        evt.type === "kot_updated" ||
        evt.type === "table_updated"
      ) {
        loadDashboardData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const occupiedTables = tables.filter((t) => t.status === "occupied" || t.status === "billed");
  const vacantTables = tables.filter((t) => t.status === "vacant");

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        category="Executive Intelligence"
        title="Restaurant Control Center"
        subtitle="Real-time operational overview, sales velocity, kitchen SLA, and floor status."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md shadow-[#E07A5F]/20 transition-all hover:scale-105"
            >
              <Receipt className="w-4 h-4" />
              <span>Open POS Terminal</span>
            </Link>
            <Link
              href="/kds"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700/60 transition-all"
            >
              <UtensilsCrossed className="w-4 h-4 text-amber-400" />
              <span>Kitchen Display</span>
            </Link>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="TODAY'S NET REVENUE"
          value={`₹${revenue.toLocaleString("en-IN")}`}
          subtitle="Tax & service charge inclusive"
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          trend={{
            value: `${growthPercent >= 0 ? "+" : ""}${growthPercent}% vs yesterday`,
            isPositive: growthPercent >= 0,
          }}
          highlight
        />
        <StatCard
          title="ACTIVE DINE-IN OCCUPANCY"
          value={tables.length > 0 ? `${occupiedTables.length} / ${tables.length} Tables` : "0 Tables"}
          subtitle={tables.length > 0 ? `${vacantTables.length} tables currently vacant` : "0 tables configured"}
          icon={<Grid3X3 className="w-5 h-5 text-blue-400" />}
          trend={{ value: tables.length > 0 ? `${Math.round((occupiedTables.length / tables.length) * 100)}% Capacity` : "0% Capacity", isPositive: true }}
        />
        <StatCard
          title="ORDERS COMPLETED"
          value={orderCount}
          subtitle={`Avg order value: ₹${orderCount > 0 ? Math.round(revenue / orderCount).toLocaleString("en-IN") : 0}`}
          icon={<ShoppingBag className="w-5 h-5 text-purple-400" />}
          trend={{ value: orderCount > 0 ? "Settled today" : "No settled orders yet", isPositive: true }}
        />
        <StatCard
          title="ACTIVE KITCHEN KOTS"
          value={`${activeKots.length} Tickets`}
          subtitle={prepPace > 0 ? `Avg prep time: ${prepPace} mins` : "No bumped KOTs today"}
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          trend={{ value: prepPace > 15 ? "Above 15m SLA" : "Within SLA", isPositive: prepPace <= 15 }}
        />
      </div>

      {/* Operational Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Floor & KDS Live Snapshot */}
        <div className="lg:col-span-2 space-y-6">
          {/* Floor Status Quick View */}
          <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Grid3X3 className="w-5 h-5 text-[#E07A5F]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Live Floor Status</h2>
              </div>
              <Link href="/tables" className="text-xs text-[#E07A5F] hover:underline flex items-center gap-1 font-medium">
                <span>Manage Floor</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {tables.length === 0 ? (
              <div className="py-10 text-center text-stone-500 bg-stone-900/30 rounded-xl border border-dashed border-stone-800">
                <Grid3X3 className="w-8 h-8 mx-auto text-stone-600 mb-2" />
                <p className="text-xs font-mono">No dining tables configured yet.</p>
                <Link
                  href="/tables"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E07A5F] text-stone-950 text-xs font-bold hover:bg-[#d0694e] transition-colors"
                >
                  Configure Tables &amp; Floor Plan
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {tables.slice(0, 12).map((tbl) => (
                  <Link
                    key={tbl.id}
                    href={`/pos`}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all hover:scale-105 ${
                      tbl.status === "occupied"
                        ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
                        : tbl.status === "billed"
                        ? "bg-blue-950/20 border-blue-500/40 text-blue-200"
                        : "bg-stone-900/60 border-stone-800 text-stone-400"
                    }`}
                  >
                    <span className="text-xs font-bold text-white">{tbl.label}</span>
                    <div className="mt-2">
                      <span className="text-[10px] uppercase font-mono block tracking-wider">
                        {tbl.status}
                      </span>
                      {tbl.currentBill ? (
                        <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">
                          ₹{tbl.currentBill}
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-600 block mt-0.5">—</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Top Selling Dishes Velocity */}
          <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <UtensilsCrossed className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Today's Best Performers</h2>
              </div>
              <Link href="/analytics" className="text-xs text-stone-400 hover:text-white flex items-center gap-1">
                <span>Detailed Sales</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {topDishes.length === 0 ? (
              <div className="py-8 text-center text-stone-500 font-mono text-xs">
                No orders processed today. Sales velocity will show here.
              </div>
            ) : (
              <div className="divide-y divide-stone-800/80">
                {topDishes.map((dish, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-xs font-mono font-bold text-stone-500">#{idx + 1}</span>
                      <div>
                        <p className="text-xs font-semibold text-white">{dish.name}</p>
                        <p className="text-[10px] text-stone-400">{dish.quantity} orders today</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">₹{dish.revenue.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-stone-500 font-mono">₹{Math.round(dish.revenue / dish.quantity)} avg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: AI Pulse & Alerts */}
        <div className="space-y-6">
          {/* Chotu AI Daily Briefing Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1E1917] to-[#151211] border border-[#E07A5F]/30 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-[#E07A5F]/20 text-[#E07A5F]">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#F4A261] font-mono">
                Chotu AI Operational Pulse
              </h2>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed mb-4">
              {orderCount > 0 || topDishes.length > 0 ? (
                <>
                  Settled <strong>{orderCount} order{orderCount === 1 ? "" : "s"}</strong> today totaling{" "}
                  <strong>₹{revenue.toLocaleString("en-IN")}</strong>.
                  {topDishes[0] && (
                    <> Top mover: <strong>{topDishes[0].name}</strong> ({topDishes[0].quantity} sold).</>
                  )}{" "}
                  {lowStockCount > 0
                    ? `${lowStockCount} raw ingredient${lowStockCount === 1 ? "" : "s"} below safety threshold.`
                    : "All inventory stock levels are healthy."}
                </>
              ) : (
                <>
                  {occupiedTables.length > 0
                    ? `${occupiedTables.length} table${occupiedTables.length === 1 ? " is" : "s are"} currently occupied with ${activeKots.length} active KOT${activeKots.length === 1 ? "" : "s"}. `
                    : "No settled orders recorded yet today. "}
                  {lowStockCount > 0
                    ? `${lowStockCount} raw ingredient${lowStockCount === 1 ? "" : "s"} need restocking.`
                    : "Inventory and kitchen queues are ready for service."}
                </>
              )}
            </p>
            <Link
              href="/insights"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E07A5F] hover:text-[#f3957c] transition-colors"
            >
              <span>View full AI suggestions & waste alerts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Low Stock Warning Card */}
          <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Stock Threshold Alerts</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                {lowStockCount} items low
              </span>
            </div>

            {lowStockCount === 0 ? (
              <div className="py-6 text-center text-stone-500 font-mono text-xs">
                All inventory items are currently above safety thresholds.
              </div>
            ) : (
              <div className="py-4 text-center text-rose-400 font-mono text-xs">
                {lowStockCount} items need attention. Check Inventory ledger.
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-stone-800 text-center">
              <Link href="/inventory" className="text-xs text-stone-400 hover:text-white transition-colors">
                Open Inventory Ledger & Supplier POs →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
