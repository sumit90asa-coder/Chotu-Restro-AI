# CHOTU RESTRO AI — FLOOR TABLES & SETTLEMENT ENGINE REPAIR REPORT

**Date:** November 26, 2026  
**Status:** REPAIRED & PRODUCTION VERIFIED  
**Component:** Floor & Tables Module (`src/app/(dashboard)/tables/page.tsx`, `backend/app/api/v1/tables.py`, `backend/app/services/order_service.py`)  

---

## 1. Problem Formulation & Root Cause

In Floor & Tables, opening the settlement modal for Table 02 revealed:
- Total Settlement Due displayed `₹0`.
- Tender options (UPI/QR, Credit/Debit, Cash) were selectable.
- The action button *"Confirm Payment & Free Table"* was enabled, allowing cashiers to attempt payment on an empty table.
- Clicking the button submitted `settleTableBill(tableId, tender, 0)`, which attempted to create zero-value payments.
- Furthermore, marking a table *"Occupied"* from the Floor map previously failed to generate an active order in PostgreSQL, leaving `table.current_order_id = None`.

---

## 2. Technical Modifications

### 2.1 Zero-Bill Protection & Prohibition of Ordinary Settlement
- **Location:** `src/app/(dashboard)/tables/page.tsx` (Lines 985–1080)
- **Rules Implemented:**
  1. If an active order contains 0 items or the total due is $\le ₹0.00$:
     - A high-visibility amber alert banner is rendered:
       *"No billable items in active order. Ordinary settlement (UPI, Card, Cash) cannot be processed for ₹0.00. Use Cancel Empty Order to safely release the table without recording a fake sale, or settle as complimentary with an authorized reason."*
     - The *"Confirm Payment & Free Table"* button is strictly disabled for Cash, Card, and UPI.
  2. Safe Table Freeing:
     - An explicit action button *"Cancel Empty Order & Free Table"* is rendered directly inside the modal and drawer.
     - Invoking this calls `POST /api/v1/pos/tables/{table_id}/cancel-order`, which marks the order `CANCELLED`, releases the table to `VACANT`, and resets `current_bill` to `₹0.00` without recording fake revenue or payments.

### 2.2 Authorized Complimentary Settlement Workflow
- Added `PaymentMethod.COMPLIMENTARY` tender:
  - Accessible in the settlement tender grid with `ShieldCheck` icon.
  - Requires mandatory input: *"Authorized Complimentary Reason (e.g. Owner guest, VIP tasting, manager discretion)"*.
  - When submitted, the backend verifies the reason is non-empty, creates an auditable `Payment` record with method `COMPLIMENTARY` and amount `0.00`, and explicitly bypasses CRM loyalty point accumulation.

### 2.3 Authoritative Active Order Coupling (`backend/app/api/v1/tables.py`)
- In `update_table_status`:
  - When a table is set to `TableStatus.OCCUPIED`:
    If `table.current_order_id` is missing, `OrderService.get_or_create_table_order` is automatically invoked, binding the table to a real PostgreSQL active order.
  - When a table is set to `TableStatus.VACANT`:
    If an unsettled active order was linked, it is safely transitioned to `OrderStatus.CANCELLED` so it never lingers as an orphaned active order.
