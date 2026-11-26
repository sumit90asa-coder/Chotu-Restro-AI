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
import {
  CHANNEL_SALES_SPLIT,
  WEEKLY_TRAFFIC_SOURCES,
  PROMOTION_IMPACTS,
} from "@/data/mockData";
import { fetchAnalyticsOverview, AnalyticsOverview } from "@/lib/api/analytics";

export const IntelligenceHub: React.FC = () => {
  const router = useRouter();
  const [poSent, setPoSent] = useState<boolean>(false);
  const [promoSent, setPromoSent] = useState<boolean>(false);
  const [deliveryThrottled, setDeliveryThrottled] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);

  useEffect(() => {
    fetchAnalyticsOverview()
      .then((data) => setAnalytics(data))
      .catch((err) => console.warn("Analytics API fallback:", err));
  }, []);

  // Live metrics grounded in database
  const todayRevenue = analytics ? Number(analytics.today_revenue || 0) : 0;
  const occupiedTables = analytics ? (analytics.occupied_tables || 0) : 0;
  const totalTables = analytics ? (analytics.total_tables || 0) : 0;
  const occupancyRate = totalTables > 0 ? ((occupiedTables / totalTables) * 100).toFixed(1) : "0.0";
  const prepPace = analytics ? `${analytics.prep_pace_minutes || analytics.avg_prep_time_minutes || 8.2}m` : "8.2m";
  const activeKots = analytics ? (analytics.active_kots ?? analytics.active_kot_count ?? 0) : 0;

  // Use live channel sales or fallback structure
  const channelSales = (analytics?.channel_sales && analytics.channel_sales.length > 0)
    ? analytics.channel_sales
    : CHANNEL_SALES_SPLIT.map(c => ({ ...c, revenue: 0, order_count: 0, percentage: 0 }));

  const weeklyTraffic = (analytics?.weekly_traffic && analytics.weekly_traffic.length > 0)
    ? analytics.weekly_traffic
    : WEEKLY_TRAFFIC_SOURCES;

  // Calculate totals for promotions
  const totalDiscountSpent = PROMOTION_IMPACTS.reduce((acc, p) => acc + p.discountSpent, 0);
  const totalPromoRevenue = PROMOTION_IMPACTS.reduce((acc, p) => acc + p.revenueGenerated, 0);
  const blendedRoi = (totalPromoRevenue / totalDiscountSpent).toFixed(1);

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
            Channel revenue attribution, day-of-week traffic dynamics, and discount margin health
          </p>
        </div>

        <div className="text-xs text-stone-400 flex items-center gap-1.5 border border-stone-800 bg-[#181514] px-3 py-1.5 font-mono rounded-xl">
          <Cpu className="w-3.5 h-3.5 text-[#E07A5F]" />
          <span>Chotu Copilot Active • Real-time Sync</span>
        </div>
      </div>

      {/* Top 4 Key Business Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#181514] border border-stone-800 rounded-2xl p-5 space-y-1">
          <div className="text-xs font-mono text-stone-400 uppercase">Period Revenue</div>
          <div className="text-2xl font-bold font-mono text-white">₹ {todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Database settled revenue</span>
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
            <span>Target: &lt;10 mins</span>
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
              Proportion of in-store dining, third-party delivery aggregators, and direct restaurant ordering
            </p>
          </div>
          <div className="text-xs font-mono text-ink-secondary">
            Gross Tracked: <strong className="text-ink">₹ {todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> ({analytics?.completed_orders_today ?? (todayRevenue > 0 ? 1 : 0)} Orders)
          </div>
        </div>

        {/* Visual Segmented Proportional Bar */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-canvas-subtle border border-border flex overflow-hidden">
            {channelSales.map((item) => (
              <div
                key={item.channel}
                style={{ width: `${item.percentage || 33.3}%` }}
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
                <span className={`w-2.5 h-2.5 inline-block ${c.channel === "store" ? "bg-ink" : c.channel === "aggregators" ? "bg-accent" : "bg-dietary-veg"}`} />
                <span>{c.label}: <strong className="text-ink">{c.percentage || 0}%</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Detailed Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {CHANNEL_SALES_SPLIT.map((item) => {
            const isStore = item.channel === "store";
            const isAggregator = item.channel === "aggregators";
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
                      <span>{item.channel === "store" ? "In-Store" : item.channel === "aggregators" ? "Aggregators" : "Direct Site"}</span>
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 border border-border bg-canvas-card">
                      {item.percentage}%
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl font-bold font-mono text-ink">
                      ₹ {item.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-mono text-ink-secondary mt-1 flex items-center justify-between">
                      <span>{item.orderCount} Orders</span>
                      <span>AOV: ₹ {item.averageOrderValue.toFixed(0)}</span>
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
                      ~22% blended commission fee (est. ₹ 3,157 cut paid to platforms).
                    </span>
                  )}
                  {!isStore && !isAggregator && (
                    <span className="text-dietary-veg font-medium">
                      Saved ₹ 1,320 in aggregator fees by routing via direct website QR.
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
              <span>Weekly Traffic &amp; Source Attribution</span>
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Order volume breakdown by day of week and primary channel traffic origin
            </p>
          </div>
          <div className="text-xs font-mono text-ink-secondary">
            Peak Day: <strong className="text-accent">Saturday (114 Orders)</strong>
          </div>
        </div>

        {/* Day-by-Day Matrix / Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-ink-secondary font-mono uppercase text-[11px]">
                <th className="py-2.5 pr-4 font-medium">Day</th>
                <th className="py-2.5 px-3 font-medium text-right">Total Orders</th>
                <th className="py-2.5 px-3 font-medium">Source Mix (Store / Aggregators / Site)</th>
                <th className="py-2.5 px-3 font-medium">Top Traffic Driver</th>
                <th className="py-2.5 pl-3 font-medium text-right">Day Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {WEEKLY_TRAFFIC_SOURCES.map((d) => (
                <tr
                  key={d.day}
                  className={`hover:bg-canvas-subtle transition-colors ${
                    d.isPeakDay ? "bg-canvas-subtle/70 font-semibold" : ""
                  }`}
                >
                  <td className="py-3 pr-4 font-sans text-ink flex items-center gap-2">
                    <span>{d.day}</span>
                    {d.isPeakDay && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-accent text-white font-bold">
                        Weekly Peak
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-ink font-bold">
                    {d.totalOrders}
                  </td>
                  <td className="py-3 px-3 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-border flex overflow-hidden">
                        <div
                          style={{ width: `${(d.storeOrders / d.totalOrders) * 100}%` }}
                          className="bg-ink h-full"
                          title={`Store: ${d.storeOrders}`}
                        />
                        <div
                          style={{ width: `${(d.aggregatorOrders / d.totalOrders) * 100}%` }}
                          className="bg-accent h-full"
                          title={`Aggregators: ${d.aggregatorOrders}`}
                        />
                        <div
                          style={{ width: `${(d.siteOrders / d.totalOrders) * 100}%` }}
                          className="bg-dietary-veg h-full"
                          title={`Site: ${d.siteOrders}`}
                        />
                      </div>
                      <span className="text-[10px] text-ink-secondary whitespace-nowrap">
                        {d.storeOrders}/{d.aggregatorOrders}/{d.siteOrders}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-sans text-ink">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <ArrowUpRight className="w-3 h-3 text-accent flex-shrink-0" />
                      <span>{d.topSource}</span>
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right font-bold text-ink">
                    ₹ {d.revenue.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
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
              <strong>Saturday &amp; Friday</strong> dominate in-store dining (60% dine-in share). 
              <strong> Mid-week dinner surges (Tuesday–Wednesday)</strong> are heavily driven by Zomato and Swiggy delivery.
            </p>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className="text-ink-secondary">Weekly Cumulative</div>
            <div className="text-base font-bold text-ink font-mono">₹ 2,94,000 (488 Orders)</div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Promotions & Discount ROI Impact */}
      <div className="bg-canvas-card border border-border p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-sm text-ink uppercase tracking-wider font-mono flex items-center gap-2">
              <Tag className="w-4 h-4 text-accent" />
              <span>Promotions &amp; Discount ROI Impact</span>
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Cost of discounting vs attributed revenue, guest retention rates, and net margin impact
            </p>
          </div>
          <div className="text-xs font-mono text-ink-secondary flex items-center gap-4">
            <span>Spent: <strong className="text-dietary-nonveg">₹ {totalDiscountSpent.toLocaleString("en-IN")}</strong></span>
            <span>Attributed Rev: <strong className="text-dietary-veg">₹ {totalPromoRevenue.toLocaleString("en-IN")}</strong></span>
            <span>Blended ROI: <strong className="text-ink">{blendedRoi}x</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROMOTION_IMPACTS.map((promo) => (
            <div
              key={promo.id}
              className="border border-border p-5 bg-canvas flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 bg-canvas-card border border-border text-ink">
                      {promo.code}
                    </span>
                    <span className="text-[11px] font-mono text-ink-secondary">
                      {promo.channel}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${
                      promo.marginHealth === "healthy"
                        ? "border-dietary-veg text-dietary-veg bg-dietary-veg/5 font-semibold"
                        : "border-accent text-accent bg-accent/5 font-semibold"
                    }`}
                  >
                    {promo.marginHealth === "healthy" ? "Healthy Margin" : "Moderate Margin"}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-ink">{promo.name}</h4>
                  <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                    {promo.insightNote}
                  </p>
                </div>
              </div>

              {/* Promo Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border text-center font-mono text-xs">
                <div className="p-2 bg-canvas-card border border-border">
                  <div className="text-[10px] text-ink-secondary uppercase">Discount</div>
                  <div className="font-bold text-ink mt-0.5">₹ {promo.discountSpent}</div>
                </div>
                <div className="p-2 bg-canvas-card border border-border">
                  <div className="text-[10px] text-ink-secondary uppercase">Revenue</div>
                  <div className="font-bold text-ink mt-0.5">₹ {promo.revenueGenerated.toLocaleString("en-IN")}</div>
                </div>
                <div className="p-2 bg-canvas-card border border-border">
                  <div className="text-[10px] text-ink-secondary uppercase">ROI</div>
                  <div className="font-bold text-dietary-veg mt-0.5">{promo.roiMultiplier}</div>
                </div>
                <div className="p-2 bg-canvas-card border border-border">
                  <div className="text-[10px] text-ink-secondary uppercase">Repeat Rate</div>
                  <div className="font-bold text-ink mt-0.5">{promo.repeatGuestRate}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Operational Suggestions (Chotu Autopilot) */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-ink font-mono uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span>Suggested Operational Actions</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Critical Depletion */}
          <div className="bg-canvas-card border border-border p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-dietary-nonveg font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Low Stock Warning</span>
                </span>
                <span className="text-ink-secondary">Depletion in 45m</span>
              </div>

              <h4 className="font-bold text-base text-ink">Heavy Dairy Cream &amp; Butter</h4>

              <p className="text-xs text-ink-secondary leading-relaxed">
                At current dinner velocity (14 gravies/hr), dairy cream stock will run dry before the 9:30 PM peak.
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
                  <span>Opening Stock & PO Ledger →</span>
                </>
              ) : (
                <span>Manage Stock &amp; POs →</span>
              )}
            </button>
          </div>

          {/* Card 2: Dynamic Yield */}
          <div className="bg-canvas-card border border-border p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-accent font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Revenue Opportunity</span>
                </span>
                <span className="text-dietary-veg font-bold">+₹ 4,200</span>
              </div>

              <h4 className="font-bold text-base text-ink">Surplus Dum Biryani Handis</h4>

              <p className="text-xs text-ink-secondary leading-relaxed">
                Portions remain unsold. Suggest creating a 15% discount promo code to re-engage registered guests.
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

          {/* Card 3: Bottleneck */}
          <div className="bg-canvas-card border border-border p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-ink font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                  <span>Kitchen Diagnostic</span>
                </span>
                <span className="text-accent font-bold">+6m delay</span>
              </div>

              <h4 className="font-bold text-base text-ink">Tandoor Clay Oven Queue</h4>

              <p className="text-xs text-ink-secondary leading-relaxed">
                Multiple Naan &amp; Roti breads in queue. Check real-time KDS tickets to prioritize seated guests.
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

      {/* Hourly Sales Pace Grid */}
      <div className="bg-canvas-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-ink">Hourly Revenue Velocity</h3>
            <p className="text-xs text-ink-secondary">Peak dinner rush: 8:00 PM – 10:30 PM</p>
          </div>
          <span className="text-xs font-mono text-ink-secondary">Today vs Average</span>
        </div>

        <div className="h-40 flex items-end gap-3 pt-6 pb-2 border-b border-border">
          {[
            { hour: "5 PM", val: "₹2.1k", height: "h-12", isCurrent: false },
            { hour: "6 PM", val: "₹4.8k", height: "h-20", isCurrent: false },
            { hour: "7 PM", val: "₹8.4k", height: "h-28", isCurrent: false },
            { hour: "8 PM (Now)", val: "₹16.2k", height: "h-36", isCurrent: true },
            { hour: "9 PM (Est)", val: "₹14.0k", height: "h-32", isCurrent: false, dashed: true },
            { hour: "10 PM (Est)", val: "₹9.2k", height: "h-20", isCurrent: false, dashed: true },
          ].map((bar, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
              <span className={`text-[10px] font-mono ${bar.isCurrent ? "text-accent font-bold" : "text-ink-secondary"}`}>
                {bar.val}
              </span>
              <div
                className={`w-full ${bar.height} transition-all ${
                  bar.isCurrent
                    ? "bg-accent"
                    : bar.dashed
                    ? "border-t border-dashed border-accent bg-canvas-subtle"
                    : "bg-border"
                }`}
              ></div>
              <span className={`text-[10px] font-mono ${bar.isCurrent ? "text-accent font-bold" : "text-ink-secondary"}`}>
                {bar.hour}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-ink-secondary pt-1 font-mono">
          <span>Projected Closing: <strong className="text-ink">₹ 78,500.00</strong></span>
          <span className="text-dietary-veg font-semibold">+18.4% above last Saturday</span>
        </div>
      </div>
    </div>
  );
};

