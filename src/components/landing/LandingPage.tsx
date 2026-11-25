"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Play,
  Sparkles,
  Smartphone,
  Tablet,
  Laptop,
  Printer,
  Clock,
  ShieldCheck,
  Utensils,
  ChefHat,
  Mic,
  TrendingUp,
  Layers,
  Store,
  Calendar,
  MessageSquare,
  Building2,
  RotateCcw,
} from "lucide-react";

export type ThemeMode = "warm-terracotta" | "warm-dining" | "fresh-cafe" | "high-volume-slate";

interface LandingPageProps {
  onLaunchLiveDemo?: () => void;
  currentTheme?: ThemeMode;
  onSelectTheme?: (theme: ThemeMode) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchLiveDemo,
  currentTheme = "warm-terracotta",
  onSelectTheme,
}) => {
  const { isAuthenticated } = useAuth();
  const dashboardHref = isAuthenticated ? "/dashboard" : "/login";

  // Navigation active tab for interactive preview
  const [activePreviewTab, setActivePreviewTab] = useState<"pos" | "qr" | "kds" | "voice">("pos");

  // Demo Booking Form State
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    restaurantName: "",
    city: "Mumbai",
    outletType: "qsr",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<typeof formData | null>(null);


  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBookDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedBooking({ ...formData });
    }, 500);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased selection:bg-brand selection:text-white">
      {/* ============================================================
          TOP ANNOUNCEMENT BAR
      ============================================================ */}
      <div className="bg-ink text-white py-2 px-4 text-xs font-medium text-center flex items-center justify-center gap-2 border-b border-border/40">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Experience modern restaurant intelligence with Cloud POS, QR Dining, and Voice AI.</span>
        <button
          onClick={() => scrollToSection("book-demo")}
          className="underline font-semibold hover:text-brand transition-colors ml-1 cursor-pointer"
        >
          Book 15-Minute Demo →
        </button>
      </div>

      {/* ============================================================
          1. CLEAN PROFESSIONAL NAVIGATION BAR
      ============================================================ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-sm shadow-xs">
              CR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-ink">
                  Chotu Restro AI
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-ink-secondary leading-none hidden sm:block">
                Artisanal Restaurant Operating System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-secondary">
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("live-preview")}
              className="hover:text-brand transition-colors cursor-pointer"
            >
              System Tour
            </button>
          </nav>

          {/* Right Header CTAs & Theme Palette */}
          <div className="flex items-center gap-3">
            {onSelectTheme && (
              <div className="hidden lg:flex items-center bg-canvas-subtle p-1 rounded-md border border-border text-xs gap-1">
                {(
                  [
                    { id: "warm-terracotta", name: "Terracotta", color: "#D95D39" },
                    { id: "warm-dining", name: "Cream", color: "#E23E2D" },
                    { id: "fresh-cafe", name: "Café", color: "#2F9E44" },
                    { id: "high-volume-slate", name: "Slate", color: "#EA580C" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTheme(t.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                      currentTheme === t.id
                        ? "bg-white text-ink shadow-2xs font-semibold"
                        : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {onLaunchLiveDemo ? (
              <button
                onClick={onLaunchLiveDemo}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-ink bg-canvas-subtle hover:bg-canvas border border-border rounded-lg transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-brand fill-brand" />
                <span>Live POS Sandbox</span>
              </button>
            ) : (
              <Link
                href={dashboardHref}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-ink bg-canvas-subtle hover:bg-canvas border border-border rounded-lg transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-brand fill-brand" />
                <span>Open Dashboard</span>
              </Link>
            )}

            {!isAuthenticated && (
              <>
                <Link
                  href="/login"
                  className="hidden md:inline-flex items-center text-xs font-medium text-ink-secondary hover:text-ink px-2 py-1 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="hidden lg:inline-flex items-center text-xs font-semibold text-brand hover:text-brand-hover px-2.5 py-1 rounded-md bg-brand/5 border border-brand/20 transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}

            <button
              onClick={() => scrollToSection("book-demo")}
              className="px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors shadow-xs active:scale-95 cursor-pointer"
            >
              Book a Demo
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          2. SIMPLE & PROFESSIONAL HERO SECTION
      ============================================================ */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden bg-gradient-to-b from-canvas via-canvas-subtle/50 to-canvas border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Calm, Unified Restaurant Technology</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-ink leading-[1.1]">
              The intelligent operating system for modern restaurants.
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-ink-secondary leading-relaxed max-w-2xl mx-auto">
              Fast cloud POS, direct QR ordering, station-routed kitchen displays, and multilingual voice billing. Zero aggregator commissions. One simple flat license.
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => scrollToSection("book-demo")}
                className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Book 15-Minute Live Walkthrough</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                href="/register"
                className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-white bg-ink hover:bg-ink/90 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Get Started / Create Account</span>
              </Link>

              <Link
                href={dashboardHref}
                className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-ink bg-white hover:bg-canvas-subtle border border-border rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 text-brand fill-brand" />
                <span>Open Dashboard</span>
              </Link>
            </div>

            {/* Micro Trust Note */}
            <p className="text-xs text-ink-secondary/80">
              No credit card required • Tested live on your actual menu in 15 minutes
            </p>
          </div>

          {/* Key Metric Highlights Strip */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white p-5 rounded-xl border border-border shadow-2xs text-center space-y-1">
              <div className="text-2xl font-bold text-ink">300+ bills/hr</div>
              <div className="text-xs text-ink-secondary">High-Velocity Cloud POS</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-border shadow-2xs text-center space-y-1">
              <div className="text-2xl font-bold text-brand">0.0% Cut</div>
              <div className="text-xs text-ink-secondary">Direct Table QR Menu</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-border shadow-2xs text-center space-y-1">
              <div className="text-2xl font-bold text-ink">&lt; 2 seconds</div>
              <div className="text-xs text-ink-secondary">KOT Kitchen Sync</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-border shadow-2xs text-center space-y-1">
              <div className="text-2xl font-bold text-emerald-600">100% BYOD</div>
              <div className="text-xs text-ink-secondary">Any Phone, Tablet or PC</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          3. INTERACTIVE SYSTEM TOUR (Clean Module Switcher)
      ============================================================ */}
      <section id="live-preview" className="py-20 bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold text-ink tracking-tight">
              One unified ledger. Zero disconnected tools.
            </h2>
            <p className="text-sm text-ink-secondary">
              Everything in Chotu Restro AI communicates synchronously. What is punched at POS or ordered via QR instantly routes to the kitchen screen.
            </p>
          </div>

          {/* Interactive Module Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 rounded-xl bg-canvas-subtle border border-border text-xs sm:text-sm font-medium">
              {[
                { id: "pos", label: "Cloud POS & Floor", icon: Store },
                { id: "qr", label: "Direct QR Menu", icon: Smartphone },
                { id: "kds", label: "Kitchen Display (KDS)", icon: ChefHat },
                { id: "voice", label: "Voice AI Billing", icon: Mic },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activePreviewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePreviewTab(tab.id as typeof activePreviewTab)}
                    className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-brand shadow-xs font-semibold"
                        : "text-ink-secondary hover:text-ink"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Screen Preview Container */}
          <div className="max-w-5xl mx-auto bg-canvas rounded-2xl border border-border shadow-sm p-6 sm:p-8">
            {activePreviewTab === "pos" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-ink">Table Floor &amp; Fast Billing</h4>
                      <p className="text-xs text-ink-secondary">Active Dining Hall • Modern Artisanal Bistro</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold">
                      8 Tables Online
                    </span>
                  </div>
                  {/* Table status grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { num: "T1", cap: "2 Seats", status: "Available", color: "border-border bg-white text-ink" },
                      { num: "T2", cap: "4 Seats", status: "Occupied", color: "border-brand bg-brand/5 text-brand font-semibold" },
                      { num: "T3", cap: "6 Seats", status: "Occupied", color: "border-brand bg-brand/5 text-brand font-semibold" },
                      { num: "T4", cap: "2 Seats", status: "Billed", color: "border-amber-400 bg-amber-50 text-amber-900 font-semibold" },
                      { num: "T5", cap: "4 Seats", status: "Available", color: "border-border bg-white text-ink" },
                      { num: "T6", cap: "4 Seats", status: "Available", color: "border-border bg-white text-ink" },
                      { num: "T7", cap: "8 Seats", status: "Reserved", color: "border-blue-400 bg-blue-50 text-blue-900" },
                      { num: "T8", cap: "4 Seats", status: "Available", color: "border-border bg-white text-ink" },
                    ].map((t) => (
                      <div key={t.num} className={`p-3 rounded-lg border text-center ${t.color}`}>
                        <div className="text-sm font-bold">{t.num}</div>
                        <div className="text-[10px] opacity-80">{t.cap}</div>
                        <div className="text-[10px] mt-1 uppercase tracking-tight">{t.status}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-border flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-border">
                      <span className="font-semibold text-ink">Current Order • Table 2</span>
                      <span className="text-[11px] text-ink-secondary">KOT #104</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>2x Paneer Butter Masala</span>
                        <span className="font-semibold">₹ 640</span>
                      </div>
                      <div className="flex justify-between">
                        <span>4x Butter Naan</span>
                        <span className="font-semibold">₹ 240</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1x Dal Makhani</span>
                        <span className="font-semibold">₹ 280</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-3 border-t border-border text-xs">
                    <div className="flex justify-between text-ink-secondary">
                      <span>Subtotal</span>
                      <span>₹ 1,160</span>
                    </div>
                    <div className="flex justify-between text-ink-secondary">
                      <span>GST (5%)</span>
                      <span>₹ 58</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-ink pt-1 border-t border-border/50">
                      <span>Total Bill</span>
                      <span className="text-brand">₹ 1,218</span>
                    </div>
                    <button className="w-full mt-2 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-colors">
                      Fire KOT to Kitchen →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === "qr" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="space-y-4">
                  <span className="text-xs uppercase font-bold text-brand tracking-wider">Zero App Install</span>
                  <h3 className="text-xl font-bold text-ink">Seamless QR Mobile Dining</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    Guests scan the unique table card on their smartphone camera. They view high-resolution food images, filter by dietary preferences, customize spice levels, and pay via UPI directly.
                  </p>
                  <ul className="space-y-2 text-xs text-ink">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Cryptographically signed 256-bit secure QR tokens</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Instant UPI payment with zero platform cut</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Automatic table association &amp; order merging</span>
                    </li>
                  </ul>
                </div>

                <div className="md:col-span-2 bg-white p-5 rounded-xl border border-border shadow-2xs max-w-sm mx-auto w-full space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <div>
                      <div className="text-xs font-bold text-ink">Modern Artisanal Bistro</div>
                      <div className="text-[10px] text-ink-secondary">Table 03 • Dine-In Guest</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      Live Menu
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { name: "Butter Chicken Supreme", desc: "Charcoal grilled chicken in rich makhani gravy", price: "₹ 390", tag: "Non-Veg" },
                      { name: "Paneer Tikka Angara", desc: "Spiced cottage cheese charred over tandoor", price: "₹ 320", tag: "Veg" },
                      { name: "Garlic Butter Naan", desc: "Fresh tandoor bread brushed with melted butter", price: "₹ 65", tag: "Veg" },
                    ].map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-border/80 flex justify-between items-center bg-canvas/40">
                        <div>
                          <div className="text-xs font-semibold text-ink">{item.name}</div>
                          <div className="text-[10px] text-ink-secondary line-clamp-1">{item.desc}</div>
                          <span className="text-[10px] font-bold text-brand">{item.price}</span>
                        </div>
                        <button className="px-3 py-1 bg-brand text-white text-xs font-semibold rounded hover:bg-brand-hover">
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">Cart: 2 Items</span>
                    <button className="px-4 py-1.5 bg-ink text-white font-semibold rounded hover:bg-ink/90">
                      Pay via UPI (₹455)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === "kds" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-ink">Live Kitchen Display System (KDS)</h4>
                    <p className="text-xs text-ink-secondary">Real-time station sync with SLA timers and ticket recall</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold">
                      3 Active Tickets
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      id: "KOT #102",
                      table: "Table 04",
                      elapsed: "03:45",
                      urgent: false,
                      items: ["1x Paneer Butter Masala", "2x Butter Naan", "1x Jeera Rice"],
                    },
                    {
                      id: "KOT #103",
                      table: "Table 02",
                      elapsed: "08:12",
                      urgent: true,
                      items: ["1x Tandoori Chicken Half", "2x Garlic Naan", "1x Sweet Lassi"],
                    },
                    {
                      id: "KOT #104",
                      table: "Takeaway #08",
                      elapsed: "01:10",
                      urgent: false,
                      items: ["2x Dal Makhani", "4x Roti (No Butter)"],
                    },
                  ].map((kot, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                        kot.urgent ? "border-red-300 bg-red-50/50" : "border-border bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-border/80">
                          <span className="font-bold text-ink">{kot.id}</span>
                          <span className={`flex items-center gap-1 font-mono text-xs ${kot.urgent ? "text-red-700 font-bold" : "text-ink-secondary"}`}>
                            <Clock className="w-3 h-3" />
                            {kot.elapsed}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-brand mt-1">{kot.table}</div>
                        <ul className="mt-2 space-y-1 text-xs text-ink">
                          {kot.items.map((i, iIdx) => (
                            <li key={iIdx} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                              <span>{i}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
                        Mark Ready (Bump)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePreviewTab === "voice" && (
              <div className="max-w-2xl mx-auto text-center space-y-6 py-4">
                <div className="w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto shadow-xs">
                  <Mic className="w-7 h-7 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-ink">Hinglish Multilingual Voice Assistant</h3>
                  <p className="text-xs text-ink-secondary max-w-md mx-auto">
                    Engineered specifically for busy Indian restaurant counters. Cashiers talk naturally in Hindi, English, or mixed speech without pausing to type.
                  </p>
                </div>

                <div className="p-4 bg-white rounded-xl border border-border text-left space-y-3">
                  <div className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                    Spoken Voice Input:
                  </div>
                  <div className="p-3 bg-canvas-subtle rounded-lg text-sm font-medium text-ink italic border border-border/60">
                    &quot;Chotu, Table 4 pe 2 Garlic Naan aur 1 Butter Chicken add karo&quot;
                  </div>
                  <div className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider pt-2">
                    Understood &amp; Routed Instantly:
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold">
                      ✓ Table 4
                    </span>
                    <span className="px-2.5 py-1 rounded bg-brand/10 text-brand font-semibold">
                      ✓ 2x Garlic Naan (₹130)
                    </span>
                    <span className="px-2.5 py-1 rounded bg-brand/10 text-brand font-semibold">
                      ✓ 1x Butter Chicken (₹390)
                    </span>
                    <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-semibold">
                      ✓ KOT Generated
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          4. CORE PLATFORM PILLARS (Clean 6-Card Grid)
      ============================================================ */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs uppercase font-bold text-brand tracking-wider">Enterprise Architecture</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Engineered for high-volume restaurant operations
          </h2>
          <p className="text-sm text-ink-secondary">
            No redundant subscriptions. Replace 4 different tablets and tools with one reliable operating system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Store,
              title: "Point of Sale & Billing",
              desc: "Fire orders in under 2 taps. Color-coded table layouts, bill splitting, item modifiers, GST bifurcation (CGST/SGST), and instant WhatsApp digital receipts.",
              highlight: "300 bills/hour pace",
            },
            {
              icon: Smartphone,
              title: "Zero-App QR Menu",
              desc: "Table-specific QR cards let guests browse rich culinary photography, filter allergens, customize dishes, and pay via UPI with 0% commission.",
              highlight: "0% aggregator fees",
            },
            {
              icon: ChefHat,
              title: "Kitchen Display (KDS)",
              desc: "Dynamic ticket dispatch to Tandoor, Curry, Bar, and Pantry stations. Elapsed timers warn kitchen staff before orders cross 10 minutes.",
              highlight: "Under 2s ticket sync",
            },
            {
              icon: Mic,
              title: "Hinglish Voice Intelligence",
              desc: "Natural speech processing tailored to loud Indian kitchen counters. Punch items, query daily revenue, or check table status hands-free.",
              highlight: "Hands-free speech",
            },
            {
              icon: Layers,
              title: "Unified Delivery Hub",
              desc: "Consolidate Zomato, Swiggy, and direct takeaway orders into one quiet table. Manage rider arrival OTPs and toggle store pause status in one click.",
              highlight: "End counter clutter",
            },
            {
              icon: TrendingUp,
              title: "Recipe & Margin Analytics",
              desc: "Automatic raw ingredient deduction on every order. Live low-stock alerts, food cost analysis, and real profit tracking across all dining channels.",
              highlight: "True margin health",
            },
          ].map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="bg-white p-6 rounded-xl border border-border shadow-2xs hover:shadow-xs transition-shadow space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-ink">{pillar.title}</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed">{pillar.desc}</p>
                </div>
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-brand">
                  <span>{pillar.highlight}</span>
                  <span>→</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>



      {/* ============================================================
          6. HARDWARE COMPATIBILITY & THE 60-MINUTE BENCHMARK
      ============================================================ */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <span className="text-xs uppercase font-bold text-brand tracking-wider">Effortless Adoption</span>
            <h2 className="text-3xl font-bold text-ink tracking-tight leading-tight">
              If your staff can use WhatsApp, they can master Chotu in 60 minutes.
            </h2>
            <p className="text-sm text-ink-secondary leading-relaxed">
              No expensive multi-day training or complicated legacy interfaces. We stripped away the bloat so captains, cashiers, and chefs perform at peak speed during 9 PM Friday rushes.
            </p>
            <div className="space-y-2.5 pt-2 text-xs text-ink font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Bring Your Own Device (BYOD): Runs smoothly on iOS, Android, Windows, Mac</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Supports standard 2-inch &amp; 3-inch thermal ESC/POS printers via USB or LAN</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Offline resilience: bills continue punching during transient internet dips</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-white rounded-xl border border-border shadow-2xs space-y-2">
              <Smartphone className="w-6 h-6 text-brand" />
              <div className="font-bold text-xs text-ink">Smartphones</div>
              <p className="text-[11px] text-ink-secondary">Captain table punching &amp; quick KOT firing</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-border shadow-2xs space-y-2">
              <Tablet className="w-6 h-6 text-brand" />
              <div className="font-bold text-xs text-ink">iPads &amp; Tablets</div>
              <p className="text-[11px] text-ink-secondary">Counter POS billing &amp; kitchen station screens</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-border shadow-2xs space-y-2">
              <Laptop className="w-6 h-6 text-brand" />
              <div className="font-bold text-xs text-ink">Laptops &amp; PCs</div>
              <p className="text-[11px] text-ink-secondary">Owner analytics, margins, recipes, and inventory</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-border shadow-2xs space-y-2">
              <Printer className="w-6 h-6 text-brand" />
              <div className="font-bold text-xs text-ink">Thermal Printers</div>
              <p className="text-[11px] text-ink-secondary">Standard receipt rolls and kitchen order tickets</p>
            </div>
          </div>
        </div>
      </section>



      {/* ============================================================
          8. CLEAN DEMO BOOKING FORM
      ============================================================ */}
      <section id="book-demo" className="py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-10">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase font-bold text-brand tracking-wider">Direct Appointment</span>
          <h2 className="text-3xl font-bold text-ink tracking-tight">
            Book a 15-Minute Personalized Demo
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary max-w-md mx-auto">
            A focused screen share tailored to your actual menu. See Hinglish voice billing, kitchen routing, and commission elimination in action.
          </p>
        </div>

        <div className="bg-white p-6 sm:p-10 rounded-2xl border border-border shadow-xs">
          {submittedBooking ? (
            <div className="text-center space-y-5 py-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-ink">Demo Confirmed!</h3>
                <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                  Thank you, <strong className="text-ink">{submittedBooking.fullName}</strong>. We have dispatched your calendar invite and Google Meet link via WhatsApp to <strong className="text-brand">+91 {submittedBooking.phone}</strong>.
                </p>
              </div>

              <div className="max-w-sm mx-auto p-4 bg-canvas-subtle rounded-lg border border-border text-xs text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Restaurant:</span>
                  <span className="font-semibold text-ink">{submittedBooking.restaurantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Format:</span>
                  <span className="font-semibold text-ink uppercase">{submittedBooking.outletType} ({submittedBooking.city})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Meeting Link:</span>
                  <span className="font-semibold text-brand">meet.google.com/cho-restro-demo</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                {onLaunchLiveDemo ? (
                  <button
                    onClick={onLaunchLiveDemo}
                    className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-colors"
                  >
                    Explore POS Sandbox
                  </button>
                ) : (
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-colors"
                  >
                    Open Live POS
                  </Link>
                )}
                <button
                  onClick={() => setSubmittedBooking(null)}
                  className="px-4 py-2 bg-canvas-subtle border border-border text-xs font-semibold text-ink rounded-lg hover:bg-canvas transition-colors"
                >
                  Edit Details
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBookDemoSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink">
                    Your Name <span className="text-brand">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink">
                    WhatsApp Number <span className="text-brand">*</span>
                  </label>
                  <div className="flex">
                    <span className="h-10 px-3 bg-canvas-subtle border border-r-0 border-border rounded-l-lg flex items-center text-xs text-ink font-semibold">
                      +91
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      required
                      pattern="[0-9]{10}"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="98200 12345"
                      className="flex-1 h-10 px-3 rounded-r-lg border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink">
                    Restaurant Name <span className="text-brand">*</span>
                  </label>
                  <input
                    type="text"
                    name="restaurantName"
                    required
                    value={formData.restaurantName}
                    onChange={handleInputChange}
                    placeholder="e.g. Bombay Tandoor House"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink">
                    City <span className="text-brand">*</span>
                  </label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="Mumbai">Mumbai</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Delhi NCR">Delhi NCR</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Pune">Pune</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Kolkata">Kolkata</option>
                    <option value="Other">Other City</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-ink">Outlet Format</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "qsr", label: "QSR Counter" },
                    { id: "cafe", label: "Café / Bistro" },
                    { id: "dinein", label: "Dine-In Dining" },
                    { id: "cloud", label: "Cloud Kitchen" },
                  ].map((fmt) => (
                    <button
                      type="button"
                      key={fmt.id}
                      onClick={() => setFormData((p) => ({ ...p, outletType: fmt.id }))}
                      className={`h-9 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        formData.outletType === fmt.id
                          ? "bg-brand text-white border-brand font-semibold"
                          : "bg-white text-ink border-border hover:border-brand/60"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase rounded-lg transition-colors shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? "Confirming Slot..." : "Schedule 15-Minute Live Demo"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ============================================================
          9. MINIMALIST PROFESSIONAL FOOTER
      ============================================================ */}
      <footer className="bg-white border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-xs">
                CR
              </div>
              <div>
                <span className="font-bold text-sm text-ink">Chotu Restro AI</span>
                <p className="text-[11px] text-ink-secondary">The artisanal restaurant operating system</p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-ink-secondary">
              <button onClick={() => scrollToSection("features")} className="hover:text-brand transition-colors cursor-pointer">
                Features
              </button>
              <button onClick={() => scrollToSection("live-preview")} className="hover:text-brand transition-colors cursor-pointer">
                System Tour
              </button>
              <Link href={dashboardHref} className="hover:text-brand transition-colors">
                Open Dashboard
              </Link>
              <Link href="/register" className="hover:text-brand transition-colors">
                Get Started
              </Link>
              <Link href="/login" className="hover:text-brand transition-colors">
                Sign In
              </Link>
              <a
                href="https://wa.me/919820012345?text=Hi,%20I%20would%20like%20to%20learn%20more%20about%20Chotu%20Restro%20AI"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-canvas-subtle border border-border text-ink hover:text-brand font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp Concierge</span>
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-secondary">
            <div>© {new Date().getFullYear()} Chotu Restro AI. All rights reserved.</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>All systems operational • 99.98% Cloud SLA</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
