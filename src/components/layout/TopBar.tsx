"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mic, Sparkles, Activity, Clock, ShieldCheck, HelpCircle, Menu, Bell, Check, Droplets, UserCheck, X } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { wsClient } from "@/lib/api/websocket";

export interface ServiceAlert {
  id: string;
  tableId: string;
  tableLabel: string;
  serviceType: string;
  displayType: string;
  notes?: string;
  timestamp: string;
}

function playChimeSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Autoplay policy fallback
  }
}

interface TopBarProps {
  onOpenVoiceModal: () => void;
  onToggleMobileMenu?: () => void;
}

export function TopBar({ onOpenVoiceModal, onToggleMobileMenu }: TopBarProps) {
  const { user } = useAuth();
  const [clock, setClock] = useState<string>("");
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [showAlertMenu, setShowAlertMenu] = useState<boolean>(false);

  // Load persisted alerts on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("chotu_service_alerts");
      if (stored) {
        setAlerts(JSON.parse(stored));
      }
    } catch {
      // Ignore parse error
    }
  }, []);

  // Sync alerts to localStorage
  const updateAlerts = (newAlerts: ServiceAlert[]) => {
    setAlerts(newAlerts);
    try {
      localStorage.setItem("chotu_service_alerts", JSON.stringify(newAlerts));
    } catch {
      // Ignore storage error
    }
  };

  const dismissAlert = (alertId: string, tableId?: string) => {
    const updated = alerts.filter((a) => a.id !== alertId);
    updateAlerts(updated);
    if (typeof window !== "undefined" && tableId) {
      window.dispatchEvent(new CustomEvent("chotu_service_cleared", { detail: { tableId } }));
    }
  };

  const clearAllAlerts = () => {
    updateAlerts([]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chotu_service_cleared", { detail: { all: true } }));
    }
    setShowAlertMenu(false);
  };

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " IST");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket service requests
  useEffect(() => {
    wsClient.connect(user?.restaurantId);
    const unsubscribe = wsClient.subscribe((evt: any) => {
      const eventType = (evt?.event || evt?.type || "").toLowerCase();
      if (eventType === "service_request") {
        const data = evt.data || evt.payload || {};
        const alertId = `${data.table_id || "tbl"}-${Date.now()}`;
        const newAlert: ServiceAlert = {
          id: alertId,
          tableId: data.table_id || "table",
          tableLabel: data.table_label || "Table",
          serviceType: data.service_type || "water",
          displayType: data.display_type || (data.service_type === "water" ? "Water Service" : "Server Assistance"),
          notes: data.notes || "",
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        };

        setAlerts((prev) => {
          const next = [newAlert, ...prev.filter((a) => a.tableId !== data.table_id)];
          try {
            localStorage.setItem("chotu_service_alerts", JSON.stringify(next));
          } catch {}
          return next;
        });

        playChimeSound();

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("chotu_service_alert", { detail: newAlert }));
        }
      }
    });

    const handleExternalClear = (e: any) => {
      if (e.detail?.tableId) {
        setAlerts((prev) => {
          const next = prev.filter((a) => a.tableId !== e.detail.tableId);
          try {
            localStorage.setItem("chotu_service_alerts", JSON.stringify(next));
          } catch {}
          return next;
        });
      } else if (e.detail?.all) {
        setAlerts([]);
        try {
          localStorage.setItem("chotu_service_alerts", JSON.stringify([]));
        } catch {}
      }
    };

    window.addEventListener("chotu_service_cleared", handleExternalClear);

    return () => {
      unsubscribe();
      window.removeEventListener("chotu_service_cleared", handleExternalClear);
    };
  }, [user?.restaurantId]);

  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <header className="h-16 border-b border-stone-800/80 bg-[#171413]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 relative">
      {/* Left: Outlet & Status */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white cursor-pointer"
            title="Toggle Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-stone-200">{user?.restaurantName || "Restaurant"}</span>
          <span className="text-xs text-stone-500 hidden sm:inline">• {user ? "Live Outlet" : "Cloud"}</span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-800/60 border border-stone-700/50 text-[11px] text-stone-300">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-time Sync Active</span>
        </div>
      </div>

      {/* Center: Real-Time Table Assistance Notification Banner */}
      {latestAlert && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-950/80 to-stone-900/90 border border-amber-500/50 text-amber-200 shadow-lg shadow-amber-950/50 animate-pulse transition-all">
          <span className="text-sm">
            {latestAlert.serviceType === "water" ? "💧" : "🔔"}
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-white font-mono">{latestAlert.tableLabel}:</span>
            <span className="font-medium text-amber-300">{latestAlert.displayType}</span>
          </div>
          <button
            onClick={() => dismissAlert(latestAlert.id, latestAlert.tableId)}
            className="ml-1 p-1 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 hover:text-white transition-colors cursor-pointer"
            title="Mark as Served / Dismiss"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          {alerts.length > 1 && (
            <button
              onClick={() => setShowAlertMenu((prev) => !prev)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300 hover:text-white"
            >
              +{alerts.length - 1} more
            </button>
          )}
        </div>
      )}

      {/* Right: Assistance Bell, Clock & Shortcuts */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Assistance Bell Icon with Badge */}
        <div className="relative">
          <button
            onClick={() => setShowAlertMenu((prev) => !prev)}
            className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
              alerts.length > 0
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/20 animate-bounce"
                : "bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200"
            }`}
            title="Table Service Requests"
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px] flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </button>

          {/* Assistance Dropdown Menu */}
          {showAlertMenu && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#1c1817] border border-stone-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5 font-mono">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  Service Requests ({alerts.length})
                </span>
                {alerts.length > 0 && (
                  <button
                    onClick={clearAllAlerts}
                    className="text-[10px] text-stone-400 hover:text-amber-400 underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">
                  No pending table assistance requests.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        alert.serviceType === "water"
                          ? "bg-sky-950/30 border-sky-800/40 text-sky-200"
                          : "bg-amber-950/30 border-amber-800/40 text-amber-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {alert.serviceType === "water" ? "💧" : "🔔"}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 font-mono font-bold">
                            <span>{alert.tableLabel}</span>
                            <span className="text-[10px] font-normal text-stone-400">({alert.timestamp})</span>
                          </div>
                          <div className="text-[11px] text-stone-300">{alert.displayType}</div>
                          {alert.notes && <div className="text-[10px] text-stone-400 italic">"{alert.notes}"</div>}
                        </div>
                      </div>

                      <button
                        onClick={() => dismissAlert(alert.id, alert.tableId)}
                        className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] font-semibold text-stone-200 flex items-center gap-1 border border-stone-700/60 cursor-pointer"
                      >
                        <Check className="w-3 h-3 text-emerald-400" />
                        Served
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-xs font-mono text-stone-300">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>{clock || "Loading..."}</span>
        </div>

        {/* Quick KDS & POS Shortcuts */}
        <Link
          href="/kds"
          className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-700/80 text-xs font-medium text-stone-200 transition-colors border border-stone-700/40"
        >
          KDS Screen
        </Link>
        <Link
          href="/pos"
          className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E07A5F]/20 hover:bg-[#E07A5F]/30 text-xs font-medium text-[#F4A261] transition-colors border border-[#E07A5F]/30"
        >
          New Bill (POS)
        </Link>

        {/* Chotu AI Voice Button */}
        <button
          onClick={onOpenVoiceModal}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-semibold text-xs shadow-md shadow-[#E07A5F]/20 hover:opacity-95 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Mic className="w-3.5 h-3.5 text-stone-950" />
          <span className="hidden sm:inline">Ask Chotu AI</span>
        </button>
      </div>
    </header>
  );
}
