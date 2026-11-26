"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Users, 
  Clock, 
  Receipt, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight,
  ArrowRightLeft,
  X,
  CreditCard,
  Banknote,
  QrCode,
  LayoutGrid,
  MapPin,
  CalendarCheck,
  Sparkles,
  UtensilsCrossed,
  ShieldCheck,
  Flame,
  ChevronRight,
  AlertCircle,
  Plus,
  Trash2,
  Printer
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { fetchTables, updateTableStatus, transferTable, createTable, deleteTable, fetchFloors, assignTableWaiter } from "@/lib/api/tables";
import { fetchStaff, StaffMemberData } from "@/lib/api/staff";
import { getTableOrder, settleTableBill, cancelTableOrder } from "@/lib/api/pos";
import { Table, TableStatus, OrderItem } from "@/types/restaurant";
import { wsClient } from "@/lib/api/websocket";
import { useAuth } from "@/lib/context/AuthContext";

interface ActiveOrderInfo {
  id: string;
  orderNumber: string;
  tokenNumber: string;
  placedBy: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

export default function TablesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "floorplan">("grid");

  // Contextual Detail Drawer State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrderInfo | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(false);

  // Table Assistance Requests Map (tableId -> alert)
  const [tableAssistance, setTableAssistance] = useState<Record<string, { serviceType: string; displayType: string; notes?: string }>>({});

  // Status Change Modal
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<TableStatus>("vacant");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Assign Server / Waiter Modal
  const [staffList, setStaffList] = useState<StaffMemberData[]>([]);
  const [showWaiterModal, setShowWaiterModal] = useState<boolean>(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const [isAssigningWaiter, setIsAssigningWaiter] = useState<boolean>(false);

  // Transfer Table Modal
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [targetTableId, setTargetTableId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Settle Bill Modal & Printable Invoice
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "complimentary">("upi");
  const [complimentaryReason, setComplimentaryReason] = useState<string>("");
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [settledInvoice, setSettledInvoice] = useState<{
    invoiceNumber: string;
    tableName: string;
    customerName?: string;
    items: OrderItem[];
    subtotal: number;
    discount: number;
    cgst: number;
    sgst: number;
    serviceCharge: number;
    grandTotal: number;
    paymentMethod: string;
    date: string;
    time: string;
  } | null>(null);

  // Add Table Modal
  const [showAddTableModal, setShowAddTableModal] = useState<boolean>(false);
  const [captainInput, setCaptainInput] = useState<string>("");
  const [newTableLabel, setNewTableLabel] = useState<string>("");
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [newTableFloor, setNewTableFloor] = useState<string>("Main AC Hall");
  const [isCreatingTable, setIsCreatingTable] = useState<boolean>(false);

  const handleCreateTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) {
      showToast("Table label is required (e.g. T-09)");
      return;
    }
    setIsCreatingTable(true);
    try {
      await createTable({
        label: newTableLabel.trim(),
        capacity: Number(newTableCapacity) || 4,
        floor_name: newTableFloor.trim() || "Main AC Hall",
      });
      showToast(`Table ${newTableLabel.trim()} added successfully`);
      setShowAddTableModal(false);
      setNewTableLabel("");
      setNewTableCapacity(4);
      await loadTables();
    } catch (err: any) {
      showToast(err?.message || "Failed to create table");
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDismissTableAssistance = (tableId: string) => {
    setTableAssistance((prev) => {
      const next = { ...prev };
      delete next[tableId];
      return next;
    });

    try {
      const stored = localStorage.getItem("chotu_service_alerts");
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter((a: any) => a.tableId !== tableId);
        localStorage.setItem("chotu_service_alerts", JSON.stringify(filtered));
      }
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chotu_service_cleared", { detail: { tableId } }));
    }
    showToast(`Service request acknowledged and marked served!`);
  };

  const loadTables = async () => {
    setLoading(true);
    try {
      const [data, staff] = await Promise.all([
        fetchTables(),
        fetchStaff().catch(() => []),
      ]);
      if (Array.isArray(staff)) {
        setStaffList(staff.filter((s) => s.is_active));
      }
      if (data && data.length > 0) {
        setTables(data);
        // If a table is currently selected, refresh its data in the drawer
        if (selectedTable) {
          const updated = data.find((t) => t.id === selectedTable.id);
          if (updated) setSelectedTable(updated);
        }
      }
    } catch (err) {
      console.warn("Failed to load tables from backend:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();

    // Load initial alerts from localStorage
    try {
      const stored = localStorage.getItem("chotu_service_alerts");
      if (stored) {
        const parsed = JSON.parse(stored);
        const map: Record<string, { serviceType: string; displayType: string; notes?: string }> = {};
        parsed.forEach((a: any) => {
          if (a.tableId) {
            map[a.tableId] = {
              serviceType: a.serviceType,
              displayType: a.displayType,
              notes: a.notes,
            };
          }
        });
        setTableAssistance(map);
      }
    } catch {}

    wsClient.connect();
    const unsubscribe = wsClient.subscribe((evt: any) => {
      const eventType = (evt?.event || evt?.type || "").toLowerCase();
      if (
        eventType === "table_updated" || 
        eventType === "order_created" || 
        eventType === "order_updated" ||
        eventType === "kot_created"
      ) {
        loadTables();
      } else if (eventType === "service_request") {
        const data = evt.data || evt.payload || {};
        if (data.table_id) {
          setTableAssistance((prev) => ({
            ...prev,
            [data.table_id]: {
              serviceType: data.service_type || "water",
              displayType: data.display_type || (data.service_type === "water" ? "Water Service" : "Server Assistance"),
              notes: data.notes || "",
            },
          }));
          showToast(`🔔 ${data.table_label || "Table"}: ${data.display_type || "Assistance Requested"}`);
        }
      }
    });

    const handleWindowAlert = (e: any) => {
      const alert = e.detail;
      if (alert?.tableId) {
        setTableAssistance((prev) => ({
          ...prev,
          [alert.tableId]: {
            serviceType: alert.serviceType,
            displayType: alert.displayType,
            notes: alert.notes,
          },
        }));
      }
    };

    const handleWindowClear = (e: any) => {
      if (e.detail?.tableId) {
        setTableAssistance((prev) => {
          const next = { ...prev };
          delete next[e.detail.tableId];
          return next;
        });
      } else if (e.detail?.all) {
        setTableAssistance({});
      }
    };

    window.addEventListener("chotu_service_alert", handleWindowAlert);
    window.addEventListener("chotu_service_cleared", handleWindowClear);

    return () => {
      unsubscribe();
      window.removeEventListener("chotu_service_alert", handleWindowAlert);
      window.removeEventListener("chotu_service_cleared", handleWindowClear);
    };
  }, []);

  // Fetch active order details when selected table changes
  useEffect(() => {
    async function fetchOrder() {
      if (!selectedTable) {
        setActiveOrder(null);
        return;
      }
      if (selectedTable.status === "vacant") {
        setActiveOrder(null);
        return;
      }

      setLoadingOrder(true);
      try {
        const orderData = await getTableOrder(selectedTable.id);
        if (orderData && orderData.items && orderData.items.length > 0) {
          const ord = orderData.order;
          setActiveOrder({
            id: ord.id,
            orderNumber: ord.order_number,
            tokenNumber: (ord as any).token_number || ord.order_number,
            placedBy: ord.placed_by || "pos",
            customerName: ord.customer_name || undefined,
            items: orderData.items,
            subtotal: Number(ord.subtotal || 0),
            discount: Number(ord.discount ?? ord.discount_amount ?? 0),
            cgst: Number(ord.cgst || 0),
            sgst: Number(ord.sgst || 0),
            serviceCharge: Number(ord.service_charge || 0),
            tax: Number(ord.cgst || 0) + Number(ord.sgst || 0),
            total: Number(ord.total_amount || 0),
          });
        } else {
          setActiveOrder(null);
        }
      } catch {
        setActiveOrder(null);
      } finally {
        setLoadingOrder(false);
      }
    }

    fetchOrder();
  }, [selectedTable?.id, selectedTable?.status]);

  // Handle Quick Status Change
  const handleStatusChangeSubmit = async () => {
    if (!selectedTable) return;
    setIsUpdatingStatus(true);
    try {
      await updateTableStatus(selectedTable.id, newStatus, captainInput.trim());
      showToast(`Table ${selectedTable.label} updated to ${newStatus.toUpperCase()}`);
      setShowStatusModal(false);
      await loadTables();
    } catch (err) {
      console.error("Failed to update status:", err);
      showToast("Error updating table status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Manual Server / Waiter Assignment
  const handleAssignWaiterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setIsAssigningWaiter(true);
    try {
      if (selectedWaiterId) {
        await assignTableWaiter(selectedTable.id, selectedWaiterId);
        const staffMember = staffList.find((s) => s.id === selectedWaiterId);
        showToast(`Assigned ${staffMember?.full_name || "server"} to ${selectedTable.label}`);
      } else if (captainInput.trim()) {
        await updateTableStatus(selectedTable.id, selectedTable.status, captainInput.trim());
        showToast(`Assigned ${captainInput.trim()} to ${selectedTable.label}`);
      } else {
        await assignTableWaiter(selectedTable.id, null);
        showToast(`Cleared server assignment for ${selectedTable.label}`);
      }
      setShowWaiterModal(false);
      await loadTables();
    } catch (err: any) {
      showToast(err?.message || "Failed to assign server");
    } finally {
      setIsAssigningWaiter(false);
    }
  };

  // Handle Table Transfer
  const handleTransferSubmit = async () => {
    if (!selectedTable || !targetTableId) return;
    setIsTransferring(true);
    try {
      await transferTable(selectedTable.id, targetTableId);
      showToast(`Order transferred from ${selectedTable.label} to Table ${targetTableId}`);
      setShowTransferModal(false);
      setTargetTableId("");
      setSelectedTable(null);
      await loadTables();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Table transfer failed";
      showToast(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  // Handle Bill Settlement directly from Floor
  const handleSettleBillSubmit = async () => {
    if (!selectedTable) return;
    const totalDue = Number(selectedTable.currentBill || activeOrder?.total || 0);
    const hasItems = activeOrder && activeOrder.items && activeOrder.items.length > 0;
    
    if ((!hasItems || totalDue <= 0) && paymentMethod !== "complimentary") {
      showToast("Cannot settle zero-item bill via Cash, Card, or UPI.");
      return;
    }
    if (paymentMethod === "complimentary" && !complimentaryReason.trim()) {
      showToast("Please provide an authorized reason for complimentary settlement.");
      return;
    }

    const snapshotTableLabel = selectedTable.label;
    const snapshotOrder = activeOrder;
    const snapshotMethod = paymentMethod;

    setIsSettling(true);
    try {
      const settledRes = await settleTableBill(selectedTable.id, paymentMethod, 0, complimentaryReason.trim() || undefined);
      showToast(`Bill settled for ${snapshotTableLabel}. Table is now Vacant.`);

      const now = new Date();
      setSettledInvoice({
        invoiceNumber: settledRes?.order_number
          ? `INV-${settledRes.order_number}`
          : snapshotOrder?.orderNumber
          ? `INV-${snapshotOrder.orderNumber}`
          : `INV-${Date.now().toString().slice(-6)}`,
        tableName: snapshotTableLabel,
        customerName: settledRes?.customer_name || snapshotOrder?.customerName,
        items: snapshotOrder?.items || [],
        subtotal: Number(settledRes?.subtotal ?? snapshotOrder?.subtotal ?? 0),
        discount: Number(settledRes?.discount ?? snapshotOrder?.discount ?? 0),
        cgst: Number(settledRes?.cgst ?? snapshotOrder?.cgst ?? 0),
        sgst: Number(settledRes?.sgst ?? snapshotOrder?.sgst ?? 0),
        serviceCharge: Number(settledRes?.service_charge ?? snapshotOrder?.serviceCharge ?? 0),
        grandTotal: Number(settledRes?.total_amount ?? snapshotOrder?.total ?? totalDue),
        paymentMethod: snapshotMethod,
        date: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      });

      setShowSettleModal(false);
      setComplimentaryReason("");
      setSelectedTable(null);
      setShowPrintModal(true);
      await loadTables();
    } catch (err: any) {
      console.error("Failed to settle bill:", err);
      showToast(err.message || "Error settling bill");
    } finally {
      setIsSettling(false);
    }
  };

  // Safe cancellation of accidental or empty active order
  const handleCancelEmptyOrder = async () => {
    if (!selectedTable) return;
    setIsSettling(true);
    try {
      await cancelTableOrder(selectedTable.id, "Empty active order cancelled from Floor & Tables");
      showToast(`Active session cleared for Table ${selectedTable.label}. Table is now Vacant.`);
      setShowSettleModal(false);
      setSelectedTable(null);
      await loadTables();
    } catch (err: any) {
      showToast(err.message || "Failed to clear table session");
    } finally {
      setIsSettling(false);
    }
  };

  // Quick Clear Table
  const handleQuickClear = async (tableId: string) => {
    try {
      await updateTableStatus(tableId, "vacant");
      showToast(`Table ${tableId} cleared and marked Vacant`);
      if (selectedTable?.id === tableId) {
        setSelectedTable((prev) => prev ? { ...prev, status: "vacant", currentBill: 0 } : null);
      }
      await loadTables();
    } catch (err) {
      console.error(err);
      showToast("Failed to clear table");
    }
  };

  // Status Metrics
  const vacantCount = tables.filter((t) => t.status === "vacant").length;
  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const billedCount = tables.filter((t) => t.status === "billed").length;
  const reservedCount = tables.filter((t) => t.status === "reserved").length;
  const totalFloorBill = tables.reduce((acc, t) => acc + (t.currentBill || 0), 0);

  // Filter Tables
  const filteredTables = tables.filter((t) => {
    if (sectionFilter !== "all" && t.section !== sectionFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  // Vacant tables for transfer destination
  const availableTargetTables = tables.filter(
    (t) => t.status === "vacant" && (!selectedTable || t.id !== selectedTable.id)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-6 print:hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#181514] border border-[#E07A5F] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-[#E07A5F]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header with Floor Actions */}
      <PageHeader
        category="Floor & Seating Management"
        title="Interactive Restaurant Floor Plan"
        subtitle="Live table occupancy, active order tracking, instant server dispatch, and table transfers."
        actions={
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-stone-900 border border-stone-800">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-[#E07A5F] text-stone-950 shadow-sm"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid View</span>
              </button>
              <button
                onClick={() => setViewMode("floorplan")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "floorplan"
                    ? "bg-[#E07A5F] text-stone-950 shadow-sm"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Blueprint</span>
              </button>
            </div>

            <button
              onClick={loadTables}
              className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
              title="Refresh Floor"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowAddTableModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-xs shadow-md shadow-[#E07A5F]/20 hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Table</span>
            </button>
            <Link
              href="/pos"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>Open POS Terminal</span>
            </Link>
          </div>
        }
      />

      {/* Real-time Status Metric Ribbons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400">Total Tables</span>
            <div className="text-xl font-bold text-white mt-0.5">{tables.length}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-stone-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181514] border border-emerald-950/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400">Available</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{vacantCount}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181514] border border-amber-950/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400">Occupied</span>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{occupiedCount}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181514] border border-blue-950/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400">Billing / Settle</span>
            <div className="text-xl font-bold text-blue-400 mt-0.5">{billedCount}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-[#181514] border border-[#E07A5F]/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#F4A261]">Active Ledger</span>
            <div className="text-xl font-bold text-white mt-0.5">₹{totalFloorBill.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center text-[#E07A5F]">
            <Flame className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Section Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#181514] border border-stone-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-400 uppercase font-mono mr-1">Section:</span>
          {["all", ...Array.from(new Set(["Main AC Hall", ...tables.map((t) => t.section || "Main AC Hall")]))].map((sec) => (
            <button
              key={sec}
              onClick={() => setSectionFilter(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                sectionFilter === sec
                  ? "bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/40 shadow-sm"
                  : "text-stone-400 hover:text-white hover:bg-stone-800 border border-transparent"
              }`}
            >
              {sec === "all" ? "All Sections" : sec}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-400 uppercase font-mono mr-1">Status:</span>
          {["all", "vacant", "occupied", "billed", "reserved"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                statusFilter === st
                  ? "bg-stone-700 text-white font-bold"
                  : "text-stone-400 hover:text-white hover:bg-stone-800 border border-transparent"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Floor Workspace: Content Area + Contextual Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Floor Map / Table Grid (8 cols when drawer open, 12 when closed) */}
        <div className={`transition-all duration-300 ${selectedTable ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"}`}>
          {viewMode === "grid" ? (
            /* Modern Tactile Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTables.map((tbl) => {
                const isSelected = selectedTable?.id === tbl.id;
                const isOccupied = tbl.status === "occupied";
                const isBilled = tbl.status === "billed";
                const isReserved = tbl.status === "reserved";

                return (
                  <div
                    key={tbl.id}
                    onClick={() => setSelectedTable(tbl)}
                    className={`cursor-pointer p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between relative group ${
                      isSelected
                        ? "ring-2 ring-[#E07A5F] bg-[#221c1a] border-[#E07A5F]"
                        : isOccupied
                        ? "bg-[#1d1815] border-amber-900/40 hover:border-amber-600/60 shadow-md"
                        : isBilled
                        ? "bg-[#141b24] border-blue-900/40 hover:border-blue-600/60 shadow-md"
                        : isReserved
                        ? "bg-[#1a1724] border-purple-900/40 hover:border-purple-600/60"
                        : "bg-[#181514] border-stone-800/80 hover:border-stone-700 hover:bg-[#1d1918]"
                    }`}
                  >
                    <div>
                      {/* Table Header: Name + Pax + Status Pill */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-white font-mono tracking-tight">{tbl.label}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-stone-300 font-mono">
                              {tbl.capacity} Pax
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">{tbl.section}</span>
                        </div>

                        {/* Status Badge with Live Pulse Dot */}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider font-mono border ${
                            isOccupied
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                              : isBilled
                              ? "bg-blue-500/15 text-blue-300 border-blue-500/40"
                              : isReserved
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {(isOccupied || isBilled) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                          )}
                          <span>{tbl.status}</span>
                        </span>
                      </div>

                      {/* Dining Metrics */}
                      <div className="space-y-2 my-4 text-xs">
                        {tbl.openedAt && (
                          <div className="flex items-center justify-between text-stone-400">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-stone-500" /> Dining Since
                            </span>
                            <span className="font-mono text-stone-200 text-xs font-semibold">{tbl.openedAt}</span>
                          </div>
                        )}

                        {tbl.captainName && (
                          <div className="flex items-center justify-between text-stone-400">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <Users className="w-3.5 h-3.5 text-stone-500" /> Captain
                            </span>
                            <span className="text-stone-300 text-xs font-medium">{tbl.captainName}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2.5 border-t border-stone-800/80">
                          <span className="text-stone-400 text-[11px]">Current Ledger:</span>
                          <span className={`font-mono font-bold ${tbl.currentBill ? "text-emerald-400 text-sm" : "text-stone-500 text-xs"}`}>
                            {tbl.currentBill ? `₹${tbl.currentBill.toLocaleString("en-IN")}` : "₹0"}
                          </span>
                        </div>
                      </div>

                      {/* Active Service / Water Assistance Badge */}
                      {tableAssistance[tbl.id] && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`my-2 p-2 rounded-xl border flex items-center justify-between text-xs animate-pulse ${
                            tableAssistance[tbl.id].serviceType === "water"
                              ? "bg-sky-950/50 border-sky-500/60 text-sky-200"
                              : "bg-amber-950/50 border-amber-500/60 text-amber-200"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>{tableAssistance[tbl.id].serviceType === "water" ? "💧" : "🔔"}</span>
                            <span>{tableAssistance[tbl.id].displayType}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissTableAssistance(tbl.id);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-700 hover:bg-stone-800 text-[10px] font-bold text-stone-200 cursor-pointer"
                          >
                            Served ✓
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick Footer Action Prompt */}
                    <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-semibold text-stone-400 group-hover:text-[#F4A261] transition-colors">
                      <span>{isOccupied ? "View Active Order" : isBilled ? "Settle Bill" : "Seat & Order"}</span>
                      <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Blueprint Architectural Section View */
            <div className="space-y-6">
              {["Main AC Hall", "Garden Terrace", "VIP Lounge"].map((secName) => {
                const secTables = filteredTables.filter((t) => t.section === secName);
                if (secTables.length === 0) return null;

                return (
                  <div key={secName} className="p-6 rounded-3xl bg-[#181514] border border-stone-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#E07A5F]" />
                        <h3 className="font-bold text-white text-sm tracking-wide">{secName}</h3>
                        <span className="text-xs text-stone-400 font-mono">({secTables.length} Tables)</span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400">
                        {secTables.filter((t) => t.status === "vacant").length} Available
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {secTables.map((tbl) => {
                        const isSelected = selectedTable?.id === tbl.id;
                        return (
                          <div
                            key={tbl.id}
                            onClick={() => setSelectedTable(tbl)}
                            className={`cursor-pointer p-4 rounded-2xl border text-center transition-all ${
                              isSelected
                                ? "bg-[#221c1a] border-[#E07A5F] ring-2 ring-[#E07A5F]"
                                : tbl.status === "occupied"
                                ? "bg-amber-950/20 border-amber-600/40 hover:border-amber-500"
                                : tbl.status === "billed"
                                ? "bg-blue-950/20 border-blue-600/40 hover:border-blue-500"
                                : "bg-stone-900 border-stone-800 hover:border-stone-700"
                            }`}
                          >
                            <div className="text-sm font-bold text-white font-mono">{tbl.label}</div>
                            <div className="text-[11px] text-stone-400 font-mono mt-0.5">{tbl.capacity} Seats</div>
                            <div className="mt-2 text-xs font-bold font-mono text-emerald-400">
                              {tbl.currentBill ? `₹${tbl.currentBill}` : "—"}
                            </div>
                            <span className="inline-block mt-2 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-800 text-stone-300">
                              {tbl.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Contextual Table Details Drawer (5 cols) */}
        {selectedTable && (
          <div className="lg:col-span-5 xl:col-span-4 bg-[#181514] border border-stone-800 rounded-3xl p-6 shadow-2xl relative sticky top-6 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-4 border-b border-stone-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white font-mono">{selectedTable.label}</h3>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase font-mono border ${
                      selectedTable.status === "occupied"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : selectedTable.status === "billed"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : selectedTable.status === "reserved"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}
                  >
                    {selectedTable.status}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {selectedTable.section} • {selectedTable.capacity} Guests Capacity
                </p>
              </div>

              <button
                onClick={() => setSelectedTable(null)}
                className="p-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white transition-colors"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Table Assistance Banner in Drawer */}
            {tableAssistance[selectedTable.id] && (
              <div
                className={`my-4 p-3.5 rounded-2xl border flex items-center justify-between gap-3 animate-pulse ${
                  tableAssistance[selectedTable.id].serviceType === "water"
                    ? "bg-sky-950/60 border-sky-500/60 text-sky-200"
                    : "bg-amber-950/60 border-amber-500/60 text-amber-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">
                    {tableAssistance[selectedTable.id].serviceType === "water" ? "💧" : "🔔"}
                  </span>
                  <div>
                    <span className="font-bold text-xs block text-white font-mono">
                      {tableAssistance[selectedTable.id].displayType} Requested
                    </span>
                    <span className="text-[11px] text-stone-300">
                      Guest is waiting at {selectedTable.label}
                    </span>
                    {tableAssistance[selectedTable.id].notes && (
                      <p className="text-[10px] italic text-stone-400 mt-0.5">
                        "{tableAssistance[selectedTable.id].notes}"
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissTableAssistance(selectedTable.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Served
                </button>
              </div>
            )}

            {/* Table Operational State Body */}
            {selectedTable.status === "vacant" ? (
              /* VACANT TABLE STATE */
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Table is Clean & Available</h4>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1">
                    Ready for walk-in guests or reservations. Seat guests and begin ordering directly in POS.
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <Link
                    href={`/pos?table=${selectedTable.id}`}
                    className="w-full py-3 px-4 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Start New Order in POS</span>
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await updateTableStatus(selectedTable.id, "reserved");
                          showToast(`Table ${selectedTable.label} marked Reserved`);
                          await loadTables();
                        } catch {
                          showToast("Failed to reserve table");
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition-colors"
                    >
                      Mark Reserved
                    </button>
                    <button
                      onClick={() => {
                        setShowStatusModal(true);
                        setNewStatus(selectedTable.status);
                        setCaptainInput(selectedTable.captainName || "");
                      }}
                      className="py-2.5 px-3 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition-colors"
                    >
                      Change Status
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWaiterId(selectedTable.assignedWaiterId || "");
                      setCaptainInput(selectedTable.captainName || "");
                      setShowWaiterModal(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-900 border border-stone-700 hover:bg-stone-800 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-[#E07A5F]" />
                    <span>{selectedTable.captainName ? `Server: ${selectedTable.captainName} (Change)` : "Assign Server / Waiter"}</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to permanently delete ${selectedTable.label}?`)) return;
                      try {
                        await deleteTable(selectedTable.id);
                        showToast(`Table ${selectedTable.label} deleted successfully`);
                        setSelectedTable(null);
                        await loadTables();
                      } catch (err: any) {
                        showToast(err?.message || "Failed to delete table");
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Vacant Table</span>
                  </button>
                </div>
              </div>
            ) : (
              /* OCCUPIED / BILLED TABLE STATE */
              <div className="py-4 space-y-5">
                {/* Active Order Summary Card */}
                {loadingOrder ? (
                  <div className="py-12 text-center text-xs text-stone-400 font-mono animate-pulse">
                    Loading live order ledger from PostgreSQL...
                  </div>
                ) : activeOrder ? (
                  <div className="space-y-4">
                    {/* Order Reference Strip */}
                    <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-stone-400 block">Token Number</span>
                        <span className="font-mono font-bold text-[#F4A261]">{activeOrder.tokenNumber}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-stone-400 block">Channel</span>
                        <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono text-[10px] uppercase">
                          {activeOrder.placedBy}
                        </span>
                      </div>
                    </div>

                    {/* Ordered Items List */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-stone-400 font-mono mb-2">
                        <span>Active Dishes ({activeOrder.items.length})</span>
                        <span>Amount</span>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                        {activeOrder.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800/60 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-stone-800 font-mono text-[10px] flex items-center justify-center font-bold text-[#E07A5F]">
                                {item.quantity}x
                              </span>
                              <div>
                                <span className="font-medium text-stone-200 block">{item.name}</span>
                                {item.notes && <span className="text-[10px] text-stone-400 italic">"{item.notes}"</span>}
                              </div>
                            </div>
                            <span className="font-mono font-bold text-stone-300">
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial Bill Total */}
                    <div className="pt-3 border-t border-stone-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-stone-400">
                        <span>Subtotal:</span>
                        <span className="font-mono text-stone-200">₹{activeOrder.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-400">
                        <span>Taxes (GST 5%):</span>
                        <span className="font-mono text-stone-200">₹{activeOrder.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold text-white pt-2 border-t border-stone-800/80">
                        <span>Total Payable:</span>
                        <span className="font-mono text-emerald-400 text-base">₹{activeOrder.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-400 text-center font-mono">
                    Table marked as {selectedTable.status}, but no active items currently in cart.
                  </div>
                )}

                {/* Operational Action Controls */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/pos?table=${selectedTable.id}`}
                      className="py-2.5 px-3 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Open in POS</span>
                    </Link>

                    {activeOrder && activeOrder.items && activeOrder.items.length > 0 ? (
                      <button
                        onClick={() => setShowSettleModal(true)}
                        className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Settle Bill</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelEmptyOrder}
                        className="py-2.5 px-3 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Table</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="py-2 px-3 rounded-xl bg-stone-900 border border-stone-700 hover:bg-stone-800 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-stone-400" />
                      <span>Transfer Table</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowStatusModal(true);
                        setNewStatus(selectedTable.status);
                        setCaptainInput(selectedTable.captainName || "");
                      }}
                      className="py-2 px-3 rounded-xl bg-stone-900 border border-stone-700 hover:bg-stone-800 text-stone-200 text-xs font-semibold transition-colors"
                    >
                      Update Status
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWaiterId(selectedTable.assignedWaiterId || "");
                      setCaptainInput(selectedTable.captainName || "");
                      setShowWaiterModal(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-stone-900 border border-stone-700 hover:bg-stone-800 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-[#E07A5F]" />
                    <span>{selectedTable.captainName ? `Server: ${selectedTable.captainName} (Change)` : "Assign Server / Waiter"}</span>
                  </button>

                  <button
                    onClick={() => handleQuickClear(selectedTable.id)}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    Quick Vacate / Clear Table
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settle Bill Modal */}
      {showSettleModal && selectedTable && (
        <Modal
          isOpen={showSettleModal}
          onClose={() => setShowSettleModal(false)}
          title={`Settle Bill: ${selectedTable.label}`}
          description="Complete payment transaction and release table to vacant"
        >
          <div className="space-y-5">
            {(!activeOrder || !activeOrder.items || activeOrder.items.length === 0 || (selectedTable.currentBill || activeOrder?.total || 0) <= 0) && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">No billable items in active order</p>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Ordinary settlement (UPI, Card, Cash) cannot be processed for ₹0.00. Use Cancel Empty Order to safely release the table without recording a fake sale, or settle as complimentary with an authorized reason.
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center">
              <span className="text-xs uppercase font-mono text-stone-400">Total Settlement Due</span>
              <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">
                ₹{(selectedTable.currentBill || activeOrder?.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-2">Select Payment Tender</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "upi", label: "UPI / QR", icon: QrCode },
                  { id: "card", label: "Credit/Debit", icon: CreditCard },
                  { id: "cash", label: "Cash Tender", icon: Banknote },
                  { id: "complimentary", label: "Complimentary", icon: ShieldCheck },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        paymentMethod === m.id
                          ? "bg-[#E07A5F]/20 border-[#E07A5F] text-[#F4A261] font-bold"
                          : "bg-stone-900 border-stone-800 text-stone-400 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px]">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === "complimentary" && (
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">Authorized Complimentary Reason *</label>
                <input
                  type="text"
                  value={complimentaryReason}
                  onChange={(e) => setComplimentaryReason(e.target.value)}
                  placeholder="e.g. Owner guest, VIP tasting, manager discretion"
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-stone-800">
              {(!activeOrder || !activeOrder.items || activeOrder.items.length === 0 || (selectedTable.currentBill || activeOrder?.total || 0) <= 0) ? (
                <button
                  type="button"
                  disabled={isSettling}
                  onClick={handleCancelEmptyOrder}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel Empty Order & Free Table</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                disabled={
                  isSettling ||
                  ((!activeOrder || !activeOrder.items || activeOrder.items.length === 0 || (selectedTable.currentBill || activeOrder?.total || 0) <= 0) &&
                    (paymentMethod !== "complimentary" || !complimentaryReason.trim()))
                }
                onClick={handleSettleBillSubmit}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSettling ? "Processing..." : paymentMethod === "complimentary" ? "Confirm Complimentary Settlement" : "Confirm Payment & Free Table"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer Table Modal */}
      {showTransferModal && selectedTable && (
        <Modal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          title={`Transfer Order: ${selectedTable.label}`}
          description="Move the active order, KOT tickets, and ledger to another vacant table"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Current bill (₹{selectedTable.currentBill}) will be re-routed to the chosen destination.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-2">Select Destination Table</label>
              {availableTargetTables.length === 0 ? (
                <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-400 text-center font-mono">
                  No vacant tables currently available for transfer.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {availableTargetTables.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTargetTableId(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        targetTableId === t.id
                          ? "bg-[#E07A5F]/20 border-[#E07A5F] text-[#F4A261] font-bold"
                          : "bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700"
                      }`}
                    >
                      <div className="text-sm font-bold font-mono">{t.label}</div>
                      <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                        {t.section} • {t.capacity} Pax
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetTableId || isTransferring}
                onClick={handleTransferSubmit}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs disabled:opacity-50"
              >
                {isTransferring ? "Transferring..." : "Transfer Order"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Status Modal */}
      {showStatusModal && selectedTable && (
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title={`Update Seating Status: ${selectedTable.label}`}
          description="Manually toggle table availability or server assignment"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-2">Select Table State</label>
              <div className="grid grid-cols-2 gap-2">
                {(["vacant", "occupied", "billed", "reserved"] as TableStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNewStatus(st)}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                      newStatus === st
                        ? "bg-[#E07A5F]/20 text-[#F4A261] border-[#E07A5F]"
                        : "bg-stone-900 border-stone-800 text-stone-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Assign Server / Captain Name
              </label>
              {staffList.length > 0 && (
                <select
                  value={staffList.find((s) => s.full_name === captainInput)?.id || ""}
                  onChange={(e) => {
                    const member = staffList.find((s) => s.id === e.target.value);
                    setCaptainInput(member ? member.full_name : "");
                  }}
                  className="w-full mb-2 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                >
                  <option value="">-- Select Registered Staff (or type below) --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role.replace("_", " ")})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={captainInput}
                onChange={(e) => setCaptainInput(e.target.value)}
                placeholder="e.g. Ramesh K. or Suresh"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F]"
              />
              <p className="text-[10px] text-stone-500 mt-1">Designates the floor captain responsible for this table session.</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleStatusChangeSubmit}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs"
              >
                {isUpdatingStatus ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Server / Waiter Modal */}
      {showWaiterModal && selectedTable && (
        <Modal
          isOpen={showWaiterModal}
          onClose={() => setShowWaiterModal(false)}
          title={`Assign Server: ${selectedTable.label}`}
          description="Select a registered staff member or enter a captain name for this table"
        >
          <form onSubmit={handleAssignWaiterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Select Staff Member
              </label>
              <select
                value={selectedWaiterId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedWaiterId(nextId);
                  const member = staffList.find((s) => s.id === nextId);
                  if (member) {
                    setCaptainInput(member.full_name);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              >
                <option value="">-- Unassigned / Custom Name Below --</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.role.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Or Enter Custom Server / Captain Name
              </label>
              <input
                type="text"
                value={captainInput}
                onChange={(e) => {
                  setCaptainInput(e.target.value);
                  setSelectedWaiterId("");
                }}
                placeholder="Leave blank to unassign"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowWaiterModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAssigningWaiter}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs"
              >
                {isAssigningWaiter ? "Assigning..." : "Save Server Assignment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Table Modal */}
      {showAddTableModal && (
        <Modal
          isOpen={showAddTableModal}
          onClose={() => setShowAddTableModal(false)}
          title="Add New Dining Table"
          description="Provision a new table with unique QR code and floor assignment"
        >
          <form onSubmit={handleCreateTableSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Table Number / Label <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                placeholder="e.g. T-09, Rooftop-01"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-[#E07A5F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Seating Capacity (Pax)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 2)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Floor / Section
                </label>
                <input
                  type="text"
                  required
                  value={newTableFloor}
                  onChange={(e) => setNewTableFloor(e.target.value)}
                  placeholder="e.g. Main AC Hall, Rooftop"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowAddTableModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingTable}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingTable ? "Creating..." : "Create Table"}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
      </div>

      {/* Printable Invoice Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Tax Invoice Generated"
        description="Official restaurant receipt with GST details"
        maxWidth="md"
      >
        <div className="space-y-4">
          {settledInvoice ? (
            <div className="p-6 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs text-stone-300 space-y-3">
              <div className="text-center space-y-0.5 border-b border-stone-800 pb-3">
                <h2 className="text-base font-bold text-white uppercase">{user?.restaurantName || "CHOTU RESTRO AI"}</h2>
                <p className="text-[10px] text-stone-400">Official Computerized Tax Invoice • Floor POS</p>
                <p className="text-[10px] text-stone-400">Date: {settledInvoice.date} • {settledInvoice.time}</p>
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
                {settledInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount Applied:</span>
                    <span>- ₹{settledInvoice.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-400">
                  <span>CGST:</span>
                  <span>₹{settledInvoice.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>SGST:</span>
                  <span>₹{settledInvoice.sgst.toFixed(2)}</span>
                </div>
                {settledInvoice.serviceCharge > 0 && (
                  <div className="flex justify-between text-stone-400">
                    <span>Service Charge:</span>
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
          ) : null}

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
          <div className="text-center pb-2 border-b-2 border-dashed border-black space-y-1">
            <h1 className="text-base font-extrabold uppercase tracking-wide">
              {user?.restaurantName || "CHOTU RESTRO AI"}
            </h1>
            <p className="text-[11px] font-semibold uppercase">
              Official Tax Invoice • Floor POS
            </p>
            <div className="text-[10px] pt-1 flex justify-between px-1">
              <span>Date: {settledInvoice.date} {settledInvoice.time}</span>
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

          <div className="py-2 space-y-1 text-[11px] border-b-2 border-dashed border-black">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{settledInvoice.subtotal.toFixed(2)}</span>
            </div>
            {settledInvoice.discount > 0 && (
              <div className="flex justify-between font-semibold">
                <span>Discount Applied:</span>
                <span>- ₹{settledInvoice.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>CGST:</span>
              <span>₹{settledInvoice.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>SGST:</span>
              <span>₹{settledInvoice.sgst.toFixed(2)}</span>
            </div>
            {settledInvoice.serviceCharge > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Service Charge:</span>
                <span>₹{settledInvoice.serviceCharge.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] font-extrabold pt-1.5 border-t border-black">
              <span>GRAND TOTAL:</span>
              <span>₹{settledInvoice.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center pt-2 space-y-0.5 text-[10px] text-gray-600">
            <p className="font-bold text-black uppercase">Thank you for dining with us!</p>
            <p>Visit again soon</p>
            <p className="text-[9px] text-gray-400 pt-1">Powered by Chotu Restro AI</p>
          </div>
        </div>
      )}
    </div>
  );
}
