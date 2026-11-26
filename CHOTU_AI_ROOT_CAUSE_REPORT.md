# CHOTU RESTRO AI — AI ASSISTANT ROOT CAUSE & DIAGNOSTIC AUDIT REPORT

**Date:** November 26, 2026  
**Auditor:** Principal AI Systems & Full-Stack Reliability Engineer  
**Component:** Chotu AI Assistant (`/ai` route & `/api/v1/ai/chat` endpoint)  
**Target Environment:** Production (`chotu-frontend-voqz.onrender.com` / `chotu-backend-o8wn.onrender.com`)  

---

## 1. Executive Summary

An exhaustive audit of the request lifecycle of the Chotu Voice AI Assistant was performed across the Next.js 15 frontend, FastAPI backend, PostgreSQL relational database, and Gemini LLM integration. 

Prior to this remediation, the AI assistant was perceived by end users as non-functional, unresponsive to speech, and failing to execute operational commands. Our diagnosis identified **five distinct architectural and implementation root causes** that broke user interactions, caused silent fallbacks, and prohibited voice-driven operations.

---

## 2. Request Lifecycle Breakdown & Failure Points

```
[User Browser Input]
       │
       ├── (1) Voice Input (Microphone) ──> [BROKEN: No Web Speech API implemented]
       │
       └── (2) Text Input ──> [askChotu API Client]
                                     │
                                     ▼ (POST /api/v1/ai/chat)
                               [FastAPI Route]
                                     │
                                     ├── (3) Schema Payload ──> [No conversational history]
                                     │
                                     ▼
                             [AIService.chat]
                                     │
                                     ├── (4) Strict NLP Regex ──> [Fails on synonyms / Hindi / Hinglish]
                                     │
                                     ├── (5) Gemini LLM Generation ──> [Bypassed PostgreSQL Mutations]
                                     │
                                     ▼
                               [SQL Database] ──> [Runtime Type Errors on Datetimes / Enums]
```

---

## 3. Detailed Root Cause Analysis

### Root Cause 1: Complete Absence of Voice Input in Frontend UI
- **Location:** `src/app/(dashboard)/ai/page.tsx`
- **Symptom:** Users expected a voice-enabled assistant, but the input interface only had a plain text `<input>` with a text send button. No microphone toggle, audio capture hook, or Web Speech API integration existed in the frontend bundle.
- **Impact:** 100% failure for any voice-based user interaction.

### Root Cause 2: Fragile Natural Language Processing & Rigid Keyword Regex
- **Location:** `backend/app/services/ai_service.py` (`AIService.chat`)
- **Symptom:** Intent classification used naive string containment checks (e.g. requiring `"today's sale"` exactly). Queries using everyday synonyms (e.g. *"How much did we sell today?"*, *"aaj kitni sales hui"*, *"is table 4 vacant"*, *"what is waiting time"*) failed to match and fell back to a generic help string.
- **Impact:** Legitimate operational queries appeared "broken" or unanswered.

### Root Cause 3: Stateless API & Absence of Conversational Context
- **Location:** `backend/app/schemas/ai.py`, `backend/app/api/v1/ai.py`
- **Symptom:** `AIChatRequest` accepted only `{"message": str}`. It lacked any conversation history structure. When a user asked *"How much did we sell today?"* followed by *"What about yesterday?"* or *"kal ka?"*, the system had zero historical context and was unable to infer that "yesterday" referred to sales revenue.
- **Impact:** Conversational follow-ups failed completely.

### Root Cause 4: LLM Generation Preempting Operational Database Mutations
- **Location:** `backend/app/services/ai_service.py`
- **Symptom:** When a `GEMINI_API_KEY` was configured, the service forwarded operational instructions (such as *"Mark butter chicken out of stock"*, *"Add dish to Table 2"*, *"Send bill on WhatsApp"*) directly to Gemini for text generation instead of executing the required transactional SQL updates on `MenuItem.is_in_stock` or `Order` records.
- **Impact:** Administrative and operational commands failed to execute in PostgreSQL.

### Root Cause 5: Runtime Schema and Datetime Type Exceptions
- **Location:** `backend/app/services/ai_service.py`
- **Symptom:**
  1. `DiningTable.opened_at` was accessed assuming it was always a `datetime.datetime` object with timezone awareness. In SQLite test fixtures and certain client payloads, it was stored as an ISO-8601 string, throwing `AttributeError: 'str' object has no attribute 'tzinfo'`.
  2. Kitchen queries filtered on `KOTStatus.PREPARING`. However, `KOTStatus` in `app/models/kot.py` is defined as `COOKING`, `READY`, `BUMPED`. Attempting to access `KOTStatus.PREPARING` raised an unhandled `AttributeError`, causing HTTP 500 errors.
- **Impact:** Entire query paths crashed when querying kitchen and floor statuses.

---

## 4. Verification & Diagnostic Evidence

| Checkpoint | Observed Before Fix | Root Cause Verified |
|---|---|---|
| Microphone Button | Missing from DOM | Verified in `ai/page.tsx` |
| "How much did we sell today?" | Generic fallback text | Verified regex omission ("sell" vs "sale") |
| "What about yesterday?" | "I didn't understand" | Verified stateless `AIChatRequest` |
| "Mark Butter Chicken 86" | Text reply, no SQL update | Verified LLM bypass of DB mutation |
| Kitchen status query | HTTP 500 Server Error | Verified invalid `KOTStatus.PREPARING` enum |
