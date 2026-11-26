# CHOTU RESTRO AI — UNIFIED POS & FLOOR TABLE ROOT CAUSE INVESTIGATION REPORT

**Date:** November 26, 2026  
**Investigator:** Principal Restaurant POS Architect & Senior Financial Transaction Engineer  
**Component:** POS Terminal (`/pos`), Floor & Tables (`/tables`), Order Lifecycle & Settlement Engine  
**Environment:** Production (`chotu-frontend-voqz.onrender.com` / `chotu-backend-o8wn.onrender.com`)  
**Target Restaurant Scope:** QA Restaurant `rest-944734b1` (Chotu QA Test Kitchen)  

---

## 1. Executive Summary & Problem Formulation

An investigation was conducted to resolve a critical operational contradiction observed across two primary restaurant screens:

- **Screen 1 (POS Terminal):** Table 02 displayed *"Active Order (6 Pax)"* with an empty active ledger (*"No dishes in active ledger"*, Subtotal: ₹0.00, Taxes: ₹0.00, Final Payable: ₹0.00). Dishes could be selected from the menu catalog, but the active ledger appeared completely empty.
- **Screen 2 (Floor & Tables):** Table 02 opened the settlement modal displaying *"Total Settlement Due: ₹0"*. Tender options (UPI/QR, Credit/Debit, Cash) were selectable, and the action button *"Confirm Payment & Free Table"* was enabled, allowing cashiers to attempt ordinary settlement on a zero-value, zero-item table.

Tracing the entire table and order lifecycle from PostgreSQL to Next.js revealed that these symptoms stemmed from **four interrelated architectural root causes** across frontend state management and backend transaction boundaries.

---

## 2. End-to-End Lifecycle Trace & Failure Points

```
[Floor & Tables: Status Updated to "OCCUPIED"]
                    │
                    ▼
          (Root Cause 1: PATCH /tables/{id}/status)
          • Table status marked "occupied"
          • BUT table.current_order_id was NOT created! (current_order_id = None)
                    │
                    ├───────────────────────────────────────────────────────┐
                    ▼                                                       ▼
      [Navigate to POS Terminal: /pos?table=T-02]            [Open Settle Modal on Floor]
                    │                                                       │
          (Root Cause 2: PosTerminal.tsx:367)                    (Root Cause 3: tables/page.tsx:996)
          • Hardcoded text: "Active Order"                       • Displayed ₹(currentBill || total || 0)
          • Hardcoded: "({capacity} Pax)" = (6 Pax)              • Evaluated to ₹0
          • Rendered: "Table 02 Active Order (6 Pax)"            • "Confirm Payment" button was ENABLED!
          • getTableOrder returned empty draft                   • Clicking called settleTableBill(₹0)
          • Ledger rendered: "No dishes in active ledger"                   │
                    │                                                       │
                    ▼                                                       ▼
          (Root Cause 4: Error Swallowing)                       (Root Cause 4: Backend Settle)
          • Cashier clicks Checkout on ₹0                        • OrderService.settle_bill had no item check
          • Settle API rejects 400                               • Allowed ₹0 payment records and fake loyalty!
          • catch block silently swallowed error!                • Or threw 409 unhandled
          • Generated fake local invoice!
```

---

## 3. Deep Root Cause Analysis

### Root Cause 1: Decoupled Table Occupancy and Active Order Creation
- **File:** `backend/app/api/v1/tables.py` (`update_table_status`)
- **Mechanism:** When a waiter or cashier clicked *"Occupied"* in the Status Change modal, `table.status` was updated to `TableStatus.OCCUPIED`. However, the handler failed to call `OrderService.get_or_create_table_order`.
- **Consequence:** `table.current_order_id` remained `None`. The table was flagged as occupied on the floor map, but had no authoritative PostgreSQL active order record. When opened in POS or Floor details, it returned an empty draft.

### Root Cause 2: Hardcoded "Active Order (Pax)" in POS UI Header
- **File:** `src/components/pos/PosTerminal.tsx` (Lines 365–369)
- **Mechanism:** The table selector pill in `PosTerminal.tsx` unconditionally rendered:
  ```tsx
  <span className="font-bold text-white">Active Order</span>
  <span className="text-stone-400 text-[11px]">({selectedTable.capacity} Pax)</span>
  ```
- **Consequence:** Regardless of whether the table was actually vacant or occupied, and regardless of whether any dishes were ordered, the UI always printed *"Active Order (6 Pax)"* by taking the table's architectural seating capacity (`capacity = 6`) and mislabeling it as live active guests.

### Root Cause 3: Zero-Bill Settlement Allowed Without Item Validation
- **Files:** `src/app/(dashboard)/tables/page.tsx`, `backend/app/services/order_service.py`
- **Mechanism:** The settlement modal in Floor & Tables used `(selectedTable.currentBill || activeOrder?.total || 0)`. When 0 items were present, this evaluated to `₹0`. The *"Confirm Payment & Free Table"* button remained enabled and selectable with standard tenders (UPI, Cash, Card).
- **Consequence:** Cashiers could trigger ordinary payment processing on ₹0 empty orders, risking the creation of fraudulent zero-value accounting entries, fake payment rows, and unearned CRM loyalty points.

### Root Cause 4: Frontend Error Swallowing on Settlement Failures
- **File:** `src/app/(dashboard)/pos/page.tsx` (`handleSettleBillConfirm`)
- **Mechanism:** In the POS terminal settlement handler, if `settleTableBill()` threw a backend rejection (e.g. HTTP 400 "Cannot settle an empty order"), the `catch` block merely logged a toast and the `finally` block proceeded to generate a local invoice (`setSettledInvoice`), open the print dialog (`setShowPrintModal(true)`), and wipe the ledger!
- **Consequence:** Cashiers were misled into believing a zero-dollar or rejected transaction had succeeded on the server.
