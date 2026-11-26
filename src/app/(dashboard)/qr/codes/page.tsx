"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import JSZip from "jszip";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableStatus } from "@/types/restaurant";
import { fetchTables, regenerateTableQR } from "@/lib/api/tables";
import { 
  QrCode, 
  Printer, 
  ExternalLink, 
  Download, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  Users, 
  FolderArchive, 
  AlertTriangle, 
  X, 
  Layers, 
  UtensilsCrossed,
  HelpCircle,
  Eye
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";

export default function QrCodesAdminPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Generated QR Data URLs: table.id -> dataUrl (PNG)
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  
  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // Regeneration Modal State
  const [tableToRegenerate, setTableToRegenerate] = useState<Table | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Bulk ZIP Download State
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Single Print Card Modal
  const [tableToPrint, setTableToPrint] = useState<Table | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute Base URL dynamically using NEXT_PUBLIC_APP_URL or current browser origin
  const baseUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    }
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }, []);

  const getTableMenuUrl = (table: Table) => {
    const tokenParam = table.qrToken ? `?token=${encodeURIComponent(table.qrToken)}` : "";
    return `${baseUrl}/qr/${encodeURIComponent(table.id)}${tokenParam}`;
  };

  // Load Tables from PostgreSQL
  const loadTables = async () => {
    setLoading(true);
    try {
      const data = await fetchTables();
      if (Array.isArray(data)) {
        setTables(data);
      }
    } catch (err) {
      console.error("Failed to fetch tables from PostgreSQL:", err);
      showToast("Could not load live tables from database. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  // Generate Scannable QR Codes whenever tables change
  useEffect(() => {
    async function generateAllQrs() {
      const urls: Record<string, string> = {};
      for (const table of tables) {
        const fullUrl = getTableMenuUrl(table);
        try {
          const dataUrl = await QRCode.toDataURL(fullUrl, {
            width: 400,
            margin: 2,
            color: {
              dark: "#181413", // Warm espresso
              light: "#FFFFFF",
            },
            errorCorrectionLevel: "H",
          });
          urls[table.id] = dataUrl;
        } catch (e) {
          console.error(`Error generating QR for ${table.id}:`, e);
        }
      }
      setQrDataUrls(urls);
    }

    if (tables.length > 0) {
      generateAllQrs();
    }
  }, [tables, baseUrl]);

  // Copy Customer Menu URL to Clipboard
  const handleCopyUrl = async (table: Table) => {
    const fullUrl = getTableMenuUrl(table);
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedTableId(table.id);
      showToast(`URL copied for ${table.label}!`);
      setTimeout(() => setCopiedTableId(null), 2500);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      showToast("Unable to copy to clipboard.");
    }
  };

  // Download Individual QR Code as PNG
  const handleDownloadSingleQr = (table: Table) => {
    const dataUrl = qrDataUrls[table.id];
    if (!dataUrl) {
      showToast("QR code still generating, please wait...");
      return;
    }
    const safeLabel = table.label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `QR_${safeLabel}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded QR for ${table.label}`);
  };

  // Download All Active Table QRs as a single ZIP file
  const handleDownloadAllZip = async () => {
    if (tables.length === 0) return;
    setIsZipping(true);
    showToast("Generating ZIP archive with all table QR codes...");
    try {
      const zip = new JSZip();
      const folder = zip.folder("ChotuRestro_Table_QRs");

      for (const table of tables) {
        const fullUrl = getTableMenuUrl(table);
        const dataUrl = await QRCode.toDataURL(fullUrl, {
          width: 800,
          margin: 3,
          color: { dark: "#181413", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });
        // Remove data URL prefix to get raw base64
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const safeName = `QR_${table.label.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
        folder?.file(safeName, base64Data, { base64: true });
      }

      // Add a handy README with table URLs
      const readmeContent = [
        "CHOTU RESTRO AI — TABLE QR CODES DIRECTORY",
        "===========================================",
        `Generated: ${new Date().toLocaleString()}`,
        `Application Domain: ${baseUrl}`,
        "",
        ...tables.map((t) => `${t.label} (Capacity: ${t.capacity}): ${getTableMenuUrl(t)}`),
        "",
        "Instructions: Print or place on corresponding dining tables.",
      ].join("\n");
      folder?.file("TABLE_URLS.txt", readmeContent);

      const content = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(content);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = `${user?.restaurantName ? user.restaurantName.replace(/[^a-zA-Z0-9]/g, "_") : "Restaurant"}_Table_QRs.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      showToast("ZIP archive downloaded successfully!");
    } catch (err) {
      console.error("ZIP creation error:", err);
      showToast("Failed to create ZIP package.");
    } finally {
      setIsZipping(false);
    }
  };

  // Regenerate Table QR Token
  const handleConfirmRegenerate = async () => {
    if (!tableToRegenerate) return;
    setIsRegenerating(true);
    try {
      const updated = await regenerateTableQR(tableToRegenerate.id);
      setTables((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      showToast(`Regenerated QR token for ${updated.label}`);
      setTableToRegenerate(null);
    } catch (err: any) {
      console.error("Failed to regenerate token:", err);
      showToast(err?.message || "Failed to regenerate QR token.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Filter Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesSearch =
        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tables, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter((t) => t.status === "occupied").length;
    const vacant = tables.filter((t) => t.status === "vacant").length;
    const billed = tables.filter((t) => t.status === "billed").length;
    const reserved = tables.filter((t) => t.status === "reserved").length;
    const totalCapacity = tables.reduce((acc, t) => acc + (t.capacity || 0), 0);
    return { total, occupied, vacant, billed, reserved, totalCapacity };
  }, [tables]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#181413] border border-[#E07A5F] text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 text-[#E07A5F]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        category="Digital Ordering Setup"
        title="Table QR Codes & Print Cards"
        subtitle="Manage dynamic, scannable QR codes connected to PostgreSQL. Guests scan to place orders that fire directly to the kitchen."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadAllZip}
              disabled={isZipping || tables.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-200 hover:text-white font-medium text-xs shadow-sm transition-all disabled:opacity-50"
              title="Download all QR codes as a ZIP package"
            >
              <FolderArchive className="w-4 h-4 text-[#E07A5F]" />
              <span>{isZipping ? "Packaging ZIP..." : "Download All (ZIP)"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Cards</span>
            </button>
          </div>
        }
      />

      {/* Stats & Domain Info Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-stone-400 block">Total Active Tables</span>
            <span className="text-xl font-bold font-mono text-white">{stats.total}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-stone-400 block">Total Seating Capacity</span>
            <span className="text-xl font-bold font-mono text-[#F4A261]">{stats.totalCapacity} Guests</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-[#F4A261]">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-stone-400 block">Live Occupancy</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {stats.occupied} / {stats.total} Tables
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181514] border border-stone-800 flex items-center justify-between">
          <div className="truncate pr-2">
            <span className="text-[11px] font-mono text-stone-400 block">Customer Menu Domain</span>
            <span className="text-xs font-mono text-[#E07A5F] truncate block">
              {baseUrl.replace(/^https?:\/\//, "")}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 flex-shrink-0">
            <QrCode className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search table by name or ID (e.g., T-01, Table 4)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181514] border border-stone-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#E07A5F] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: "all", label: "All Tables", count: stats.total },
            { id: "vacant", label: "Vacant", count: stats.vacant, color: "text-emerald-400" },
            { id: "occupied", label: "Occupied", count: stats.occupied, color: "text-amber-400" },
            { id: "billed", label: "Billed", count: stats.billed, color: "text-blue-400" },
            { id: "reserved", label: "Reserved", count: stats.reserved, color: "text-purple-400" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === pill.id
                  ? "bg-[#E07A5F] text-stone-950 font-bold shadow-md shadow-[#E07A5F]/20"
                  : "bg-[#181514] border border-stone-800 text-stone-400 hover:text-white"
              }`}
            >
              <span>{pill.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === pill.id ? "bg-stone-950 text-white" : "bg-stone-900 text-stone-400"
                }`}
              >
                {pill.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-96 rounded-3xl bg-[#181514] border border-stone-800 p-6 flex flex-col items-center justify-between">
              <div className="w-24 h-4 bg-stone-800 rounded" />
              <div className="w-36 h-36 bg-stone-900 rounded-2xl" />
              <div className="w-full h-8 bg-stone-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-[#181514]/60 border border-stone-800 rounded-3xl p-8">
          <UtensilsCrossed className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Tables Found</h3>
          <p className="text-xs text-stone-400">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search query or status filter."
              : "No dining tables exist in PostgreSQL yet."}
          </p>
        </div>
      ) : (
        /* Table QR Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-8">
          {filteredTables.map((table) => {
            const customerUrl = getTableMenuUrl(table);
            const qrImage = qrDataUrls[table.id];

            return (
              <div
                key={table.id}
                className="p-6 rounded-3xl bg-[#181514] border border-stone-800 text-center flex flex-col items-center justify-between shadow-xl relative overflow-hidden group hover:border-[#E07A5F]/50 transition-all print:border print:border-stone-300 print:bg-white print:text-stone-900 print:shadow-none"
              >
                {/* Header Information */}
                <div className="w-full space-y-1 mb-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono uppercase font-bold text-[#E07A5F] tracking-widest truncate max-w-[150px]">
                      {user?.restaurantName || "Restaurant Table"}
                    </span>

                    {/* Table Status Badge */}
                    <span
                      className={`text-[9px] uppercase font-mono font-semibold px-2 py-0.5 rounded-full border ${
                        table.status === "occupied"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : table.status === "vacant"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : table.status === "billed"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      }`}
                    >
                      {table.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-white print:text-stone-900 pt-1">
                    {table.label}
                  </h3>

                  <div className="flex items-center justify-center gap-2 text-xs text-stone-400 font-medium">
                    <Users className="w-3.5 h-3.5 text-stone-500" />
                    <span>Capacity: {table.capacity} Guests</span>
                    {table.section && (
                      <>
                        <span className="text-stone-600">•</span>
                        <span className="text-stone-500">{table.section}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Scannable Dynamic QR Code Container */}
                <div className="p-4 bg-white rounded-2xl shadow-inner mb-4 flex flex-col items-center justify-center border border-stone-200 w-full max-w-[200px]">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt={`QR Code for ${table.label}`}
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 flex flex-col items-center justify-center text-stone-400 animate-pulse">
                      <QrCode className="w-12 h-12 text-stone-400 mb-1" />
                      <span className="text-[10px] font-mono">Generating QR...</span>
                    </div>
                  )}
                  <span className="text-[9px] font-mono text-stone-800 mt-2 uppercase font-extrabold tracking-wider">
                    SCAN TO BROWSE & ORDER
                  </span>
                </div>

                {/* Micro URL with Copy Button */}
                <div className="w-full mb-3 print:hidden">
                  <div className="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-stone-900/90 border border-stone-800/80 text-[10px] font-mono text-stone-400">
                    <span className="truncate pl-1 select-all" title={customerUrl}>
                      /qr/{table.id}?token={table.qrToken?.slice(0, 10)}...
                    </span>
                    <button
                      onClick={() => handleCopyUrl(table)}
                      className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors flex-shrink-0"
                      title="Copy full customer menu URL"
                    >
                      {copiedTableId === table.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="w-full space-y-2 print:hidden">
                  <Link
                    href={`/qr/${table.id}${table.qrToken ? `?token=${table.qrToken}` : ""}`}
                    target="_blank"
                    className="w-full py-2 px-3 rounded-xl bg-stone-900 border border-stone-800 hover:border-[#E07A5F]/40 text-stone-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#E07A5F]" />
                    <span>Preview Customer Menu</span>
                  </Link>

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {/* Download PNG */}
                    <button
                      onClick={() => handleDownloadSingleQr(table)}
                      className="py-1.5 px-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Download QR code as PNG"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>PNG</span>
                    </button>

                    {/* Print Card */}
                    <button
                      onClick={() => setTableToPrint(table)}
                      className="py-1.5 px-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Print table card"
                    >
                      <Printer className="w-3 h-3 text-blue-400" />
                      <span>Print</span>
                    </button>

                    {/* Regenerate Token */}
                    <button
                      onClick={() => setTableToRegenerate(table)}
                      className="py-1.5 px-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-rose-500/40 text-stone-300 hover:text-rose-400 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Regenerate QR token (invalidates old code)"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* Print Only Microcopy */}
                <div className="hidden print:block text-center mt-3 pt-2 border-t border-stone-200">
                  <p className="text-[10px] text-stone-600 font-mono">
                    Open Camera & Point at QR • No App Required
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGENERATE QR CONFIRMATION MODAL */}
      {tableToRegenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181413] border border-stone-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Regenerate QR Code?</h3>
                <p className="text-xs text-stone-400 font-mono">{tableToRegenerate.label}</p>
              </div>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Regenerating the QR code for <strong className="text-white font-bold">{tableToRegenerate.label}</strong> will immediately invalidate the existing QR code. Any printed cards using the old code will immediately stop working.
            </p>

            <div className="p-3 rounded-2xl bg-stone-900 border border-stone-800 text-[11px] font-mono text-stone-400 space-y-1">
              <div>Current Token: <span className="text-stone-300">{tableToRegenerate.qrToken || "None"}</span></div>
              <div className="text-[#F4A261]">A new cryptographically secure token will be generated.</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isRegenerating}
                onClick={() => setTableToRegenerate(null)}
                className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRegenerating}
                onClick={handleConfirmRegenerate}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                <span>{isRegenerating ? "Regenerating..." : "Yes, Regenerate"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PRINT PREVIEW MODAL */}
      {tableToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181413] border border-stone-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono">Print Table Card</h3>
              <button
                onClick={() => setTableToPrint(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Preview Card */}
            <div className="printable-area p-6 rounded-2xl bg-white text-stone-950 text-center space-y-3 shadow-md border border-stone-300">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-[#E07A5F] tracking-widest block">
                  {user?.restaurantName || "Restaurant Table"}
                </span>
                <h4 className="text-2xl font-black text-stone-900">{tableToPrint.label}</h4>
                <p className="text-xs text-stone-600 font-medium">Table for {tableToPrint.capacity} Guests</p>
              </div>

              {qrDataUrls[tableToPrint.id] && (
                <div className="p-2 bg-stone-50 rounded-xl inline-block border border-stone-200">
                  <img
                    src={qrDataUrls[tableToPrint.id]}
                    alt={`QR for ${tableToPrint.label}`}
                    className="w-40 h-40 object-contain mx-auto"
                  />
                </div>
              )}

              <div className="space-y-1 pt-1">
                <span className="text-xs font-bold text-stone-900 block font-mono uppercase tracking-wider">
                  Scan to View Menu & Order
                </span>
                <p className="text-[10px] text-stone-500 font-mono">
                  No app required • Point mobile camera to scan
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setTableToPrint(null)}
                className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Card</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
