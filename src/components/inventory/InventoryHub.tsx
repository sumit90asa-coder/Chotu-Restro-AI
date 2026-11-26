"use client";

import React, { useState, useEffect } from "react";
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  TrendingDown, 
  ShieldAlert, 
  X, 
  Sparkles,
  ArrowUpDown,
  Truck,
  FileCheck,
  Building,
  Check,
  Trash2,
  Edit2,
  History
} from "lucide-react";
import { 
  IngredientStock, 
  fetchIngredients, 
  adjustIngredientStock, 
  fetchStockAlerts,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  fetchStockTransactions,
  StockTransactionData
} from "@/lib/api/inventory";
import {
  SupplierData,
  PurchaseOrderData,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder
} from "@/lib/api/suppliers";
import { ClickSpark } from "@/components/animations/ClickSpark";
import { ReactiveButton } from "@/components/animations/ReactiveButton";

export const InventoryHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"ingredients" | "suppliers" | "purchase_orders">("ingredients");
  const [ingredients, setIngredients] = useState<IngredientStock[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "low" | "out">("all");
  
  // Stock Adjustment Modal state
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientStock | null>(null);
  const [adjDelta, setAdjDelta] = useState<string>("1.0");
  const [adjType, setAdjType] = useState<"intake" | "wastage" | "adjustment">("intake");
  const [adjReason, setAdjReason] = useState<string>("Fresh vendor delivery");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Add Ingredient Modal state
  const [showAddIngredientModal, setShowAddIngredientModal] = useState<boolean>(false);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    unit: "kg",
    current_stock: 10,
    reorder_threshold: 5,
    cost_per_unit: 50,
    supplier_name: "",
  });

  // Edit Ingredient Modal state
  const [editingIngredient, setEditingIngredient] = useState<IngredientStock | null>(null);

  // History Modal state
  const [historyIngredient, setHistoryIngredient] = useState<IngredientStock | null>(null);
  const [ingredientTransactions, setIngredientTransactions] = useState<StockTransactionData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Supplier modal
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
  });

  // PO creation modal
  const [showAddPOModal, setShowAddPOModal] = useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [poIngredientId, setPOIngredientId] = useState<string>("");
  const [poQuantity, setPOQuantity] = useState<number>(10);
  const [poUnitCost, setPOUnitCost] = useState<number>(100);

  // Receive PO modal
  const [receivingPO, setReceivingPO] = useState<PurchaseOrderData | null>(null);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState<string>("INV-REC-001");
  const [receivedQtyInput, setReceivedQtyInput] = useState<number>(10);
  const [actualUnitCostInput, setActualUnitCostInput] = useState<number>(100);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ingList, alertList, suppList, poList] = await Promise.all([
        fetchIngredients().catch(() => []),
        fetchStockAlerts().catch(() => []),
        fetchSuppliers().catch(() => []),
        fetchPurchaseOrders().catch(() => [])
      ]);
      setIngredients(ingList);
      setAlerts(alertList);
      setSuppliers(suppList);
      setPurchaseOrders(poList);
      if (suppList.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(suppList[0].id);
      }
      if (ingList.length > 0 && !poIngredientId) {
        setPOIngredientId(ingList[0].id);
        setPOUnitCost(Number(ingList[0].cost_per_unit) || 100);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleAdjustStock = async () => {
    if (!selectedIngredient) return;
    const numDelta = parseFloat(adjDelta);
    if (isNaN(numDelta) || numDelta === 0) return;

    try {
      setSubmitting(true);
      const effectiveDelta = adjType === "wastage" ? -Math.abs(numDelta) : numDelta;

      await adjustIngredientStock(selectedIngredient.id, {
        quantity_delta: effectiveDelta,
        transaction_type: adjType,
        reason: adjReason,
      });

      showToast(`Stock updated for ${selectedIngredient.name}: ${effectiveDelta > 0 ? "+" : ""}${effectiveDelta} ${selectedIngredient.unit}`);
      setSelectedIngredient(null);
      setAdjDelta("1.0");
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    try {
      setSubmitting(true);
      const created = await createSupplier(newSupplier);
      setSuppliers((prev) => [created, ...prev]);
      showToast(`Added vendor profile: ${created.name}`);
      setShowAddSupplierModal(false);
      setNewSupplier({ name: "", contact_person: "", phone: "", email: "", gstin: "", address: "" });
    } catch (err: any) {
      showToast(err.message || "Failed to register supplier");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !poIngredientId) return;
    try {
      setSubmitting(true);
      const po = await createPurchaseOrder({
        supplier_id: selectedSupplierId,
        items: [
          {
            ingredient_id: poIngredientId,
            ordered_quantity: Number(poQuantity),
            unit_cost: Number(poUnitCost),
          }
        ]
      });
      setPurchaseOrders((prev) => [po, ...prev]);
      showToast(`Purchase order #${po.po_number} created successfully!`);
      setShowAddPOModal(false);
    } catch (err: any) {
      showToast(err.message || "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceivePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO || receivingPO.items.length === 0) return;
    try {
      setSubmitting(true);
      const item = receivingPO.items[0];
      const updated = await receivePurchaseOrder(receivingPO.id, {
        invoice_number: invoiceNumberInput,
        idempotency_key: `recv-${receivingPO.id}-${Date.now()}`,
        items: [
          {
            ingredient_id: item.ingredient_id,
            received_quantity: Number(receivedQtyInput),
            actual_unit_cost: Number(actualUnitCostInput),
          }
        ]
      });
      showToast(`PO #${receivingPO.po_number} received! Weighted average inventory cost recalculated.`);
      setReceivingPO(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to receive purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredient.name.trim()) return;
    try {
      setSubmitting(true);
      const created = await createIngredient({
        name: newIngredient.name.trim(),
        unit: newIngredient.unit,
        current_stock: Number(newIngredient.current_stock) || 0,
        reorder_threshold: Number(newIngredient.reorder_threshold) || 5,
        cost_per_unit: Number(newIngredient.cost_per_unit) || 0,
        supplier_name: newIngredient.supplier_name.trim() || undefined,
      });
      showToast(`Added raw ingredient: ${created.name}`);
      setShowAddIngredientModal(false);
      setNewIngredient({
        name: "",
        unit: "kg",
        current_stock: 10,
        reorder_threshold: 5,
        cost_per_unit: 50,
        supplier_name: "",
      });
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create ingredient");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;
    try {
      setSubmitting(true);
      const updated = await updateIngredient(editingIngredient.id, {
        name: editingIngredient.name,
        unit: editingIngredient.unit,
        current_stock: Number(editingIngredient.current_stock),
        reorder_threshold: Number(editingIngredient.reorder_threshold),
        cost_per_unit: Number(editingIngredient.cost_per_unit),
        supplier_name: editingIngredient.supplier_name || undefined,
      });
      showToast(`Updated ingredient: ${updated.name}`);
      setEditingIngredient(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update ingredient");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIngredient = async (ing: IngredientStock) => {
    if (!confirm(`Are you sure you want to delete raw ingredient "${ing.name}"?`)) return;
    try {
      await deleteIngredient(ing.id);
      showToast(`Deleted ingredient: ${ing.name}`);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete ingredient");
    }
  };

  const handleViewHistory = async (ing: IngredientStock) => {
    setHistoryIngredient(ing);
    setLoadingHistory(true);
    try {
      const txs = await fetchStockTransactions(ing.id);
      setIngredientTransactions(txs);
    } catch (err: any) {
      showToast(err.message || "Failed to load stock history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtered ingredients
  const filtered = ingredients.filter((ing) => {
    const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterMode === "low") return matchesSearch && ing.is_low_stock && ing.current_stock > 0;
    if (filterMode === "out") return matchesSearch && ing.current_stock <= 0;
    return matchesSearch;
  });

  const lowStockCount = ingredients.filter((i) => i.is_low_stock && i.current_stock > 0).length;
  const outOfStockCount = ingredients.filter((i) => i.current_stock <= 0).length;
  const totalValuation = ingredients.reduce((acc, i) => acc + i.current_stock * i.cost_per_unit, 0);

  return (
    <div className="flex-1 p-6 lg:p-10 bg-canvas space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-border pb-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
            <span>Raw Material &amp; Supplier Procurement</span>
            <span className="w-2.5 h-2.5 rounded-full bg-dietary-veg"></span>
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Automatic recipe consumption upon KOT firing, supplier purchase orders, and row-locked WAC inventory valuation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-1.5 border border-border bg-canvas-card hover:bg-canvas-subtle text-xs font-mono text-ink flex items-center gap-2 rounded transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand ${loading ? "animate-spin" : ""}`} />
            <span>Sync DB</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-canvas px-4 py-2.5 text-xs font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 rounded">
          <CheckCircle2 className="w-4 h-4 text-dietary-veg" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-canvas-card border border-border p-5 space-y-1 rounded">
          <div className="text-xs font-mono text-ink-secondary uppercase">Tracked Items</div>
          <div className="text-2xl font-bold font-mono text-ink">{ingredients.length} Items</div>
          <div className="text-xs text-ink-secondary">Linked to dish recipes</div>
        </div>

        <div className="bg-canvas-card border border-border p-5 space-y-1 rounded">
          <div className="text-xs font-mono text-ink-secondary uppercase">Low Stock Warnings</div>
          <div className="text-2xl font-bold font-mono text-accent">{lowStockCount} Items</div>
          <div className="text-xs text-accent">Below safety threshold</div>
        </div>

        <div className="bg-canvas-card border border-border p-5 space-y-1 rounded">
          <div className="text-xs font-mono text-ink-secondary uppercase">Suppliers / POs</div>
          <div className="text-2xl font-bold font-mono text-brand">{suppliers.length} / {purchaseOrders.length}</div>
          <div className="text-xs text-brand">Active supply chains</div>
        </div>

        <div className="bg-canvas-card border border-border p-5 space-y-1 rounded">
          <div className="text-xs font-mono text-ink-secondary uppercase">Est. Stock Valuation</div>
          <div className="text-2xl font-bold font-mono text-ink">₹ {totalValuation.toFixed(2)}</div>
          <div className="text-xs text-dietary-veg font-medium">Weighted average cost</div>
        </div>
      </div>

      {/* Top Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("ingredients")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "ingredients"
              ? "bg-brand text-white"
              : "bg-canvas-card border border-border text-ink-secondary hover:text-ink"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Raw Ingredients &amp; Stocks</span>
        </button>

        <button
          onClick={() => setActiveTab("suppliers")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "suppliers"
              ? "bg-brand text-white"
              : "bg-canvas-card border border-border text-ink-secondary hover:text-ink"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Suppliers &amp; Vendors ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("purchase_orders")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "purchase_orders"
              ? "bg-brand text-white"
              : "bg-canvas-card border border-border text-ink-secondary hover:text-ink"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Purchase Orders &amp; Receipts ({purchaseOrders.length})</span>
        </button>
      </div>

      {/* TAB 1: RAW INGREDIENTS */}
      {activeTab === "ingredients" && (
        <div className="space-y-6">
          {/* Active Low Stock Alerts Banner */}
          {(lowStockCount > 0 || outOfStockCount > 0) && (
            <div className="p-4 bg-accent/10 border border-accent/30 rounded flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-ink">
                    Stock Warning: {lowStockCount + outOfStockCount} ingredients require procurement
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Depleted stock levels for {ingredients.filter(i => Number(i.current_stock) <= 0 || i.is_low_stock).map(i => i.name).slice(0, 3).join(", ") || "core kitchen staples"}. Order from your registered vendors to avoid 86ing bestselling dishes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab("purchase_orders");
                  setShowAddPOModal(true);
                }}
                className="px-3.5 py-1.5 bg-accent text-white font-mono text-xs font-bold rounded shadow-xs hover:bg-accent/90 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Purchase Order</span>
              </button>
            </div>
          )}

          {/* Operational Filter and Search Bar */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search raw ingredients (e.g. Chicken, Paneer, Flour)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-canvas border border-border pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-faint focus:outline-none focus:border-ink-secondary transition-colors rounded"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAddIngredientModal(true)}
                className="px-3 py-1.5 bg-brand text-white font-mono text-xs font-bold rounded shadow-xs hover:bg-brand/90 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Raw Ingredient</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    filterMode === "all"
                      ? "bg-ink text-canvas font-bold"
                      : "text-ink-secondary hover:text-ink bg-canvas-card border border-border"
                  }`}
                >
                  All ({ingredients.length})
                </button>
                <button
                  onClick={() => setFilterMode("low")}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    filterMode === "low"
                      ? "bg-accent text-white font-bold"
                      : "text-accent bg-accent/10 border border-accent/20 hover:bg-accent/20"
                  }`}
                >
                  Low ({lowStockCount})
                </button>
                <button
                  onClick={() => setFilterMode("out")}
                  className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                    filterMode === "out"
                      ? "bg-dietary-nonveg text-white font-bold"
                      : "text-dietary-nonveg bg-dietary-nonveg/10 border border-dietary-nonveg/20 hover:bg-dietary-nonveg/20"
                  }`}
                >
                  Out ({outOfStockCount})
                </button>
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="bg-canvas-card border border-border rounded overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-canvas-subtle text-ink-secondary font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">Ingredient</th>
                    <th className="py-3 px-4 font-semibold text-right">Current Stock</th>
                    <th className="py-3 px-4 font-semibold text-right">Min Threshold</th>
                    <th className="py-3 px-4 font-semibold text-right">Cost / Unit (WAC)</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-ink-secondary font-mono">
                        No ingredients found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((ing) => {
                      const isOut = ing.current_stock <= 0;
                      const isLow = ing.is_low_stock && !isOut;

                      return (
                        <tr key={ing.id} className="hover:bg-canvas-subtle/50 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-ink flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-brand" />
                            <span>{ing.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-ink">
                            {Number(ing.current_stock).toFixed(3)} {ing.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-ink-secondary">
                            {Number(ing.min_reorder_level).toFixed(3)} {ing.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-ink">
                            ₹ {Number(ing.cost_per_unit).toFixed(2)} / {ing.unit}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                                isOut
                                  ? "bg-dietary-nonveg/15 text-dietary-nonveg border border-dietary-nonveg/30"
                                  : isLow
                                  ? "bg-accent/15 text-accent border border-accent/30"
                                  : "bg-dietary-veg/15 text-dietary-veg border border-dietary-veg/30"
                              }`}
                            >
                              {ing.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedIngredient(ing);
                                  setAdjDelta("5.0");
                                  setAdjType("intake");
                                  setAdjReason("Fresh shipment receipt");
                                }}
                                className="px-2 py-1 border border-border hover:border-brand text-ink text-[11px] font-mono font-medium rounded hover:bg-canvas transition-all cursor-pointer"
                                title="Adjust stock"
                              >
                                Adjust
                              </button>
                              <button
                                onClick={() => setEditingIngredient(ing)}
                                className="p-1 border border-border hover:border-brand text-ink rounded hover:bg-canvas transition-all cursor-pointer"
                                title="Edit ingredient"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-ink-secondary" />
                              </button>
                              <button
                                onClick={() => handleViewHistory(ing)}
                                className="p-1 border border-border hover:border-brand text-ink rounded hover:bg-canvas transition-all cursor-pointer"
                                title="Stock movement history"
                              >
                                <History className="w-3.5 h-3.5 text-ink-secondary" />
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(ing)}
                                className="p-1 border border-border hover:border-dietary-nonveg text-dietary-nonveg rounded hover:bg-dietary-nonveg/10 transition-all cursor-pointer"
                                title="Delete ingredient"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIERS */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-ink">Registered Restaurant Suppliers</h3>
            <button
              onClick={() => setShowAddSupplierModal(true)}
              className="px-3.5 py-1.5 bg-brand text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Supplier</span>
            </button>
          </div>

          <div className="bg-canvas-card border border-border rounded overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-canvas-subtle text-ink-secondary font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">Supplier Name</th>
                    <th className="py-3 px-4 font-semibold">Contact Person</th>
                    <th className="py-3 px-4 font-semibold">Phone</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">GSTIN</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-ink-secondary font-mono">
                        No suppliers registered yet. Click "Add New Supplier" to create your vendor network.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-canvas-subtle/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-ink">{sup.name}</td>
                        <td className="py-3 px-4 text-ink-secondary">{sup.contact_person || "—"}</td>
                        <td className="py-3 px-4 font-mono text-ink">{sup.phone || "—"}</td>
                        <td className="py-3 px-4 text-ink-secondary">{sup.email || "—"}</td>
                        <td className="py-3 px-4 font-mono text-xs">{sup.gstin || "—"}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={async () => {
                              try {
                                await updateSupplier(sup.id, { is_active: !sup.is_active });
                                showToast(`Vendor status updated for ${sup.name}`);
                                const s = await fetchSuppliers();
                                setSuppliers(s);
                              } catch {
                                showToast("Failed to update vendor status");
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                              sup.is_active
                                ? "bg-dietary-veg/15 text-dietary-veg border-dietary-veg/30 hover:bg-dietary-veg/25"
                                : "bg-canvas-subtle text-ink-muted border-border hover:text-ink"
                            }`}
                          >
                            {sup.is_active ? "Active Vendor" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete supplier ${sup.name}?`)) return;
                              try {
                                const res = await deleteSupplier(sup.id);
                                showToast(res.message || "Supplier removed");
                                const s = await fetchSuppliers();
                                setSuppliers(s);
                              } catch (err: any) {
                                showToast(err?.message || "Failed to delete supplier");
                              }
                            }}
                            className="p-1 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Delete or Deactivate Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PURCHASE ORDERS */}
      {activeTab === "purchase_orders" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-ink">Purchase Orders &amp; WAC Receipts</h3>
            <button
              onClick={() => setShowAddPOModal(true)}
              className="px-3.5 py-1.5 bg-brand text-white text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Raise Purchase Order</span>
            </button>
          </div>

          <div className="bg-canvas-card border border-border rounded overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-canvas-subtle text-ink-secondary font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">PO Number</th>
                    <th className="py-3 px-4 font-semibold">Supplier</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Created Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-ink-secondary font-mono">
                        No purchase orders placed yet.
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => {
                      const supp = suppliers.find((s) => s.id === po.supplier_id);
                      return (
                        <tr key={po.id} className="hover:bg-canvas-subtle/50 transition-colors">
                          <td className="py-3 px-4 font-bold font-mono text-ink">#{po.po_number}</td>
                          <td className="py-3 px-4 text-ink-secondary">{supp?.name || po.supplier_name || "Vendor"}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">
                            ₹{Number(po.total_amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                po.status === "received"
                                  ? "bg-dietary-veg/15 text-dietary-veg border border-dietary-veg/30"
                                  : "bg-accent/15 text-accent border border-accent/30"
                              }`}
                            >
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-ink-secondary font-mono">
                            {new Date(po.created_at).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {po.status !== "received" ? (
                              <button
                                onClick={() => {
                                  setReceivingPO(po);
                                  if (po.items && po.items.length > 0) {
                                    setReceivedQtyInput(po.items[0].ordered_quantity);
                                    setActualUnitCostInput(po.items[0].unit_cost);
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-mono font-bold rounded cursor-pointer transition-colors"
                              >
                                Receive Stock
                              </button>
                            ) : (
                              <span className="text-ink-secondary font-mono text-[11px]">✓ Received &amp; Costed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {selectedIngredient && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-canvas-card border border-border w-full max-w-md rounded shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-brand" />
                <h3 className="font-bold text-sm text-ink">
                  Stock Adjustment: {selectedIngredient.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIngredient(null)}
                className="text-ink-secondary hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-canvas-subtle border border-border rounded text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Current Balance:</span>
                <span className="font-bold text-ink">
                  {Number(selectedIngredient.current_stock).toFixed(3)} {selectedIngredient.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Unit Valuation (WAC):</span>
                <span className="text-ink">₹ {Number(selectedIngredient.cost_per_unit).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-semibold mb-1">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjType("intake");
                      setAdjReason("Vendor shipment delivery");
                    }}
                    className={`py-1.5 px-2 rounded border text-center transition-all cursor-pointer ${
                      adjType === "intake"
                        ? "border-dietary-veg bg-dietary-veg/15 text-dietary-veg font-bold"
                        : "border-border text-ink-secondary hover:bg-canvas-subtle"
                    }`}
                  >
                    + Intake
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjType("wastage");
                      setAdjReason("Kitchen spoilage / wastage");
                    }}
                    className={`py-1.5 px-2 rounded border text-center transition-all cursor-pointer ${
                      adjType === "wastage"
                        ? "border-dietary-nonveg bg-dietary-nonveg/15 text-dietary-nonveg font-bold"
                        : "border-border text-ink-secondary hover:bg-canvas-subtle"
                    }`}
                  >
                    - Wastage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjType("adjustment");
                      setAdjReason("Physical inventory reconciliation");
                    }}
                    className={`py-1.5 px-2 rounded border text-center transition-all cursor-pointer ${
                      adjType === "adjustment"
                        ? "border-brand bg-brand-faint text-brand font-bold"
                        : "border-border text-ink-secondary hover:bg-canvas-subtle"
                    }`}
                  >
                    Audit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">
                  Quantity ({selectedIngredient.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={adjDelta}
                  onChange={(e) => setAdjDelta(e.target.value)}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded focus:outline-none focus:border-brand"
                  placeholder="e.g. 5.0"
                />
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Audit Reason / Memo</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                  placeholder="Reason for adjustment"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedIngredient(null)}
                className="px-3.5 py-1.5 text-xs text-ink-secondary hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <ReactiveButton
                variant="primary"
                size="sm"
                onClick={handleAdjustStock}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold"
              >
                {submitting ? "Saving..." : "Confirm Stock Delta"}
              </ReactiveButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="bg-canvas-card border border-border w-full max-w-md rounded shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-ink">Register New Supplier Profile</h3>
              <button type="button" onClick={() => setShowAddSupplierModal(false)} className="text-ink-secondary hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Vendor / Firm Legal Name *</label>
              <input
                type="text"
                required
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                placeholder="e.g. Royal Spice Traders"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Contact Person</label>
                <input
                  type="text"
                  value={newSupplier.contact_person}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded"
                  placeholder="e.g. Vijay Kumar"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink font-mono rounded"
                  placeholder="+91 98200 11223"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Email</label>
                <input
                  type="email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded"
                  placeholder="vendor@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={newSupplier.gstin}
                  onChange={(e) => setNewSupplier({ ...newSupplier, gstin: e.target.value.toUpperCase() })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono uppercase text-ink rounded"
                  placeholder="27AABCU1234F1Z1"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Warehouse / Supply Address</label>
              <input
                type="text"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded"
                placeholder="Market Yard, Pune 411037"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="px-3.5 py-1.5 text-xs text-ink-secondary hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-brand text-white font-bold text-xs rounded cursor-pointer hover:bg-brand/90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Supplier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Purchase Order Modal */}
      {showAddPOModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreatePO} className="bg-canvas-card border border-border w-full max-w-md rounded shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-ink">Raise New Purchase Order</h3>
              <button type="button" onClick={() => setShowAddPOModal(false)} className="text-ink-secondary hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Select Registered Vendor *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.contact_person || "Contact"})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Target Raw Material *</label>
              <select
                required
                value={poIngredientId}
                onChange={(e) => {
                  setPOIngredientId(e.target.value);
                  const sel = ingredients.find((i) => i.id === e.target.value);
                  if (sel) setPOUnitCost(Number(sel.cost_per_unit));
                }}
                className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name} (Current: {ing.current_stock} {ing.unit})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Ordered Quantity</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={poQuantity}
                  onChange={(e) => setPOQuantity(Number(e.target.value))}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Target Cost / Unit (₹)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={poUnitCost}
                  onChange={(e) => setPOUnitCost(Number(e.target.value))}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                />
              </div>
            </div>

            <div className="p-3 bg-canvas-subtle border border-border rounded text-xs font-mono flex justify-between">
              <span className="text-ink-secondary">Estimated PO Total:</span>
              <span className="font-bold text-ink">₹ {(poQuantity * poUnitCost).toFixed(2)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddPOModal(false)}
                className="px-3.5 py-1.5 text-xs text-ink-secondary hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-brand text-white font-bold text-xs rounded cursor-pointer hover:bg-brand/90 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Generate Purchase Order"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receive Stock Modal */}
      {receivingPO && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleReceivePO} className="bg-canvas-card border border-border w-full max-w-md rounded shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-ink">Receive Stock: PO #{receivingPO.po_number}</h3>
              <button type="button" onClick={() => setReceivingPO(null)} className="text-ink-secondary hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Vendor Invoice / Delivery Challan #</label>
              <input
                type="text"
                required
                value={invoiceNumberInput}
                onChange={(e) => setInvoiceNumberInput(e.target.value)}
                className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink font-mono rounded"
                placeholder="INV-9921"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Actually Received Qty</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={receivedQtyInput}
                  onChange={(e) => setReceivedQtyInput(Number(e.target.value))}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Billed Unit Cost (₹)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={actualUnitCostInput}
                  onChange={(e) => setActualUnitCostInput(Number(e.target.value))}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                />
              </div>
            </div>

            <div className="p-3 bg-canvas-subtle border border-border rounded text-[11px] font-mono text-ink-secondary space-y-1">
              <p>• Updates stock ledger with row-level transaction lock (SELECT FOR UPDATE).</p>
              <p>• Recalculates Weighted Average Cost (WAC) based on actual invoice price.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setReceivingPO(null)}
                className="px-3.5 py-1.5 text-xs text-ink-secondary hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Receiving & Costing..." : "Confirm Stock Receipt"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Raw Ingredient Modal */}
      {showAddIngredientModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateIngredient} className="bg-canvas-card border border-border w-full max-w-md rounded shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <Package className="w-4 h-4 text-brand" />
                <span>Add New Raw Material / Ingredient</span>
              </h3>
              <button type="button" onClick={() => setShowAddIngredientModal(false)} className="text-ink-secondary hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Ingredient Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Biryani Rice"
                  value={newIngredient.name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Unit of Measurement *</label>
                  <select
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="l">l (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces / Units)</option>
                    <option value="packet">packet (Packets)</option>
                    <option value="can">can (Cans)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Opening Stock ({newIngredient.unit})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={newIngredient.current_stock}
                    onChange={(e) => setNewIngredient({ ...newIngredient, current_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Min Safety Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={newIngredient.reorder_threshold}
                    onChange={(e) => setNewIngredient({ ...newIngredient, reorder_threshold: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Purchase Price / Unit (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={newIngredient.cost_per_unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Associate Supplier (Optional)</label>
                <select
                  value={newIngredient.supplier_name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, supplier_name: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                >
                  <option value="">-- No Supplier Associated --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} ({s.contact_person || "Contact"})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddIngredientModal(false)}
                className="px-3.5 py-1.5 text-xs text-ink-secondary hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-brand text-white font-bold text-xs rounded cursor-pointer hover:bg-brand/90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Raw Material"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Ingredient Modal */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleUpdateIngredient} className="bg-canvas-card border border-border w-full max-w-md rounded shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand" />
                <span>Edit Raw Material: {editingIngredient.name}</span>
              </h3>
              <button type="button" onClick={() => setEditingIngredient(null)} className="text-ink-secondary hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Ingredient Name</label>
                <input
                  type="text"
                  required
                  value={editingIngredient.name}
                  onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Measurement Unit</label>
                  <select
                    value={editingIngredient.unit}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, unit: e.target.value })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="l">l (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces / Units)</option>
                    <option value="packet">packet (Packets)</option>
                    <option value="can">can (Cans)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Current Stock ({editingIngredient.unit})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={editingIngredient.current_stock}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, current_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Min Threshold ({editingIngredient.unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={editingIngredient.reorder_threshold}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, reorder_threshold: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Cost Per Unit (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={editingIngredient.cost_per_unit}
                    onChange={(e) => setEditingIngredient({ ...editingIngredient, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-canvas border border-border px-3 py-2 text-xs font-mono text-ink rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Associated Supplier</label>
                <select
                  value={editingIngredient.supplier_name || ""}
                  onChange={(e) => setEditingIngredient({ ...editingIngredient, supplier_name: e.target.value })}
                  className="w-full bg-canvas border border-border px-3 py-2 text-xs text-ink rounded focus:outline-none focus:border-brand"
                >
                  <option value="">-- No Supplier Associated --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingIngredient(null)}
                className="px-3.5 py-1.5 text-xs text-ink-secondary hover:text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-brand text-white font-bold text-xs rounded cursor-pointer hover:bg-brand/90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Movement History Modal */}
      {historyIngredient && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-canvas-card border border-border w-full max-w-2xl rounded shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <History className="w-4 h-4 text-brand" />
                <span>Stock Movement Ledger: {historyIngredient.name}</span>
              </h3>
              <button type="button" onClick={() => setHistoryIngredient(null)} className="text-ink-secondary hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-ink-secondary font-mono">Loading transactions...</div>
              ) : ingredientTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-secondary font-mono">No stock movements recorded yet for this ingredient.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-canvas-subtle text-ink-secondary font-mono uppercase text-[10px]">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3">Reference / Order</th>
                      <th className="py-2 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ingredientTransactions.map((tx) => {
                      const isPositive = Number(tx.quantity) > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-canvas-subtle/40 font-mono text-[11px]">
                          <td className="py-2.5 px-3 text-ink-secondary">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="py-2.5 px-3 uppercase font-bold text-ink">{tx.transaction_type}</td>
                          <td className={`py-2.5 px-3 text-right font-bold ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                            {isPositive ? "+" : ""}{Number(tx.quantity).toFixed(3)} {historyIngredient.unit}
                          </td>
                          <td className="py-2.5 px-3 text-ink-secondary">{tx.reference_id || "Manual"}</td>
                          <td className="py-2.5 px-3 text-ink truncate max-w-xs">{tx.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setHistoryIngredient(null)}
                className="px-4 py-1.5 bg-ink text-canvas text-xs font-bold rounded cursor-pointer hover:bg-ink/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
