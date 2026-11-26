"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { 
  fetchSettings, 
  updateSettings, 
  RestaurantSettingsData 
} from "@/lib/api/settings";
import { 
  Store, 
  ShieldCheck, 
  QrCode, 
  Printer, 
  Save, 
  Check,
  RefreshCw,
  Globe
} from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [settings, setSettings] = useState<RestaurantSettingsData>({
    name: "",
    tagline: "Artisanal Restaurant Operating System",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    fssai_number: "",
    tax_rate: 5.0,
    cgst_rate: 2.5,
    sgst_rate: 2.5,
    service_charge_rate: 5.0,
    service_charge_enabled: true,
    currency: "INR",
    upi_vpa: "",
    auto_print_kot: true,
    invoice_prefix: "INV",
    timezone: "Asia/Kolkata",
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchSettings();
      setSettings(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load restaurant settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await updateSettings({
        name: settings.name,
        tagline: settings.tagline || undefined,
        phone: settings.phone || undefined,
        email: settings.email || undefined,
        address: settings.address || undefined,
        gstin: settings.gstin || undefined,
        fssai_number: settings.fssai_number || undefined,
        cgst_percent: settings.cgst_rate ?? Number(settings.cgst_percent ?? 2.5),
        sgst_percent: settings.sgst_rate ?? Number(settings.sgst_percent ?? 2.5),
        service_charge_percent: settings.service_charge_enabled
          ? (settings.service_charge_rate ?? Number(settings.service_charge_percent ?? 5.0))
          : 0,
        service_charge_enabled: settings.service_charge_enabled,
        currency: settings.currency,
        upi_vpa: settings.upi_vpa || undefined,
        auto_print_kot: settings.auto_print_kot,
        invoice_prefix: settings.invoice_prefix,
        timezone: settings.timezone,
      });
      setSettings(updated);
      showToast("Restaurant configuration and tax rules updated successfully!");
    } catch (err: any) {
      showToast(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="System & Administration"
        title="Restaurant Profile & Tax Configuration"
        subtitle="Manage outlet branding, FSSAI & GSTIN compliance, dynamic UPI VPA for customer billing, and station routing rules."
        actions={
          <button
            onClick={loadSettings}
            disabled={loading}
            className="px-3.5 py-1.5 border border-stone-800 bg-[#181514] hover:bg-stone-800 text-xs font-mono text-stone-200 flex items-center gap-2 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#E07A5F] ${loading ? "animate-spin" : ""}`} />
            <span>Reload</span>
          </button>
        }
      />

      {loading && !settings ? (
        <div className="p-12 text-center text-xs text-stone-400">Loading restaurant settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Outlet Profile */}
          <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
              <Store className="w-5 h-5 text-[#E07A5F]" />
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Outlet Information & Contact
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Restaurant Legal Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-semibold focus:outline-none focus:border-[#E07A5F]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Brand Tagline / Header</label>
                <input
                  type="text"
                  value={settings.tagline || ""}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Official Contact Phone</label>
                <input
                  type="tel"
                  value={settings.phone || ""}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Billing Email</label>
                <input
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Complete Physical Address</label>
                <input
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                />
              </div>
            </div>
          </div>

          {/* Legal & Tax Compliance */}
          <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Statutory Compliance & Indian GST
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">GSTIN Number (15 Digits)</label>
                <input
                  type="text"
                  value={settings.gstin || ""}
                  onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono font-bold focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">FSSAI License Number (14 Digits)</label>
                <input
                  type="text"
                  value={settings.fssai_number || ""}
                  onChange={(e) => setSettings({ ...settings, fssai_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">CGST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={settings.cgst_rate ?? 0}
                  onChange={(e) => setSettings({ ...settings, cgst_rate: Number(e.target.value), cgst_percent: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">SGST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={settings.sgst_rate ?? 0}
                  onChange={(e) => setSettings({ ...settings, sgst_rate: Number(e.target.value), sgst_percent: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Service Charge (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={!settings.service_charge_enabled}
                  value={settings.service_charge_enabled ? (settings.service_charge_rate ?? 0) : 0}
                  onChange={(e) => setSettings({ ...settings, service_charge_rate: Number(e.target.value), service_charge_percent: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F] disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="sc-toggle"
                  checked={Boolean(settings.service_charge_enabled)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSettings({
                      ...settings,
                      service_charge_enabled: enabled,
                      service_charge_rate: enabled ? (settings.service_charge_rate || 5.0) : 0,
                      service_charge_percent: enabled ? (settings.service_charge_rate || 5.0) : 0,
                    });
                  }}
                  className="w-4 h-4 rounded text-[#E07A5F] bg-stone-900 border-stone-700 focus:ring-0"
                />
                <label htmlFor="sc-toggle" className="text-xs text-stone-300 font-medium cursor-pointer">
                  Apply Discretionary Service Charge on Dine-In bills
                </label>
              </div>
            </div>
          </div>

          {/* Operational, Invoice & UPI Settings */}
          <div className="p-6 rounded-2xl bg-[#181514] border border-stone-800 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
              <QrCode className="w-5 h-5 text-amber-400" />
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                UPI Gateway, Invoicing & Station Routing
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Merchant UPI VPA ID</label>
                <input
                  type="text"
                  value={settings.upi_vpa || ""}
                  onChange={(e) => setSettings({ ...settings, upi_vpa: e.target.value })}
                  placeholder="merchant@bank"
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Dynamic QR codes on customer receipts and POS settlement will route to this UPI handle.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Invoice Number Prefix</label>
                <input
                  type="text"
                  value={settings.invoice_prefix || "INV"}
                  onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Prefix applied to all generated guest bills (e.g. INV-2026-0001).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Operating Timezone</label>
                <input
                  type="text"
                  value={settings.timezone || "Asia/Kolkata"}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="autoprint-toggle"
                  checked={settings.auto_print_kot}
                  onChange={(e) => setSettings({ ...settings, auto_print_kot: e.target.checked })}
                  className="w-4 h-4 rounded text-[#E07A5F] bg-stone-900 border-stone-700 focus:ring-0"
                />
                <label htmlFor="autoprint-toggle" className="text-xs text-stone-300 font-medium cursor-pointer">
                  Auto-Print KOT on POS and QR Order Confirmation
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold text-xs shadow-lg hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving Configuration..." : "Save All Configuration"}</span>
            </button>
          </div>
        </form>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
