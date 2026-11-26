# CHOTU RESTRO AI — COMPREHENSIVE ENGINEERING CHANGELOG

All changes made across audit and repair phases (Tasks 1, 1.1, 2, 2.1, 2.2, 3.0, and the Master Audit) organized by module and commit.

---

## 1. MENU & CATALOG MANAGEMENT

### Commit `2d66cfc` — feat(menu): add dish deletion button with confirmation modal and fix category name display
- **Added:** Interactive dish deletion button (Trash icon) in `src/app/(dashboard)/menu/page.tsx` with two-step confirmation modal and optimistic UI updates.
- **Added:** `deleteMenuItem` in `src/lib/api/menu.ts` calling `DELETE /api/v1/menu/items/{id}` for soft deactivation (`is_active = false`).
- **Fixed:** Category column displaying raw hexadecimal UUIDs (e.g., `E807dd`). Added `@property def category_name(self)` in `backend/app/models/menu.py` and `category_name: Optional[str] = None` in `backend/app/schemas/menu.py`.
- **Added:** Automated pytest suite in `backend/tests/test_menu_crud.py` verifying full dish creation, update, category resolution, and soft deletion.

---

## 2. CHOTU AI COPILOT & OPERATIONAL INTELLIGENCE

### Commit `84769ff` & Phase 4.N — feat(ai): upgrade Chotu AI with 10 database-grounded operational queries
- **Added:** 10 deterministic SQL query builders in `backend/app/services/ai_service.py` querying PostgreSQL directly for:
  1. Today's gross sales & completed order count (`QUERY_SALES`)
  2. Top 5 selling dishes in the past 7 days (`QUERY_TOP_DISHES`)
  3. Low stock raw ingredients vs minimum threshold (`QUERY_INVENTORY`)
  4. Active pending and in-kitchen orders (`QUERY_PENDING_ORDERS`)
  5. Currently occupied tables (`QUERY_TABLES`)
  6. Cancelled orders today & lost revenue (`QUERY_CANCELLED_ORDERS`)
  7. Yesterday's sales & ticket count (`QUERY_SALES_YESTERDAY`)
  8. Top frequent customers by order frequency (`QUERY_TOP_CUSTOMERS`)
  9. Currently unavailable or 86'd dishes (`QUERY_UNAVAILABLE_DISHES`)
  10. Total outstanding unpaid payments (`QUERY_OUTSTANDING_PAYMENTS`)
- **Fixed:** Chotu AI randomly firing KOT orders to arbitrary tables. Enforced strict table confirmation guard before any mutating order action can be dispatched.
- **Added:** `backend/tests/test_chotu_ai_comprehensive.py` verifying all 10 operational queries pass against live PostgreSQL records.

---

## 3. AUTHENTICATION & SESSION SECURITY

### Commit `84769ff` — feat(auth): persistent database-backed token revocation
- **Added:** `revoked_tokens` table in PostgreSQL with Alembic migration.
- **Updated:** `backend/app/core/security.py` to persist revoked JWTs with JTI, SHA-256 token hash, user ID, and expiration date.
- **Updated:** `get_current_user()` dependency in `backend/app/api/deps.py` to reject revoked tokens immediately across server restarts and horizontally scaled workers.
- **Added:** Cross-tab logout synchronization in `src/lib/auth.ts` using `BroadcastChannel('chotu_auth_channel')`.
- **Added:** Multi-worker revocation test suite in `backend/tests/test_persistent_revocation.py`.

---

## 4. INVENTORY & RECIPE BILL OF MATERIALS (BOM)

### Commit `84769ff` — feat(inventory): non-negative intake validation and automatic recipe consumption
- **Fixed:** Vulnerability allowing negative numbers in stock intake. Added Pydantic `Field(..., gt=0)` validation in `backend/app/schemas/inventory.py` and `min="0.01"` HTML attribute in `src/app/(dashboard)/inventory/page.tsx`.
- **Added:** Automatic recipe BOM deduction in `backend/app/services/order_service.py`. When a KOT is fired, linked ingredients are automatically decremented via `StockTransaction(type="CONSUMPTION")`.
- **Added:** Minimum stock alerts highlighting low-stock raw materials on the inventory overview dashboard.

---

## 5. POINT OF SALE (POS) & BILLING

### Commit `84769ff` & Earlier Cycles — feat(pos): thermal print layout and dynamic GST rates
- **Fixed:** Invoice printing clipping right margin on thermal printers. Added `@media print` CSS rules in `src/app/(dashboard)/orders/page.tsx` formatted specifically for 80mm and 58mm roll widths.
- **Fixed:** POS terminal displaying stale GST rates after restaurant settings were modified. Ensured POS context refetches restaurant tax rates on load.
- **Fixed:** Decimal calculation precision across all billing endpoints using Python `decimal.Decimal` and PostgreSQL `Numeric(10,2)`.

---

## 6. KITCHEN DISPLAY SYSTEM (KDS) & QR SELF-ORDERING

### Commit `84769ff` — feat(kds): untick ready items and live QR status sync
- **Fixed:** KDS page lock preventing chefs from unticking items after page refresh. Updated `PATCH /api/v1/kot/items/{id}/status` to allow toggling between `ready` and `preparing`.
- **Fixed:** QR self-ordering page failing to update status to "Food Prepared". Subscribed customer tracker to live WebSocket order item transitions.
- **Added:** Waiter assistance and water calling alerts broadcasting real-time banner notifications to the POS cashier screen.

---

## 7. FINANCIAL ACCOUNTING & Z-REPORTS

### Commit `84769ff` — feat(reports): real-time Z-Report calculation and opening float input
- **Fixed:** Z-Report displaying pre-generated placeholder numbers. Implemented `GET /api/v1/analytics/z-report` aggregating actual daily transactions, cash float, disbursements, and net cash.
- **Added:** Opening cash float modal in `src/app/(dashboard)/expenses/page.tsx` allowing cashiers to set custom daily starting cash drawer balances.

---

## 8. MOBILE RESPONSIVENESS & UI REFINEMENT

### Commit `84769ff` — fix(ui): mobile horizontal overflow and collapsible navigation drawer
- **Fixed:** Elements overflowing offscreen on mobile viewports (< 400px). Added `overflow-x: hidden` and responsive grid layouts.
- **Fixed:** Desktop sidebar dominating screen space on mobile devices. Replaced with collapsible slide-out sheet drawer.
