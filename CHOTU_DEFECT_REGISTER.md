# CHOTU RESTRO AI — DEFECT REGISTER & REMEDIATION LOG

**Project:** Chotu Restro AI  
**Audit Date:** November 26, 2026  
**Total Defects Cataloged:** 25  
**Total Resolved:** 25 (100%)  
**Severity Breakdown:**
- **CRITICAL:** 5 defects (All Resolved)
- **HIGH:** 8 defects (All Resolved)
- **MEDIUM:** 8 defects (All Resolved)
- **LOW:** 4 defects (All Resolved)

---

## 1. CRITICAL DEFECTS

### DEF-001: In-Memory Token Revocation Revived on Server Restart
- **Module:** Authentication / Security
- **Symptom:** When a user logged out, their JWT token became valid again after the backend process restarted or on horizontally scaled Render instances.
- **Root Cause:** Revoked token hashes were stored in an in-memory Python `set()` (`REVOKED_TOKENS`), which was reset to empty on every process restart.
- **Affected Files:** `backend/app/core/security.py`, `backend/app/models/auth.py`, `backend/app/api/v1/auth.py`
- **Fix Applied:** Created `revoked_tokens` table in PostgreSQL. `revoke_token()` writes the JTI, token hash, user ID, and expiration timestamp. `is_token_revoked()` executes a direct SQL check against PostgreSQL.
- **Verification:** `backend/tests/test_persistent_revocation.py` passed; token rejected with 401 across simulated server restarts.

### DEF-002: Negative Inventory Stock Intake Vulnerability
- **Module:** Inventory & Stock Management
- **Symptom:** Users could enter negative numbers in the stock intake screen, allowing fraudulent or accidental stock depletion without an audit trail.
- **Root Cause:** `StockAdjustmentRequest` schema lacked minimum value validation, accepting negative floats.
- **Affected Files:** `backend/app/schemas/inventory.py`, `src/app/(dashboard)/inventory/page.tsx`
- **Fix Applied:** Added Pydantic `Field(..., gt=0)` validator for stock replenishment actions. Added `min="0.01"` HTML attribute to frontend numeric input.
- **Verification:** Verified negative intake returns HTTP 422 Unprocessable Entity; positive intake increases stock correctly.

### DEF-003: Chotu AI Random Table KOT Firing Bug
- **Module:** Chotu AI Copilot
- **Symptom:** When asking Chotu AI questions or asking to add a dish, it would occasionally fire a KOT order to an unintended or random table.
- **Root Cause:** Unstructured LLM responses without strict intent validation permitted action triggers on conversational prompts; table IDs were defaulted to `table-1` when unspecified.
- **Affected Files:** `backend/app/services/ai_service.py`
- **Fix Applied:** Separated operational queries from mutating actions. Actions now require explicit confirmation and explicit valid `table_id`. Fallback handler validates parameters before dispatching orders.
- **Verification:** Verified `test_chotu_ai_actions.py` and `test_chotu_ai_comprehensive.py`. Conversational queries never trigger order creation.

### DEF-004: Missing Category Name Display (Raw Hex IDs)
- **Module:** Menu & Pricing Management
- **Symptom:** Menu management table displayed raw hexadecimal UUID substrings (e.g. `E807dd`) under the "Category" column instead of "Starters", "Mains", "Desserts".
- **Root Cause:** Relational join was omitted in the serialization schema; `category_id` was mapped directly to the UI column without fetching the related `MenuCategory.name`.
- **Affected Files:** `backend/app/models/menu.py`, `backend/app/schemas/menu.py`, `src/lib/api/menu.ts`, `src/app/(dashboard)/menu/page.tsx`
- **Fix Applied:** Added `@property def category_name(self)` to `MenuItem` ORM model. Updated Pydantic schema with `category_name: Optional[str] = None`. Frontend updated to render `dish.category_name || dish.category`.
- **Verification:** Automated tests passed; menu page displays readable human titles.

### DEF-005: Absence of Menu Item Deletion Action
- **Module:** Menu & Pricing Management
- **Symptom:** Restaurant managers could create dishes, edit dishes, and mark them 86'd, but could not delete obsolete dishes from the catalog.
- **Root Cause:** The backend possessed `DELETE /api/v1/menu/items/{id}`, but the frontend table omitted the delete icon and confirmation dialog.
- **Affected Files:** `src/app/(dashboard)/menu/page.tsx`, `src/lib/api/menu.ts`
- **Fix Applied:** Implemented delete button with trash icon and two-step modal confirmation. Calls `deleteMenuItem()` which triggers soft delete (`is_active = false`), removing it from POS and customer QR menus.
- **Verification:** Verified dish deletion removes item from table and triggers success toast.

---

## 2. HIGH SEVERITY DEFECTS

### DEF-006: Hardcoded Placeholder Metrics in Daily Pulse
- **Module:** Analytics & Executive Cockpit
- **Symptom:** Daily Pulse displayed static numbers (e.g., "₹45,200", "84 Orders") regardless of actual orders placed in the restaurant.
- **Root Cause:** Frontend components had hardcoded fallback mock arrays when real-time feeds returned empty sets.
- **Affected Files:** `src/app/(dashboard)/page.tsx`, `backend/app/api/v1/analytics.py`
- **Fix Applied:** Replaced mock state with live SQL aggregation queries computing today's gross revenue, completed orders, and average ticket size.
- **Verification:** Verified live metrics reflect actual database transactions for the authenticated tenant.

### DEF-007: Ineffective Suggest Actions in Daily Pulse
- **Module:** Executive Cockpit / Daily Pulse
- **Symptom:** Suggest action buttons ("Promote slow-moving item", "Review labor cost") were purely decorative and triggered no action.
- **Root Cause:** Buttons had no `onClick` handlers or router navigation bindings.
- **Affected Files:** `src/app/(dashboard)/page.tsx`
- **Fix Applied:** Bound action buttons to active navigation routes (e.g., navigating to `/marketing` with pre-filled discount coupon for slow-moving items).
- **Verification:** Verified clicking action buttons navigates to functional submodules.

### DEF-008: Guest Name Ignored in Live Orders Hub
- **Module:** Live Orders Hub
- **Symptom:** When a customer entered their name on the QR ordering page, the Live Orders Hub continued to display "Guest".
- **Root Cause:** Order submission payload passed `customer_name`, but the order creation service defaulted to "Guest" unless an existing `customer_id` was supplied.
- **Affected Files:** `backend/app/api/v1/qr.py`, `backend/app/services/order_service.py`, `src/app/(dashboard)/orders/page.tsx`
- **Fix Applied:** Backend captures `customer_name` from QR order payload and stores it on `Order.notes` or creates an auto-linked temporary customer record.
- **Verification:** Verified customer names entered during QR ordering display accurately in Live Orders Hub.

### DEF-009: Inability to Connect Raw Materials to Dishes (Recipe BOM)
- **Module:** Inventory & Recipe BOM
- **Symptom:** Ordering dishes in POS did not deduct linked raw materials; restaurant owners could not track food costs or recipe consumption.
- **Root Cause:** Recipe Bill of Materials (BOM) linking table existed in database schema but was disconnected from KOT order completion logic.
- **Affected Files:** `backend/app/services/order_service.py`, `backend/app/api/v1/inventory.py`, `src/app/(dashboard)/inventory/page.tsx`
- **Fix Applied:** Added automatic recipe BOM lookup during KOT dispatch. When an order item is sent to the kitchen, linked ingredients are automatically decremented via `StockTransaction(type="CONSUMPTION")`.
- **Verification:** Verified ordering 1 "Butter Chicken" automatically deducts linked butter and chicken stock in DB.

### DEF-010: Z-Report Pre-Generated Placeholder Display
- **Module:** Billing & Reports
- **Symptom:** Z-Report screen displayed identical pre-generated financial numbers regardless of restaurant or date selected.
- **Root Cause:** Frontend had hardcoded sample Z-Report JSON embedded in component state.
- **Affected Files:** `src/app/(dashboard)/reports/page.tsx`, `backend/app/api/v1/analytics.py`
- **Fix Applied:** Implemented `GET /api/v1/analytics/z-report?date=YYYY-MM-DD` which queries actual daily orders, payment tenders (Cash, UPI, Card), expenses, and opening float.
- **Verification:** Verified Z-Report renders exact mathematical reconciliation of database transactions.

### DEF-011: Missing Opening Cash Float Input in Petty Cash Register
- **Module:** Petty Cash & Expense Register
- **Symptom:** Cashier could not enter the opening cash drawer balance at the beginning of a shift.
- **Root Cause:** No UI input existed for setting opening float; opening balance was hardcoded to ₹5,000.00.
- **Affected Files:** `src/app/(dashboard)/expenses/page.tsx`, `backend/app/api/v1/expenses.py`
- **Fix Applied:** Added "Set Opening Float" modal and `POST /api/v1/expenses/opening-float` endpoint to persist daily drawer opening balances.
- **Verification:** User can set custom opening cash float and see it reflected in drawer reconciliation.

### DEF-012: Unticked Items Uneditable on KDS Page Refresh
- **Module:** Kitchen Display System (KDS)
- **Symptom:** Once an item was marked as ready in KDS, refreshing the page locked the item, preventing chefs from reverting erroneous clicks.
- **Root Cause:** Item status update endpoint only permitted forward transitions (`pending` → `ready`).
- **Affected Files:** `backend/app/api/v1/kot.py`, `src/app/(dashboard)/kds/page.tsx`
- **Fix Applied:** Updated KDS status endpoint to allow toggling between `ready` and `preparing`/`pending` with audit timestamp.
- **Verification:** Chefs can untick accidentally marked items; state persists correctly across page refreshes.

### DEF-013: QR Water and Waiter Assistance Not Visible in Restaurant Dashboard
- **Module:** Customer QR Ordering / POS
- **Symptom:** Customers clicking "Call Waiter" or "Water Service" received a success toast on mobile, but restaurant staff saw no notification.
- **Root Cause:** QR assistance requests were logged in DB but omitted from real-time WebSocket broadcast to POS and Live Orders Hub.
- **Affected Files:** `backend/app/api/v1/qr.py`, `src/app/(dashboard)/pos/page.tsx`, `src/app/(dashboard)/orders/page.tsx`
- **Fix Applied:** Connected `POST /api/v1/qr/assistance` to WebSocket manager. Alert banners with audible chime appear at the top of POS and Orders Hub showing table number and service type.
- **Verification:** Tested assistance calls from table 2; notification banner appeared immediately on POS screen.

---

## 3. MEDIUM & LOW DEFECTS (SUMMARY)

| Defect ID | Module | Description | Fix Summary | Status |
|---|---|---|---|:---:|
| **DEF-014** | Menu | Inability to select dishes for Chef's Pick | Added `is_chef_pick` boolean toggle on dish edit modal | **PASS** |
| **DEF-015** | QR Menu | Updated restaurant GST rates not reflected on QR Menu | Dynamically injected restaurant GST settings into QR menu response | **PASS** |
| **DEF-016** | POS Menu | Changed GST rates showed old cached rates | Refreshed store context on GST rate update in settings | **PASS** |
| **DEF-017** | Billing | Thermal invoice printing clipping right margin | Added `@media print` CSS rules with `width: 80mm; overflow: hidden;` | **PASS** |
| **DEF-018** | Menu | "86'd" jargon displayed instead of "Out of Stock" | Updated badge to display "Out of Stock" with red pill indicator | **PASS** |
| **DEF-019** | QR Menu | Food ready status did not update to "Food Prepared" | Subscribed QR tracker to WebSocket order item state updates | **PASS** |
| **DEF-020** | Live Orders | Live Orders Hub filters did nothing for non-dine-in orders | Added filter predicates for Dine-in, Takeaway, and Delivery | **PASS** |
| **DEF-021** | Menu | Old placeholder dishes shown when catalog was empty | Added clean empty state graphic and "Add Your First Dish" CTA | **PASS** |
| **DEF-022** | Staff | Inability to manually assign captain/server to tables | Added server assignment dropdown in Table and Order details modal | **PASS** |
| **DEF-023** | Mobile UX | Layout offscreen horizontal overflow on phones (< 400px) | Added `overflow-x: hidden` and flexible responsive containers | **PASS** |
| **DEF-024** | Mobile UX | Sidebar took up excessive screen space on mobile | Converted sidebar to slide-out sheet drawer for screens < 768px | **PASS** |
| **DEF-025** | Marketing | Coupon validation case-sensitivity bug | Converted coupon code comparison to `.upper()` in backend validator | **PASS** |
