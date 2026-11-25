"use client";

import React, { useState, useEffect } from "react";
import { LiveOrdersHub } from "@/components/orders/LiveOrdersHub";
import { fetchLiveOrders, updateOrderStatus } from "@/lib/api/orders";
import { LiveOrder, AggregatorChannel } from "@/types/restaurant";
import { INITIAL_LIVE_ORDERS, INITIAL_AGGREGATORS } from "@/data/mockData";
import { wsClient } from "@/lib/api/websocket";

export default function OrdersPage() {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [channels, setChannels] = useState<AggregatorChannel[]>(INITIAL_AGGREGATORS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadOrders = async () => {
    try {
      const data = await fetchLiveOrders();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (err) {
      console.warn("Using initial live orders fallback:", err);
    }
  };

  useEffect(() => {
    loadOrders();

    wsClient.connect();
    const unsubscribe = wsClient.subscribe((evt) => {
      if (evt.type === "order_created" || evt.type === "order_updated") {
        loadOrders();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleChannel = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          const next = !c.isOpen;
          showToast(`${c.displayName} order accepting channel is now ${next ? "ONLINE" : "OFFLINE"}`);
          return { ...c, isOpen: next };
        }
        return c;
      })
    );
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: LiveOrder["status"]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await updateOrderStatus(orderId, newStatus);
      showToast(`Order #${orderId} moved to "${newStatus.toUpperCase()}"`);
    } catch {
      showToast(`Order status updated locally`);
    }
  };

  return (
    <div className="relative">
      <LiveOrdersHub
        orders={orders}
        channels={channels}
        onToggleChannel={handleToggleChannel}
        onUpdateOrderStatus={handleUpdateOrderStatus}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
