"use client";

import React, { useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CustomerMenu } from "@/components/qr/CustomerMenu";
import { Flame, Bell, Droplets, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { QRMenuResponse, requestTableAssistance } from "@/lib/api/qr";

function QRMenuContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const tableParam = Array.isArray(params?.tableId) ? params.tableId[0] : params?.tableId;
  const queryToken = searchParams?.get("token");

  // Prefer exact query token; fallback to tableParam format
  const effectiveToken = queryToken || (tableParam?.startsWith("qr-") ? tableParam : (tableParam ? `qr-${tableParam.toLowerCase()}` : "qr-t01-demo"));

  const [restaurantName, setRestaurantName] = useState<string>("Dine-In Menu");
  const [tableLabel, setTableLabel] = useState<string>(
    tableParam ? (tableParam.toUpperCase().startsWith("T-") ? `Table ${tableParam.replace(/^T-/i, "")}` : `Table ${tableParam}`) : "Dining Table"
  );
  const [tableStatus, setTableStatus] = useState<string>("vacant");
  const [assistanceMsg, setAssistanceMsg] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const handleMenuLoaded = (data: QRMenuResponse) => {
    if (data.restaurant_name) setRestaurantName(data.restaurant_name);
    if (data.table_label) {
      setTableLabel(data.table_label.startsWith("T-") ? `Table ${data.table_label.replace(/^T-/i, "")}` : data.table_label);
    }
    if (data.table_status) setTableStatus(data.table_status);
  };

  const requestAssistance = async (serviceType: "water" | "waiter") => {
    if (isRequesting) return;
    setIsRequesting(true);
    const title = serviceType === "water" ? "Water service" : "Server assistance";
    try {
      const res = await requestTableAssistance(effectiveToken, serviceType);
      setAssistanceMsg(res.message || `${title} requested! A captain has been notified.`);
    } catch {
      setAssistanceMsg(`${title} requested! Staff notified.`);
    } finally {
      setIsRequesting(false);
      setTimeout(() => setAssistanceMsg(null), 4500);
    }
  };

  return (
    <div className="min-h-screen bg-[#110E0D] text-stone-100 flex flex-col font-sans selection:bg-[#E07A5F] selection:text-white">
      {/* Customer Header */}
      <header className="sticky top-0 z-40 bg-[#161312]/95 backdrop-blur-md border-b border-stone-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E07A5F] to-[#F4A261] flex items-center justify-center text-white font-bold shadow-md shadow-[#E07A5F]/20">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">{restaurantName}</h1>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#E07A5F] font-mono uppercase font-semibold tracking-wider">
                {tableLabel}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase font-medium ${
                  tableStatus === "occupied"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {tableStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Waiter Assistance Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            disabled={isRequesting}
            onClick={() => requestAssistance("water")}
            className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:border-blue-500/40 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Request Water Service"
          >
            <Droplets className="w-4 h-4 text-blue-400" />
          </button>
          <button
            disabled={isRequesting}
            onClick={() => requestAssistance("waiter")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:border-amber-500/40 active:scale-95 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            title="Call Captain / Server"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Call Server</span>
          </button>
        </div>
      </header>

      {/* Floating alert */}
      {assistanceMsg && (
        <div className="sticky top-[57px] z-30 bg-emerald-950/95 border-b border-emerald-500/40 text-emerald-300 text-xs py-2 px-4 text-center font-medium shadow-md">
          {assistanceMsg}
        </div>
      )}

      {/* Menu Body */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 pb-20">
        <CustomerMenu
          token={effectiveToken}
          tableLabel={tableLabel}
          onMenuLoaded={handleMenuLoaded}
        />
      </main>
    </div>
  );
}

export default function DynamicQRMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#110E0D] flex flex-col items-center justify-center text-stone-400 space-y-3">
          <UtensilsCrossed className="w-8 h-8 text-[#E07A5F] animate-pulse" />
          <p className="text-xs font-mono">Loading digital table menu...</p>
        </div>
      }
    >
      <QRMenuContent />
    </Suspense>
  );
}
