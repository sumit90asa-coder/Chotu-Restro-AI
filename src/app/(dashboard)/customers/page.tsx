"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { 
  fetchCustomers, 
  createCustomer, 
  adjustCustomerLoyalty, 
  fetchCustomerOrders,
  CustomerData 
} from "@/lib/api/customers";
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Award, 
  Clock, 
  Sparkles,
  TrendingUp,
  RefreshCw,
  Gift,
  FileText
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCustomer, setNewCustomer] = useState({ 
    name: "", 
    phone: "", 
    email: "", 
    dietary_preference: "veg",
    notes: "" 
  });
  
  // Loyalty adjustment modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [loyaltyDelta, setLoyaltyDelta] = useState<number>(50);
  const [loyaltyReason, setLoyaltyReason] = useState<string>("Complimentary loyalty bonus");
  const [adjustingLoyalty, setAdjustingLoyalty] = useState<boolean>(false);

  // Customer order history drawer/modal
  const [historyCustomer, setHistoryCustomer] = useState<CustomerData | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadCustomers = async (q = "") => {
    try {
      setLoading(true);
      const data = await fetchCustomers(q);
      setCustomers(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    try {
      const created = await createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || undefined,
        dietary_preference: newCustomer.dietary_preference,
        notes: newCustomer.notes || undefined,
      });
      setCustomers((prev) => [created, ...prev]);
      showToast(`Added customer profile for ${created.name}`);
      setShowAddModal(false);
      setNewCustomer({ name: "", phone: "", email: "", dietary_preference: "veg", notes: "" });
    } catch (err: any) {
      showToast(err.message || "Failed to register customer");
    }
  };

  const handleLoyaltyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      setAdjustingLoyalty(true);
      const updated = await adjustCustomerLoyalty(selectedCustomer.id, {
        points: Number(loyaltyDelta),
        reason: loyaltyReason,
        idempotency_key: `loyalty-${selectedCustomer.id}-${Date.now()}`,
      });
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(
        `Loyalty balance updated for ${updated.name}: ${updated.loyalty_points} pts`
      );
      setSelectedCustomer(null);
    } catch (err: any) {
      showToast(err.message || "Failed to adjust loyalty points");
    } finally {
      setAdjustingLoyalty(false);
    }
  };

  const handleViewOrders = async (customer: CustomerData) => {
    setHistoryCustomer(customer);
    try {
      setLoadingHistory(true);
      const orders = await fetchCustomerOrders(customer.id);
      setOrderHistory(orders);
    } catch (err: any) {
      showToast(err.message || "Failed to fetch customer order history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalPoints = customers.reduce((a, b) => a + (b.loyalty_points || 0), 0);
  const totalRevenue = customers.reduce((a, b) => a + (b.total_spend || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="Guest Relations & Retention"
        title="Customer CRM & Loyalty"
        subtitle="Manage guest profiles, dining history, lifetime spend, dietary preferences, and reward loyalty points."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadCustomers(searchQuery)}
              disabled={loading}
              className="px-3.5 py-2 border border-stone-800 bg-[#181514] hover:bg-stone-800 text-xs font-mono text-stone-200 flex items-center gap-2 rounded-xl transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E07A5F] ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer Profile</span>
            </button>
          </div>
        }
      />

      {/* CRM Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Total Enrolled Guests</span>
            <p className="text-xl font-bold text-white mt-0.5">{customers.length} Profiles</p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-[#E07A5F]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Total Guest Lifetime Spend</span>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Active Loyalty Ledger Points</span>
            <p className="text-xl font-bold text-amber-400 mt-0.5">{totalPoints} Pts</p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-amber-400">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-stone-500" />
        <input
          type="text"
          placeholder="Search by customer name or normalized E.164 phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs text-white placeholder:text-stone-500 focus:outline-none"
        />
      </div>

      {/* Customers Table */}
      <div className="rounded-2xl bg-[#181514] border border-stone-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#151211] border-b border-stone-800 text-stone-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Contact Phone</th>
                <th className="px-4 py-3.5">Total Visits</th>
                <th className="px-4 py-3.5">Lifetime Spend</th>
                <th className="px-4 py-3.5">Loyalty Points</th>
                <th className="px-4 py-3.5">Dietary Preference</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-stone-500 font-mono">
                    Loading customer profiles from PostgreSQL...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-stone-500 font-mono">
                    No matching customer profiles found.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-stone-800 text-[#E07A5F] flex items-center justify-center font-bold text-xs">
                          {c.name ? c.name[0].toUpperCase() : "G"}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">{c.name}</p>
                          {c.notes && (
                            <p className="text-[10px] text-stone-400 truncate max-w-[180px]">{c.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-stone-300">
                      <p>{c.phone}</p>
                      {c.email && <p className="text-[10px] text-stone-500">{c.email}</p>}
                    </td>
                    <td className="px-4 py-4 font-bold text-stone-200">
                      {c.visit_count ?? (c as any).total_orders ?? 0} visits
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-400">
                      ₹{Number(c.total_spend || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-bold font-mono">
                        <Award className="w-3 h-3 text-amber-400" />
                        {c.loyalty_points ?? (c as any).loyalty_points_balance ?? 0} pts
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-[10px] text-stone-300 capitalize">
                        {c.dietary_preference || "Flexible"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          title="Adjust loyalty points"
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Gift className="w-3 h-3" />
                          <span>Points</span>
                        </button>
                        <button
                          onClick={() => handleViewOrders(c)}
                          title="View order history"
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Orders</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Customer Registration"
        description="Add guest details to loyalty database"
        maxWidth="sm"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Customer Full Name *</label>
            <input
              type="text"
              required
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="e.g. Rahul Singhania"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Phone Number (Normalized E.164) *</label>
            <input
              type="tel"
              required
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="+91 98200 12345"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Email Address</label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              placeholder="guest@example.com"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Dietary Preference</label>
              <select
                value={newCustomer.dietary_preference}
                onChange={(e) => setNewCustomer({ ...newCustomer, dietary_preference: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              >
                <option value="veg">Vegetarian</option>
                <option value="nonveg">Non-Vegetarian</option>
                <option value="jain">Jain / No Onion/Garlic</option>
                <option value="vegan">Vegan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Notes / Preferences</label>
              <input
                type="text"
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                placeholder="e.g. VIP, Corner table"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs cursor-pointer hover:bg-[#d0694e] transition-colors"
            >
              Save Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* Loyalty Points Adjustment Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Adjust Loyalty Points — ${selectedCustomer.name}`}
          description={`Current Balance: ${selectedCustomer.loyalty_points} Points`}
          maxWidth="sm"
        >
          <form onSubmit={handleLoyaltyAdjustment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Points to Add (+) or Deduct (-)
              </label>
              <input
                type="number"
                required
                value={loyaltyDelta}
                onChange={(e) => setLoyaltyDelta(Number(e.target.value))}
                placeholder="e.g. 50 or -30"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                New calculated balance: {selectedCustomer.loyalty_points + Number(loyaltyDelta)} pts
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Audit Reason *
              </label>
              <input
                type="text"
                required
                value={loyaltyReason}
                onChange={(e) => setLoyaltyReason(e.target.value)}
                placeholder="e.g. Birthday celebration gift, Manual correction"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjustingLoyalty}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs cursor-pointer hover:bg-[#d0694e] transition-colors disabled:opacity-50"
              >
                {adjustingLoyalty ? "Updating..." : "Commit Transaction"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Customer Order History Modal */}
      {historyCustomer && (
        <Modal
          isOpen={!!historyCustomer}
          onClose={() => setHistoryCustomer(null)}
          title={`Order History — ${historyCustomer.name}`}
          description={`Phone: ${historyCustomer.phone} • Lifetime Spend: ₹${historyCustomer.total_spend}`}
          maxWidth="md"
        >
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loadingHistory ? (
              <p className="text-xs text-stone-400 font-mono text-center py-6">
                Loading order records...
              </p>
            ) : orderHistory.length === 0 ? (
              <p className="text-xs text-stone-400 font-mono text-center py-6">
                No previous settled orders found for this customer.
              </p>
            ) : (
              orderHistory.map((ord: any) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-white">Order #{ord.order_number}</p>
                    <p className="text-[11px] text-stone-400">
                      {ord.created_at ? new Date(ord.created_at).toLocaleString("en-IN") : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-emerald-400">₹{ord.total_amount}</p>
                    <span className="text-[10px] font-mono uppercase text-stone-400">{ord.status}</span>
                  </div>
                </div>
              ))
            )}
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
