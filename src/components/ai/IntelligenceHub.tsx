"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  TrendingUp,
  Clock,
  ShieldAlert,
  Cpu,
  Check,
  ShoppingBag,
  Store,
  Globe,
  Tag,
  ArrowUpRight,
  Calendar,
  Sparkles,
} from "lucide-react";
import { fetchAnalyticsOverview, AnalyticsOverview } from "@/lib/api/analytics";
import { fetchCoupons, Coupon } from "@/lib/api/marketing";

export const IntelligenceHub: React.FC = () => {
  const router = useRouter();
  const [poSent, setPoSent] = useState<boolean>(false);
  const [promoSent, setPromoSent] = useState<boolean>(false);
  const [deliveryThrottled, setDeliveryThrottled] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.allSettled([fetchAnalyticsOverview(), fetchCoupons()])
      .then(([ovRes, cpnRes]) => {
        if (ovRes.status === "fulfilled") setAnalytics(ovRes.value);
        if (cpnRes.status === "fulfilled" && Array.isArray(cpnRes.value)) setCoupons(cpnRes.value);
      })
      .finally(() => setLoading(false));
  }, []);

  // Live metrics grounded in restaurant PostgreSQL database
  const todayRevenue = analytics ? Number(analytics.today_revenue || 0) : 0;
  const completedOrders = analytics ? Number(analytics.completed_orders_today ?? analytics.orders_count ?? 0) : 0;
  const occupiedTables = analytics ? Number(analytics.occupied_tables || 0) : 0;
  const totalTables = analytics ? Number(analytics.total_tables || 0) : 0;
  const occupancyRate = totalTables > 0 ? ((occupiedTables / totalTables) * 100).toFixed(1) : "0.0";
  const prepPaceVal = analytics ? Number(analytics.prep_pace_minutes ?? analytics.avg_prep_time_minutes ?? 0) : 0;
  const prepPace = prepPaceVal > 0 ? `${prepPaceVal}m` : "0.0m";
  const activeKots = analytics ? Number(analytics.active_kots ?? analytics.active_kot_count ?? 0) : 0;
  const totalDiscountGiven = analytics ? Number(analytics.total_discount_given || 0) : 0;

  const channelSales = analytics?.channel_sales && analytics.channel_sales.length > 0
    ? analytics.channel_sales
    : [
        { channel: "store", label: "In-Store Sales (Dine-In + Counter)", percentage: 0, revenue: 0, order_count: 0, average_order_value: 0 },
        { channel: "aggregators", label: "Online Aggregators (Zomato + Swiggy)", percentage: 0, revenue: 0, order_count: 0, average_order_value: 0 },
        { channel: "site", label: "Direct Website & QR Ordering", percentage: 0, revenue: 0, order_count: 0, average_order_value: 0 },
      ];

  const weeklyTraffic = analytics?.weekly_traffic || [];
  const weeklyTotalRevenue = weeklyTraffic.reduce((acc, d) => acc + Number(d.revenue || 0), 0);
  const weeklyTotalOrders = weeklyTraffic.reduce((acc, d) => acc + Number(d.total_orders || 0), 0);
  const peakDay = weeklyTraffic.find((d) => d.is_peak_day) || weeklyTraffic.reduce((best, d) => (Number(d.revenue) > Number(best?.revenue || 0) ? d : best), weeklyTraffic[0]);

  const hourlyRevenue = analytics?.hourly_revenue || [];
  const maxHourlyRev = Math.max(...hourlyRevenue.map((h) => Number(h.revenue || 0)), 1);
  const lowStockAlerts = analytics?.low_stock_alerts || [];
  const topDishes = analytics?.top_dishes || [];

  const activeCoupons = coupons.filter((c) => c.is_active);

  return (
    <div className="flex-1 p-6 lg:p-10 bg-[#110E0D] text-stone-100 space-y-10 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-stone-800 pb-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Operational Intelligence &amp; Economics
            </h2>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Live channel revenue attribution, 7-day traffic dynamics, and discount margin health for your restaurant
          </p>
        </div>

        <div className="text-xs text-stone-400 flex items-center gap-1.5 border border-stone-800 bg-[#181514] px-3 py-1.5 font-mono rounded-xl">
          <Cpu className="w-3.5 h-3.5 text-[#E07A5F]" />
          <span>{loading ? "Syncing Database..." : "Chotu Copilot Active • Real-time Sync"}</span>
        </div>
      </div>

      {/* Top 4 Key Business Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#181514] border border-stone-800 rounded-2xl p-5 space-y-1">
          <div className="text-xs font-mono text-stone-400 uppercase">Today&apos;s Revenue</div>
          <div className="text-2xl font-bold font-mono text-white">
            ₹ {todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{completedOrders} settled order{completedOrders === 1 ? "" : "s"} today</span>
          </div>
        </div>

        <div className="bg-[#181514] border border-stone-800 rounded-2xl p-5 space-y-1">
          <div className="text-xs font-mono text-stone-400 uppercase">Table Occupancy</div>
          <div className="text-2xl font-bold font-mono text-white">
            {occupiedTables} <span className="text-sm font-normal text-stone-400">/ {totalTables} Tables</span>
          </div>
          <div className="text-xs text-stone-400">{occupancyRate}% dine-in capacity</div>
        </div>

        <div className="bg-[#181514] border border-stone-800 rounded-2xl p-5 space-y-1">
          <div className="text-xs font-mono text-stone-400 uppercase">Kitchen Prep Pace</div>
          <div className="text-2xl font-bold font-mono text-white">{prepPace}</div>
          <div className="text-xs text-stone-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{prepPaceVal > 0 ? "Target: <10 mins" : "No bumped KOTs today"}</span>
          </div>
        </div>

        <div className="bg-[#181514] border border-stone-800 rounded-2xl p-5 space-y-1">
          <div className="text-xs font-mono text-stone-400 uppercase">Active KOT Tickets</div>
          <div className="text-2xl font-bold font-mono text-white">{activeKots} Queued</div>
          <div className="text-xs text-[#E07A5F]">Real-time KDS active tickets</div>
        </div>
      </div>

      {/* SECTION 1: Channel Sales Mix Breakdown (% Split) */}
      <div className="bg-canvas-card border border-border p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-sm text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent" />
              <span>Channel Sales Mix (% Split)</span>
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Proportion of in-store dining, third-party delivery aggregators, and direct delivery ordering
            </p>
          </div>
          <div className="text-xs font-mono text-ink-secondary">
            Gross Tracked:{" "}
            <strong className="text-ink">
              ₹ {todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>{" "}
            ({completedOrders} Orders)
          </div>
        </div>

        {/* Visual Segmented Proportional Bar */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-canvas-subtle border border-border flex overflow-hidden">
            {channelSales.map((item) => (
              <div
                key={item.channel}
                style={{ width: `${todayRevenue > 0 ? item.percentage : 33.3}%` }}
                className={`h-full transition-all duration-300 relative group ${
                  item.channel === "store"
                    ? "bg-ink"
                    : item.channel === "aggregators"
                    ? "bg-accent"
                    : "bg-dietary-veg"
                }`}
                title={`${item.label}: ${item.percentage || 0}%`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-ink-secondary pt-1 flex-wrap gap-3">
            {channelSales.map((c) => (
              <div key={c.channel} className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 inline-block ${
                    c.channel === "store" ? "bg-ink" : c.channel === "aggregators" ? "bg-accent" : "bg-dietary-veg"
                  }`}
                />
                <span>
                  {c.label}: <strong className="text-ink">{c.percentage || 0}%</strong>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Detailed Breakdown Cards (Grounded in DB) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {channelSales.map((item) => {
            const isStore = item.channel === "store";
            const isAggregator = item.channel === "aggregators";
            const rev = Number(item.revenue || 0);
            const aov = Number(item.average_order_value || 0);
            const estCommission = Math.round(rev * 0.22);
            const estSaved = Math.round(rev * 0.22);
            return (
              <div
                key={item.channel}
                className="border border-border p-4 bg-canvas flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-ink-secondary flex items-center gap-1.5">
                      {isStore ? (
                        <Store className="w-3.5 h-3.5 text-ink" />
                      ) : isAggregator ? (
                        <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-dietary-veg" />
                      )}
                      <span>{isStore ? "In-Store" : isAggregator ? "Aggregators" : "Direct Delivery"}</span>
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 border border-border bg-canvas-card">
                      {item.percentage || 0}%
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl font-bold font-mono text-ink">
                      ₹ {rev.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-mono text-ink-secondary mt-1 flex items-center justify-between">
                      <span>{item.order_count || 0} Orders</span>
                      <span>AOV: ₹ {aov.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border text-[11px] leading-relaxed text-ink-secondary">
                  {isStore && (
                    <span className="text-ink font-medium">
                      100% margin retention. Zero marketplace commissions deducted.
                    </span>
                  )}
                  {isAggregator && (
                    <span className="text-accent font-medium">
                      {rev > 0
                        ? `~22% blended commission fee (est. ₹ ${estCommission.toLocaleString("en-IN")} platform cut).`
                        : "No aggregator orders recorded for this period."}
                    </span>
                  )}
                  {!isStore && !isAggregator && (
                    <span className="text-dietary-veg font-medium">
                      {rev > 0
                        ? `Saved est. ₹ ${estSaved.toLocaleString("en-IN")} in aggregator fees via direct delivery.`
                        : "No direct delivery orders recorded yet today."}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Weekly Traffic & Source Attribution */}
      <div className="bg-canvas-card border border-border p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-sm text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span>7-Day Traffic &amp; Source Attribution</span>
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Actual order volume and revenue across the last 7 days from your database
            </p>
          </div>
          <div className="text-xs font-mono text-ink-secondary">
            Peak Day:{" "}
            <strong className="text-accent">
              {peakDay && peakDay.total_orders > 0
                ? `${peakDay.day} (${peakDay.total_orders} Orders)`
                : "No orders in last 7 days"}
            </strong>
          </div>
        </div>

        {/* Day-by-Day Matrix / Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-ink-secondary font-mono uppercase text-[11px]">
                <th className="py-2.5 pr-4 font-medium">Day</th>
                <th className="py-2.5 px-3 font-medium text-right">Total Orders</th>
                <th className="py-2.5 px-3 font-medium">Source Mix (Store / Aggregators / Delivery)</th>
                <th className="py-2.5 px-3 font-medium">Top Traffic Driver</th>
                <th className="py-2.5 pl-3 font-medium text-right">Day Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {weeklyTraffic.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-secondary text-xs">
                    No 7-day order data recorded yet.
                  </td>
                </tr>
              ) : (
                weeklyTraffic.map((d) => {
                  const storeOrders = Number(d.store_orders || 0);
                  const aggOrders = Number(d.aggregator_orders || 0);
                  const siteOrders = Number(d.site_orders || 0);
                  const total = Math.max(Number(d.total_orders || 0), 1);
                  const rev = Number(d.revenue || 0);
                  return (
                    <tr
                      key={d.day}
                      className={`hover:bg-canvas-subtle transition-colors ${
                        d.is_peak_day ? "bg-canvas-subtle/70 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-sans text-ink flex items-center gap-2">
                        <span>{d.day}</span>
                        {d.is_peak_day && d.total_orders > 0 && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-accent text-white font-bold">
                            Weekly Peak
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-ink font-bold">{d.total_orders}</td>
                      <td className="py-3 px-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-border flex overflow-hidden">
                            {d.total_orders > 0 && (
                              <>
                                <div
                                  style={{ width: `${(storeOrders / total) * 100}%` }}
                                  className="bg-ink h-full"
                                  title={`Store: ${storeOrders}`}
                                />
                                <div
                                  style={{ width: `${(aggOrders / total) * 100}%` }}
                                  className="bg-accent h-full"
                                  title={`Aggregators: ${aggOrders}`}
                                />
                                <div
                                  style={{ width: `${(siteOrders / total) * 100}%` }}
                                  className="bg-dietary-veg h-full"
                                  title={`Delivery: ${siteOrders}`}
                                />
                              </>
                            )}
                          </div>
                          <span className="text-[10px] text-ink-secondary whitespace-nowrap">
                            {storeOrders}/{aggOrders}/{siteOrders}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans text-ink">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <ArrowUpRight className="w-3 h-3 text-accent flex-shrink-0" />
                          <span>{d.total_orders > 0 ? d.top_source || "In-Store Dining" : "No Orders"}</span>
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right font-bold text-ink">
                        ₹ {rev.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Traffic Key Insights Banner */}
        <div className="border border-border p-4 bg-canvas flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-ink font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Chotu Traffic Synthesis</span>
            </span>
            <p className="text-ink-secondary font-sans text-xs">
              {weeklyTotalOrders > 0 && peakDay ? (
                <>
                  <strong>{peakDay.day}</strong> recorded your highest volume ({peakDay.total_orders} orders, ₹{" "}
                  {Number(peakDay.revenue || 0).toLocaleString("en-IN")}).{" "}
                  {topDishes[0] && (
                    <>
                      Top dish in period: <strong>{topDishes[0].name}</strong> ({topDishes[0].quantity_sold} sold).
                    </>
                  )}
                </>
              ) : (
                "Traffic insights will populate automatically as orders are settled in your restaurant."
              )}
            </p>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className="text-ink-secondary">Weekly Cumulative</div>
            <div className="text-base font-bold text-ink font-mono">
              ₹ {weeklyTotalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
              {weeklyTotalOrders} Orders)
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Promotions & Discount Summary (Real Coupons + Discounts) */}
      <div className="bg-canvas-card border border-border p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-sm text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <Tag className="w-4 h-4 text-accent" />
              <span>Promotions &amp; Discount Summary</span>
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Live promo codes configured for your restaurant and total discounts applied today
            </p>
          </div>
          <div className="text-xs font-mono text-ink-secondary flex items-center gap-4">
            <span>
              Discounts Given Today:{" "}
              <strong className="text-dietary-nonveg">₹ {totalDiscountGiven.toLocaleString("en-IN")}</strong>
            </span>
            <span>
              Active Coupons: <strong className="text-ink">{activeCoupons.length}</strong>
            </span>
          </div>
        </div>

        {coupons.length === 0 ? (
          <div className="p-6 border border-dashed border-border text-center text-xs text-ink-secondary font-mono space-y-2">
            <p>No promo codes created yet for your restaurant.</p>
            <button
              type="button"
              onClick={() => router.push("/marketing")}
              className="px-3 py-1.5 bg-canvas border border-border hover:border-accent text-ink text-xs font-semibold cursor-pointer"
            >
              Create Promo Code in Marketing →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coupons.map((c) => (
              <div key={c.id} className="border border-border p-5 bg-canvas flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 bg-canvas-card border border-border text-ink">
                      {c.code}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${
                        c.is_active
                          ? "border-dietary-veg text-dietary-veg bg-dietary-veg/5 font-semibold"
                          : "border-border text-ink-secondary"
                      }`}
                    >
                      {c.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    {c.description ||
                      `${c.discount_type === "percentage" ? `${c.discount_value}% off` : `₹${c.discount_value} flat off`} on orders ≥ ₹${c.min_order_value}`}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center font-mono text-xs">
                  <div className="p-2 bg-canvas-card border border-border">
                    <div className="text-[10px] text-ink-secondary uppercase">Discount</div>
                    <div className="font-bold text-ink mt-0.5">
                      {c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                    </div>
                  </div>
                  <div className="p-2 bg-canvas-card border border-border">
                    <div className="text-[10px] text-ink-secondary uppercase">Min Order</div>
                    <div className="font-bold text-ink mt-0.5">₹{c.min_order_value}</div>
                  </div>
                  <div className="p-2 bg-canvas-card border border-border">
                    <div className="text-[10px] text-ink-secondary uppercase">Uses</div>
                    <div className="font-bold text-ink mt-0.5">
                      {c.used_count} / {c.usage_limit}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actionable Operational Suggestions (Grounded in Live DB State) */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-ink font-mono uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span>Suggested Operational Actions</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Live Low Stock */}
          <div className="bg-canvas-card border border-border p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-dietary-nonveg font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Inventory Status</span>
                </span>
                <span className="text-ink-secondary">{lowStockAlerts.length} low</span>
              </div>

              <h4 className="font-bold text-base text-ink">
                {lowStockAlerts.length > 0
                  ? lowStockAlerts.slice(0, 2).map((a) => a.name).join(" & ")
                  : "Raw Stock Healthy"}
              </h4>

              <p className="text-xs text-ink-secondary leading-relaxed">
                {lowStockAlerts.length > 0
                  ? `${lowStockAlerts[0].name} is at ${lowStockAlerts[0].current_stock} ${lowStockAlerts[0].unit} (threshold: ${lowStockAlerts[0].reorder_threshold} ${lowStockAlerts[0].unit}). Restock to avoid 86'ing linked dishes.`
                  : "All raw ingredients in your inventory are currently above their reorder thresholds."}
              </p>
            </div>

            <button
              onClick={() => {
                setPoSent(true);
                router.push("/inventory");
              }}
              className="w-full py-2 bg-canvas hover:bg-canvas-subtle border border-border text-xs text-ink font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {poSent ? (
                <>
                  <Check className="w-3.5 h-3.5 text-dietary-veg" />
                  <span>Opening Stock &amp; PO Ledger →</span>
                </>
              ) : (
                <span>Manage Stock &amp; POs →</span>
              )}
            </button>
          </div>

          {/* Card 2: Top Performer / Promo */}
          <div className="bg-canvas-card border border-border p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-accent font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Menu Velocity</span>
                </span>
                <span className="text-dietary-veg font-bold">
                  {topDishes[0] ? `₹${Number(topDishes[0].revenue).toLocaleString("en-IN")}` : "Ready"}
                </span>
              </div>

              <h4 className="font-bold text-base text-ink">
                {topDishes[0] ? topDishes[0].name : "Menu Promotions"}
              </h4>

              <p className="text-xs text-ink-secondary leading-relaxed">
                {topDishes[0]
                  ? `Your top seller today with ${topDishes[0].quantity_sold} orders. Consider bundling or promoting complementary items.`
                  : "Create targeted promo codes in Marketing to boost dine-in and direct delivery volume."}
              </p>
            </div>

            <button
              onClick={() => {
                setPromoSent(true);
                router.push("/marketing");
              }}
              className="w-full py-2 bg-canvas hover:bg-canvas-subtle border border-border text-xs text-ink font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {promoSent ? (
                <>
                  <Check className="w-3.5 h-3.5 text-dietary-veg" />
                  <span>Opening Marketing Hub →</span>
                </>
              ) : (
                <span>Launch Promo Campaign →</span>
              )}
            </button>
          </div>

          {/* Card 3: Live Kitchen Queue */}
          <div className="bg-canvas-card border border-border p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-ink font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                  <span>Kitchen Queue</span>
                </span>
                <span className="text-accent font-bold">{activeKots} active</span>
              </div>

              <h4 className="font-bold text-base text-ink">
                {activeKots > 0 ? `${activeKots} Active KOT${activeKots === 1 ? "" : "s"} in Prep` : "Kitchen Clear"}
              </h4>

              <p className="text-xs text-ink-secondary leading-relaxed">
                {activeKots > 0
                  ? `Average prep pace is ${prepPace}. Monitor station queues in KDS to keep table turnaround fast.`
                  : "No pending KOT tickets in the kitchen display queue right now."}
              </p>
            </div>

            <button
              onClick={() => {
                setDeliveryThrottled(true);
                router.push("/kds");
              }}
              className="w-full py-2 bg-canvas hover:bg-canvas-subtle border border-border text-xs text-ink font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {deliveryThrottled ? (
                <>
                  <Check className="w-3.5 h-3.5 text-dietary-veg" />
                  <span>Opening Kitchen KDS →</span>
                </>
              ) : (
                <span>Open Kitchen Display (KDS) →</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hourly Sales Pace Grid (Live from DB) */}
      <div className="bg-canvas-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-ink">Hourly Revenue Velocity (Today)</h3>
            <p className="text-xs text-ink-secondary">Actual settled revenue by hour in Asia/Kolkata (IST)</p>
          </div>
          <span className="text-xs font-mono text-ink-secondary">Live Database Ledger</span>
        </div>

        {hourlyRevenue.length === 0 ? (
          <div className="py-10 text-center text-xs text-ink-secondary font-mono">
            No hourly revenue data available yet.
          </div>
        ) : (
          <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b border-border overflow-x-auto">
            {hourlyRevenue.map((bar, idx) => {
              const rev = Number(bar.revenue || 0);
              const pct = rev > 0 ? Math.max(8, Math.round((rev / maxHourlyRev) * 100)) : 4;
              return (
                <div key={idx} className="flex-1 min-w-[44px] flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className={`text-[10px] font-mono ${bar.is_current ? "text-accent font-bold" : "text-ink-secondary"}`}>
                    {rev > 0 ? `₹${rev >= 1000 ? `${(rev / 1000).toFixed(1)}k` : rev.toFixed(0)}` : "₹0"}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${pct}%` }}
                      className={`w-full transition-all ${
                        bar.is_current
                          ? "bg-accent"
                          : rev > 0
                          ? "bg-ink/80"
                          : "bg-border/40"
                      }`}
                      title={`${bar.hour}: ₹${rev.toFixed(2)} (${bar.order_count} orders)`}
                    />
                  </div>
                  <span className={`text-[10px] font-mono whitespace-nowrap ${bar.is_current ? "text-accent font-bold" : "text-ink-secondary"}`}>
                    {bar.hour}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-ink-secondary pt-1 font-mono">
          <span>
            Today&apos;s Settled Total:{" "}
            <strong className="text-ink">
              ₹ {todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </span>
          <span className="text-dietary-veg font-semibold">{completedOrders} orders settled today</span>
        </div>
      </div>
    </div>
  );
};
