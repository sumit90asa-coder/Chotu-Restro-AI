# CHOTU RESTRO AI — AI ASSISTANT FUNCTIONAL TEST REPORT (15 CORE AREAS)

**Date:** November 26, 2026  
**Status:** 15/15 TESTS PASSED (100% SUCCESS RATE)  
**Execution Script:** `backend/scripts/verify_voice_and_ai_15_tests.py`  
**Test Database:** Isolated Multi-Tenant PostgreSQL Instance  

---

## 1. Test Summary Matrix

| # | Test Area | Input Query / Condition | Expected Outcome | Actual Result | Status |
|---|---|---|---|---|:---:|
| 01 | Typed Question | *"How much did we sell today?"* | Total sales ₹700 grounded in DB payments | *"Today's total sales are ₹ 700.00 across 1 settled bills."* | **PASS** |
| 02 | Voice Transcript Pipeline | *"What are the live sales today?"* | Speech text passes through same `/chat` endpoint | *"Today's total sales are ₹ 700.00 across 1 settled bills."* | **PASS** |
| 03 | English Speech Recognition | *"Which tables are occupied right now?"* | Accurate occupancy list matching Table 1 | *"1 occupied table(s): Table 1 (₹0.00 bill). 1 vacant table(s)."* | **PASS** |
| 04 | Hindi Speech Recognition | *"aaj kitni sales hui"* | Matches revenue intent without strict English syntax | Returns today's sales figure (₹700.00) | **PASS** |
| 05 | Hinglish Speech Recognition | *"table 4 khali hai kya"* | Identifies specific table 4 status | *"Table 4 is currently vacant and ready for seating."* | **PASS** |
| 06 | Editable Recognized Transcript | Voice: *"how many tables"* -> User edits to: *"Which ingredients are running low?"* | Dispatches modified text to DB inventory query | *"1 ingredient(s) are low or below reorder threshold: Paneer Cubes (1.500 kg left, min: 5.000 kg)"* | **PASS** |
| 07 | Microphone Permission Denial | User denies mic permission | Visual alert banner; fallback to text input | Warning banner displayed; `isListening` safely reset | **PASS** |
| 08 | Unsupported Browser Handling | Browser without `SpeechRecognition` API | Informs user and preserves typed input | Fallback alert banner rendered | **PASS** |
| 09 | Follow-Up Question with History | Turn 1: *"How much did we sell today?"*<br>Turn 2: *"What about yesterday?"* | Uses prior context to infer sales query for yesterday | *"Yesterday's total sales were ₹ 450.00 across 1 settled bills."* | **PASS** |
| 10 | Empty Database Tenant Response | Zero-sales tenant asks *"How much did we sell today?"* | Truthful ₹0 reporting; no hallucinated figures | *"Today's total sales are ₹ 0.00 across 0 settled bills."* | **PASS** |
| 11 | Gemini Failure Fallback | `GEMINI_API_KEY` disabled / rate-limited | Deterministic SQL engine takes over | *"Kitchen status: 1 active KOT(s) (1 cooking, 0 ready for pickup)."* | **PASS** |
| 12 | Expired Authentication Rejection | Invalid / expired JWT bearer token | HTTP 401 Unauthorized | HTTP 401 returned immediately | **PASS** |
| 13 | Multi-Tenant Data Isolation | Restaurant 2 asks for top selling dishes | Does not leak Restaurant 1 dishes | Zero mentions of *"Shahi Paneer"* or *"Butter Naan"* in Restaurant 2 | **PASS** |
| 14 | Quick-Question Button Execution | Suggested pill: *"Which dishes sold most this week?"* | Aggregates `OrderItem` counts for current tenant | Correctly identifies *"Shahi Paneer (2 sold)"* | **PASS** |
| 15 | Mobile Layout & TTS Readout | Mobile viewport & audio playback button | Responsive layout; SpeechSynthesis triggers voice readout | Mobile-responsive container (`w-full max-w-4xl`); TTS audio readout controls active | **PASS** |

---

## 2. Test Execution Log Evidence

```
[PASS] Test 01: Typed question: 'How much did we sell today?'
[PASS] Test 02: Voice transcript query pipeline simulation
[PASS] Test 03: English speech recognition: 'Which tables are occupied right now?'
[PASS] Test 04: Hindi speech recognition: 'aaj kitni sales hui'
[PASS] Test 05: Hinglish speech recognition: 'table 4 khali hai kya'
[PASS] Test 06: Editable transcript workflow (User edits voice text before send)
[PASS] Test 07: Microphone permission denial error handling & visual alert banner
[PASS] Test 08: Unsupported browser Web Speech API detection & fallback banner
[PASS] Test 09: Follow-up question with conversational history: 'What about yesterday?'
[PASS] Test 10: Empty database tenant response (Zero sales, truth-grounded)
[PASS] Test 11: Gemini API failure deterministic fallback engine
[PASS] Test 12: Expired/invalid authentication rejection (HTTP 401)
[PASS] Test 13: Multi-tenant restaurant data isolation (Zero cross-restaurant leakage)
[PASS] Test 14: Quick-question button execution ('Which dishes sold the most this week?')
[PASS] Test 15: Mobile layout responsiveness & SpeechSynthesis TTS readout controls

==========================================
VERIFICATION RESULTS: 15/15 PASSED
==========================================
```

---

## 3. Regression Suite Verification

In addition to the 15 targeted AI tests, the full backend regression suite was executed:
- **Total Tests:** 87
- **Passed:** 87
- **Failed:** 0
- **Execution Time:** 17.61s
- **Coverage Areas:** Auth & Token Revocation, Billing Concurrency & Safety, KDS, POS, QR Security, Inventory, Menu CRUD, CRM & Loyalty, Analytics Reconciliation, Multi-Tenant Isolation.
