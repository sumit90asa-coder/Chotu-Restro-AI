# CHOTU RESTRO AI — VOICE INPUT & SPEECH RECOGNITION IMPLEMENTATION REPORT

**Date:** November 26, 2026  
**Status:** IMPLEMENTED & PRODUCTION READY  
**Component:** Voice AI Input & Speech Synthesis Module  
**File Modified:** `src/app/(dashboard)/ai/page.tsx`  

---

## 1. Architectural Design & User Experience Flow

Voice recognition was designed to function directly inside the primary input container:

```
[ Microphone Toggle ] ──> [ Web Speech API (en-IN / hi-IN) ]
         │                               │
         ▼                               ▼
[ Pulsing Red Indicator ]        [ Live Text Stream ]
         │                               │
         ▼                               ▼
[ "Done" or "Discard" ] ─────────> [ Editable Input Field ]
                                                 │
                                                 ▼ (User Reviews / Edits)
                                        [ Send Button / Enter ]
                                                 │
                                                 ▼
                                        [ askChotu() Backend API ]
                                                 │
                                                 ▼
                                     [ Optional TTS Speaker Readout ]
```

---

## 2. In-Input Voice Controls & State Architecture

### 2.1 Visual Input Layout
The microphone button is positioned cleanly inside the input container alongside language selectors:
```tsx
<div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-2xl p-2 focus-within:border-[#E07A5F] transition-all">
  {/* Microphone Toggle */}
  <button
    type="button"
    onClick={toggleListening}
    className={`p-3 rounded-xl transition-all ${
      isListening
        ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
        : "bg-stone-800 hover:bg-stone-700 text-stone-300"
    }`}
  >
    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
  </button>

  {/* Editable Input Field */}
  <input
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder={isListening ? "Listening to your voice..." : "Speak or type your question here..."}
    className="flex-1 bg-transparent border-none text-stone-100 placeholder-stone-500 text-sm focus:outline-none px-2"
  />

  {/* Send Button */}
  <button
    onClick={() => handleSend()}
    disabled={!input.trim() || isTyping}
    className="px-5 py-2.5 rounded-xl bg-[#E07A5F] hover:bg-[#d66a4f] text-stone-950 font-bold text-xs"
  >
    Send
  </button>
</div>
```

### 2.2 Live Recording Status Bar
When recording is initiated, a contextual control bar animates directly above the input:
- Pulsing red badge: `Recording Voice... Speak now in Hindi, English, or Hinglish`
- Action buttons:
  - **Done Speaking**: Stops recording and immediately preserves the recognized transcript in the input.
  - **Discard**: Stops recording and wipes the interim transcript without sending.

---

## 3. Web Speech API Integration & Language Support

### 3.1 Speech Recognition Engine
The component checks for browser support via `window.SpeechRecognition || (window as any).webkitSpeechRecognition`.
```typescript
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
if (!SpeechRecognition) {
  setBrowserUnsupported(true);
  return;
}
```

### 3.2 Multilingual Support (English, Hindi, Hinglish)
- Users can switch language models on the fly using a language toggle pill:
  - `en-IN` (Indian English - optimized for Indian restaurant terminology)
  - `hi-IN` (Hindi - native Devanagari and phonetic recognition)
- Hinglish phrases (e.g. *"Table 4 khali hai kya"*, *"Paneer ka stock kitna hai"*) are smoothly recognized and matched by both language modes and backend NLP tokenizers.

### 3.3 Editable Transcripts Before Submission
Speech transcripts are written directly to the `input` state:
- Users can click into the input box to correct dish names, quantities, or table numbers before dispatching.
- Incomplete or empty transcripts are never sent automatically.

---

## 4. Exception & Permission Handling

1. **Microphone Permission Denied (`not-allowed`):**
   - Caught in `recognition.onerror`.
   - Displays an amber warning banner: *"Microphone access was denied. Please allow microphone permissions in your browser or type your query below."*
   - Safely resets `isListening` to `false`.
2. **Unsupported Browsers:**
   - Caught on component mount.
   - Displays an informational banner: *"Your browser does not support the Web Speech API. Please use Google Chrome, Microsoft Edge, or Safari for voice recognition, or type your query below."*
3. **Session Interruption:**
   - Automatically unbinds recognition instances on page unload or route transition to prevent background microphone activity.

---

## 5. Speech Synthesis (Text-to-Speech) Readout

To complete the voice assistant experience:
- Every Chotu response card includes an audio speaker button (`Volume2` / `VolumeX`).
- Clicking the speaker activates `window.speechSynthesis.speak()`, reading out the sales totals, table occupancy, or action confirmations aloud in natural synthesized speech.
- Clicking while playing immediately cancels speech readout (`speechSynthesis.cancel()`).
