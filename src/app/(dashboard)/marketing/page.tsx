"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Coupon } from "@/types/restaurant";
import {
  fetchCoupons,
  createCoupon as apiCreateCoupon,
  toggleCouponStatus as apiToggleCouponStatus,
  deleteCoupon as apiDeleteCoupon,
} from "@/lib/api/marketing";
import { 
  Tag, 
  Plus, 
  Send, 
  Check, 
  Percent, 
  Gift, 
  MessageSquare, 
  Copy,
  TrendingUp,
  Sparkles,
  Power,
  Trash2
} from "lucide-react";

export default function MarketingPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    description: "",
    discountType: "percentage" as Coupon["discountType"],
    discountValue: "",
    minOrderValue: "",
    maxDiscount: "",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const data = await fetchCoupons();
        if (Array.isArray(data)) {
          const mapped: Coupon[] = data.map((d: any) => ({
            id: d.id,
            code: d.code,
            description: d.description || "",
            discountType: (d.discount_type || d.discountType || "percentage") as any,
            discountValue: Number(d.discount_value ?? d.discountValue ?? 0),
            minOrderValue: Number(d.min_order_value ?? d.minOrderValue ?? 0),
            maxDiscount: d.max_discount ? Number(d.max_discount) : undefined,
            usageLimit: d.usage_limit || 1000,
            usedCount: d.used_count || 0,
            expiresAt: d.expires_at ? new Date(d.expires_at).toLocaleDateString() : "31-Dec-2026",
            isActive: Boolean(d.is_active ?? d.isActive ?? true),
          }));
          setCoupons(mapped);
          return;
        }
      } catch (err) {
        console.warn("Error fetching coupons:", err);
      }
      setCoupons([]);
    };

    loadCoupons();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discountValue) return;
    try {
      const created = await apiCreateCoupon({
        code: newCoupon.code.toUpperCase(),
        description: newCoupon.description || "Special promotional offer",
        discount_type: newCoupon.discountType as any,
        discount_value: Number(newCoupon.discountValue),
        min_order_value: Number(newCoupon.minOrderValue) || 0,
        max_discount: newCoupon.maxDiscount ? Number(newCoupon.maxDiscount) : undefined,
      });

      const added: Coupon = {
        id: created.id,
        code: created.code,
        description: created.description || "Special promotional offer",
        discountType: created.discount_type as any,
        discountValue: Number(created.discount_value),
        minOrderValue: Number(created.min_order_value) || 0,
        maxDiscount: created.max_discount ? Number(created.max_discount) : undefined,
        usageLimit: created.usage_limit || 1000,
        usedCount: created.used_count || 0,
        expiresAt: created.expires_at ? new Date(created.expires_at).toLocaleDateString() : "31-Dec-2026",
        isActive: created.is_active,
      };

      const updated = [added, ...coupons];
      setCoupons(updated);
      try {
        localStorage.setItem("chotu_coupons", JSON.stringify(updated));
      } catch {}
      showToast(`Promo code ${added.code} saved to PostgreSQL database and active!`);
    } catch (err: any) {
      showToast(err.message || "Failed to create promo code on server.");
    }

    setShowAddModal(false);
    setNewCoupon({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "",
      minOrderValue: "",
      maxDiscount: "",
    });
  };

  const handleToggleStatus = async (couponId: string) => {
    try {
      const toggled = await apiToggleCouponStatus(couponId);
      const updated = coupons.map((c) => {
        if (c.id === couponId) {
          const next = toggled.is_active;
          showToast(`Promo code ${c.code} is now ${next ? "ACTIVE" : "DISABLED"} in database`);
          return { ...c, isActive: next };
        }
        return c;
      });
      setCoupons(updated);
      try {
        localStorage.setItem("chotu_coupons", JSON.stringify(updated));
      } catch {}
    } catch (err: any) {
      // Local fallback with warning
      const updated = coupons.map((c) => {
        if (c.id === couponId) {
          const next = !c.isActive;
          showToast(`Promo code ${c.code} updated locally: ${next ? "ACTIVE" : "DISABLED"}`);
          return { ...c, isActive: next };
        }
        return c;
      });
      setCoupons(updated);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      await apiDeleteCoupon(couponId);
      const updated = coupons.filter((c) => c.id !== couponId);
      setCoupons(updated);
      showToast("Promo code deleted from database");
      try {
        localStorage.setItem("chotu_coupons", JSON.stringify(updated));
      } catch {}
    } catch (err: any) {
      const updated = coupons.filter((c) => c.id !== couponId);
      setCoupons(updated);
      showToast("Promo code removed");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`Copied code "${code}" to clipboard!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="Growth & Campaigns"
        title="Promotions & Discount Codes"
        subtitle="Create discount vouchers, configure minimum order thresholds, and broadcast WhatsApp & SMS promotional campaigns."
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promo Code</span>
          </button>
        }
      />

      {/* Campaign Broadcast Templates */}
      <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
            Instant Broadcast Templates (WhatsApp & SMS)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-white block mb-1">
                Weekend Biryani & Curry Fest
              </span>
              <p className="text-[11px] text-stone-400">
                "Craving authentic dining? Use code <strong>WELCOME20</strong> to get 20% off this weekend at our restaurant!"
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-stone-800 flex justify-between items-center">
              <span className="text-[10px] text-stone-500">Target: 342 Enrolled Guests</span>
              <button
                onClick={() => showToast("Simulated campaign broadcast sent to 342 guests!")}
                className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
              >
                Send Broadcast
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-900/80 border border-stone-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-white block mb-1">
                Happy Hour 5 PM - 8 PM
              </span>
              <p className="text-[11px] text-stone-400">
                "Unwind with mocktails & starters at 15% off! Scan table QR code before 8 PM to enjoy happy hour specials."
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-stone-800 flex justify-between items-center">
              <span className="text-[10px] text-stone-500">Target: In-store Dine-in</span>
              <button
                onClick={() => showToast("Happy hour prompt activated across all table QR codes!")}
                className="px-3 py-1 rounded-lg bg-[#E07A5F]/20 text-[#F4A261] text-xs font-bold hover:bg-[#E07A5F]/30 transition-colors"
              >
                Activate on QR Menu
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Coupons Grid */}
      {coupons.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#181514] border border-stone-800 space-y-3">
          <Tag className="w-10 h-10 mx-auto text-stone-600" />
          <h3 className="text-sm font-bold text-stone-200">No Promo Codes Created</h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Boost customer retention and QR self-ordering by creating discount vouchers and seasonal promo codes.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all mt-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Promo Code</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className={`p-5 rounded-2xl bg-[#181514] border transition-all shadow-lg relative overflow-hidden flex flex-col justify-between ${
                coupon.isActive
                  ? "border-stone-800 hover:border-stone-700"
                  : "border-stone-800/40 opacity-60 bg-stone-950/60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-3 py-1 rounded-xl font-mono font-bold text-sm tracking-wider ${
                      coupon.isActive
                        ? "bg-[#E07A5F]/20 border border-[#E07A5F]/40 text-[#F4A261]"
                        : "bg-stone-800 border border-stone-700 text-stone-500 line-through"
                    }`}
                  >
                    {coupon.code}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono border ${
                      coupon.isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-stone-800 text-stone-400 border-stone-700"
                    }`}
                  >
                    {coupon.isActive ? "Active" : "Disabled"}
                  </span>
                </div>

                <p className="text-xs font-semibold text-white mb-2">{coupon.description}</p>

                <div className="space-y-1.5 text-[11px] text-stone-400 mb-4">
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className={coupon.isActive ? "text-emerald-400 font-bold" : "text-stone-500"}>
                      {coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} FLAT`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Order:</span>
                    <span className="text-stone-300 font-mono">₹{coupon.minOrderValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Redeemed:</span>
                    <span className="text-stone-300 font-mono">{coupon.usedCount} times</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                <span className="text-[10px] text-stone-500 font-mono">Expires: {coupon.expiresAt}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleStatus(coupon.id)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      coupon.isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700"
                    }`}
                    title={coupon.isActive ? "Disable Promo Code" : "Enable Promo Code"}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => copyCode(coupon.code)}
                    className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 transition-colors"
                    title="Copy Code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id)}
                    className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-rose-500/20 hover:text-rose-400 text-stone-400 transition-colors"
                    title="Delete Promo Code"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Coupon Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create New Promo Code"
        description="Set discount rule and order constraints"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateCoupon} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Coupon Code (Uppercase) *</label>
            <input
              type="text"
              required
              value={newCoupon.code}
              onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
              placeholder="e.g. FESTIVE25"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Offer Description</label>
            <input
              type="text"
              value={newCoupon.description}
              onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
              placeholder="e.g. 25% off on orders above ₹600"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Type</label>
              <select
                value={newCoupon.discountType}
                onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Value *</label>
              <input
                type="number"
                required
                value={newCoupon.discountValue}
                onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
                placeholder="20"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Minimum Order Value (₹)</label>
            <input
              type="number"
              value={newCoupon.minOrderValue}
              onChange={(e) => setNewCoupon({ ...newCoupon, minOrderValue: e.target.value })}
              placeholder="500"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono"
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
              Activate Code
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
