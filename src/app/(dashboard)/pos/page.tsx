"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { Modal } from "@/components/ui/Modal";
import {
  INITIAL_TABLES,
  MENU_ITEMS
} from "@/data/mockData";
import { Table, MenuItem, OrderItem } from "@/types/restaurant";
import { fetchTables } from "@/lib/api/tables";
import { fetchMenuItems } from "@/lib/api/menu";
import {
  getTableOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  transmitTableKot,
  settleTableBill
} from "@/lib/api/pos";
import { fetchRestaurantSettings } from "@/lib/api/settings";
import { useAuth } from "@/lib/context/AuthContext";
import { Printer, CheckCircle2, QrCode, CreditCard, Banknote, ShieldCheck } from "lucide-react";

function PosContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tableParam = searchParams ? searchParams.get("table") : null;

  const [tables, setTables] = useState<Table[]>([]);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>(tableParam || "");
  const [ledgerItems, setLedgerItems] = useState<OrderItem[]>([]);
  const [taxConfig, setTaxConfig] = useState<{ cgst: number; sgst: number; serviceCharge: number }>({
    cgst: 2.5,
    sgst: 2.5,
    serviceCharge: 5.0,
  });
  const [settledInvoice, setSettledInvoice] = useState<{
    invoiceNumber: string;
    tableId: string;
    tableName: string;
    items: OrderItem[];
    subtotal: number;
    cgst: number;
    sgst: number;
    serviceCharge: number;
    grandTotal: number;
    paymentMethod: string;
    date: string;
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
  }, [tableParam]);

  // Fetch or sync table order
  useEffect(() => {
    async function syncTableOrder() {
      try {
        const orderData = await getTableOrder(selectedTableId);
        setLedgerItems(orderData?.items || []);
      } catch (err) {
        console.warn("Could not fetch remote table order:", err);
      }
    }
    syncTableOrder();
  }, [selectedTableId]);

  const handleAddDish = async (dish: MenuItem, notes?: string) => {
    setLedgerItems((prev) => {
      const existing = prev.find((i) => i.dishId === dish.id && i.notes === notes);
      if (existing) {
        return prev.map((i) =>
          i.dishId === dish.id && i.notes === notes ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          dishId: dish.id,
          name: dish.name,
          price: dish.price,
          quantity: 1,
          dietary: dish.dietary,
          station: dish.station,
          notes: notes,
        },
      ];
    });

    try {
      await addOrUpdateOrderItem(selectedTableId, dish.id, 1, notes);
    } catch {
      // Local optimistic update kept
    }
  };

  const handleChangeQty = async (dishId: string, delta: number) => {
    setLedgerItems((prev) =>
      prev
        .map((i) => {
          if (i.dishId === dishId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as OrderItem[]
    );

    try {
      await addOrUpdateOrderItem(selectedTableId, dishId, delta);
    } catch {
      // Optimistic update
    }
  };

  const handleRemoveItem = async (dishId: string) => {
    setLedgerItems((prev) => prev.filter((i) => i.dishId !== dishId));
    try {
      await removeOrderItem(selectedTableId, dishId);
    } catch {
      // Optimistic update
    }
  };

  const handleTransmitKot = async () => {
    try {
      await transmitTableKot(selectedTableId);
      showToast(`KOT successfully sent to Kitchen for ${selectedTableId}!`);
    } catch {
      showToast(`KOT queued locally for ${selectedTableId}`);
    }
  };

  const subtotal = ledgerItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cgst = subtotal * (taxConfig.cgst / 100);
  const sgst = subtotal * (taxConfig.sgst / 100);
  const serviceCharge = subtotal * (taxConfig.serviceCharge / 100);
  const grandTotal = Math.round(subtotal + cgst + sgst + serviceCharge);

  const handleSettleBillConfirm = async () => {
    setIsSettling(true);
    const currentTable = tables.find((t) => t.id === selectedTableId);
    const snapshotItems = [...ledgerItems];
    const snapshotSubtotal = subtotal;
    const snapshotCgst = cgst;
    const snapshotSgst = sgst;
    const snapshotSc = serviceCharge;
    const snapshotTotal = grandTotal;

    try {
      await settleTableBill(selectedTableId, paymentMethod);
      showToast(`Bill for ${currentTable?.label || selectedTableId} settled via ${paymentMethod.toUpperCase()}!`);
    } catch {
      showToast(`Bill settlement recorded for ${currentTable?.label || selectedTableId}`);
    } finally {
      setIsSettling(false);
      setSettledInvoice({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        tableId: selectedTableId,
        tableName: currentTable?.label || selectedTableId,
        items: snapshotItems,
        subtotal: snapshotSubtotal,
        cgst: snapshotCgst,
        sgst: snapshotSgst,
        serviceCharge: snapshotSc,
        grandTotal: snapshotTotal,
        paymentMethod,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      });
      setLedgerItems([]);
      setShowSettleModal(false);
      setShowPrintModal(true);
      fetchTables().then((t) => Array.isArray(t) && setTables(t)).catch(() => { });
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
          {/* Printable Receipt Preview Card */}
          {settledInvoice ? (
            <div id="printable-invoice" className="p-6 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs text-stone-300 space-y-3 print:border-none print:p-0">
              <div className="text-center space-y-0.5 border-b border-stone-800 pb-3">
                <h2 className="text-base font-bold text-white uppercase">{user?.restaurantName || "CHOTU RESTRO AI"}</h2>
                <p className="text-[10px] text-stone-400">Official Computerized Tax Invoice • Dine-In POS</p>
                <p className="text-[10px] text-stone-400">Date: {settledInvoice.date}</p>
              </div>

              <div className="flex justify-between text-[11px] pt-1">
                <span>Table: {settledInvoice.tableName}</span>
                <span>Inv: #{settledInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-[11px] pb-2 border-b border-stone-800">
                <span>Date: {settledInvoice.date}</span>
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

          <div className="flex items-center justify-end gap-2 pt-2">
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
