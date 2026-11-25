"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Flame,
  User,
  Mail,
  Phone,
  Lock,
  Store,
  MapPin,
  Building,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileText
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    restaurantName: "",
    restaurantType: "dinein",
    address: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "",
    gstin: "",
    fssaiNumber: "",
    upiVpa: "",
    agreeTerms: true,
  });

  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (!formData.agreeTerms) {
      setError("Please accept the terms and conditions to create your account.");
      return;
    }

    const res = await register({
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      restaurantName: formData.restaurantName,
      restaurantType: formData.restaurantType,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      gstin: formData.gstin || undefined,
      fssaiNumber: formData.fssaiNumber || undefined,
      upiVpa: formData.upiVpa || undefined,
    });

    if (res.success) {
      router.push("/dashboard");
    } else {
      setError(res.error || "Registration failed. Please check your details.");
    }
  };

  return (
    <div className="min-h-screen bg-[#110E0D] flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden text-stone-100">
      {/* Background Ambience */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#E07A5F]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#F4A261]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#E07A5F] to-[#F4A261] shadow-xl shadow-[#E07A5F]/20 mb-4 hover:scale-105 transition-transform">
            <Flame className="w-8 h-8 text-white" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Create Restaurant Account</h1>
          <p className="text-xs text-stone-400 mt-1 font-mono uppercase tracking-wider">
            Start fresh with Chotu Restro AI • 0% Commission Hospitality Platform
          </p>
        </div>

        {/* Registration Card */}
        <div className="bg-[#181514] border border-stone-800 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Owner Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-800 text-xs font-semibold uppercase tracking-wider text-[#E07A5F]">
                <User className="w-3.5 h-3.5" />
                <span>1. Owner Account Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="owner@myrestaurant.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Mobile Number (WhatsApp) *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98200 12345"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Password * (min 8 chars)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-300 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      minLength={8}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Restaurant Profile */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-800 text-xs font-semibold uppercase tracking-wider text-[#E07A5F]">
                <Store className="w-3.5 h-3.5" />
                <span>2. Restaurant Profile</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Restaurant Name *</label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="restaurantName"
                      required
                      value={formData.restaurantName}
                      onChange={handleChange}
                      placeholder="e.g. Royal Spice Bistro"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Outlet Format</label>
                  <select
                    name="restaurantType"
                    value={formData.restaurantType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs focus:outline-none focus:border-[#E07A5F] transition-colors"
                  >
                    <option value="dinein">Dine-In Casual / Fine Dining</option>
                    <option value="cafe">Café / Bistro / Bakery</option>
                    <option value="qsr">QSR Quick Service Counter</option>
                    <option value="cloud">Cloud Kitchen / Delivery Hub</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-300 mb-1">Street Address *</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Shop 5, Linking Road, Bandra"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">City *</label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs focus:outline-none focus:border-[#E07A5F] transition-colors"
                  >
                    <option value="Mumbai">Mumbai</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Delhi NCR">Delhi NCR</option>
                    <option value="Pune">Pune</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Kolkata">Kolkata</option>
                    <option value="Other">Other City</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">PIN Code</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="400050"
                    className="w-full px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Business Information (Optional) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-800 text-xs font-semibold uppercase tracking-wider text-[#E07A5F]">
                <FileText className="w-3.5 h-3.5" />
                <span>3. Business Information (Optional)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-stone-300 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    placeholder="27AABCU9603R1ZM"
                    className="w-full px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] uppercase transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-300 mb-1">FSSAI Licence</label>
                  <input
                    type="text"
                    name="fssaiNumber"
                    value={formData.fssaiNumber}
                    onChange={handleChange}
                    placeholder="11521005000432"
                    className="w-full px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-300 mb-1">UPI VPA for QR</label>
                  <input
                    type="text"
                    name="upiVpa"
                    value={formData.upiVpa}
                    onChange={handleChange}
                    placeholder="restaurant@icici"
                    className="w-full px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-700/80 text-white text-xs placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-stone-400">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="mt-0.5 rounded border-stone-700 text-[#E07A5F] focus:ring-[#E07A5F] bg-stone-900"
                />
                <span>
                  I agree to the Terms of Service, 0% Commission Policy, and privacy standards of Chotu Restro AI.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-xs shadow-lg shadow-[#E07A5F]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isLoading ? "Creating Restaurant Workspace..." : "Register Restaurant & Launch Dashboard"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-6 border-t border-stone-800 text-center text-xs text-stone-400 space-y-2">
            <div>
              Already have an authorized account?{" "}
              <Link href="/login" className="text-[#E07A5F] hover:underline font-semibold">
                Sign In here
              </Link>
            </div>
            <div>
              <Link href="/" className="text-stone-500 hover:text-stone-300 transition-colors">
                ← Back to Public Landing Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
