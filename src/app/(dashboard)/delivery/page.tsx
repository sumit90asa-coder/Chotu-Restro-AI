"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { 
  fetchDeliveryOrders, 
  dispatchDeliveryOrder, 
  verifyDeliveryOTP,
  regenerateDeliveryOTP,
  managerOverrideDelivery,
  DeliveryOrderData 
} from "@/lib/api/delivery";
import { useAuth } from "@/lib/context/AuthContext";
import { 
  Bike, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Search,
  ShieldCheck,
  RefreshCw,
  KeyRound
} from "lucide-react";

export default function DeliveryPage() {
  const { user } = useAuth();
  const isManagerOrOwner = user?.role === "owner" || user?.role === "manager";
  const [orders, setOrders] = useState<DeliveryOrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dispatch Modal
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrderData | null>(null);
  const [assignRiderModal, setAssignRiderModal] = useState<boolean>(false);
  const [riderInput, setRiderInput] = useState<{ name: string; phone: string }>({
    name: "Raju Shinde (Direct Fleet)",
    phone: "+91 98200 99112",
  });
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [dispatchedOTP, setDispatchedOTP] = useState<string | null>(null);

  // OTP Verification Modal
  const [verifyModal, setVerifyModal] = useState<boolean>(false);
  const [verifyOtpInput, setVerifyOtpInput] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);
  const [managerOtpPreview, setManagerOtpPreview] = useState<string | null>(null);
  const [regeneratingOtp, setRegeneratingOtp] = useState<boolean>(false);
  const [overriding, setOverriding] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadOrders = async (st?: string) => {
    try {
      setLoading(true);
      const data = await fetchDeliveryOrders(st === "all" ? undefined : st);
      setOrders(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load delivery orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(statusFilter);
  }, [statusFilter]);

  const handleDispatch = async () => {
    if (!selectedOrder) return;
    try {
      setDispatching(true);
      const res = await dispatchDeliveryOrder(selectedOrder.id, {
        rider_name: riderInput.name,
        rider_phone: riderInput.phone,
      });
      setDispatchedOTP(res.delivery_otp);
      showToast(`Order #${selectedOrder.order_number} dispatched! OTP generated.`);
      await loadOrders(statusFilter);
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch order");
    } finally {
      setDispatching(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!selectedOrder || !verifyOtpInput) return;
    try {
      setVerifying(true);
      const res = await verifyDeliveryOTP(selectedOrder.id, verifyOtpInput.trim());
      if (res.verified || res.status === "verified") {
        showToast(`Delivery handover verified! Order #${selectedOrder.order_number} marked Delivered.`);
        setVerifyModal(false);
        setVerifyOtpInput("");
        setSelectedOrder(null);
        await loadOrders(statusFilter);
      }
    } catch (err: any) {
      showToast(err.message || "Invalid OTP code or max attempts exceeded");
      await loadOrders(statusFilter);
    } finally {
      setVerifying(false);
    }
  };

  const handleManagerRegenerateOTP = async () => {
    if (!selectedOrder) return;
    try {
      setRegeneratingOtp(true);
      const res = await regenerateDeliveryOTP(selectedOrder.id);
      setManagerOtpPreview(res.delivery_otp);
      setVerifyOtpInput("");
      showToast(`New OTP generated for #${selectedOrder.order_number} (lockout cleared).`);
      await loadOrders(statusFilter);
    } catch (err: any) {
      showToast(err.message || "Failed to regenerate OTP");
    } finally {
      setRegeneratingOtp(false);
    }
  };

  const handleManagerOverride = async () => {
    if (!selectedOrder) return;
    try {
      setOverriding(true);
      const res = await managerOverrideDelivery(selectedOrder.id, "Manager verified handover after OTP failure");
      if (res.verified || res.status === "verified") {
        showToast(`Order #${selectedOrder.order_number} marked Delivered via Manager Override.`);
        setVerifyModal(false);
        setVerifyOtpInput("");
        setManagerOtpPreview(null);
        setSelectedOrder(null);
        await loadOrders(statusFilter);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to override delivery");
    } finally {
      setOverriding(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="Logistics & Dispatch"
        title="Delivery & Aggregator Operations"
        subtitle="Manage in-house fleet and third-party deliveries, dispatch orders, and verify cryptographically hashed delivery OTPs."
        actions={
          <button
            onClick={() => loadOrders(statusFilter)}
            disabled={loading}
            className="px-3.5 py-2 border border-stone-800 bg-[#181514] hover:bg-stone-800 text-xs font-mono text-stone-200 flex items-center gap-2 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#E07A5F] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Aggregator Status Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center font-bold text-red-400">
              Z
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Zomato Gateway</h3>
              <p className="text-[10px] text-amber-400 font-mono">Integration Ready • Webhook Available</p>
            </div>
          </div>
          <span className="text-xs font-bold text-stone-400 font-mono">REST v2</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400">
              S
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Swiggy Gateway</h3>
              <p className="text-[10px] text-amber-400 font-mono">Integration Ready • Webhook Available</p>
            </div>
          </div>
          <span className="text-xs font-bold text-stone-400 font-mono">REST v2</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 border border-[#E07A5F]/30 flex items-center justify-center font-bold text-[#E07A5F]">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Direct Fleet & Delivery</h3>
              <p className="text-[10px] text-emerald-400 font-mono">Secure Salted SHA-256 OTP</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 font-mono">{orders.length} in DB</span>
        </div>
      </div>

      {/* Orders Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[#181514] border border-stone-800">
        {[
          { value: "all", label: "All" },
          { value: "new", label: "New" },
          { value: "preparing", label: "Preparing" },
          { value: "ready", label: "Ready" },
          { value: "out-for-delivery", label: "Out for Delivery" },
          { value: "completed", label: "Delivered" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === tab.value
                ? "bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/40 font-bold"
                : "text-stone-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Delivery Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && orders.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-stone-500 font-mono">
            Loading delivery orders from PostgreSQL...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-stone-500 font-mono">
            No delivery orders found for filter "{statusFilter}".
          </div>
        ) : (
          filteredOrders.map((ord) => (
            <div
              key={ord.id}
              className="p-5 rounded-2xl bg-[#181514] border border-stone-800 flex flex-col justify-between hover:border-stone-700 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">#{ord.order_number}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      Direct Delivery
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono border ${
                      ord.status === "out-for-delivery"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : ord.status === "completed"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {ord.status.replace(/-/g, " ")}
                  </span>
                </div>

                <div className="space-y-2 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-300 font-semibold">{ord.customer_name}</span>
                    <span className="text-stone-400 font-mono">{ord.customer_phone}</span>
                  </div>

                  <p className="text-[11px] text-stone-400 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-500 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{ord.delivery_address || "Standard Delivery"}</span>
                  </p>

                  <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800/80">
                    <span className="text-[10px] text-stone-500 font-mono uppercase block mb-1">
                      Ordered Items:
                    </span>
                    <p className="text-xs text-stone-200">{ord.items_summary}</p>
                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-stone-800">
                      <span className="text-[11px] text-stone-400">Total:</span>
                      <span className="text-xs font-bold text-emerald-400">₹{ord.total_amount}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px]">
                      <span className="text-stone-500">Rider: </span>
                      <span className="text-stone-200 font-medium">{ord.rider_name || "Unassigned"}</span>
                    </div>
                    {ord.otp_verified && (
                      <div className="text-[11px] font-mono bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>OTP Verified</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-stone-800">
                {(ord.status === "new" || ord.status === "preparing" || ord.status === "ready") && (
                  <button
                    onClick={() => {
                      setSelectedOrder(ord);
                      setDispatchedOTP(null);
                      setAssignRiderModal(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Assign Rider & Dispatch</span>
                  </button>
                )}

                {ord.status === "out-for-delivery" && (
                  <button
                    onClick={() => {
                      setSelectedOrder(ord);
                      setVerifyOtpInput("");
                      setManagerOtpPreview(null);
                      setVerifyModal(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{ord.otp_attempts >= 3 ? "OTP Locked — Manage" : "Verify Customer OTP"}</span>
                  </button>
                )}

                {ord.status === "completed" && (
                  <div className="flex-1 py-1.5 text-center text-xs text-stone-500 font-medium flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Delivered & Settled</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Assign Rider Modal */}
      {selectedOrder && (
        <Modal
          isOpen={assignRiderModal}
          onClose={() => setAssignRiderModal(false)}
          title={`Dispatch Order: #${selectedOrder.order_number}`}
          description={`Assign delivery rider for ${selectedOrder.customer_name}`}
          maxWidth="sm"
        >
          {dispatchedOTP ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Order Dispatched Successfully!</h4>
                <p className="text-xs text-stone-400">
                  Give this one-time code to the customer or rider. Only a secure hash is stored in PostgreSQL.
                </p>
                <div className="text-2xl font-mono font-bold tracking-widest text-[#F4A261] py-2 bg-stone-900 rounded-lg border border-stone-800">
                  {dispatchedOTP}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setAssignRiderModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Rider Full Name</label>
                <input
                  type="text"
                  value={riderInput.name}
                  onChange={(e) => setRiderInput({ ...riderInput, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Rider Mobile Phone</label>
                <input
                  type="text"
                  value={riderInput.phone}
                  onChange={(e) => setRiderInput({ ...riderInput, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  onClick={() => setAssignRiderModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispatch}
                  disabled={dispatching}
                  className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs cursor-pointer hover:bg-[#d0694e] disabled:opacity-50"
                >
                  {dispatching ? "Generating OTP..." : "Confirm & Dispatch"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Verify Customer OTP Modal */}
      {selectedOrder && (
        <Modal
          isOpen={verifyModal}
          onClose={() => {
            setVerifyModal(false);
            setManagerOtpPreview(null);
          }}
          title={`Verify Handover: #${selectedOrder.order_number}`}
          description={`Enter the 4-digit OTP provided by ${selectedOrder.customer_name}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">Customer Delivery OTP</label>
              <input
                type="text"
                maxLength={6}
                value={verifyOtpInput}
                onChange={(e) => setVerifyOtpInput(e.target.value)}
                placeholder="4-digit code"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-lg font-mono tracking-widest text-center focus:outline-none focus:border-[#E07A5F]"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Verified using constant-time comparison against salted SHA-256 hash. Attempts used: {selectedOrder.otp_attempts ?? 0}/3.
              </p>
            </div>

            {isManagerOrOwner && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold font-mono uppercase text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Manager OTP Recovery
                  </span>
                  {selectedOrder.otp_attempts >= 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                      Locked
                    </span>
                  )}
                </div>

                {managerOtpPreview && (
                  <div className="p-2 rounded-lg bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[10px] text-stone-400 block">New Active Customer OTP</span>
                    <span className="text-xl font-mono font-bold tracking-widest text-[#F4A261]">
                      {managerOtpPreview}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleManagerRegenerateOTP}
                    disabled={regeneratingOtp || overriding}
                    className="py-1.5 px-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-300 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {regeneratingOtp ? "Resetting..." : "Regenerate OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={handleManagerOverride}
                    disabled={overriding || regeneratingOtp}
                    className="py-1.5 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {overriding ? "Completing..." : "Override & Deliver"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => {
                  setVerifyModal(false);
                  setManagerOtpPreview(null);
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOTP}
                disabled={verifying || !verifyOtpInput}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify & Complete"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
