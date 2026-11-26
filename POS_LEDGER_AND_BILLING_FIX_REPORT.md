# CHOTU RESTRO AI — POS LEDGER & FINANCIAL BILLING REPAIR REPORT

**Date:** November 26, 2026  
**Status:** REPAIRED & PRODUCTION VERIFIED  
**Component:** POS Terminal (`src/app/(dashboard)/pos/page.tsx`, `src/components/pos/PosTerminal.tsx`) & Billing Engine (`backend/app/services/billing_service.py`, `backend/app/services/order_service.py`)  

---

## 1. Problem Formulation & Root Cause

Previously, when cashiers navigated to `/pos?table=T-02`:
1. The table header unconditionally displayed:
   `Table 02 Active Order (6 Pax)`
   This occurred because `PosTerminal.tsx` hardcoded the string `"Active Order"` and interpolated the table's architectural seating capacity (`capacity = 6`) as `({selectedTable.capacity} Pax)`, even when the table was vacant and had zero guests seated.
2. In the billing ledger, it showed *"No dishes in active ledger"* with ₹0.00 across all totals.
3. Adding items did not synchronize the `activeOrder` metadata back into the POS terminal.
4. If an empty or invalid bill settlement was attempted, the frontend `catch` block silently swallowed the server rejection and fabricated a local invoice.

---

## 2. Technical Modifications

### 2.1 Authoritative Financial Calculation (`backend/app/services/billing_service.py`)
- Strict numerical validation for all line items:
  - Validates `price` and `quantity` as valid non-null decimals.
  - Rejects `NaN`, `infinity`, and negative values with explicit `ValueError`.
  - Rejects non-positive quantities (`quantity <= 0`).
- Dynamic tax & charge computation:
  - Fetches `cgst_percent`, `sgst_percent`, and `service_charge_percent` directly from the authenticated `Restaurant` model.
  - Subtotal = $\sum (\text{valid price} \times \text{valid quantity})$.
  - Taxes are calculated strictly on the discounted subtotal.
  - All currency calculations rounded with `ROUND_HALF_UP` to 2 decimal places ($0.01).

### 2.2 Table Order Persistence & Synchronization (`src/app/(dashboard)/pos/page.tsx`)
- Added `activeOrder` state tracking the authoritative backend order.
- In `syncTableOrder`:
  - Calls `getTableOrder(selectedTableId)`.
  - Sets `activeOrder(orderData.order)` and `ledgerItems(orderData.items)`.
- In `handleAddDish`, `handleChangeQty`, and `handleRemoveItem`:
  - Dispatches updates directly to `/api/v1/pos/tables/{table_id}/order/items`.
  - Replaces local state with the authoritative server order and item list.
  - Synchronizes `currentBill` and `status` in the table list state.
- In `handleSettleBillConfirm`:
  - Rejects settlement immediately if `ledgerItems.length === 0` or `grandTotal <= 0`.
  - Removed silent error swallowing: if the backend rejects settlement, the error message is displayed in a toast and no invoice or print modal is triggered.

### 2.3 POS Terminal UI Improvements (`src/components/pos/PosTerminal.tsx`)
- Dynamic Table Header Pill:
  - If a genuine active order exists (`order_number !== "DRAFT"`):
    Displays `Order #{activeOrder.order_number}` (emerald badge) with `({capacity} Pax • {items_count} Items)`.
  - If the table is marked occupied but has 0 items:
    Displays `Occupied (0 items)` (amber badge).
  - If the table is vacant:
    Displays `Vacant` (stone badge) with `({capacity} Pax)`.
- Disabled Checkout for Empty Orders:
  - "Checkout & Settle Payment" and "Fire KOT" are disabled when `ledgerItems.length === 0`.
- Safe Abandonment Workflow:
  - If a table is marked occupied but has 0 dishes in the ledger, an amber button *"Cancel Empty Order & Free Table"* is rendered, allowing cashiers to cancel the accidental order and free the table in PostgreSQL without recording a false sale.
