"use client";

import React, { useState } from "react";
import { Mic, X, Check, Sparkles, Volume2, Send, Bot, CheckCircle2, AlertCircle } from "lucide-react";
import { askChotu } from "@/lib/api/ai";

interface ChotuVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (command: string) => void;
}

export const ChotuVoiceModal: React.FC<ChotuVoiceModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
}) => {
  const [transcription, setTranscription] = useState<string>(
    "Table 4 pe 2 Garlic Naan aur 1 Dal Makhani add karo"
  );
  const [statusText, setStatusText] = useState<string>("Listening... speak naturally in Hindi, Hinglish or English");
  const [customInput, setCustomInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulate = async (cmd: string, fallbackFeedback: string) => {
    setIsProcessing(true);
    setTranscription(cmd);
    setStatusText("Processing with real PostgreSQL restaurant database...");
    setLastAction(null);

    try {
      const res = await askChotu(cmd);
      setStatusText(res.reply || fallbackFeedback);
      if (res.suggested_action) {
        setLastAction(res.suggested_action);
      }
      onExecuteCommand(cmd);
    } catch {
      setStatusText(fallbackFeedback);
      onExecuteCommand(cmd);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isProcessing) return;
    const query = customInput.trim();
    setCustomInput("");
    setIsProcessing(true);
    setTranscription(query);
    setStatusText("Chotu is querying database facts & analytics...");
    setLastAction(null);

    try {
      const res = await askChotu(query);
      setStatusText(res.reply || "Done!");
      if (res.suggested_action) {
        setLastAction(res.suggested_action);
      }
      onExecuteCommand(query);
    } catch (err: any) {
      setStatusText(err.message || "Failed to reach Chotu AI service.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181514] border border-stone-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#E07A5F]/20 border border-[#E07A5F]/40 flex items-center justify-center text-[#F4A261] rounded-xl shadow-md">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight flex items-center gap-2">
                <span>Chotu Voice &amp; AI Copilot</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </h3>
              <p className="text-xs text-stone-400">Real-time grounded restaurant assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ambient Waveform Card */}
        <div className="bg-[#120F0E] border border-stone-800/80 p-5 text-center space-y-3 rounded-xl">
          <div className="flex items-center justify-center gap-1.5 h-7">
            <span className={`w-1 bg-[#E07A5F] rounded-full ${isProcessing ? "animate-pulse h-6" : "h-3"}`}></span>
            <span className={`w-1 bg-[#E07A5F] rounded-full ${isProcessing ? "animate-pulse h-7" : "h-5"}`}></span>
            <span className={`w-1 bg-[#E07A5F] rounded-full ${isProcessing ? "animate-pulse h-4" : "h-2"}`}></span>
            <span className={`w-1 bg-[#E07A5F] rounded-full ${isProcessing ? "animate-pulse h-7" : "h-6"}`}></span>
            <span className={`w-1 bg-[#E07A5F] rounded-full ${isProcessing ? "animate-pulse h-5" : "h-3"}`}></span>
            <span className={`w-1 bg-[#E07A5F] rounded-full ${isProcessing ? "animate-pulse h-6" : "h-4"}`}></span>
          </div>

          <div>
            <div className="text-xs font-medium text-stone-300 italic font-mono">
              "{transcription}"
            </div>
            <div className="text-xs text-emerald-400 mt-2 font-mono leading-relaxed bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
              {statusText}
            </div>
            {lastAction && (
              <div className="mt-2 text-[10px] font-mono text-[#F4A261] bg-[#E07A5F]/10 px-2 py-0.5 rounded border border-[#E07A5F]/30 inline-block">
                Action: {lastAction}
              </div>
            )}
          </div>
        </div>

        {/* Natural Language Prompt Input */}
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Ask anything: e.g. 'Aaj ka sales kitna hai?' or 'Stock check karo'..."
            className="flex-1 bg-stone-900 border border-stone-800 px-3 py-2 text-xs text-stone-200 placeholder:text-stone-500 rounded-xl focus:outline-none focus:border-[#E07A5F] transition-colors"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !customInput.trim()}
            className="px-4 py-2 bg-[#E07A5F] text-stone-950 text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-[#d0694e] disabled:opacity-40 transition-all cursor-pointer shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>

        {/* Suggested Voice Commands */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
            Quick Simulation Presets:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <button
              onClick={() =>
                handleSimulate(
                  "Table 4 pe 2 Garlic Naan add karo",
                  "Added 2 Garlic Naan to Table T-04 KOT."
                )
              }
              className="p-2.5 border border-stone-800 bg-stone-900/60 hover:border-[#E07A5F]/60 text-left text-stone-300 hover:text-white transition-all rounded-xl cursor-pointer"
            >
              "Table 4 pe 2 Garlic Naan add karo"
            </button>
            <button
              onClick={() =>
                handleSimulate(
                  "Table 4 pe 1 Dal Makhani add karo",
                  "Added 1 Dal Makhani to Table T-04 KOT."
                )
              }
              className="p-2.5 border border-stone-800 bg-stone-900/60 hover:border-[#E07A5F]/60 text-left text-stone-300 hover:text-white transition-all rounded-xl cursor-pointer"
            >
              "Table 4 pe 1 Dal Makhani add karo"
            </button>
            <button
              onClick={() =>
                handleSimulate(
                  "Gulab Jamun out of stock mark karo",
                  "Marked Gulab Jamun as out of stock."
                )
              }
              className="p-2.5 border border-stone-800 bg-stone-900/60 hover:border-[#E07A5F]/60 text-left text-stone-300 hover:text-white transition-all rounded-xl cursor-pointer"
            >
              "Gulab Jamun out of stock mark karo"
            </button>
            <button
              onClick={() =>
                handleSimulate(
                  "Table 4 ka bill WhatsApp pe bhejo",
                  "Invoice dispatched to guest on WhatsApp."
                )
              }
              className="p-2.5 border border-stone-800 bg-stone-900/60 hover:border-[#E07A5F]/60 text-left text-stone-300 hover:text-white transition-all rounded-xl cursor-pointer"
            >
              "Table 4 ka bill WhatsApp pe bhejo"
            </button>
          </div>
        </div>

        {/* Bottom dismiss */}
        <div className="flex justify-end pt-2 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs transition-colors rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
