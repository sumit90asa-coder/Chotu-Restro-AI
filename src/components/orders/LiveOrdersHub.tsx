"use client";

import React, { useState } from "react";
import { LiveOrder, AggregatorChannel, OrderMode } from "@/types/restaurant";
import { 
  ShoppingBag, 
  Bike, 
  UtensilsCrossed, 
  Store, 
  Info, 
  Check, 
  Power, 
  ExternalLink,
  ChevronRight,
  MapPin,
  Clock,
  CheckCheck,
  RotateCcw,
  PackageCheck,
  Smartphone,
  ChefHat,
  Sparkles
} from "lucide-react";
import { ClickSpark } from "@/components/animations/ClickSpark";

interface LiveOrdersHubProps {
  orders: LiveOrder[];
  channels: AggregatorChannel[];
  onToggleChannel: (channelId: string) => void;
  onUpdateOrderStatus: (orderId: string, newStatus: LiveOrder["status"]) => void;
}

export const LiveOrdersHub: React.FC<LiveOrdersHubProps> = ({
  orders,
  channels,
  onToggleChannel,
  onUpdateOrderStatus,
}) => {
  const [viewMode, setViewMode] = useState<"active" | "completed">("active");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<LiveOrder | null>(null);

  const activeOrders = orders.filter((o) => o.status !== "completed");
  const completedOrders = orders.filter((o) => o.status === "completed");

  const currentList = viewMode === "active" ? activeOrders : completedOrders;

  const filteredOrders = currentList.filter((order) => {
    if (modeFilter === "all") return true;
    const rawMode = (order.mode || "").toLowerCase().replace("_", "-");
    if (modeFilter === "aggregators") {
      return (
        rawMode === "zomato" ||
        rawMode === "swiggy" ||
        rawMode === "ubereats" ||
        rawMode === "doordash" ||
        Boolean(order.aggregatorDetails)
      );
    }
    if (modeFilter === "dine-in") {
      return rawMode === "dine-in" || rawMode === "dinein" || rawMode.includes("dine");
    }
    return rawMode === modeFilter;
  });

  const totalCompletedRevenue = completedOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  return (
    <div className="flex-1 p-6 lg:p-10 bg-canvas space-y-10 max-w-7xl mx-auto w-full">
      
      {/* Header with View Switcher: Active Dispatch vs Completed History */}
      <div className="border-b border-border pb-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
            <span>Orders &amp; Multi-Channel Dispatch</span>
            <span className="w-2.5 h-2.5 rounded-full bg-dietary-veg animate-pulse"></span>
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Real-time unified ledger for Dine-In, Takeaway, Direct Delivery, and Online Third-Party Apps
          </p>
        </div>

        {/* View Switcher: Active Queue vs Completed Orders Archive */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border bg-canvas-card p-1 text-xs rounded-md shadow-xs">
            <button
              onClick={() => setViewMode("active")}
              className={`px-3.5 py-1.5 font-medium transition-all btn-reactive active:scale-95 flex items-center gap-1.5 rounded ${
                viewMode === "active"
                  ? "bg-ink text-canvas font-semibold shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <span>Active Dispatch</span>
              <span
                className={`px-1.5 py-0.2 text-[10px] font-mono rounded ${
                  viewMode === "active"
                    ? "bg-white/20 text-white"
                    : "bg-canvas-subtle text-ink-secondary"
                }`}
              >
                {activeOrders.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode("completed")}
              className={`px-3.5 py-1.5 font-medium transition-all btn-reactive active:scale-95 flex items-center gap-1.5 rounded ${
                viewMode === "completed"
                  ? "bg-ink text-canvas font-semibold shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-dietary-veg" />
              <span>Completed Orders</span>
              <span
                className={`px-1.5 py-0.2 text-[10px] font-mono rounded ${
                  viewMode === "completed"
                    ? "bg-white/20 text-white"
                    : "bg-canvas-subtle text-ink-secondary"
                }`}
              >
                {completedOrders.length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex flex-col text-right font-mono text-xs text-ink-secondary border-l border-border pl-3">
            <span>Settled Today</span>
            <strong className="text-ink">₹ {totalCompletedRevenue.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Orders Filter Tabs with ClickSpark feedback */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
        <ClickSpark sparkColor="#D95D39" sparkCount={6} sparkRadius={16}>
          <button
            onClick={() => setModeFilter("all")}
            className={`px-3.5 py-1.5 font-medium transition-all btn-reactive active:scale-95 rounded cursor-pointer ${
              modeFilter === "all"
                ? "bg-ink text-canvas font-semibold shadow-xs"
                : "text-ink-secondary hover:text-ink bg-canvas-card border border-border"
            }`}
          >
            All Orders ({currentList.length})
          </button>
        </ClickSpark>

        <ClickSpark sparkColor="#1967D2" sparkCount={6} sparkRadius={16}>
          <button
            onClick={() => setModeFilter("dine-in")}
            className={`px-3 py-1.5 font-medium transition-all btn-reactive active:scale-95 rounded cursor-pointer ${
              modeFilter === "dine-in"
                ? "bg-[#1967D2] text-white font-semibold shadow-xs"
                : "text-[#1967D2] bg-[#E8F1FD] border border-[#1967D2]/20 hover:bg-[#E8F1FD]/80"
            }`}
          >
            Dine-In
          </button>
        </ClickSpark>

        <ClickSpark sparkColor="#B06000" sparkCount={6} sparkRadius={16}>
          <button
            onClick={() => setModeFilter("takeaway")}
            className={`px-3 py-1.5 font-medium transition-all btn-reactive active:scale-95 rounded cursor-pointer ${
              modeFilter === "takeaway"
                ? "bg-[#B06000] text-white font-semibold shadow-xs"
                : "text-[#B06000] bg-[#FEF7E0] border border-[#B06000]/20 hover:bg-[#FEF7E0]/80"
            }`}
          >
            Takeout / Pickup
          </button>
        </ClickSpark>

        <ClickSpark sparkColor="#C5221F" sparkCount={6} sparkRadius={16}>
          <button
            onClick={() => setModeFilter("delivery")}
            className={`px-3 py-1.5 font-medium transition-all btn-reactive active:scale-95 rounded cursor-pointer ${
              modeFilter === "delivery"
                ? "bg-[#C5221F] text-white font-semibold shadow-xs"
                : "text-[#C5221F] bg-[#FCE8E6] border border-[#C5221F]/20 hover:bg-[#FCE8E6]/80"
            }`}
          >
            Direct Delivery
          </button>
        </ClickSpark>

        <ClickSpark sparkColor="#D95D39" sparkCount={6} sparkRadius={16}>
          <button
            onClick={() => setModeFilter("aggregators")}
            className={`px-3 py-1.5 font-medium transition-all btn-reactive active:scale-95 rounded cursor-pointer ${
              modeFilter === "aggregators"
                ? "bg-brand text-white font-semibold shadow-xs"
                : "text-brand bg-brand/10 border border-brand/20 hover:bg-brand/15"
            }`}
          >
            Delivery Apps (Uber Eats · DoorDash · Zomato)
          </button>
        </ClickSpark>
      </div>

      {/* Main Multi-Channel Orders Table (Matching the Reference Screenshot) */}
      <div className="bg-canvas-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-border/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-xs font-mono text-ink-secondary">
                    No active orders found in this filter view.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isOnline =
                    ord.mode === "ubereats" ||
                    ord.mode === "doordash" ||
                    ord.mode === "zomato" ||
                    ord.mode === "swiggy" ||
                    Boolean(ord.aggregatorDetails);

                  return (
                    <tr key={ord.id} className="hover:bg-canvas-subtle/50 transition-colors">
                      
                      {/* Column 1: Time */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap align-middle">
                        <div className="font-semibold text-xs text-ink">Today</div>
                        <div className="text-[11px] text-ink-secondary font-mono">
                          {ord.time.replace("Today ", "")}
                        </div>
                      </td>

                      {/* Column 2: Order / Token ID */}
                      <td className="py-4 px-4 whitespace-nowrap align-middle">
                        <div className="font-bold text-xs text-ink font-mono">{ord.orderNumber}</div>
                        <div className="text-[11px] text-ink-secondary font-mono">{ord.tokenNumber}</div>
                      </td>

                      {/* Column 3: Customer & Channel / Table Badges */}
                      <td className="py-4 px-4 align-middle min-w-[200px]">
                        <div className="font-semibold text-xs text-ink mb-1">{ord.customerName}</div>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ord.mode === "dine-in" && (
                            <>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E8F1FD] text-[#1967D2]">
                                Dine In
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FCE8E6] text-[#C5221F]">
                                {ord.tableId || "Table 2"}
                              </span>
                            </>
                          )}

                          {ord.mode === "takeaway" && (
                            <>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF7E0] text-[#B06000]">
                                Takeout
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FCE8E6] text-[#C5221F]">
                                {ord.tableId || "Table 4"}
                              </span>
                            </>
                          )}

                          {ord.mode === "delivery" && (
                            <>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEEFC3] text-[#B06000]">
                                Delivery
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FCE8E6] text-[#C5221F]">
                                {ord.tableId || "Table 6"}
                              </span>
                            </>
                          )}

                          {isOnline && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FCE8E6] text-[#D93025]">
                              Online Delivery
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: Context slot (Pickup Time / Address / Aggregator details) */}
                      <td className="py-4 px-4 align-middle">
                        {ord.mode === "takeaway" && (
                          <div className="flex items-center gap-6">
                            <span className="px-2.5 py-0.5 rounded bg-[#DC2626] text-white font-mono font-bold text-[11px]">
                              {ord.time.replace("Today ", "")}
                            </span>
                            <div className="flex flex-col items-center">
                              <ShoppingBag className="w-4 h-4 text-ink-secondary" />
                              <div className="w-7 h-[2px] bg-ink-secondary/40 mt-1"></div>
                            </div>
                          </div>
                        )}

                        {ord.mode === "delivery" && (
                          <div className="text-xs text-ink-secondary font-mono max-w-xs truncate" title={ord.deliveryAddress}>
                            {ord.deliveryAddress || "404 Monolith Tower West Hollywood CA 94523..."}
                          </div>
                        )}

                        {isOnline && (
                          <div className="space-y-0.5 text-xs font-mono">
                            <div className="font-semibold text-ink">
                              {ord.mode === "ubereats" || ord.aggregatorDetails?.platform === "ubereats"
                                ? "Uber Eats"
                                : ord.mode === "doordash" || ord.aggregatorDetails?.platform === "doordash"
                                ? "DoorDash"
                                : ord.mode === "swiggy"
                                ? "Swiggy"
                                : "Zomato"}{" "}
                              - {ord.aggregatorDetails?.orderId || "MNHLAW3L"}
                            </div>
                            <div className="text-[11px] text-ink-secondary">
                              {ord.aggregatorDetails?.riderStatus || "Placed"}
                            </div>
                          </div>
                        )}

                        {ord.mode === "dine-in" && (
                          <div className="text-xs text-ink-secondary truncate max-w-xs">
                            {ord.itemsSummary}
                          </div>
                        )}
                      </td>

                      {/* Column 5: Amount */}
                      <td className="py-4 px-4 text-right whitespace-nowrap align-middle">
                        <span className="text-xs font-bold font-mono text-ink">
                          ₹ {ord.totalAmount.toFixed(2)}
                        </span>
                      </td>

                      {/* Column 6: Status button (Ongoing in Teal pill) */}
                      <td className="py-4 px-4 text-center whitespace-nowrap align-middle">
                        <ClickSpark sparkColor="#00B4A6" sparkCount={8} sparkRadius={18}>
                          <button
                            onClick={() => {
                              if (ord.status === "preparing") {
                                onUpdateOrderStatus(ord.id, "ready");
                              } else if (ord.status === "ready") {
                                onUpdateOrderStatus(ord.id, ord.mode === "dine-in" ? "completed" : "out-for-delivery");
                              } else if (ord.status === "out-for-delivery") {
                                onUpdateOrderStatus(ord.id, "completed");
                              } else if (ord.status === "completed") {
                                // Completed order stays completed
                              }
                            }}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold text-white tracking-tight transition-all btn-reactive active:scale-90 active:translate-y-0.5 shadow-sm hover:shadow-md cursor-pointer ${
                              ord.status === "preparing"
                                ? "bg-[#00897B] hover:bg-[#00796B]" // Teal pill matching screenshot!
                                : ord.status === "ready"
                                ? "bg-[#16A34A] hover:bg-[#15803D]"
                                : ord.status === "out-for-delivery"
                                ? "bg-[#7C3AED] hover:bg-[#6D28D9]"
                                : ord.status === "completed"
                                ? "bg-gray-600 hover:bg-gray-700"
                                : "bg-[#E11D48] hover:bg-[#BE123C]"
                            }`}
                          >
                            {ord.status === "preparing"
                              ? "Ongoing"
                              : ord.status === "ready"
                              ? "Food Ready"
                              : ord.status === "out-for-delivery"
                              ? "Out for Delivery"
                              : ord.status === "completed"
                              ? "Done"
                              : "New"}
                          </button>
                        </ClickSpark>
                      </td>

                      {/* Column 7: Circular Info button (i) matching solid dark circle */}
                      <td className="py-4 px-4 text-center whitespace-nowrap align-middle">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="w-5 h-5 rounded-full bg-[#1E1B18] text-white hover:bg-brand flex items-center justify-center text-[10px] font-serif font-bold transition-all hover:scale-110 active:scale-90 cursor-pointer mx-auto shadow-xs"
                          title="View Order Details"
                        >
                          i
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* ============================================================
          THIRD-PARTY DELIVERY APPS INTEGRATION & WORKFLOW
          Exact recreation of the reference screenshot illustration:
          - Handwritten cursive "Third-party delivery apps" header with dashed arrow
          - Left: Stylized girl holding smartphone
          - Middle: Aggregator card with floating bag & red "1" badge,
                    Uber Eats (1/0/0), DoorDash (0/1/0), Grubhub (0/0/1) + interactive green toggles
          - Right: Yellow rolled receipt with burger stamp + Chef in toque + Customer
      ============================================================ */}
      <div className="pt-6 space-y-6">
        
        {/* Visual Workflow Canvas */}
        <div className="bg-[#181514] border border-stone-800 rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          
          {/* Handwritten Annotation at top-left with dashed arrow */}
          <div className="relative mb-8 pl-4 sm:pl-8">
            <div className="inline-block relative">
              <span className="font-hand text-3xl sm:text-4xl text-white font-bold block leading-tight">
                Third-party<br />delivery apps
              </span>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-12 relative">
            
            {/* Step 1: Customer Girl on Phone (Exact illustration style) */}
            <div className="flex flex-col items-center relative shrink-0">
              <svg width="140" height="150" viewBox="0 0 140 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                {/* Hair Bun */}
                <ellipse cx="64" cy="24" rx="15" ry="14" fill="#2E1F38" />
                <path d="M50 26C50 18 57 12 66 12C75 12 82 18 82 27C82 35 74 38 65 38C56 38 50 33 50 26Z" fill="#2E1F38" />
                {/* Loose Curls */}
                <path d="M52 18C47 20 44 26 47 30" stroke="#2E1F38" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M80 20C84 22 87 27 84 31" stroke="#2E1F38" strokeWidth="2" strokeLinecap="round" />
                {/* Head & Neck Profile */}
                <path d="M64 36C56 37 48 44 48 53C48 59 51 63 54 67L53 82L64 82L65 69C72 67 77 61 77 53C77 43 72 36 64 36Z" fill="#FFF6EF" stroke="#2E1F38" strokeWidth="2.2" strokeLinejoin="round" />
                {/* Nose & Smile */}
                <path d="M48 51L43 55L48 58L49 63L54 67" fill="#FFF6EF" stroke="#2E1F38" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M53 50C54 48 57 48 58 51" stroke="#2E1F38" strokeWidth="2" strokeLinecap="round" />
                <path d="M49 61C51 63 54 63 55 61" stroke="#2E1F38" strokeWidth="1.8" strokeLinecap="round" />
                {/* Ear & Teal Hoop Earring */}
                <circle cx="66" cy="55" r="4.5" fill="#FFF6EF" stroke="#2E1F38" strokeWidth="1.8" />
                <circle cx="66" cy="60" r="7" stroke="#00C49F" strokeWidth="3" fill="none" />
                {/* Teal Top / Shirt */}
                <path d="M38 90C42 81 51 79 65 79C79 79 88 81 92 90L96 128H32L38 90Z" fill="#00C49F" />
                <path d="M53 82L65 90L77 82" stroke="#2E1F38" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Mint Green Smartphone held in hand */}
                <g transform="translate(80, 64) rotate(12)">
                  <rect x="0" y="0" width="18" height="34" rx="4" fill="#00D4B2" stroke="#2E1F38" strokeWidth="2" />
                  <rect x="2.5" y="4" width="13" height="23" rx="1.5" fill="#E6FFFA" />
                  <circle cx="9" cy="30" r="1.5" fill="#2E1F38" />
                  {/* Hand */}
                  <path d="M-4 20C-1 18 5 18 6 22L4 28C2 31 -3 30 -4 28Z" fill="#FFF6EF" stroke="#2E1F38" strokeWidth="2" />
                </g>
              </svg>
            </div>

            {/* Connecting Dashed Curved Arrow 1 */}
            <div className="hidden lg:flex items-center justify-center">
              <svg width="70" height="50" viewBox="0 0 70 50" fill="none" className="text-stone-600">
                <path d="M5 10C25 35 45 40 62 42M62 42L54 36M62 42L56 47" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Step 2: The Aggregator Hub Card (Exact match to screenshot) */}
            <div className="w-full max-w-sm bg-[#141211] border border-stone-800 shadow-[0_6px_25px_rgba(0,0,0,0.4)] rounded-2xl p-5 sm:p-6 relative">
              
              {/* Takeout Bag Icon with Red "1" notification badge perched at the top */}
              <div className="absolute -top-5 left-8 flex items-center justify-center">
                <div className="relative">
                  <div className="w-10 h-10 bg-[#352542] rounded-xl flex items-center justify-center shadow-md border-2 border-[#141211]">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FF5252] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs border-2 border-[#141211]">
                    1
                  </span>
                </div>
              </div>

              {/* Table Headers: New | Ongoing | Done */}
              <div className="pt-3 pb-2 flex items-center justify-between text-xs font-medium text-stone-400">
                <div className="w-24"></div>
                <div className="flex items-center gap-6 sm:gap-7 text-center font-mono text-xs flex-1 justify-center pr-3">
                  <span className="w-8">New</span>
                  <span className="w-12">Ongoing</span>
                  <span className="w-8">Done</span>
                </div>
                <div className="w-10"></div>
              </div>

              {/* Aggregator Rows */}
              <div className="space-y-4">
                
                {/* Row 1: Uber Eats (1 / 0 / 0) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="w-24 shrink-0 flex items-center">
                    <div className="w-9 h-9 bg-black rounded-lg flex flex-col items-center justify-center text-white shadow-xs p-0.5 border border-stone-800">
                      <span className="text-[7px] font-bold leading-tight tracking-tight">Uber</span>
                      <span className="text-[8px] font-black leading-tight text-[#06C167]">Eats</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-7 text-center font-mono text-sm font-bold text-stone-100 flex-1 justify-center pr-3">
                    <span className="w-8">1</span>
                    <span className="w-12">0</span>
                    <span className="w-8">0</span>
                  </div>

                  <button
                    onClick={() => onToggleChannel("agg-ubereats")}
                    className="w-10 h-5.5 rounded-full bg-[#10B981] p-0.5 transition-all btn-reactive active:scale-90 cursor-pointer shrink-0 shadow-xs flex items-center justify-end"
                    title="Toggle Uber Eats"
                  >
                    <span className="w-4.5 h-4.5 rounded-full bg-white block shadow-sm transform transition-transform"></span>
                  </button>
                </div>

                {/* Row 2: DoorDash (0 / 1 / 0) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="w-24 shrink-0 flex items-center">
                    <div className="w-9 h-9 bg-stone-900 border border-stone-800 rounded-lg flex items-center justify-center shadow-xs p-1">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#FF3008] fill-current">
                        <path d="M23.071 8.411a6.071 6.071 0 0 0-5.42-3.328H1.667A1.667 1.667 0 0 0 0 6.75v.083a1.667 1.667 0 0 0 1.667 1.667h16.03a3.571 3.571 0 0 1 3.571 3.571c0 1.705-1.198 3.13-2.802 3.488l-4.71 1.05a1.667 1.667 0 1 0 .727 3.253l4.71-1.05A6.072 6.072 0 0 0 23.07 8.411Z" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-7 text-center font-mono text-sm font-bold text-stone-100 flex-1 justify-center pr-3">
                    <span className="w-8">0</span>
                    <span className="w-12">1</span>
                    <span className="w-8">0</span>
                  </div>

                  <button
                    onClick={() => onToggleChannel("agg-doordash")}
                    className="w-10 h-5.5 rounded-full bg-[#10B981] p-0.5 transition-all btn-reactive active:scale-90 cursor-pointer shrink-0 shadow-xs flex items-center justify-end"
                    title="Toggle DoorDash"
                  >
                    <span className="w-4.5 h-4.5 rounded-full bg-white block shadow-sm transform transition-transform"></span>
                  </button>
                </div>

                {/* Row 3: Grubhub / Delivery App (0 / 0 / 1) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="w-24 shrink-0 flex items-center">
                    <div className="w-9 h-9 bg-[#F36805] rounded-lg flex items-center justify-center text-white shadow-xs p-1.5">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                        <path d="M12 3L2 12h3v8h5v-6h4v6h5v-8h3L12 3zm-2 9H8v-2h2v2zm6 0h-2v-2h2v2z" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-7 text-center font-mono text-sm font-bold text-stone-100 flex-1 justify-center pr-3">
                    <span className="w-8">0</span>
                    <span className="w-12">0</span>
                    <span className="w-8">1</span>
                  </div>

                  <button
                    onClick={() => onToggleChannel("agg-grubhub")}
                    className="w-10 h-5.5 rounded-full bg-[#10B981] p-0.5 transition-all btn-reactive active:scale-90 cursor-pointer shrink-0 shadow-xs flex items-center justify-end"
                    title="Toggle Grubhub"
                  >
                    <span className="w-4.5 h-4.5 rounded-full bg-white block shadow-sm transform transition-transform"></span>
                  </button>
                </div>

              </div>
            </div>

            {/* Connecting Dashed Curved Arrow 2 */}
            <div className="hidden lg:flex items-center justify-center">
              <svg width="70" height="50" viewBox="0 0 70 50" fill="none" className="text-stone-600">
                <path d="M5 40C25 15 45 10 62 10M62 10L54 16M62 10L56 5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Step 3: Yellow Ticket + Chef in Toque + Customer Handover */}
            <div className="flex items-center gap-6 shrink-0">
              
              {/* Rolled Yellow Order Ticket with Burger Stamp */}
              <div className="flex flex-col items-center">
                <svg width="60" height="75" viewBox="0 0 60 75" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                  <path d="M10 8C10 4 18 4 22 7C26 10 40 10 44 7C48 4 54 4 54 8V62C54 66 48 66 44 63C40 60 26 60 22 63C18 66 10 66 10 62V8Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.8" strokeLinejoin="round" />
                  <ellipse cx="32" cy="7" rx="20" ry="4" fill="#F59E0B" stroke="#D97706" strokeWidth="1.2" />
                  <path d="M10 62C10 66 18 69 32 69C46 69 54 66 54 62" stroke="#D97706" strokeWidth="1.8" fill="none" />
                  {/* Burger Doodle Stamp */}
                  <g transform="translate(20, 24)">
                    <path d="M3 10C3 4 21 4 21 10H3Z" fill="#B45309" />
                    <rect x="1" y="12" width="22" height="3" rx="1.5" fill="#78350F" />
                    <rect x="3" y="17" width="18" height="2.5" rx="1.2" fill="#B45309" />
                    <path d="M2 11H22L20 13H4L2 11Z" fill="#F59E0B" />
                  </g>
                </svg>
              </div>

              {/* Chef in Pink/Salmon Coat with Chef Toque Hat */}
              <div className="flex flex-col items-center">
                <svg width="100" height="120" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                  {/* Chef Toque Hat */}
                  <path d="M38 20C38 12 46 8 50 8C56 8 62 12 62 20C68 16 75 20 75 26C75 33 70 37 64 38H36C30 37 25 33 25 26C25 20 32 16 38 20Z" fill="#FF6B6B" stroke="#2E1F38" strokeWidth="2.2" strokeLinejoin="round" />
                  <rect x="32" y="38" width="36" height="7" rx="2" fill="#FFFFFF" stroke="#2E1F38" strokeWidth="1.8" />
                  {/* Head & Beard */}
                  <path d="M40 45V55C40 62 45 67 50 67C55 67 60 62 60 55V45H40Z" fill="#FFF6EF" stroke="#2E1F38" strokeWidth="1.8" />
                  <path d="M40 52C40 64 45 70 50 70C55 70 60 64 60 52C56 55 54 55 50 54C46 55 44 55 40 52Z" fill="#2E1F38" />
                  {/* Eyes looking up */}
                  <circle cx="44" cy="48" r="1.8" fill="#2E1F38" />
                  <circle cx="56" cy="48" r="1.8" fill="#2E1F38" />
                  {/* Salmon / Pink Chef Coat */}
                  <path d="M25 76C28 70 38 68 50 68C62 68 72 70 75 76L80 110H20L25 76Z" fill="#FF6B6B" />
                  <path d="M42 70L50 80L58 70" stroke="#2E1F38" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Connecting Dashed Arrow 3 */}
              <div className="hidden sm:flex items-center justify-center">
                <svg width="45" height="30" viewBox="0 0 45 30" fill="none" className="text-[#C4BCB3]">
                  <path d="M5 15C18 15 28 15 38 15M38 15L30 9M38 15L30 21" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Customer Girl on Far Right receiving the order */}
              <div className="flex flex-col items-center">
                <svg width="90" height="110" viewBox="0 0 90 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                  {/* Hair Bun */}
                  <circle cx="52" cy="18" r="11" fill="#2E1F38" />
                  <path d="M42 20C42 14 47 10 53 10C59 10 64 14 64 20C64 26 58 30 52 30C46 30 42 25 42 20Z" fill="#2E1F38" />
                  {/* Face & Neck */}
                  <path d="M38 38C38 46 43 54 50 54C57 54 62 46 62 38C62 31 57 28 50 28C43 28 38 31 38 38Z" fill="#FFF6EF" stroke="#2E1F38" strokeWidth="1.8" />
                  {/* Smiling Eyes */}
                  <path d="M43 40C44 38 47 38 48 40" stroke="#2E1F38" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M52 40C53 38 56 38 57 40" stroke="#2E1F38" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Happy Smile */}
                  <path d="M46 47C48 49 51 49 53 47" stroke="#2E1F38" strokeWidth="1.8" strokeLinecap="round" />
                  {/* Teal Earrings */}
                  <circle cx="37" cy="43" r="3.5" stroke="#00C49F" strokeWidth="2.2" fill="none" />
                  <circle cx="63" cy="43" r="3.5" stroke="#00C49F" strokeWidth="2.2" fill="none" />
                  {/* Teal Shirt */}
                  <path d="M28 64C32 58 40 56 50 56C60 56 68 58 72 64L76 96H24L28 64Z" fill="#00C49F" />
                </svg>
              </div>

            </div>

          </div>

          {/* Footer Highlights */}
          <div className="mt-8 pt-5 border-t border-[#E8E4DF] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#6E675F]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand shrink-0" />
              <span>
                <strong>0% Manual Re-Punching:</strong> Webhook auto-injects directly into Kitchen KDS &amp; POS ledger.
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Auto-accept: <strong className="text-dietary-veg">ENABLED</strong></span>
              <span>•</span>
              <span>Menu sync: <strong className="text-ink">REAL-TIME</strong></span>
            </div>
          </div>

        </div>

      </div>

      {/* Order Details Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-canvas-card border border-border w-full max-w-md rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h4 className="font-bold text-sm text-ink font-mono">{selectedOrder.orderNumber}</h4>
                <p className="text-xs text-ink-secondary">{selectedOrder.tokenNumber} • {selectedOrder.time}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-xs font-mono text-ink-secondary hover:text-ink px-2 py-1 border border-border"
              >
                Close [✕]
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Customer:</span>
                <span className="font-semibold text-ink">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Channel:</span>
                <span className="font-semibold text-ink uppercase font-mono">{selectedOrder.mode}</span>
              </div>
              {selectedOrder.deliveryAddress && (
                <div className="space-y-1">
                  <span className="text-ink-secondary">Delivery Address:</span>
                  <div className="p-2.5 bg-canvas-subtle border border-border text-ink rounded">
                    {selectedOrder.deliveryAddress}
                  </div>
                </div>
              )}
              {selectedOrder.aggregatorDetails && (
                <div className="p-2.5 bg-canvas-subtle border border-border space-y-1 font-mono rounded">
                  <div>Platform: {selectedOrder.aggregatorDetails.platform.toUpperCase()}</div>
                  <div>Order ID: {selectedOrder.aggregatorDetails.orderId}</div>
                  <div>Rider Status: {selectedOrder.aggregatorDetails.riderStatus}</div>
                  {selectedOrder.aggregatorDetails.otp && (
                    <div className="text-brand font-bold">Handover OTP: {selectedOrder.aggregatorDetails.otp}</div>
                  )}
                </div>
              )}
              <div className="pt-2 border-t border-border">
                <span className="text-ink-secondary">Dishes in Order:</span>
                <div className="mt-1 font-mono text-ink p-2 bg-canvas-subtle rounded">{selectedOrder.itemsSummary}</div>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-bold text-sm">
                <span>Total Amount:</span>
                <span className="font-mono text-ink">₹ {selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              {selectedOrder.status !== "completed" && (
                <button
                  onClick={() => {
                    onUpdateOrderStatus(
                      selectedOrder.id,
                      selectedOrder.status === "preparing" ? "ready" : "completed"
                    );
                    setSelectedOrder(null);
                  }}
                  className="flex-1 py-2 bg-brand text-white font-medium text-xs hover:bg-brand-hover transition-colors rounded"
                >
                  Advance Status
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-canvas-subtle border border-border text-ink font-medium text-xs hover:bg-canvas transition-colors rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LiveOrdersHub;
