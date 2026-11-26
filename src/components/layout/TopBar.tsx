"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mic, Sparkles, Activity, Clock, ShieldCheck, HelpCircle, Menu } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

interface TopBarProps {
  onOpenVoiceModal: () => void;
  onToggleMobileMenu?: () => void;
}

export function TopBar({ onOpenVoiceModal, onToggleMobileMenu }: TopBarProps) {
  const { user } = useAuth();
  const [clock, setClock] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " IST");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-stone-800/80 bg-[#171413]/95 backdrop-blur-md px-6 flex items-center justify-between z-20">
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
          <span className="text-xs text-stone-500">• {user ? "Live Outlet" : "Cloud"}</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-800/60 border border-stone-700/50 text-[11px] text-stone-300">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-time Sync Active</span>
        </div>
      </div>

      {/* Right: Clock & Chotu AI Trigger */}
      <div className="flex items-center gap-3">
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
          <span>Ask Chotu AI</span>
        </button>
      </div>
    </header>
  );
}
