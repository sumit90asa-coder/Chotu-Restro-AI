"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Receipt, 
  Grid3X3, 
  ShoppingBag, 
  UtensilsCrossed, 
  Bike, 
  BookOpen, 
  Package, 
  Users, 
  UserCheck, 
  Wallet, 
  Bot, 
  Sparkles, 
  BarChart3, 
  Tag, 
  Settings, 
  ExternalLink, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Flame,
  QrCode
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

interface NavGroup {
  label: string;
  items: {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "OPERATIONS",
    items: [
      { name: "Executive Cockpit", href: "/dashboard", icon: LayoutDashboard },
      { name: "POS Terminal", href: "/pos", icon: Receipt },
      { name: "Floor & Tables", href: "/tables", icon: Grid3X3 },
      { name: "Live Orders Hub", href: "/orders", icon: ShoppingBag, badge: "Live" },
      { name: "Kitchen (KDS)", href: "/kds", icon: UtensilsCrossed },
      { name: "Delivery Dispatch", href: "/delivery", icon: Bike },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { name: "Menu & Pricing", href: "/menu", icon: BookOpen },
      { name: "Inventory & Stock", href: "/inventory", icon: Package },
      { name: "Customer CRM", href: "/customers", icon: Users },
      { name: "Staff & Shifts", href: "/staff", icon: UserCheck },
      { name: "Petty Cash & Expense", href: "/expenses", icon: Wallet },
    ],
  },
  {
    label: "INTELLIGENCE & GROWTH",
    items: [
      { name: "Chotu Voice AI", href: "/ai", icon: Bot, badge: "AI" },
      { name: "Daily Pulse & Insights", href: "/insights", icon: Sparkles },
      { name: "Reports & Z-Report", href: "/analytics", icon: BarChart3 },
      { name: "Marketing & Promos", href: "/marketing", icon: Tag },
      { name: "QR Codes & Table Cards", href: "/qr/codes", icon: QrCode },
      { name: "Settings & Profile", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  return (
    <aside
      className={`relative flex flex-col h-screen border-r border-stone-800/80 bg-[#141211] text-stone-300 transition-all duration-300 z-30 select-none ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className={`flex items-center ${collapsed ? "justify-center px-2 relative" : "justify-between px-4"} h-16 border-b border-stone-800/80 bg-[#191615]`}>
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden" title={collapsed ? "Chotu Restro AI" : undefined}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E07A5F] to-[#F4A261] flex items-center justify-center text-white font-bold shadow-md shadow-[#E07A5F]/20 flex-shrink-0">
            <Flame className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-wide text-white truncate">Chotu Restro AI</span>
              <span className="text-[10px] text-stone-400 font-mono uppercase tracking-wider truncate">{user?.restaurantName || "My Restaurant"}</span>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1.5 text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors ${
            collapsed ? "absolute -right-3 top-5 bg-[#191615] border border-stone-700/80 shadow-md z-40 rounded-full" : "rounded-lg"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6 scrollbar-thin scrollbar-thumb-stone-800">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-semibold text-stone-500 tracking-wider uppercase font-mono mb-1.5">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-[#E07A5F]/15 text-[#F4A261] font-semibold shadow-sm border border-[#E07A5F]/30"
                      : "text-stone-400 hover:text-stone-100 hover:bg-stone-800/50"
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? "text-[#E07A5F]" : "text-stone-400"}`} />
                  {!collapsed && <span className="truncate flex-1">{item.name}</span>}
                  {!collapsed && item.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[#E07A5F]/20 text-[#E07A5F] border border-[#E07A5F]/30">
                      {item.badge}
                    </span>
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Profile & Landing Link */}
      <div className="p-3 border-t border-stone-800/80 bg-[#161413] space-y-2">
        <Link
          href="/landing"
          target="_blank"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 transition-colors"
          title="Open Landing Page in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
          {!collapsed && <span className="text-[11px] truncate">Public Landing Page</span>}
        </Link>

        <div className="flex items-center justify-between pt-2 border-t border-stone-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user?.fullName ? user.fullName[0] : "R"}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-stone-200 truncate">{user?.fullName || "Staff Member"}</span>
                <span className="text-[10px] text-emerald-400 font-mono capitalize truncate">{user?.role || "Manager"}</span>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
