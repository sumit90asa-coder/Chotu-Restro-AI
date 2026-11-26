"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Expense } from "@/types/restaurant";
import { useAuth } from "@/lib/context/AuthContext";
import { 
  Wallet, 
  Plus, 
  Receipt, 
  Banknote, 
  CreditCard, 
  Calendar, 
  Filter,
  ArrowDownLeft,
  CheckCircle2,
  DollarSign
} from "lucide-react";

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newExp, setNewExp] = useState({
    title: "",
    category: "supplies" as Expense["category"],
    amount: "",
    paymentMode: "cash" as Expense["paymentMode"],
    paidTo: "",
    receiptNumber: "",
    notes: "",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const storageKey = user?.restaurantId ? `chotu_expenses_${user.restaurantId}` : "chotu_expenses_default";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setExpenses(JSON.parse(stored));
      } else {
        setExpenses([]);
      }
    } catch {
      setExpenses([]);
    }
  }, [storageKey]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExp.title || !newExp.amount) return;
    const added: Expense = {
      id: `exp-${Date.now().toString().slice(-4)}`,
      title: newExp.title,
      category: newExp.category,
      amount: Number(newExp.amount),
      paymentMode: newExp.paymentMode,
      paidTo: newExp.paidTo || "Vendor",
      recordedBy: user?.fullName || "Staff Member",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      receiptNumber: newExp.receiptNumber || `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: newExp.notes,
    };
    const updated = [added, ...expenses];
    setExpenses(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    showToast(`Logged expense of ₹${added.amount} for "${added.title}"`);
    setShowAddModal(false);
    setNewExp({
      title: "",
      category: "supplies",
      amount: "",
      paymentMode: "cash",
      paidTo: "",
      receiptNumber: "",
      notes: "",
    });
  };

  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const cashPaid = expenses
    .filter((e) => e.paymentMode === "cash")
    .reduce((a, b) => a + b.amount, 0);

  const filteredExpenses = expenses.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="Financial Accounting & Cash Drawer"
        title="Petty Cash & Expense Register"
        subtitle="Track daily restaurant disbursements, cash drawer outflow, vendor payouts, and maintain complete audit compliance."
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Total Recorded Payouts</span>
            <p className="text-xl font-bold text-rose-400 mt-0.5">
              ₹{totalExpense.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-rose-400">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Cash Drawer Disbursements</span>
            <p className="text-xl font-bold text-amber-400 mt-0.5">
              ₹{cashPaid.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-amber-400">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Opening Register Float</span>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">₹5,000.00</p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#181514] border border-stone-800 overflow-x-auto">
        {["all", "supplies", "utilities", "maintenance", "payroll", "marketing"].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
              categoryFilter === cat
                ? "bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/40"
                : "text-stone-400 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl bg-[#181514] border border-stone-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#151211] border-b border-stone-800 text-stone-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Expense Item</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Paid To (Vendor)</th>
                <th className="px-4 py-3.5">Payment Tender</th>
                <th className="px-4 py-3.5">Receipt / Voucher</th>
                <th className="px-4 py-3.5">Amount (₹)</th>
                <th className="px-4 py-3.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-stone-500 font-mono text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-8 h-8 text-stone-600 mb-1" />
                      <p className="font-semibold text-stone-300">No expenses recorded yet</p>
                      <p className="text-[11px] text-stone-500 max-w-sm">
                        Track petty cash, vendor purchases, LPG refills, and cash drawer disbursements by clicking &quot;Record Expense&quot;.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-white text-xs">{exp.title}</p>
                      {exp.notes && (
                        <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">{exp.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 capitalize text-stone-300 font-medium">
                      {exp.category}
                    </td>
                    <td className="px-4 py-4 text-stone-300">{exp.paidTo}</td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-0.5 rounded uppercase font-mono text-[10px] font-bold bg-stone-900 border border-stone-800 text-stone-300">
                        {exp.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-stone-400 text-[11px]">
                      {exp.receiptNumber}
                    </td>
                    <td className="px-4 py-4 font-bold text-rose-400 text-xs">
                      ₹{exp.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-stone-400 text-[11px]">
                      {exp.date}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Operational Payout"
        description="Log vendor invoice or petty cash disbursement"
        maxWidth="sm"
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Expense Title / Item *</label>
            <input
              type="text"
              required
              value={newExp.title}
              onChange={(e) => setNewExp({ ...newExp, title: e.target.value })}
              placeholder="e.g. Ice bag delivery"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                value={newExp.amount}
                onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })}
                placeholder="450"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Category</label>
              <select
                value={newExp.category}
                onChange={(e) => setNewExp({ ...newExp, category: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              >
                <option value="supplies">Supplies</option>
                <option value="utilities">Utilities</option>
                <option value="maintenance">Maintenance</option>
                <option value="payroll">Payroll</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Paid To (Vendor)</label>
              <input
                type="text"
                value={newExp.paidTo}
                onChange={(e) => setNewExp({ ...newExp, paidTo: e.target.value })}
                placeholder="Vendor name"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Tender</label>
              <select
                value={newExp.paymentMode}
                onChange={(e) => setNewExp({ ...newExp, paymentMode: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              >
                <option value="cash">Cash (Drawer)</option>
                <option value="upi">UPI / QR</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Notes / Items Included</label>
            <input
              type="text"
              value={newExp.notes}
              onChange={(e) => setNewExp({ ...newExp, notes: e.target.value })}
              placeholder="e.g. 5 bags of crushed ice for mocktail bar"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
