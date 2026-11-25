"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MENU_ITEMS } from "@/data/mockData";
import { MenuItem } from "@/types/restaurant";
import { fetchMenuItems } from "@/lib/api/menu";
import { submitQROrder } from "@/lib/api/qr";
import { 
  Flame, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  CheckCircle2, 
  RotateCcw, 
  X,
  CreditCard,
  QrCode,
  Printer
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export default function KioskPage() {
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway">("dine-in");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dietary, setDietary] = useState<"all" | "veg" | "nonveg">("all");
  const [dishes, setDishes] = useState<MenuItem[]>(MENU_ITEMS);
  const [cart, setCart] = useState<{ dish: MenuItem; qty: number }[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [orderCompleteToken, setOrderCompleteToken] = useState<string | null>(null);

  useEffect(() => {
    async function loadMenu() {
      try {
        const data = await fetchMenuItems();
        if (data && data.length > 0) setDishes(data);
      } catch (err) {
        console.warn("Using local kiosk menu fallback", err);
      }
    }
    loadMenu();
  }, []);

  const categories = [
    { id: "all", label: "All Items" },
    { id: "starters", label: "Starters & Tandoor" },
    { id: "mains", label: "Main Curries" },
    { id: "breads", label: "Indian Breads" },
    { id: "beverages", label: "Beverages" },
    { id: "desserts", label: "Desserts" },
  ];

  const addToCart = (dish: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.dish.id === dish.id);
      if (existing) {
        return prev.map((i) => (i.dish.id === dish.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { dish, qty: 1 }];
    });
  };

  const updateQty = (dishId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.dish.id === dishId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const totalItems = cart.reduce((acc, it) => acc + it.qty, 0);
  const subtotal = cart.reduce((acc, it) => acc + it.dish.price * it.qty, 0);
  const tax = subtotal * 0.05;
  const grandTotal = Math.round(subtotal + tax);

  const handleCompleteOrder = async () => {
    try {
      const res = await submitQROrder("qr-t04-demo", {
        customer_name: `Express Kiosk (${orderType.toUpperCase()})`,
        items: cart.map((c) => ({
          dish_id: c.dish.id,
          name: c.dish.name,
          price: c.dish.price,
          quantity: c.qty,
          dietary: c.dish.dietary,
          station: c.dish.station,
        })),
        captain_notes: `Order from Express Kiosk - ${orderType}`,
      });
      setOrderCompleteToken(res.token_number || res.order_number || `K-${Math.floor(100 + Math.random() * 900)}`);
    } catch {
      const token = `K-${Math.floor(100 + Math.random() * 900)}`;
      setOrderCompleteToken(token);
    } finally {
      setShowCheckoutModal(false);
      setCart([]);
    }
  };

  const filteredDishes = dishes.filter((dish) => {
    if (selectedCategory !== "all" && dish.category !== selectedCategory) return false;
    if (dietary !== "all" && dish.dietary !== dietary) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#110E0D] text-stone-100 flex flex-col select-none">
      {/* Kiosk Header */}
      <header className="h-20 bg-[#161312] border-b border-stone-800 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E07A5F] to-[#F4A261] flex items-center justify-center text-white font-bold shadow-lg shadow-[#E07A5F]/20">
            <Flame className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Express Self-Ordering Kiosk</h1>
            <p className="text-xs text-[#E07A5F] font-mono uppercase tracking-wider">
              Smart Counter Ordering
            </p>
          </div>
        </div>

        {/* Order Type Toggle */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-stone-900 border border-stone-800">
          <button
            onClick={() => setOrderType("dine-in")}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              orderType === "dine-in"
                ? "bg-[#E07A5F] text-stone-950 shadow-md"
                : "text-stone-400 hover:text-white"
            }`}
          >
            Dine-In
          </button>
          <button
            onClick={() => setOrderType("takeaway")}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              orderType === "takeaway"
                ? "bg-[#E07A5F] text-stone-950 shadow-md"
                : "text-stone-400 hover:text-white"
            }`}
          >
            Takeaway
          </button>
        </div>

        {/* Exit link for staff */}
        <Link
          href="/dashboard"
          className="text-xs text-stone-500 hover:text-stone-300 font-medium"
        >
          Exit Kiosk
        </Link>
      </header>

      {/* Main Kiosk Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Category Sidebar */}
        <div className="w-64 bg-[#141211] border-r border-stone-800 p-4 space-y-2 overflow-y-auto">
          <span className="text-[10px] font-mono uppercase text-stone-500 font-bold px-3">
            Menu Categories
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full text-left px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat.id
                  ? "bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/40 shadow-sm"
                  : "text-stone-400 hover:bg-stone-800 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}

          <div className="pt-6 border-t border-stone-800 space-y-2">
            <span className="text-[10px] font-mono uppercase text-stone-500 font-bold px-3">
              Dietary Filter
            </span>
            <div className="grid grid-cols-2 gap-2 px-2">
              <button
                onClick={() => setDietary(dietary === "veg" ? "all" : "veg")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                  dietary === "veg"
                    ? "bg-emerald-950 text-emerald-400 border-emerald-500"
                    : "bg-stone-900 border-stone-800 text-stone-400"
                }`}
              >
                🥦 Veg Only
              </button>
              <button
                onClick={() => setDietary(dietary === "nonveg" ? "all" : "nonveg")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                  dietary === "nonveg"
                    ? "bg-rose-950 text-rose-400 border-rose-500"
                    : "bg-stone-900 border-stone-800 text-stone-400"
                }`}
              >
                🍗 Non-Veg
              </button>
            </div>
          </div>
        </div>

        {/* Center Menu Grid */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-stone-800">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDishes.map((dish) => {
              const inCart = cart.find((i) => i.dish.id === dish.id);
              return (
                <div
                  key={dish.id}
                  className="p-5 rounded-2xl bg-[#181514] border border-stone-800 flex flex-col justify-between hover:border-stone-700 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                          dish.dietary === "veg" ? "border-emerald-500" : "border-rose-500"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            dish.dietary === "veg" ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                      </span>
                      {dish.bestseller && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Bestseller
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{dish.name}</h3>
                    <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed mb-4">
                      {dish.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                    <span className="text-base font-extrabold text-emerald-400">
                      ₹{dish.price}
                    </span>

                    {inCart ? (
                      <div className="flex items-center gap-2 bg-stone-900 border border-stone-700 px-2 py-1 rounded-xl">
                        <button
                          onClick={() => updateQty(dish.id, -1)}
                          className="p-1 text-stone-300 hover:text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold px-2">{inCart.qty}</span>
                        <button
                          onClick={() => updateQty(dish.id, 1)}
                          className="p-1 text-stone-300 hover:text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(dish)}
                        className="py-2 px-4 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Cart Tray */}
        <div className="w-80 bg-[#161312] border-l border-stone-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#E07A5F]" />
                <span>Your Tray</span>
              </h2>
              <span className="text-xs font-mono text-stone-400 font-bold">
                {totalItems} items
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-16 text-stone-500 space-y-2">
                <ShoppingBag className="w-12 h-12 mx-auto stroke-1" />
                <p className="text-xs">Your tray is empty.</p>
                <p className="text-[11px] text-stone-600">Tap any dish on the left to add.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.dish.id}
                    className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-white truncate">{item.dish.name}</p>
                      <p className="text-stone-400 font-mono">₹{item.dish.price} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.dish.id, -1)}
                        className="p-1 rounded bg-stone-800 text-stone-300"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold w-4 text-center">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.dish.id, 1)}
                        className="p-1 rounded bg-stone-800 text-stone-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tray Bottom Summary */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-stone-800 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal:</span>
                  <span>₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>GST (5%):</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-stone-800">
                  <span>Total Payable:</span>
                  <span className="text-emerald-400">₹{grandTotal}</span>
                </div>
              </div>

              <button
                onClick={() => setShowCheckoutModal(true)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <span>Proceed to Pay (₹{grandTotal})</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title="Complete Order at Kiosk"
        description="Scan QR or tap your card on the payment terminal"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
            <span className="text-xs text-stone-400 font-mono uppercase block">Total Amount</span>
            <span className="text-2xl font-extrabold text-emerald-400">₹{grandTotal}</span>
          </div>

          <div className="p-4 bg-white rounded-xl mx-auto w-44 h-44 flex flex-col items-center justify-center shadow-md">
            <QrCode className="w-32 h-32 text-stone-950" />
            <span className="text-[9px] font-mono text-stone-600 mt-1 uppercase font-bold">
              SCAN WITH ANY UPI APP
            </span>
          </div>

          <div className="pt-3 border-t border-stone-800 flex gap-2">
            <button
              onClick={() => setShowCheckoutModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteOrder}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 text-xs font-bold shadow-md"
            >
              Simulate Payment Success
            </button>
          </div>
        </div>
      </Modal>

      {/* Order Token Modal */}
      {orderCompleteToken && (
        <Modal
          isOpen={!!orderCompleteToken}
          onClose={() => setOrderCompleteToken(null)}
          title="Order Placed Successfully!"
          description="Your ticket has been sent to the kitchen"
          maxWidth="sm"
        >
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <span className="text-xs text-stone-400 uppercase font-mono block">Your Order Token</span>
              <span className="text-4xl font-extrabold text-white tracking-wider font-mono">
                {orderCompleteToken}
              </span>
            </div>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              Please take your printed receipt. Watch the live display screen above the counter for your token.
            </p>

            <button
              onClick={() => setOrderCompleteToken(null)}
              className="w-full py-3 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs"
            >
              Start New Order
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
