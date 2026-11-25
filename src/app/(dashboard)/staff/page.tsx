"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { 
  fetchStaff, 
  createStaff, 
  updateStaffStatus, 
  StaffMemberData 
} from "@/lib/api/staff";
import { 
  UserCheck, 
  Users, 
  Plus, 
  ShieldCheck, 
  RefreshCw, 
  Phone, 
  Key, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function StaffPage() {
  const [staffList, setStaffList] = useState<StaffMemberData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    username: "",
    role: "waiter",
    password: "",
    phone: "",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await fetchStaff();
      setStaffList(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load staff roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const toggleShift = async (staff: StaffMemberData) => {
    try {
      const nextActive = !staff.is_active;
      const updated = await updateStaffStatus(staff.id, nextActive);
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_active: updated.is_active } : s))
      );
      showToast(
        `${staff.full_name} status updated to ${nextActive ? "Active / On Duty" : "Off Duty / Suspended"}`
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update staff shift status");
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.username) return;
    try {
      const created = await createStaff({
        email: newStaff.username,
        full_name: newStaff.name,
        role: newStaff.role,
        password: newStaff.password || "Restro@2026",
        phone: newStaff.phone || undefined,
      });
      setStaffList((prev) => [created, ...prev]);
      showToast(`Added ${created.full_name} (${created.role}) to restaurant staff directory`);
      setShowAddModal(false);
      setNewStaff({ name: "", username: "", role: "waiter", password: "", phone: "" });
    } catch (err: any) {
      showToast(err.message || "Failed to create staff member");
    }
  };

  const onDutyCount = staffList.filter((s) => s.is_active).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="Workforce & Permissions"
        title="Staff Roster & Shift Control"
        subtitle="Manage restaurant staff, operational roles (Manager, Cashier, Chef, Server), clock-in shifts, and security privileges."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={loadStaff}
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
              <span>Add Staff Member</span>
            </button>
          </div>
        }
      />

      {/* Staff Status Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Total Enrolled Team</span>
            <p className="text-xl font-bold text-white mt-0.5">{staffList.length} Members</p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-[#E07A5F]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Currently Active / On Duty</span>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{onDutyCount} Active</p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-400">Security & RBAC</span>
            <p className="text-xl font-bold text-amber-400 mt-0.5">Enforced (JWT + DB)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-2xl bg-[#181514] border border-stone-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#151211] border-b border-stone-800 text-stone-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Contact Phone</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Registered</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {loading && staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-stone-500 font-mono">
                    Loading staff directory from PostgreSQL...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-stone-500 font-mono">
                    No staff members enrolled yet. Click "Add Staff Member" above.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-stone-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-800 text-stone-200 flex items-center justify-center font-bold text-xs">
                          {staff.full_name ? staff.full_name[0].toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">{staff.full_name}</p>
                          <p className="text-[11px] text-stone-400 font-mono">{staff.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-0.5 rounded-full capitalize text-[10px] font-bold font-mono bg-stone-900 border border-stone-700 text-[#F4A261]">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-stone-300 text-[11px]">
                      {staff.phone || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                          staff.is_active
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40"
                            : "bg-stone-900 text-stone-500 border-stone-800"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${staff.is_active ? "bg-emerald-400" : "bg-stone-600"}`} />
                        <span>{staff.is_active ? "Active" : "Inactive"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-stone-400 text-[11px]">
                      {staff.created_at ? new Date(staff.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => toggleShift(staff)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          staff.is_active
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {staff.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New Team Member"
        description="Add staff profile and assign role in PostgreSQL"
        maxWidth="sm"
      >
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={newStaff.name}
              onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
              placeholder="e.g. Ramesh Pawar"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Login Email *</label>
            <input
              type="email"
              required
              value={newStaff.username}
              onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
              placeholder="staff@restaurant.com"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Initial Password *</label>
            <input
              type="password"
              required
              value={newStaff.password}
              onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Operational Role</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              >
                <option value="waiter">Server / Captain</option>
                <option value="kitchen_staff">Kitchen Staff</option>
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner / Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                placeholder="+91 98200 12345"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
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
              Enroll Staff Member
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
