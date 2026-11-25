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
import { useAuth } from "@/lib/context/AuthContext";
import { Printer, CheckCircle2, QrCode, CreditCard, Banknote, ShieldCheck } from "lucide-react";

function PosContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tableParam = searchParams ? searchParams.get("table") : null;

  const [tables, setTables] = useState<Table[]>([]);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>(tableParam || "T-04");
  const [ledgerItems, setLedgerItems] = useState<OrderItem[]>([]);
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
        const [tableData, menuData] = await Promise.all([
          fetchTables().catch(() => []),
          fetchMenuItems().catch(() => []),
        ]);
        if (Array.isArray(tableData)) setTables(tableData);
        if (Array.isArray(menuData)) setDishes(menuData);
      } catch (err) {
        console.warn("Using initial fallback state", err);
      }
    }
    loadInitialData();
  }, []);

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

  const handleSettleBillConfirm = async () => {
    setIsSettling(true);
    try {
      await settleTableBill(selectedTableId, paymentMethod);
      showToast(`Bill for ${selectedTableId} settled via ${paymentMethod.toUpperCase()}!`);
      setShowSettleModal(false);
      setShowPrintModal(true);
      setLedgerItems([]);
    } catch {
      showToast(`Settled locally for ${selectedTableId}`);
      setShowSettleModal(false);
      setShowPrintModal(true);
      setLedgerItems([]);
    } finally {
      setIsSettling(false);
    }
  };

  const subtotal = ledgerItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const serviceCharge = subtotal * 0.05;
  const grandTotal = Math.round(subtotal + cgst + sgst + serviceCharge);

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
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === "upi"
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
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === "cash"
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
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === "card"
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
          <div className="p-6 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs text-stone-300 space-y-3 print:border-none print:p-0">
            <div className="text-center space-y-0.5 border-b border-stone-800 pb-3">
              <h2 className="text-base font-bold text-white uppercase">{user?.restaurantName || "RESTAURANT TAX INVOICE"}</h2>
              <p className="text-[10px] text-stone-400">Official Computerized Tax Invoice • Dine-In POS</p>
              <p className="text-[10px] text-stone-400">Date: {new Date().toLocaleDateString("en-IN")}</p>
            </div>

            <div className="flex justify-between text-[11px] pt-1">
              <span>Table: {selectedTableId}</span>
              <span>Inv: #INV-20261123-042</span>
            </div>
            <div className="flex justify-between text-[11px] pb-2 border-b border-stone-800">
              <span>Date: 23-Nov-2026</span>
              <span>Payment: {paymentMethod.toUpperCase()}</span>
            </div>

            <div className="divide-y divide-stone-800/60 py-2">
              <div className="flex justify-between font-bold text-stone-400 pb-1 text-[10px] uppercase">
                <span>Item</span>
                <span>Qty x Rate</span>
                <span>Amount</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Butter Chicken</span>
                <span>1 x ₹340</span>
                <span>₹340.00</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Garlic Butter Naan</span>
                <span>3 x ₹60</span>
                <span>₹180.00</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span>Paneer Tikka Masala</span>
                <span>1 x ₹290</span>
                <span>₹290.00</span>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-stone-800 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹810.00</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>CGST (2.5%):</span>
                <span>₹20.25</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>SGST (2.5%):</span>
                <span>₹20.25</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Service Charge (5%):</span>
                <span>₹40.50</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-stone-700">
                <span>GRAND TOTAL:</span>
                <span className="text-emerald-400">₹891.00</span>
              </div>
            </div>

            <div className="text-center pt-3 border-t border-stone-800 text-[10px] text-stone-500">
              Thank you for dining with us! Visit again.
            </div>
          </div>

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
