"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Table, MenuItem, OrderItem } from "@/types/restaurant";
import { MENU_ITEMS } from "@/data/mockData";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  Send, 
  CreditCard,
  ChevronDown,
  Sparkles,
  Flame,
  Utensils,
  Coffee,
  IceCream,
  Wheat,
  SlidersHorizontal,
  Clock,
  User,
  Phone,
  MessageSquare,
  CheckCircle2,
  X,
  AlertCircle
} from "lucide-react";

interface PosTerminalProps {
  tables: Table[];
  selectedTableId: string;
  onSelectTable: (id: string) => void;
  ledgerItems: OrderItem[];
  onAddDish: (dish: MenuItem, notes?: string) => void;
  onChangeQty: (dishId: string, delta: number) => void;
  onRemoveItem: (dishId: string) => void;
  onTransmitKot: () => void;
  onSendWhatsApp: () => void;
  onSettleBill: () => void;
  dishes?: MenuItem[];
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
  ledgerItems,
  onAddDish,
  onChangeQty,
  onRemoveItem,
  onTransmitKot,
  onSendWhatsApp,
  onSettleBill,
  dishes,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [showPopularOnly, setShowPopularOnly] = useState<boolean>(false);
  const [showTablePicker, setShowTablePicker] = useState<boolean>(false);

  // Customer Context State
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  // Discount Percentage State
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [promoCodeInput, setPromoCodeInput] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoFeedback, setPromoFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const handleApplyPromo = () => {
    setPromoFeedback(null);
    const query = promoCodeInput.trim().toUpperCase();
    if (!query) return;

    try {
      const stored = localStorage.getItem("chotu_coupons");
      const coupons = stored ? JSON.parse(stored) : [];
      const found = coupons.find((c: any) => c.code.toUpperCase() === query);

      if (!found) {
        setPromoFeedback({ message: `Code "${query}" not found`, isError: true });
        return;
      }

      if (!found.isActive) {
        setPromoFeedback({ message: `Promo code "${query}" is currently disabled`, isError: true });
        return;
      }

      if (rawSubtotal < (found.minOrderValue || 0)) {
        setPromoFeedback({ message: `Min order ₹${found.minOrderValue} required for this code`, isError: true });
        return;
      }

      if (found.discountType === "percentage") {
        setDiscountPercent(found.discountValue);
      } else {
        const pct = rawSubtotal > 0 ? Math.min(100, (found.discountValue / rawSubtotal) * 100) : 0;
        setDiscountPercent(Number(pct.toFixed(1)));
      }

      setAppliedPromo(found.code);
      setPromoFeedback({ message: `Applied ${found.code}!`, isError: false });
    } catch {
      setPromoFeedback({ message: "Could not apply promo code", isError: true });
    }
  };

  const handleClearPromo = () => {
    setDiscountPercent(0);
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoFeedback(null);
  };

  // Item Customization Note Modal
  const [customizingDish, setCustomizingDish] = useState<MenuItem | null>(null);
  const [customNote, setCustomNote] = useState<string>("");

  // Prevent duplicate double-clicks
  const [isSubmittingKot, setIsSubmittingKot] = useState<boolean>(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0] || {
    id: "T-01",
    label: "Table 1",
    capacity: 4,
    status: "vacant",
  };

  // Bill calculations
  const rawSubtotal = ledgerItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountAmount = (rawSubtotal * discountPercent) / 100;
  const taxableSubtotal = Math.max(0, rawSubtotal - discountAmount);
  const gst = taxableSubtotal * 0.05; // 2.5% CGST + 2.5% SGST
  const serviceCharge = taxableSubtotal * 0.05;
  const grandTotal = taxableSubtotal + gst + serviceCharge;

  // Live menu items from PostgreSQL or fallback
  const availableDishes = dishes && dishes.length > 0 ? dishes : MENU_ITEMS;

  // Filtered menu items
  const filteredDishes = availableDishes.filter((dish) => {
    const matchesCat = selectedCategory === "all" || dish.category === selectedCategory;
    const matchesDietary = dietaryFilter === "all" || dish.dietary === dietaryFilter;
    const matchesPopular = !showPopularOnly || dish.bestseller === true;
    const matchesSearch =
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesDietary && matchesPopular && matchesSearch;
  });

  const categories = [
    { id: "all", label: "All Items", icon: Utensils, count: availableDishes.length },
    { id: "starters", label: "Starters & Tandoor", icon: Flame, count: availableDishes.filter(d => d.category === "starters").length },
    { id: "mains", label: "Main Curries", icon: Utensils, count: availableDishes.filter(d => d.category === "mains").length },
    { id: "breads", label: "Breads & Roti", icon: Wheat, count: availableDishes.filter(d => d.category === "breads").length },
    { id: "desserts", label: "Desserts & Sweets", icon: IceCream, count: availableDishes.filter(d => d.category === "desserts").length },
    { id: "beverages", label: "Beverages & Bar", icon: Coffee, count: availableDishes.filter(d => d.category === "beverages").length },
  ];

  const handleCustomAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customizingDish) {
      onAddDish(customizingDish, customNote.trim() || undefined);
      setCustomizingDish(null);
      setCustomNote("");
    }
  };

  const handleFireKot = async () => {
    if (ledgerItems.length === 0 || isSubmittingKot) return;
    setIsSubmittingKot(true);
    try {
      await onTransmitKot();
    } finally {
      setIsSubmittingKot(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#110E0D] text-stone-100 min-h-0">
      {/* 3-Column Studio Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Navigation, Filters & Search (2.5 - 3 Cols)                  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 border-r border-stone-800/80 bg-[#141110] flex flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-4">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search dishes or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1c1817] border border-stone-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Dietary and Special Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">Dietary & Picks</span>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  onClick={() => setDietaryFilter("all")}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all ${
                    dietaryFilter === "all"
                      ? "bg-stone-700 text-white shadow-sm"
                      : "bg-[#1c1817] border border-stone-800 text-stone-400 hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setDietaryFilter(dietaryFilter === "veg" ? "all" : "veg")}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    dietaryFilter === "veg"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-[#1c1817] border border-stone-800 text-stone-400 hover:text-emerald-400"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Veg</span>
                </button>
                <button
                  onClick={() => setDietaryFilter(dietaryFilter === "nonveg" ? "all" : "nonveg")}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    dietaryFilter === "nonveg"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      : "bg-[#1c1817] border border-stone-800 text-stone-400 hover:text-rose-400"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Non-Veg</span>
                </button>
              </div>

              <button
                onClick={() => setShowPopularOnly(!showPopularOnly)}
                className={`w-full mt-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                  showPopularOnly
                    ? "bg-[#E07A5F]/20 text-[#F4A261] border-[#E07A5F]"
                    : "bg-[#1c1817] border-stone-800 text-stone-400 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F4A261]" />
                  <span>Popular / Chef's Picks</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900">Featured</span>
              </button>
            </div>

            {/* Category Navigation Menu */}
            <div className="space-y-1 pt-2 border-t border-stone-800/80">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block mb-2">
                Menu Categories
              </span>
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                      isSelected
                        ? "bg-[#E07A5F] text-stone-950 font-bold shadow-md shadow-[#E07A5F]/20"
                        : "text-stone-300 hover:text-white hover:bg-[#1f1a19]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-stone-950" : "text-stone-400"}`} />
                      <span>{cat.label}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isSelected ? "bg-stone-950/20 text-stone-950 font-bold" : "bg-stone-900 text-stone-500"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left Footer: Station Status Badges */}
          <div className="p-3 border-t border-stone-800/80 bg-[#110E0D] text-[10px] font-mono text-stone-500 flex items-center justify-between">
            <span>KDS Station Sync:</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTRE COLUMN: Food Catalogue & Dish Showcase (5.5 - 6 Cols)              */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 xl:col-span-6 bg-[#110E0D] border-r border-stone-800/80 flex flex-col justify-between overflow-y-auto">
          
          {/* Header Strip with Table Picker & Dish Counter */}
          <div className="p-4 border-b border-stone-800/80 bg-[#161211] flex items-center justify-between gap-3 sticky top-0 z-20">
            {/* Table Selector Pill */}
            <div className="relative">
              <button
                onClick={() => setShowTablePicker(!showTablePicker)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1f1a19] border border-stone-700/80 hover:border-[#E07A5F] text-xs font-mono transition-colors"
              >
                <span className="px-2 py-0.5 rounded-md bg-[#E07A5F] text-stone-950 text-[10px] font-bold uppercase tracking-wider">
                  {selectedTable.label}
                </span>
                <span className="font-bold text-white">Active Order</span>
                <span className="text-stone-400 text-[11px]">({selectedTable.capacity} Pax)</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {/* Table Picker Popup */}
              {showTablePicker && (
                <div className="absolute left-0 top-full mt-2 z-50 bg-[#1a1615] border border-stone-700 rounded-2xl shadow-2xl p-3 w-80 grid grid-cols-2 gap-2 text-xs font-mono">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelectTable(t.id);
                        setShowTablePicker(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        t.id === selectedTableId
                          ? "border-[#E07A5F] bg-[#E07A5F]/20 text-[#F4A261] font-bold"
                          : "border-stone-800 hover:border-stone-700 text-stone-300"
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{t.label}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            t.status === "occupied" ? "bg-amber-400" : t.status === "billed" ? "bg-blue-400" : "bg-emerald-400"
                          }`}
                        />
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {t.capacity} Pax • {t.status}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-stone-400 font-mono">
              Showing <span className="text-white font-bold">{filteredDishes.length}</span> dishes
            </div>
          </div>

          {/* Dishes Grid */}
          <div className="p-4 lg:p-6 flex-1 overflow-y-auto">
            {filteredDishes.length === 0 ? (
              <div className="py-20 text-center space-y-3 font-mono text-xs text-stone-500">
                <AlertCircle className="w-8 h-8 text-stone-600 mx-auto" />
                <p>No dishes match your selected category and dietary filters.</p>
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setDietaryFilter("all");
                    setSearchQuery("");
                    setShowPopularOnly(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white text-xs font-semibold"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredDishes.map((dish) => {
                  const isInStock = dish.inStock !== false;
                  return (
                    <div
                      key={dish.id}
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between group ${
                        isInStock
                          ? "bg-[#181413] border-stone-800/80 hover:border-stone-700 hover:bg-[#1d1817] shadow-sm hover:shadow-md"
                          : "bg-stone-900/40 border-stone-800/40 opacity-60"
                      }`}
                    >
                      {/* Image Thumbnail & Badge */}
                      <div className="relative h-32 w-full rounded-xl overflow-hidden mb-3 bg-stone-900">
                        {dish.image ? (
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-600">
                            <Utensils className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Top Ribbon: Dietary Indicator & Station */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span
                            className={`w-3 h-3 rounded-full flex items-center justify-center border ${
                              dish.dietary === "veg"
                                ? "border-emerald-400 bg-emerald-500"
                                : "border-rose-400 bg-rose-500"
                            }`}
                          />
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-stone-950/80 backdrop-blur-md text-stone-300 border border-stone-800">
                            {dish.station}
                          </span>
                        </div>

                        {/* Stock Status Badge */}
                        {!isInStock ? (
                          <div className="absolute top-2.5 right-2.5 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/80 text-white font-bold">
                            86'd Sold Out
                          </div>
                        ) : dish.bestseller && (
                          <div className="absolute top-2.5 right-2.5 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#E07A5F] text-stone-950 font-bold">
                            Bestseller
                          </div>
                        )}

                        {/* Price Tag in INR */}
                        <div className="absolute bottom-2 left-2.5 font-mono text-sm font-bold text-white drop-shadow">
                          ₹{dish.price.toFixed(2)}
                        </div>
                      </div>

                      {/* Content info */}
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-white group-hover:text-[#F4A261] transition-colors">
                          {dish.name}
                        </h4>
                        <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">
                          {dish.description}
                        </p>
                      </div>

                      {/* Bottom Actions: Customise & Quick Add */}
                      <div className="pt-3 mt-3 border-t border-stone-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomizingDish(dish);
                            setCustomNote("");
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                          title="Add special cooking instructions"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Customise</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isInStock}
                          onClick={() => onAddDish(dish)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Order Context, Customer Info & Cart Ledger (3.5 - 4 Cols)   */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 xl:col-span-3 bg-[#141110] flex flex-col justify-between overflow-hidden">
          
          {/* Order Context & Customer Panel */}
          <div className="p-4 border-b border-stone-800/80 space-y-3 bg-[#181413]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white font-mono">{selectedTable.label} Billing Context</h3>
                <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                  Server: {selectedTable.captainName || "Captain Staff"}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-[10px] font-mono font-bold text-stone-300">
                {ledgerItems.reduce((acc, it) => acc + it.quantity, 0)} Items
              </span>
            </div>

            {/* Quick Customer Inputs */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="relative">
                <User className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Guest Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#1c1817] border border-stone-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#E07A5F]"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Mobile / SMS"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#1c1817] border border-stone-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#E07A5F]"
                />
              </div>
            </div>
          </div>

          {/* Cart Ledger Item List */}
          <div className="p-4 flex-1 overflow-y-auto divide-y divide-stone-800/60">
            {ledgerItems.length === 0 ? (
              <div className="py-16 text-center space-y-2 text-stone-500 font-mono text-xs">
                <Utensils className="w-6 h-6 mx-auto text-stone-600" />
                <p>No dishes in active ledger.</p>
                <p className="text-[10px] text-stone-600">Select dishes from the catalogue to begin order.</p>
              </div>
            ) : (
              ledgerItems.map((item) => (
                <div key={item.dishId} className="py-3 flex items-start justify-between text-xs gap-2">
                  <div className="space-y-1 flex-1 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.dietary === "veg" ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      <span className="font-semibold text-stone-200">{item.name}</span>
                    </div>

                    {item.notes && (
                      <p className="text-[10px] text-[#F4A261] italic bg-amber-500/10 px-2 py-0.5 rounded-md inline-block">
                        Note: {item.notes}
                      </p>
                    )}

                    <div className="text-[11px] font-mono text-stone-500">
                      ₹{item.price.toFixed(2)} each
                    </div>
                  </div>

                  {/* Quantity and Line Total */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="flex items-center rounded-lg border border-stone-800 bg-[#1c1817]">
                      <button
                        onClick={() => onChangeQty(item.dishId, -1)}
                        className="px-2 py-1 text-stone-400 hover:text-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-mono text-xs font-bold text-white min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onChangeQty(item.dishId, 1)}
                        className="px-2 py-1 text-stone-400 hover:text-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-mono text-xs font-bold text-stone-200 min-w-[60px] text-right">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>

                    <button
                      onClick={() => onRemoveItem(item.dishId)}
                      className="p-1 rounded text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Settlement & Financial Breakdown Footer */}
          <div className="p-4 border-t border-stone-800/80 bg-[#161211] space-y-3">
            
            {/* Quick Discount & Promo Code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                <span>Apply Discount:</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        setDiscountPercent(pct);
                        setAppliedPromo(null);
                        setPromoFeedback(null);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                        discountPercent === pct && !appliedPromo
                          ? "bg-[#E07A5F] text-stone-950"
                          : "bg-stone-900 text-stone-400 hover:text-white"
                      }`}
                    >
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="Promo Code (e.g. WELCOME20)"
                  className="flex-1 bg-stone-900 border border-stone-800 rounded px-2 py-1 text-[11px] font-mono text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-[#E07A5F]"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[10px] font-mono font-bold transition-colors"
                >
                  Apply
                </button>
                {appliedPromo && (
                  <button
                    type="button"
                    onClick={handleClearPromo}
                    className="px-1.5 py-1 text-rose-400 hover:text-rose-300 text-[10px] font-mono"
                    title="Remove Promo"
                  >
                    Clear
                  </button>
                )}
              </div>
              {promoFeedback && (
                <p className={`text-[10px] font-mono ${promoFeedback.isError ? "text-rose-400" : "text-emerald-400"}`}>
                  {promoFeedback.message}
                </p>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs font-mono text-stone-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="text-stone-200 font-semibold">₹{rawSubtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount ({discountPercent}%):</span>
                  <span>- ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>CGST (2.5%) + SGST (2.5%):</span>
                <span className="text-stone-200">₹{gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge (5%):</span>
                <span className="text-stone-200">₹{serviceCharge.toFixed(2)}</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="pt-2 border-t border-stone-800 flex items-baseline justify-between font-mono">
              <span className="text-xs uppercase tracking-wider font-bold text-stone-300">Final Payable</span>
              <span className="text-xl font-bold text-emerald-400">₹{grandTotal.toFixed(2)}</span>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={ledgerItems.length === 0 || isSubmittingKot}
                onClick={handleFireKot}
                className="py-2.5 px-3 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-40"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmittingKot ? "Firing..." : "Fire KOT"}</span>
              </button>

              <button
                type="button"
                onClick={onSendWhatsApp}
                className="py-2.5 px-3 rounded-xl bg-stone-900 border border-stone-700/80 hover:bg-stone-800 text-stone-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Bill</span>
              </button>
            </div>

            <button
              type="button"
              disabled={ledgerItems.length === 0}
              onClick={onSettleBill}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-stone-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-40"
            >
              <CreditCard className="w-4 h-4" />
              <span>Checkout & Settle Payment</span>
            </button>
          </div>

        </div>

      </div>

      {/* Item Customisation Note Modal */}
      {customizingDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181413] border border-stone-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Customise Dish</h3>
                <p className="text-xs text-stone-400 font-mono mt-0.5">{customizingDish.name}</p>
              </div>
              <button
                onClick={() => setCustomizingDish(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCustomAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Preparation Instructions (KOT Notes)
                </label>
                <textarea
                  rows={3}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Less spicy, Extra crispy, No garlic, Gluten-free"
                  className="w-full bg-[#1c1817] border border-stone-800 rounded-xl p-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap gap-1.5">
                {["Less Spicy", "Extra Crispy", "No Onions/Garlic", "Well Done", "Pack Separately"].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setCustomNote((prev) => prev ? `${prev}, ${pill}` : pill)}
                    className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-[10px] text-stone-300 hover:border-stone-700"
                  >
                    + {pill}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setCustomizingDish(null)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 text-xs font-bold"
                >
                  Add with Customisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
