# CHOTU RESTRO AI — AI ASSISTANT REPAIR & ENHANCEMENT REPORT

**Date:** November 26, 2026  
**Status:** FULLY REPAIRED & PRODUCTION VERIFIED  
**Auditor:** Principal AI Systems & Full-Stack Reliability Engineer  
**Files Modified:**
- `backend/app/schemas/ai.py`
- `backend/app/api/v1/ai.py`
- `backend/app/services/ai_service.py`
- `src/lib/api/ai.ts`
- `src/app/(dashboard)/ai/page.tsx`

---

## 1. Architectural Architecture & Pipeline Unification

Both voice recognition (speech-to-text) and typed user messages are unified under a **single authenticated pipeline**:

```
[Voice Microphone / Web Speech API] ──┐
                                      ├──> [Editable Input State] ──> [Single API Client: askChotu()]
[Typed Keyboard Input] ───────────────┘                                         │
                                                                                ▼
                                                                     POST /api/v1/ai/chat
                                                                                │
                                                            ┌───────────────────┴───────────────────┐
                                                            ▼                                       ▼
                                                [PostgreSQL Deterministic]             [Gemini 1.5/2.0 Flash LLM]
                                                • Direct Data Extraction               • Natural Language Synthesis
                                                • Instant DB Mutations                 • Contextual Historical Injection
                                                • Zero Cross-Tenant Leaks              • Truth-Grounded Verification
```

---

## 2. Backend Modifications & Schema Upgrades

### 2.1 Schema Upgrades (`backend/app/schemas/ai.py`)
- Added `ChatMessageContext` model:
  ```python
  class ChatMessageContext(BaseModel):
      role: str  # "user" | "assistant" | "system"
      content: str
  ```
- Extended `AIChatRequest`:
  ```python
  class AIChatRequest(BaseModel):
      message: str
      conversation_history: Optional[List[ChatMessageContext]] = None
  ```
- Extended `AIChatResponse`:
  ```python
  class AIChatResponse(BaseModel):
      reply: str
      intent: str
      suggested_action: Optional[str] = None
      action_data: Optional[Dict[str, Any]] = None
      data_context: Optional[Dict[str, Any]] = None
  ```

### 2.2 Endpoint Updates (`backend/app/api/v1/ai.py`)
- Forwarded `conversation_history` from `req.conversation_history` into `AIService.chat`.
- Maintained strict JWT authentication and tenant scoping via `current_user.restaurant_id`.

### 2.3 Comprehensive Service Overhaul (`backend/app/services/ai_service.py`)
1. **Multi-Turn Conversational Memory:**
   - Evaluates preceding turns in `conversation_history` to disambiguate follow-up questions.
   - For example: when a user asks *"How much did we sell today?"* and follows up with *"What about yesterday?"*, the service inspects prior turns, detects the sales revenue context, and answers with yesterday's revenue.
2. **Prioritized Operational Mutations:**
   - Operational actions (`MARK_OUT_OF_STOCK`, `ADD_ITEMS`, `SEND_BILL_WHATSAPP`) are intercepted and executed immediately against PostgreSQL transactions, bypassing LLM delays or hallucinated non-action.
3. **Robust Intent Classification & NLP Matching:**
   - Expanded keywords and regex patterns across Hindi, English, and Hinglish.
   - Added specific handlers for:
     - `QUERY_SALES_YESTERDAY` ("kal ki sales", "yesterday", "what about yesterday")
     - `QUERY_SALES_WEEK` ("weekly revenue", "this week")
     - `QUERY_SPECIFIC_TABLE` ("is table 4 occupied", "table 4 khali hai kya")
     - `QUERY_TABLE_WAIT_TIME` ("longest waiting table", "seated longest")
     - `QUERY_ORDERS_READY` ("orders ready for pickup", "ready to serve")
     - `QUERY_ORDERS_PREPARING` ("orders cooking", "kitchen status")
     - `QUERY_OUT_OF_STOCK_INGREDIENTS` ("zero stock ingredients", "khatam ho gaya")
     - `QUERY_INVENTORY_VALUATION` ("inventory value", "total stock value")
     - `QUERY_TOP_DISHES` ("best sellers", "top selling dishes")
     - `QUERY_UNAVAILABLE_DISHES` ("86'd items", "which dishes are out of stock")
     - `QUERY_TODAY_CUSTOMERS` ("how many customers visited today", "new customers")
     - `QUERY_CANCELLED_ORDERS` ("cancelled orders today", "voided bills")
4. **Resilient Datetime and Enum Handling:**
   - Safely handles `DiningTable.opened_at` as either string or datetime.
   - Replaced invalid `KOTStatus.PREPARING` reference with `KOT.status != KOTStatus.BUMPED`.
5. **Deterministic Fallback Engine:**
   - If `GEMINI_API_KEY` is unavailable or Gemini API returns an error/rate limit, the system falls back seamlessly to deterministic SQL synthesis without throwing unhandled exceptions.

---

## 3. Frontend Integration (`src/lib/api/ai.ts`)

- Upgraded `askChotu` client function to support sending historical messages:
  ```typescript
  export interface AIChatMessageContext {
    role: "user" | "assistant" | "system";
    content: string;
  }

  export async function askChotu(
    message: string,
    conversationHistory?: AIChatMessageContext[]
  ): Promise<AIChatResponse> {
    const res = await apiClient.post<AIChatResponse>("/api/v1/ai/chat", {
      message,
      conversation_history: conversationHistory,
    });
    return res.data;
  }
  ```
