"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { Modal } from "@/components/ui/Modal";
import { Table, MenuItem, OrderItem } from "@/types/restaurant";
import { fetchTables } from "@/lib/api/tables";
import { fetchMenuItems } from "@/lib/api/menu";
import {
  getTableOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  transmitTableKot,
  settleTableBill,
  cancelTableOrder
} from "@/lib/api/pos";
import { fetchRestaurantSettings } from "@/lib/api/settings";
import { useAuth } from "@/lib/context/AuthContext";
import { wsClient } from "@/lib/api/websocket";
import { Printer, CheckCircle2, QrCode, CreditCard, Banknote, ShieldCheck } from "lucide-react";

function PosContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tableParam = searchParams ? searchParams.get("table") : null;

  const [tables, setTables] = useState<Table[]>([]);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>(tableParam || "");
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [ledgerItems, setLedgerItems] = useState<OrderItem[]>([]);
  const [taxConfig, setTaxConfig] = useState<{ cgst: number; sgst: number; serviceCharge: number }>({
    cgst: 2.5,
    sgst: 2.5,
    serviceCharge: 5.0,
  });
  const [lastCustomerName, setLastCustomerName] = useState<string>("");
  const [settledInvoice, setSettledInvoice] = useState<{
    invoiceNumber: string;
    tableId: string;
    tableName: string;
    customerName?: string;
    items: OrderItem[];
    subtotal: number;
    cgst: number;
    sgst: number;
    serviceCharge: number;
    grandTotal: number;
    paymentMethod: string;
    date: string;
    time?: string;
  } | null>(null);
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("upi");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (tableParam) {
      setSelectedTableId(tableParam);
    }
  }, [tableParam]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [tableData, menuData, settingsData] = await Promise.all([
          fetchTables().catch(() => []),
          fetchMenuItems().catch(() => []),
          fetchRestaurantSettings().catch(() => null),
        ]);
        if (Array.isArray(tableData) && tableData.length > 0) {
          setTables(tableData);
          if (!tableParam) {
            setSelectedTableId(tableData[0].id);
          }
        }
        if (Array.isArray(menuData)) setDishes(menuData);
        if (settingsData) {
          setTaxConfig({
            cgst: Number(settingsData.cgst_percent ?? 2.5),
            sgst: Number(settingsData.sgst_percent ?? 2.5),
            serviceCharge: Number(settingsData.service_charge_percent ?? 5.0),
          });
        }
      } catch (err) {
        console.warn("Using initial fallback state", err);
      }
    }
    loadInitialData();

    wsClient.connect(user?.restaurantId);
    const unsubscribe = wsClient.subscribe((evt: any) => {
      const eventType = (evt?.event || evt?.type || "").toLowerCase();
      if (eventType === "service_request") {
        const data = evt.data || evt.payload || {};
        const icon = data.service_type === "water" ? "💧" : "🔔";
        showToast(`${icon} Service Call: ${data.table_label || "Table"} requested ${data.display_type || "Assistance"}!`);
      }
    });

    const handleWindowAlert = (e: any) => {
      const alert = e.detail;
      if (alert) {
        const icon = alert.serviceType === "water" ? "💧" : "🔔";
        showToast(`${icon} Service Call: ${alert.tableLabel} requested ${alert.displayType}!`);
      }
    };

    window.addEventListener("chotu_service_alert", handleWindowAlert);

    return () => {
      unsubscribe();
      window.removeEventListener("chotu_service_alert", handleWindowAlert);
    };
  }, [tableParam, user?.restaurantId]);

  // Fetch or sync table order
  useEffect(() => {
    async function syncTableOrder() {
      try {
        const orderData = await getTableOrder(selectedTableId);
        setActiveOrder(orderData?.order || null);
        setLedgerItems(orderData?.items || []);
      } catch (err) {
        console.warn("Could not fetch remote table order:", err);
        setActiveOrder(null);
        setLedgerItems([]);
      }
    }
    syncTableOrder();
  }, [selectedTableId]);

  const handleAddDish = async (dish: MenuItem, notes?: string) => {
    try {
      const res = await addOrUpdateOrderItem(selectedTableId, dish.id, 1, notes);
      setActiveOrder(res.order);
      setLedgerItems(res.items);
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId
            ? { ...t, status: "occupied", currentBill: Number(res.order.total_amount || 0) }
            : t
        )
      );
    } catch (err: any) {
      showToast(err.message || "Failed to add dish to order");
    }
  };

  const handleChangeQty = async (dishId: string, delta: number) => {
    try {
      const res = await addOrUpdateOrderItem(selectedTableId, dishId, delta);
      setActiveOrder(res.order);
      setLedgerItems(res.items);
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId
            ? { ...t, currentBill: Number(res.order.total_amount || 0) }
            : t
        )
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update item quantity");
    }
  };

  const handleRemoveItem = async (dishId: string) => {
    try {
      const res = await removeOrderItem(selectedTableId, dishId);
      setActiveOrder(res.order);
      setLedgerItems(res.items);
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTableId
            ? { ...t, currentBill: Number(res.order.total_amount || 0) }
            : t
        )
      );
    } catch (err: any) {
      showToast(err.message || "Failed to remove item");
    }
  };

  const handleCancelOrder = async () => {
    try {
      await cancelTableOrder(selectedTableId, "Cancelled from POS Terminal");
      showToast(`Active table session cleared and marked Vacant.`);
      setActiveOrder(null);
      setLedgerItems([]);
      const refreshed = await fetchTables();
      if (Array.isArray(refreshed)) setTables(refreshed);
    } catch (err: any) {
      showToast(err.message || "Failed to cancel table order");
    }
  };

  const handleTransmitKot = async (customerName?: string, customerPhone?: string, orderMode?: string) => {
    try {
      if (customerName && customerName.trim()) {
        setLastCustomerName(customerName.trim());
      }
      await transmitTableKot(selectedTableId, undefined, customerName, customerPhone, orderMode);
      showToast(`KOT successfully sent to Kitchen for ${selectedTableId}!`);
      // Refresh order to get any updated status
      const updated = await getTableOrder(selectedTableId);
      if (updated?.order) setActiveOrder(updated.order);
    } catch (err: any) {
      showToast(err.message || `Failed to fire KOT for ${selectedTableId}`);
    }
  };

  const subtotal = ledgerItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cgst = subtotal * (taxConfig.cgst / 100);
  const sgst = subtotal * (taxConfig.sgst / 100);
  const serviceCharge = subtotal * (taxConfig.serviceCharge / 100);
  const grandTotal = Math.round(subtotal + cgst + sgst + serviceCharge);

  const handleSettleBillConfirm = async () => {
    if (ledgerItems.length === 0 || grandTotal <= 0) {
      showToast("Cannot settle empty bill with zero items.");
      return;
    }
    setIsSettling(true);
    const currentTable = tables.find((t) => t.id === selectedTableId);
    const snapshotItems = [...ledgerItems];
    const snapshotSubtotal = subtotal;
    const snapshotCgst = cgst;
    const snapshotSgst = sgst;
    const snapshotSc = serviceCharge;
    const snapshotTotal = grandTotal;

    try {
      const settledRes = await settleTableBill(selectedTableId, paymentMethod);
      showToast(`Bill for ${currentTable?.label || selectedTableId} settled via ${paymentMethod.toUpperCase()}!`);
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

      setSettledInvoice({
        invoiceNumber: settledRes?.order_number || activeOrder?.order_number ? `INV-${settledRes?.order_number || activeOrder?.order_number}` : `INV-${Date.now().toString().slice(-6)}`,
        tableId: selectedTableId,
        tableName: currentTable?.label || selectedTableId,
        customerName: lastCustomerName || activeOrder?.customer_name || undefined,
        items: snapshotItems,
        subtotal: snapshotSubtotal,
        cgst: snapshotCgst,
        sgst: snapshotSgst,
        serviceCharge: snapshotSc,
        grandTotal: snapshotTotal,
        paymentMethod,
        date: dateStr,
        time: timeStr,
      });
      setActiveOrder(null);
      setLedgerItems([]);
      setShowSettleModal(false);
      setShowPrintModal(true);
      fetchTables().then((t) => Array.isArray(t) && setTables(t)).catch(() => { });
    } catch (err: any) {
      showToast(err.message || "Failed to settle bill");
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="relative">
      <PosTerminal
        tables={tables}
        dishes={dishes}
        selectedTableId={selectedTableId}
        onSelectTable={setSelectedTableId}
        ledgerItems={ledgerItems}
        onAddDish={handleAddDish}
        onChangeQty={handleChangeQty}
        onRemoveItem={handleRemoveItem}
        onTransmitKot={handleTransmitKot}
        onSendWhatsApp={() => showToast("Digital receipt link sent to customer WhatsApp!")}
        onSettleBill={() => setShowSettleModal(true)}
        taxConfig={taxConfig}
        activeOrder={activeOrder}
        onCancelOrder={handleCancelOrder}
      />

      {/* Bill Settlement Modal */}
      <Modal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        title={`Settle Bill: Table ${selectedTableId}`}
        description="Select payment tender and complete transaction"
        maxWidth="md"
      >
        <div className="space-y-5">
          {/* Amount Overview */}
          <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between">
            <span className="text-xs text-stone-400">Total Payable (Taxes Inc.)</span>
            <span className="text-xl font-bold text-emerald-400">₹{grandTotal.toLocaleString("en-IN")}</span>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2">Tender Method</label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${paymentMethod === "upi"
                  ? "bg-[#E07A5F]/20 border-[#E07A5F] text-[#F4A261]"
                  : "bg-stone-900 border-stone-800 text-stone-400 hover:text-white"
                  }`}
              >
                <QrCode className="w-5 h-5" />
                <span className="text-xs font-bold">UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${paymentMethod === "cash"
                  ? "bg-[#E07A5F]/20 border-[#E07A5F] text-[#F4A261]"
                  : "bg-stone-900 border-stone-800 text-stone-400 hover:text-white"
                  }`}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-xs font-bold">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${paymentMethod === "card"
                  ? "bg-[#E07A5F]/20 border-[#E07A5F] text-[#F4A261]"
                  : "bg-stone-900 border-stone-800 text-stone-400 hover:text-white"
                  }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Card (EDC)</span>
              </button>
            </div>
          </div>

          {/* Dynamic UPI Preview if UPI is chosen */}
          {paymentMethod === "upi" && (
            <div className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 text-center space-y-2">
              <p className="text-xs font-mono text-stone-300">VPA: {user?.restaurantName ? `${user.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, "")}@upi` : "restaurant@upi"}</p>
              <div className="w-32 h-32 mx-auto bg-white rounded-lg flex items-center justify-center p-2 shadow-md">
                <QrCode className="w-24 h-24 text-stone-950" />
              </div>
              <p className="text-[10px] text-stone-400">Scan via GPay, PhonePe, Paytm or any BHIM UPI</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
            <button
              onClick={() => setShowSettleModal(false)}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              disabled={isSettling || ledgerItems.length === 0}
              onClick={handleSettleBillConfirm}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-xs shadow-lg hover:opacity-95 transition-all"
            >
              {isSettling ? "Recording Payment..." : `Confirm Payment (₹${grandTotal})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Printable Invoice Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Tax Invoice Generated"
        description="Official restaurant receipt with GST details"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Printable Receipt Preview Card (Screen Preview) */}
          {settledInvoice ? (
            <div className="p-6 rounded-xl bg-stone-900 border border-stone-800 font-mono text-xs text-stone-200 space-y-3 shadow-inner print:hidden">
              <div className="text-center space-y-0.5 border-b border-stone-800 pb-3">
                <h2 className="text-base font-bold text-white uppercase">{user?.restaurantName || "CHOTU RESTRO AI"}</h2>
                <p className="text-[10px] text-stone-400">Official Computerized Tax Invoice • Dine-In POS</p>
                <p className="text-[10px] text-stone-400">Date: {settledInvoice.date} {settledInvoice.time || ""}</p>
              </div>

              <div className="flex justify-between text-[11px] pt-1">
                <span>Table: {settledInvoice.tableName}</span>
                <span>Inv: #{settledInvoice.invoiceNumber}</span>
              </div>
              {settledInvoice.customerName && (
                <div className="flex justify-between text-[11px] text-stone-300">
                  <span>Customer: {settledInvoice.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] pb-2 border-b border-stone-800">
                <span>Date: {settledInvoice.date} {settledInvoice.time || ""}</span>
                <span>Payment: {settledInvoice.paymentMethod.toUpperCase()}</span>
              </div>

              <div className="divide-y divide-stone-800/60 py-2">
                <div className="flex justify-between font-bold text-stone-400 pb-1 text-[10px] uppercase">
                  <span>Item</span>
                  <span>Qty x Rate</span>
                  <span>Amount</span>
                </div>
                {settledInvoice.items.length === 0 ? (
                  <div className="py-2 text-center text-stone-500 font-mono text-[11px]">
                    No discrete items billed
                  </div>
                ) : (
                  settledInvoice.items.map((it, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between">
                      <span className="truncate max-w-[180px]">{it.name}</span>
                      <span>{it.quantity} x ₹{it.price}</span>
                      <span>₹{(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1 pt-2 border-t border-stone-800 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{settledInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>CGST ({taxConfig.cgst}%):</span>
                  <span>₹{settledInvoice.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>SGST ({taxConfig.sgst}%):</span>
                  <span>₹{settledInvoice.sgst.toFixed(2)}</span>
                </div>
                {settledInvoice.serviceCharge > 0 && (
                  <div className="flex justify-between text-stone-400">
                    <span>Service Charge ({taxConfig.serviceCharge}%):</span>
                    <span>₹{settledInvoice.serviceCharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-stone-700">
                  <span>GRAND TOTAL:</span>
                  <span className="text-emerald-400">₹{settledInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-stone-800 text-[10px] text-stone-500">
                Thank you for dining with us! Visit again.
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-stone-500 font-mono text-xs">
              No invoice details available to print.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 print:hidden">
            <button
              onClick={() => setShowPrintModal(false)}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium"
            >
              Close
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print Tax Invoice</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Pure Print-Only Thermal Tax Invoice (Root Level - No Modal Clipping) */}
      {settledInvoice && (
        <div
          id="printable-invoice"
          className="hidden print:block font-mono text-black text-[12px] leading-tight"
        >
          {/* Thermal Receipt Header */}
          <div className="text-center pb-2 border-b-2 border-dashed border-black space-y-1">
            <h1 className="text-base font-extrabold uppercase tracking-wide">
              {user?.restaurantName || "CHOTU RESTRO AI"}
            </h1>
            <p className="text-[11px] font-semibold uppercase">
              Official Tax Invoice • Dine-In POS
            </p>
            <div className="text-[10px] pt-1 flex justify-between px-1">
              <span>Date: {settledInvoice.date} {settledInvoice.time || ""}</span>
              <span className="font-bold">INV: #{settledInvoice.invoiceNumber}</span>
            </div>
            <div className="text-[10px] flex justify-between px-1">
              <span>Table: <strong className="uppercase">{settledInvoice.tableName}</strong></span>
              <span>Payment: <strong className="uppercase">{settledInvoice.paymentMethod}</strong></span>
            </div>
            {settledInvoice.customerName && (
              <div className="text-[10px] text-left px-1">
                <span>Customer: <strong>{settledInvoice.customerName}</strong></span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-2 border-b-2 border-dashed border-black">
            <div className="grid grid-cols-12 font-bold pb-1 text-[11px] uppercase border-b border-black">
              <span className="col-span-6">Item</span>
              <span className="col-span-3 text-center">Qty x Rate</span>
              <span className="col-span-3 text-right">Amount</span>
            </div>
            <div className="divide-y divide-gray-200">
              {settledInvoice.items.length === 0 ? (
                <div className="py-2 text-center text-gray-500 italic text-[11px]">
                  No discrete items billed
                </div>
              ) : (
                settledInvoice.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 py-1 text-[11px]">
                    <span className="col-span-6 font-medium break-words pr-1">{it.name}</span>
                    <span className="col-span-3 text-center">{it.quantity} x ₹{it.price}</span>
                    <span className="col-span-3 text-right font-semibold">₹{(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="py-2 space-y-1 text-[11px] border-b-2 border-dashed border-black">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{settledInvoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>CGST ({taxConfig.cgst}%):</span>
              <span>₹{settledInvoice.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>SGST ({taxConfig.sgst}%):</span>
              <span>₹{settledInvoice.sgst.toFixed(2)}</span>
            </div>
            {settledInvoice.serviceCharge > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Service Charge ({taxConfig.serviceCharge}%):</span>
                <span>₹{settledInvoice.serviceCharge.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] font-extrabold pt-1.5 border-t border-black">
              <span>GRAND TOTAL:</span>
              <span>₹{settledInvoice.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-2 space-y-0.5 text-[10px] text-gray-600">
            <p className="font-bold text-black uppercase">Thank you for dining with us!</p>
            <p>Visit again soon</p>
            <p className="text-[9px] text-gray-400 pt-1">Powered by Chotu Restro AI</p>
          </div>
        </div>
      )}

      {/* Floating toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-stone-500">Loading POS Terminal...</div>}>
      <PosContent />
    </Suspense>
  );
}
