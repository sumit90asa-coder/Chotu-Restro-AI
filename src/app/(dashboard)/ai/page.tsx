"use client";

import React, { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { askChotu, AIChatMessageContext } from "@/lib/api/ai";
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  RotateCcw, 
  Square, 
  AlertCircle, 
  X, 
  Lightbulb,
  Radio,
  Sparkles
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "chotu";
  text: string;
  timestamp: string;
  actionTaken?: any;
  isError?: boolean;
  rawQuery?: string;
}

export default function AiConsolePage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("chotu_ai_chat_history");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // fallback
      }
    }
    return [
      {
        id: "msg-0",
        sender: "chotu",
        text: "Namaste! I am Chotu, your AI Restaurant Operating Assistant. Ask me about today's sales, kitchen ticket pacing, occupied tables, low inventory ingredients, or give voice instructions in Hindi, Hinglish or English.",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  const [input, setInput] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Speech Recognition State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<string>("en-IN"); // 'en-IN' | 'hi-IN'
  const recognitionRef = useRef<any>(null);

  // Speech Synthesis (TTS) State
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // AbortController for stop-generating
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Persist conversation to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("chotu_ai_chat_history", JSON.stringify(messages));
      } catch {
        // ignore
      }
    }
  }, [messages]);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Check SpeechRecognition support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Cleanup speech recognition and synthesis on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Start / Stop Speech Recognition
  const toggleListening = () => {
    setSpeechError(null);

    if (!speechSupported) {
      setSpeechError(
        "Voice input is not supported in this browser. Please use Google Chrome, Edge, or type your query."
      );
      return;
    }

    if (isListening) {
      // Stop recording
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const combined = finalTranscript || interimTranscript;
        if (combined.trim()) {
          setInput((prev) => {
            // If previous input was empty, replace; else append with space
            return combined.trim();
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setSpeechError(
            "Microphone access was denied. Please allow microphone permissions in your browser address bar to use voice input."
          );
        } else if (event.error === "no-speech") {
          // benign timeout
        } else if (event.error === "network") {
          setSpeechError("Network error during speech recognition. Please check your connection.");
        } else {
          setSpeechError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setSpeechError("Failed to initialize microphone. Please check permissions.");
      setIsListening(false);
    }
  };

  const discardVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
    setInput("");
    setSpeechError(null);
  };

  // Text-To-Speech (TTS) readout
  const toggleSpeak = (messageId: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean text of markdown symbols for speech
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/[#*_`]/g, "")
      .replace(/₹/g, "Rupees ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const targetLang = speechLang === "hi-IN" ? "hi" : "en";
    const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang) || v.lang.includes("IN"));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // Send message to AI backend
  const handleSend = async (textToSend?: string) => {
    // If voice recognition is currently running, stop it
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsTyping(true);
    setSpeechError(null);

    // Build conversation history context from recent turns
    const conversationHistory: AIChatMessageContext[] = messages
      .slice(-6)
      .map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

    try {
      const res = await askChotu(query, undefined, conversationHistory);
      const chotuMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "chotu",
        text: res.reply || "Done! I have checked the live restaurant system for you.",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        actionTaken: res.action_data,
        rawQuery: query,
      };
      setMessages((prev) => [...prev, chotuMsg]);
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        "Chotu AI Assistant is currently unable to reach the server. Please check your network connection.";
      const chotuMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "chotu",
        text: `⚠️ ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        isError: true,
        rawQuery: query,
      };
      setMessages((prev) => [...prev, chotuMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsTyping(false);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChatHistory = () => {
    const initialMsg: ChatMessage = {
      id: "msg-0",
      sender: "chotu",
      text: "Chat cleared! I am Chotu, ready for your next voice or text query.",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([initialMsg]);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chotu_ai_chat_history");
    }
  };

  const samplePrompts = [
    "How much did we sell today?",
    "Summarise today's restaurant performance",
    "What were yesterday's sales?",
    "Show this week's revenue",
    "Which tables are currently occupied?",
    "Is Table 4 occupied?",
    "Which table has the longest waiting time?",
    "How many KOTs are currently pending?",
    "Which orders are being prepared?",
    "Which orders are ready?",
    "Which ingredients are running low?",
    "Which ingredients are out of stock?",
    "What is the total stock valuation?",
    "What are our best-selling items?",
    "Which dishes are unavailable?",
    "How many customers visited today?",
    "Table 4 ka bill kitna hai?",
    "Aaj kitni sales hui?"
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between">
        <PageHeader
          category="Conversational Intelligence"
          title="Chotu Voice AI Assistant"
          subtitle="Natural language reasoning & operational assistant. Speaks English, Hindi and Hinglish for instant queries and action execution."
        />
        <button
          onClick={clearChatHistory}
          className="text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-900 transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Speech Error Banner if applicable */}
      {speechError && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{speechError}</span>
          </div>
          <button onClick={() => setSpeechError(null)} className="text-amber-400 hover:text-amber-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Container */}
      <div className="flex-1 rounded-2xl bg-[#181514] border border-stone-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-thin scrollbar-thumb-stone-800">
          {messages.map((m) => {
            const isChotu = m.sender === "chotu";
            const isSpeaking = speakingMessageId === m.id;

            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-2xl ${isChotu ? "" : "ml-auto flex-row-reverse"}`}
              >
                {isChotu ? (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E07A5F] to-[#F4A261] flex items-center justify-center text-stone-950 font-bold flex-shrink-0 shadow-md">
                    <Bot className="w-4 h-4 text-stone-950" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    U
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed space-y-2 relative group shadow-sm ${
                    isChotu
                      ? m.isError
                        ? "bg-rose-950/40 border border-rose-500/30 text-rose-200"
                        : "bg-stone-900 border border-stone-800 text-stone-200"
                      : "bg-[#E07A5F] text-stone-950 font-medium"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  <div className="flex items-center justify-between gap-4 pt-1 border-t border-stone-800/40 text-[10px] opacity-70">
                    <span className="font-mono">{m.timestamp}</span>

                    <div className="flex items-center gap-2">
                      {m.actionTaken && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                          Action Grounded
                        </span>
                      )}

                      {/* Retry button for errors */}
                      {m.isError && m.rawQuery && (
                        <button
                          onClick={() => handleSend(m.rawQuery)}
                          className="flex items-center gap-1 text-rose-300 hover:text-white transition-colors"
                          title="Retry Query"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}

                      {/* Text-To-Speech Speaker Button */}
                      {isChotu && (
                        <button
                          onClick={() => toggleSpeak(m.id, m.text)}
                          className={`p-1 rounded hover:bg-stone-800 transition-colors ${
                            isSpeaking ? "text-[#E07A5F] animate-pulse" : "text-stone-400 hover:text-stone-200"
                          }`}
                          title={isSpeaking ? "Stop Speaking" : "Listen in Voice"}
                        >
                          {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {/* Copy message button */}
                      <button
                        onClick={() => copyToClipboard(m.id, m.text)}
                        className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
                        title="Copy text"
                      >
                        {copiedId === m.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center justify-between gap-3 max-w-md animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E07A5F] to-[#F4A261] flex items-center justify-center text-stone-950 font-bold flex-shrink-0">
                  <Bot className="w-4 h-4 text-stone-950" />
                </div>
                <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 text-xs text-stone-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E07A5F]" />
                  <span>Chotu is querying restaurant database...</span>
                </div>
              </div>
              <button
                onClick={handleStopGenerating}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] flex items-center gap-1 border border-stone-700 transition-colors"
                title="Stop generation"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 bg-[#151211] border-t border-stone-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-stone-500 font-mono uppercase font-bold flex items-center gap-1 pl-2 shrink-0">
            <Lightbulb className="w-3 h-3 text-amber-400" />
            Quick:
          </span>
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={isTyping}
              className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 hover:border-[#E07A5F]/50 text-stone-300 hover:text-white text-[11px] whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Active Speech Recording Indicator */}
        {isListening && (
          <div className="px-4 py-2 bg-gradient-to-r from-red-950/70 via-stone-900 to-red-950/70 border-t border-red-500/40 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-xs text-red-300 font-medium font-mono">
                Recording Voice... ({speechLang === "hi-IN" ? "Hindi (हिन्दी)" : "English / Hinglish"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={discardVoiceInput}
                className="text-[11px] text-stone-400 hover:text-white px-2 py-0.5 rounded border border-stone-700 bg-stone-800 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={toggleListening}
                className="text-[11px] text-red-200 hover:text-white px-2.5 py-0.5 rounded bg-red-700 hover:bg-red-600 transition-colors font-medium"
              >
                Done Speaking
              </button>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 md:p-4 bg-[#171413] border-t border-stone-800 flex items-center gap-2 md:gap-3">
          {/* Language Switcher Pill */}
          <button
            onClick={() => setSpeechLang((prev) => (prev === "en-IN" ? "hi-IN" : "en-IN"))}
            className="px-2.5 py-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 text-[10px] font-mono font-bold transition-colors shrink-0"
            title="Toggle Speech Recognition Language"
          >
            {speechLang === "en-IN" ? "EN / Hinglish" : "HI (हिंदी)"}
          </button>

          {/* Microphone Voice Input Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all shrink-0 ${
              isListening
                ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/30"
                : "bg-stone-900 border border-stone-800 hover:border-[#E07A5F]/60 text-stone-400 hover:text-stone-200"
            }`}
            title={
              !speechSupported
                ? "Speech recognition not supported in this browser"
                : isListening
                ? "Click to stop recording"
                : "Click to speak your question (English / Hindi / Hinglish)"
            }
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                isListening
                  ? "Listening to your voice... Speak now..."
                  : "Speak or type your question here (e.g. 'How much did we sell today?' or 'Aaj kitni sales hui?')..."
              }
              className={`w-full px-4 py-3 rounded-xl bg-stone-900 border text-xs text-white placeholder:text-stone-500 focus:outline-none transition-all ${
                isListening
                  ? "border-red-500/70 ring-1 ring-red-500/40"
                  : "border-stone-800 focus:border-[#E07A5F]"
              }`}
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="p-3 rounded-xl bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-stone-950 font-bold hover:opacity-95 disabled:opacity-40 transition-all shrink-0 shadow-md"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
