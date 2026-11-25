"use client";

import React, { useState, useEffect } from "react";
import { KOT } from "@/types/restaurant";
import { 
  Check, 
  CheckCircle2,
  Clock, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  CheckCheck, 
  Flame, 
  AlertTriangle,
  Utensils,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell
} from "lucide-react";

interface KitchenDisplayProps {
  kots: KOT[];
  onBumpKot: (kotId: string) => void;
  onRecallKot: (kotId: string) => void;
  onToggleItem?: (itemId: string) => void;
  onRefresh?: () => void;
  isWsConnected?: boolean;
}

export const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ 
  kots, 
  onBumpKot, 
  onRecallKot,
  onToggleItem,
  onRefresh,
  isWsConnected = true
}) => {
  const [viewMode, setViewMode] = useState<"active" | "completed">("active");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [confirmBumpId, setConfirmBumpId] = useState<string | null>(null);

  // Live timer tick every 10 seconds to update elapsed time visual
  const [ticker, setTicker] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleItemCheck = (key: string, itemId?: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
    if (onToggleItem && itemId) {
      onToggleItem(itemId);
    }
  };

  const activeKots = kots.filter((k) => k.status !== "bumped");
  const completedKots = kots.filter((k) => k.status === "bumped");

  // Station Filter
  const currentList = (viewMode === "active" ? activeKots : completedKots).filter((kot) => {
    if (stationFilter === "all") return true;
    return kot.items.some((item) => item.station === stationFilter);
  });

  // Calculate overdue counts
  const overdueCount = activeKots.filter((k) => k.elapsedSeconds > 720).length;

  return (
    <div className="flex-1 p-4 lg:p-8 bg-[#110E0D] text-stone-100 space-y-6 max-w-7xl mx-auto w-full">
      
      {/* High-Contrast Kitchen Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-stone-800 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight font-mono flex items-center gap-2.5">
              <span>Kitchen Display System</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            {/* Live WebSocket Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                isWsConnected
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
              }`}
            >
              {isWsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isWsConnected ? "Live Pass Sync" : "Reconnecting..."}</span>
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1 font-mono">
            Line Pacing • Station Routing • Real-time KOT Orders
          </p>
        </div>

        {/* Action Controls & Sound */}
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
              title="Refresh Tickets"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Active vs Completed Tab Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-stone-900 border border-stone-800 text-xs">
            <button
              onClick={() => setViewMode("active")}
              className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                viewMode === "active"
                  ? "bg-[#E07A5F] text-stone-950 shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Active Line</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                viewMode === "active" ? "bg-stone-950/20 text-stone-950 font-extrabold" : "bg-stone-800 text-stone-300"
              }`}>
                {activeKots.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode("completed")}
              className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                viewMode === "completed"
                  ? "bg-stone-700 text-white shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Completed / Served</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                viewMode === "completed" ? "bg-stone-900 text-white" : "bg-stone-800 text-stone-400"
              }`}>
                {completedKots.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="px-3 py-2 rounded-xl border border-stone-800 bg-stone-900 text-xs text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#F4A261]" />
            ) : (
              <VolumeX className="w-4 h-4 text-stone-500" />
            )}
            <span className="hidden sm:inline font-mono">{soundEnabled ? "Chime On" : "Muted"}</span>
          </button>
        </div>
      </div>

      {/* Station Filters Strip & SLA Summary */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-3.5 rounded-2xl bg-[#181413] border border-stone-800 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-mono text-stone-400 uppercase mr-1">Kitchen Station:</span>
          {[
            { id: "all", label: "All Stations" },
            { id: "curry", label: "Curry Pass" },
            { id: "tandoor", label: "Tandoor" },
            { id: "bar", label: "Bar & Drinks" },
            { id: "pantry", label: "Pantry & Cold" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStationFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                stationFilter === st.id
                  ? "bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/40 shadow-sm"
                  : "text-stone-400 hover:text-white hover:bg-stone-800 border border-transparent"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* SLA Indicator stats */}
        <div className="text-xs font-mono text-stone-400 flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{overdueCount} Overdue (&gt;12m)</span>
            </span>
          )}
          <span>Active: <strong className="text-white">{activeKots.length}</strong></span>
          <span>•</span>
          <span>Completed: <strong className="text-emerald-400">{completedKots.length}</strong></span>
        </div>
      </div>

      {/* Tickets Stream Grid */}
      {currentList.length === 0 ? (
        <div className="py-24 text-center space-y-3 border border-stone-800/80 rounded-3xl bg-[#181413]">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white font-mono">Kitchen Pass is Clear</h3>
          <p className="text-xs text-stone-400 font-mono">
            {viewMode === "active"
              ? "All kitchen tickets have been prepared and bumped. Standing by for incoming orders."
              : "No tickets found matching the selected station filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((kot) => {
            const isCompleted = kot.status === "bumped";
            const isLate = kot.elapsedSeconds > 720 && !isCompleted; // > 12 mins
            const isApproaching = kot.elapsedSeconds > 480 && !isLate && !isCompleted; // > 8 mins
            const minutes = Math.floor(kot.elapsedSeconds / 60);
            const seconds = kot.elapsedSeconds % 60;
            const timeString = `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;

            return (
              <div
                key={kot.id}
                className={`bg-[#181413] border rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-200 ${
                  isCompleted 
                    ? "border-stone-800 opacity-80" 
                    : isLate 
                    ? "border-rose-500 ring-1 ring-rose-500/50 shadow-rose-950/30" 
                    : isApproaching
                    ? "border-amber-500/60 shadow-amber-950/20"
                    : "border-stone-800 hover:border-stone-700"
                }`}
              >
                <div>
                  {/* High Contrast Ticket Header */}
                  <div className={`p-4 border-b flex items-start justify-between ${
                    isCompleted 
                      ? "bg-stone-900/50 border-stone-800" 
                      : isLate 
                      ? "bg-rose-950/25 border-rose-500/30" 
                      : isApproaching
                      ? "bg-amber-950/20 border-amber-500/30"
                      : "bg-[#1f1918] border-stone-800"
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white font-mono tracking-tight">
                          {kot.tableId ? `Table ${kot.tableId.replace("T-", "")}` : "Takeaway"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono font-bold">
                          KOT #{kot.kotNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono mt-1 flex items-center gap-2">
                        <span className="uppercase px-1.5 py-0.2 rounded bg-stone-800 text-stone-300">
                          {kot.placedBy}
                        </span>
                        <span>•</span>
                        <span>{kot.createdAt || "Just Now"}</span>
                      </div>
                    </div>

                    {/* SLA Timer Pill */}
                    <div>
                      {isCompleted ? (
                        <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5" />
                          <span>Cooked ({timeString})</span>
                        </span>
                      ) : (
                        <div
                          className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                            isLate
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                              : isApproaching
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{timeString}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preparation Notes / Captain Alert */}
                  {kot.captainNotes && (
                    <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-[#F4A261] font-medium flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>"{kot.captainNotes}"</span>
                    </div>
                  )}

                  {/* Ordered Items List */}
                  <div className="p-4 space-y-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                      Kitchen Items ({kot.items.length})
                    </span>

                    <div className="space-y-2">
                      {kot.items.map((item, idx) => {
                        const itemKey = `${kot.id}-${item.dishId}-${idx}`;
                        const isDone = isCompleted || item.status === "ready" || checkedItems[itemKey];

                        return (
                          <div
                            key={itemKey}
                            onClick={() => !isCompleted && toggleItemCheck(itemKey, (item as any).id || item.dishId)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isDone
                                ? "bg-stone-900/40 border-stone-800/40 opacity-50"
                                : "bg-[#1e1918] border-stone-800 hover:border-stone-700"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Prep Checkbox */}
                              <div
                                className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-all ${
                                  isDone
                                    ? "bg-emerald-500 border-emerald-500 text-stone-950"
                                    : "border-stone-600 bg-stone-900"
                                }`}
                              >
                                {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold font-mono text-white ${isDone ? "line-through text-stone-500" : ""}`}>
                                    {item.quantity}x
                                  </span>
                                  <span className={`text-sm font-semibold text-stone-100 ${isDone ? "line-through text-stone-500" : ""}`}>
                                    {item.name}
                                  </span>
                                </div>

                                {item.notes && (
                                  <p className="text-[11px] text-[#F4A261] mt-0.5 font-mono italic">
                                    → {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Station Badge */}
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-stone-400">
                              {item.station}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Ticket Footer Action: Bump / Complete / Recall */}
                <div className="p-4 border-t border-stone-800 bg-[#14100f]">
                  {isCompleted ? (
                    <button
                      onClick={() => onRecallKot(kot.id)}
                      className="w-full py-2.5 px-3 rounded-xl bg-stone-900 border border-stone-700 hover:bg-stone-800 text-stone-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Recall to Active Line</span>
                    </button>
                  ) : confirmBumpId === kot.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onBumpKot(kot.id);
                          setConfirmBumpId(null);
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Confirm Bump Ticket</span>
                      </button>
                      <button
                        onClick={() => setConfirmBumpId(null)}
                        className="px-3 py-2.5 rounded-xl bg-stone-800 text-stone-400 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmBumpId(kot.id)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] hover:opacity-95 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>Bump Ticket (Mark Ready)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
