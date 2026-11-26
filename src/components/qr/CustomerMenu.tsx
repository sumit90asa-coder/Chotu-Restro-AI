"use client";

import React, { useState, useEffect } from "react";
import { MenuItem } from "@/types/restaurant";
import { 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  Flame, 
  Search, 
  ShoppingBag, 
  Sparkles, 
  X, 
  Utensils, 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  EyeOff,
  Eye,
  FileText
} from "lucide-react";
import { submitQROrder, fetchQRMenu, fetchCurrentQROrder, QRMenuResponse } from "@/lib/api/qr";
import { mapBackendMenuItem } from "@/lib/api/menu";

interface CartItem {
  dish: MenuItem;
  qty: number;
  notes?: string;
}

interface ConfirmedOrder {
  tokenNumber: string;
  orderNumber: string;
  totalAmount: number;
  itemsCount: number;
  placedAt: string;
  status: "queued" | "preparing" | "ready";
}

interface CustomerMenuProps {
  token?: string;
  tableLabel?: string;
  onMenuLoaded?: (data: QRMenuResponse) => void;
  onOrderCreated?: () => void;
}

export const CustomerMenu: React.FC<CustomerMenuProps> = ({
  token = "qr-t01-demo",
  tableLabel = "Table 01",
  onMenuLoaded,
  onOrderCreated,
}) => {
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dietary, setDietary] = useState<"all" | "veg" | "nonveg">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hideOutOfStock, setHideOutOfStock] = useState<boolean>(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState<boolean>(false);
  const [customizingDish, setCustomizingDish] = useState<MenuItem | null>(null);
  const [itemNote, setItemNote] = useState<string>("");

  // Order Submission & Live Tracking State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadMenu = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [data, activeOrd] = await Promise.all([
        fetchQRMenu(token),
        fetchCurrentQROrder(token).catch(() => null),
      ]);
      if (data && Array.isArray(data.items)) {
        setDishes(data.items.map(mapBackendMenuItem));
        if (onMenuLoaded) {
          onMenuLoaded(data);
        }
      } else {
        setFetchError("No menu items found for this restaurant.");
      }

      if (activeOrd && activeOrd.id) {
        const confirmed: ConfirmedOrder = {
          tokenNumber: activeOrd.token_number || activeOrd.id,
          orderNumber: activeOrd.order_number || `${tableLabel}`,
          totalAmount: Number(activeOrd.total_amount || 0),
          itemsCount: activeOrd.items ? activeOrd.items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0) : 0,
          placedAt: activeOrd.created_at ? new Date(activeOrd.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active",
          status: "preparing",
        };
        setConfirmedOrder(confirmed);
        try {
          localStorage.setItem(`chotu_qr_order_${token}`, JSON.stringify(confirmed));
        } catch {}
        if (onMenuLoaded && data) {
          onMenuLoaded({ ...data, table_status: "occupied" });
        }
      } else {
        try {
          const cached = localStorage.getItem(`chotu_qr_order_${token}`);
          if (cached) {
            setConfirmedOrder(JSON.parse(cached));
          }
        } catch {}
      }
    } catch (err: any) {
      console.error("QR Menu Fetch Error:", err);
      setFetchError(err?.message || "Invalid or expired table QR code. Please ask staff for assistance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadMenu();
    }
  }, [token]);

  // Cart Operations
  const handleAddDish = (dish: MenuItem, note?: string) => {
    if (!dish.inStock) {
      showToast(`${dish.name} is currently sold out.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.dish.id === dish.id && i.notes === note);
      if (existing) {
        return prev.map((i) =>
          i.dish.id === dish.id && i.notes === note ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { dish, qty: 1, notes: note }];
    });
    showToast(`Added ${dish.name} to order`);
  };

  const handleUpdateQty = (dishId: string, delta: number, note?: string) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.dish.id === dishId && i.notes === note) {
            const nextQty = i.qty + delta;
            return nextQty > 0 ? { ...i, qty: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (dishId: string, note?: string) => {
    setCart((prev) => prev.filter((i) => !(i.dish.id === dishId && i.notes === note)));
  };

  // Calculations
  const totalItemsCount = cart.reduce((acc, i) => acc + i.qty, 0);
  const subtotal = cart.reduce((acc, i) => acc + i.dish.price * i.qty, 0);
  const gst = subtotal * 0.05; // 5% GST
  const grandTotal = subtotal + gst;

  // Filter Dishes
  const filteredDishes = dishes.filter((dish) => {
    if (hideOutOfStock && !dish.inStock) return false;
    const matchesCat = selectedCategory === "all" || dish.category === selectedCategory;
    const matchesDietary = dietary === "all" || dish.dietary === dietary;
    const matchesSearch =
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesDietary && matchesSearch;
  });

  const categories = [
    { id: "all", label: "All Items" },
    { id: "starters", label: "Starters & Tandoor" },
    { id: "mains", label: "Main Curries" },
    { id: "breads", label: "Breads & Roti" },
    { id: "desserts", label: "Desserts" },
    { id: "beverages", label: "Beverages" },
  ];

  // Submit Order via API
  const handlePlaceOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    try {
      const res = await submitQROrder(token, {
        customer_name: `Guest (${tableLabel})`,
        idempotency_key: idempotencyKey,
        items: cart.map((c) => ({
          dish_id: c.dish.id,
          name: c.dish.name,
          price: c.dish.price,
          quantity: c.qty,
          dietary: c.dish.dietary,
          station: c.dish.station,
          notes: c.notes,
        })),
        captain_notes: `Customer self-order via Table QR`,
      });

      const itemsCount = res.items
        ? res.items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0)
        : totalItemsCount;

      const confirmed: ConfirmedOrder = {
        tokenNumber: res.token_number || `IND-${Date.now().toString().slice(-6)}`,
        orderNumber: res.order_number || `${tableLabel}-1`,
        totalAmount: Number(res.total_amount || grandTotal),
        itemsCount: itemsCount,
        placedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "preparing",
      };

      setConfirmedOrder(confirmed);
      try {
        localStorage.setItem(`chotu_qr_order_${token}`, JSON.stringify(confirmed));
      } catch {}
      setCart([]);
      setShowCartDrawer(false);
      if (onOrderCreated) onOrderCreated();
      if (onMenuLoaded) {
        onMenuLoaded({
          restaurant_name: "",
          table_id: "",
          table_label: tableLabel,
          table_status: "occupied",
          items: [],
        });
      }
    } catch (err: any) {
      console.error("QR order API error:", err);
      const msg = err?.message || "Failed to submit order. Please alert the server.";
      setSubmitError(msg);
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Error State
  if (fetchError) {
    return (
      <div className="py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Invalid or Expired Table QR</h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
            {fetchError}
          </p>
        </div>
        <button
          onClick={loadMenu}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 hover:text-white text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Menu</span>
        </button>
      </div>
    );
  }

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-stone-900/60 rounded-2xl border border-stone-800" />
        <div className="flex gap-2">
          <div className="h-8 bg-stone-900/60 rounded-xl flex-1" />
          <div className="h-8 bg-stone-900/60 rounded-xl flex-1" />
          <div className="h-8 bg-stone-900/60 rounded-xl flex-1" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-3xl bg-[#181413] border border-stone-800 flex gap-4 items-center">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-stone-800 rounded w-2/3" />
                <div className="h-3 bg-stone-900 rounded w-full" />
                <div className="h-4 bg-stone-800 rounded w-1/4 mt-2" />
              </div>
              <div className="w-20 h-20 bg-stone-900 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#181413] border border-[#E07A5F] text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 text-[#E07A5F]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmed Order Active Status Banner */}
      {confirmedOrder && (
        <div className="p-5 rounded-3xl bg-[#181413] border border-emerald-500/40 shadow-xl space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold block">
                  Order Fired to Kitchen
                </span>
                <h3 className="text-base font-bold text-white font-mono">{confirmedOrder.tokenNumber}</h3>
              </div>
            </div>
            <span className="text-xs font-mono text-stone-400">{confirmedOrder.placedAt}</span>
          </div>

          {/* Kitchen Timeline Stepper */}
          <div className="p-3.5 rounded-2xl bg-stone-900/80 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Check className="w-3.5 h-3.5" /> Order Received
              </span>
              <span className="flex items-center gap-1.5 text-[#F4A261] font-bold animate-pulse">
                <Flame className="w-3.5 h-3.5" /> Cooking on Pass
              </span>
              <span className="text-stone-500">Ready to Serve</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-[#F4A261] w-2/3" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
            <span>{confirmedOrder.itemsCount} dishes ordered • ₹{confirmedOrder.totalAmount.toFixed(2)}</span>
            <span className="text-[11px] text-stone-500 italic">Bill settled with server after dining</span>
          </div>
        </div>
      )}

      {/* Search & Filter Strip */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search our delicious dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181413] border border-stone-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
          />
        </div>

        {/* Dietary Switcher & Out of Stock Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDietary("all")}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold text-center transition-all ${
              dietary === "all"
                ? "bg-stone-700 text-white shadow-sm"
                : "bg-[#181413] border border-stone-800 text-stone-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setDietary("veg")}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              dietary === "veg"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-[#181413] border border-stone-800 text-stone-400 hover:text-emerald-400"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Pure Veg</span>
          </button>
          <button
            onClick={() => setDietary("nonveg")}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              dietary === "nonveg"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : "bg-[#181413] border border-stone-800 text-stone-400 hover:text-rose-400"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Non-Veg</span>
          </button>

          {/* Toggle to Hide Sold Out Items */}
          <button
            onClick={() => setHideOutOfStock(!hideOutOfStock)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              hideOutOfStock
                ? "bg-[#E07A5F]/20 text-[#F4A261] border-[#E07A5F]/50"
                : "bg-[#181413] border-stone-800 text-stone-400 hover:text-stone-300"
            }`}
            title="Hide sold out dishes"
          >
            {hideOutOfStock ? <EyeOff className="w-3.5 h-3.5 text-[#F4A261]" /> : <Eye className="w-3.5 h-3.5 text-stone-500" />}
            <span className="hidden sm:inline">In-Stock</span>
          </button>
        </div>

        {/* Category Horizontal Scrolling Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === c.id
                  ? "bg-[#E07A5F] text-stone-950 font-bold shadow-md shadow-[#E07A5F]/20"
                  : "bg-[#181413] border border-stone-800 text-stone-400 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Dish Cards List */}
      <div className="space-y-4 pt-1">
        {filteredDishes.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-stone-500 space-y-2">
            <Utensils className="w-8 h-8 mx-auto text-stone-600" />
            <p>No dishes match your selected filter.</p>
          </div>
        ) : (
          filteredDishes.map((dish) => {
            const inCartQty = cart
              .filter((c) => c.dish.id === dish.id)
              .reduce((acc, c) => acc + c.qty, 0);

            return (
              <div
                key={dish.id}
                className={`p-4 rounded-3xl bg-[#181413] border shadow-md flex gap-4 items-center justify-between group transition-all ${
                  dish.inStock ? "border-stone-800/80 hover:border-stone-700" : "border-stone-800/40 opacity-75"
                }`}
              >
                {/* Dish Details */}
                <div className="space-y-1.5 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full flex items-center justify-center border ${
                        dish.dietary === "veg"
                          ? "border-emerald-400 bg-emerald-500"
                          : "border-rose-400 bg-rose-500"
                      }`}
                    />
                    <h4 className="text-sm font-bold text-white leading-snug">{dish.name}</h4>
                  </div>

                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                    {dish.description}
                  </p>

                  <div className="flex items-center gap-2.5 pt-1">
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      ₹{dish.price.toFixed(2)}
                    </span>
                    {dish.bestseller && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/30">
                        Popular
                      </span>
                    )}
                    {!dish.inStock && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono">
                        Sold Out
                      </span>
                    )}
                  </div>
                </div>

                {/* Dish Thumbnail & Action */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden relative bg-stone-900 border border-stone-800">
                    {dish.image ? (
                      <img
                        src={dish.image}
                        alt={dish.name}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          dish.inStock ? "group-hover:scale-105" : "grayscale opacity-50"
                        }`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-600">
                        <Utensils className="w-6 h-6" />
                      </div>
                    )}
                    {!dish.inStock && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="text-[9px] font-mono uppercase font-bold text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40">
                          Unavailable
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Add / Qty Control */}
                  {!dish.inStock ? (
                    <button
                      disabled
                      className="w-full py-1.5 px-3 rounded-xl bg-stone-900/80 border border-stone-800 text-stone-500 text-[11px] font-semibold cursor-not-allowed text-center"
                    >
                      Sold Out
                    </button>
                  ) : inCartQty > 0 ? (
                    <div className="flex items-center rounded-xl border border-[#E07A5F] bg-[#1f1918]">
                      <button
                        onClick={() => handleUpdateQty(dish.id, -1)}
                        className="px-2 py-1 text-stone-300 hover:text-white"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-bold font-mono text-[#F4A261]">
                        {inCartQty}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(dish.id, 1)}
                        className="px-2 py-1 text-stone-300 hover:text-white"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddDish(dish)}
                      className="w-full py-1.5 px-3 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom duration-200">
          <div className="p-3.5 rounded-2xl bg-[#1e1918]/95 border border-[#E07A5F] shadow-2xl backdrop-blur-xl flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#E07A5F] text-stone-950 text-xs font-bold font-mono">
                  {totalItemsCount} {totalItemsCount === 1 ? "Item" : "Items"}
                </span>
                <span className="text-sm font-bold text-white font-mono">₹{grandTotal.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5">Includes 5% Restaurant GST</p>
            </div>

            <button
              onClick={() => setShowCartDrawer(true)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
            >
              <span>View Cart</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cart Review Drawer / Modal */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181413] border border-stone-800 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-mono">Your Table Cart</h3>
                <p className="text-xs text-stone-400 font-mono mt-0.5">{tableLabel} • Dine-In Guest</p>
              </div>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message if submission failed */}
            {submitError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-stone-800/80 pr-1 space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                  <div className="space-y-0.5 flex-1 pr-2">
                    <span className="font-semibold text-stone-200 block">{item.dish.name}</span>
                    <span className="text-[11px] font-mono text-stone-400">
                      ₹{item.dish.price.toFixed(2)} each
                    </span>
                    {item.notes && (
                      <span className="text-[10px] text-[#F4A261] font-mono block italic">
                        Note: {item.notes}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center rounded-lg border border-stone-800 bg-stone-900">
                      <button
                        onClick={() => handleUpdateQty(item.dish.id, -1, item.notes)}
                        className="px-2 py-1 text-stone-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-mono text-xs font-bold text-white">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(item.dish.id, 1, item.notes)}
                        className="px-2 py-1 text-stone-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-mono text-xs font-bold text-stone-200 min-w-[55px] text-right">
                      ₹{(item.dish.price * item.qty).toFixed(2)}
                    </span>

                    <button
                      onClick={() => handleRemoveCartItem(item.dish.id, item.notes)}
                      className="p-1 text-stone-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="pt-3 border-t border-stone-800 space-y-1.5 text-xs font-mono text-stone-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="text-stone-200">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Restaurant GST (5%):</span>
                <span className="text-stone-200">₹{gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-stone-800">
                <span>Grand Total:</span>
                <span className="text-emerald-400 text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Clarification on Payment */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-[#F4A261] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Orders fire directly to the live kitchen pass. Payment is settled at table after dining.</span>
            </div>

            {/* Confirm Submission Button */}
            <button
              type="button"
              disabled={isSubmitting || cart.length === 0}
              onClick={handlePlaceOrder}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Flame className="w-4 h-4" />
              <span>{isSubmitting ? "Firing Order to Kitchen..." : "Fire Order to Kitchen"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
