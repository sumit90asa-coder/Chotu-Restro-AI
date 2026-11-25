"use client";

import React, { useState, useEffect } from "react";
import { KitchenDisplay } from "@/components/kds/KitchenDisplay";
import { fetchKDSTickets, bumpKOT, recallKOT, toggleKOTItem } from "@/lib/api/kds";
import { KOT } from "@/types/restaurant";
import { INITIAL_KOTS } from "@/data/mockData";
import { wsClient } from "@/lib/api/websocket";

export default function KdsPage() {
  const [kots, setKots] = useState<KOT[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadTickets = async () => {
    try {
      const data = await fetchKDSTickets();
      if (Array.isArray(data)) {
        setKots(data);
      }
    } catch (err) {
      console.warn("Error fetching KOT tickets:", err);
    }
  };

  useEffect(() => {
    loadTickets();

    // Connect real-time WebSocket for live kitchen tickets
    wsClient.connect();
    const unsubscribe = wsClient.subscribe((event) => {
      if (event.type === "kot_created" || event.type === "kot_updated" || event.type === "order_created") {
        loadTickets();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBumpKot = async (kotId: string) => {
    setKots((prev) =>
      prev.map((k) => (k.id === kotId ? { ...k, status: "bumped" } : k))
    );
    try {
      await bumpKOT(kotId);
      showToast(`KOT #${kotId} bumped and marked ready!`);
    } catch {
      showToast(`KOT #${kotId} bumped locally`);
    }
  };

  const handleRecallKot = async (kotId: string) => {
    setKots((prev) =>
      prev.map((k) => (k.id === kotId ? { ...k, status: "cooking" } : k))
    );
    try {
      await recallKOT(kotId);
      showToast(`KOT #${kotId} recalled back to active queue!`);
    } catch {
      showToast(`KOT #${kotId} recalled locally`);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    try {
      await toggleKOTItem(itemId);
    } catch (err) {
      console.warn("Toggle item KDS:", err);
    }
  };

  return (
    <div className="relative">
      <KitchenDisplay
        kots={kots}
        onBumpKot={handleBumpKot}
        onRecallKot={handleRecallKot}
        onToggleItem={handleToggleItem}
        onRefresh={loadTickets}
        isWsConnected={true}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
