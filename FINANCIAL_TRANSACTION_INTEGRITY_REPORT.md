# CHOTU RESTRO AI — FINANCIAL TRANSACTION INTEGRITY REPORT

**Date:** November 26, 2026  
**Author:** Principal Financial Transaction Engineer & Senior Database Reliability Engineer  
**Component:** POS Terminal, Floor Settlement, Billing Engine, CRM Loyalty, Payment Accounting  
**Status:** FULLY HARDENED & VERIFIED

---

## 1. Architectural Overview & Design Principles

Financial transactions in restaurant point-of-sale environments demand strict consistency, idempotency, and audit compliance. The Chotu Restro AI financial transaction layer enforces four fundamental pillars:

1. **Pessimistic Concurrency Control:** Prevention of double-settlement and race conditions via database row-level locking (`SELECT ... FOR UPDATE`).
2. **Deterministic Monetary Mathematics:** Absolute rejection of IEEE 754 floating-point types (`float`); exclusive use of Python's `Decimal` with symmetric half-up rounding (`ROUND_HALF_UP`) to two decimal places.
3. **Strict Domain Validation:** Defense against negative prices, non-finite values (`NaN`, `Infinity`), zero/negative quantities, and unauthenticated discounts.
4. **Zero-Bill & Complimentary Accounting Integrity:** Rigorous distinction between empty orders (cancelled without financial records), paid transactions (tendered via Cash, UPI, Card, NetBanking), and genuine zero-value orders (settled as `COMPLIMENTARY` with mandatory audit justification, awarding zero loyalty points).

---

## 2. Concurrency Control & Row-Level Locking

### 2.1 The Race Condition Threat
In a multi-terminal or distributed restaurant setup, two cashiers or automated clients might submit settlement requests for the same table at the exact same millisecond (or a cashier might double-click the settlement button during network latency).

Without proper transaction isolation, two separate `Payment` records could be inserted into the ledger for a single bill, the restaurant's total revenue would be artificially inflated, and duplicate loyalty points would be credited to the customer.

### 2.2 Implementation in `OrderService.settle_bill`
To completely eliminate race conditions, settlement requests execute inside an atomic PostgreSQL transaction with pessimistic row-level locking:

```python
# Lock the order record immediately upon entry
order = (
    db.query(Order)
    .filter(Order.id == order_id)
    .with_for_update()
    .first()
)

# Enforce immediate idempotency check
if order.payment_status == PaymentStatus.PAID or order.status == OrderStatus.COMPLETED:
    raise ValueError("Order has already been settled and paid.")

# Lock the associated dining table
if order.table_id:
    table = (
        db.query(DiningTable)
        .filter(DiningTable.id == order.table_id)
        .with_for_update()
        .first()
    )
```

### 2.3 API Contract: HTTP 409 Conflict
When a duplicate settlement attempt arrives at `POST /api/v1/pos/tables/{table_id}/settle`, the API layer traps the `ValueError` and returns an explicit `HTTP 409 CONFLICT`:

```python
try:
    settled_order = OrderService.settle_bill(...)
except ValueError as e:
    err_str = str(e)
    if "already been settled" in err_str.lower() or "already settled" in err_str.lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order has already been settled and paid."
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=err_str
    )
```

This guarantees that retried requests or simultaneous cashier submissions fail safely without double-charging or ledger corruption.

---

## 3. Mathematical Precision & Tax Calculation

### 3.1 Arithmetic Rules
All monetary calculations in `BillingService.calculate_totals()` adhere to the following formula:

$$\text{Subtotal} = \sum_{i=1}^{n} (\text{price}_i \times \text{quantity}_i)$$

$$\text{Taxable Amount} = \max(0, \text{Subtotal} - \text{Discount})$$

$$\text{CGST} = \text{round}\left(\text{Taxable Amount} \times \frac{\text{CGST}\%}{100}, 2\right)$$

$$\text{SGST} = \text{round}\left(\text{Taxable Amount} \times \frac{\text{SGST}\%}{100}, 2\right)$$

$$\text{Service Charge} = \text{round}\left(\text{Taxable Amount} \times \frac{\text{Service Charge}\%}{100}, 2\right)$$

$$\text{Grand Total} = \text{Taxable Amount} + \text{CGST} + \text{SGST} + \text{Service Charge}$$

### 3.2 Dynamic Restaurant Rate Resolution
Tax rates and service charges are not hardcoded. They are loaded dynamically from the owning `Restaurant` record:
- CGST default: 2.50% (5% GST split evenly).
- SGST default: 2.50%.
- Service Charge: configurable per restaurant (e.g. 5.00% or 0.00%).

All rounding utilizes `Decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`, preventing single-paisa rounding discrepancies across large volumes of orders.

---

## 4. Input Sanity & Data Validation

The billing engine validates all incoming payloads at both Pydantic schema boundary and service execution layer:

| Input Condition | Engine Behavior | Error Code / Exception |
|---|---|---|
| Null or empty price | Rejected immediately | `ValueError: Invalid price: None` |
| Non-numeric / NaN string | Rejected immediately | `ValueError: Invalid numerical value for price` |
| Infinite value (`inf`, `-inf`) | Rejected immediately | `ValueError: Price must be finite` |
| Negative price ($< 0.00$) | Rejected immediately | `ValueError: Price cannot be negative` |
| Quantity $\le 0$ | Rejected immediately | `ValueError: Quantity must be greater than zero` |
| Discount $>$ Subtotal | Clamped to Subtotal | Taxable amount set to ₹0.00 |

---

## 5. Zero-Bill & Complimentary Accounting Policy

### 5.1 The Empty Order Trap (Prevented)
A major vulnerability in previous builds was allowing an occupied table with 0 items (Subtotal ₹0.00) to proceed through ordinary checkout. Cashiers could click *"Confirm Payment & Free Table"*, creating zero-value `CASH` or `UPI` payments and inflating transaction counts.

**Remediation:**
1. Ordinary settlement tenders (`cash`, `upi`, `card`, `netbanking`) are strictly rejected on ₹0 bills:
   ```python
   if final_total <= Decimal("0.00") and method != PaymentMethod.COMPLIMENTARY:
       raise ValueError(
           "Cannot settle a zero-amount bill with regular payment tenders. "
           "Use complimentary settlement with an authorized reason, or cancel the order if empty."
       )
   ```
2. Safe Abandonment Workflow:
   A dedicated endpoint `POST /api/v1/pos/tables/{table_id}/cancel-order` allows staff to release accidental seatings without recording fake sales. The order transitions to `OrderStatus.CANCELLED`, the table transitions to `TableStatus.VACANT`, and the ledger is reset to ₹0.00.

### 5.2 Complimentary Settlement Rules
Legitimate 100% discounts (manager approval, VIPs, quality recovery) must be settled under `PaymentMethod.COMPLIMENTARY`:
- Requires `complimentary_reason` string (min length: 3 characters).
- Records a formal `Payment` entry with `amount = Decimal("0.00")` and `method = PaymentMethod.COMPLIMENTARY`.
- Generates a permanent audit log linking the approving user, order, and reason.

---

## 6. CRM Loyalty Points Idempotency & Protection

Loyalty points are awarded via `CRMService.award_points_for_order()` upon successful settlement:

1. **Eligibility Rules:**
   - Only orders with `payment_status == PAID` and `total_amount > 0` are eligible.
   - Complimentary orders (`PaymentMethod.COMPLIMENTARY`) are **ineligible** and award **0 points**.
   - Cancelled orders award **0 points**.
2. **Idempotency Guarantee:**
   Because settlement is protected by row-level locking and duplicate settlement requests are rejected, loyalty points can only be awarded **exactly once** per order lifecycle.
3. **Audit Trail:**
   Customer points balances are updated atomically within the same database transaction as the payment record creation.

---

## 7. Compliance & Audit Sign-Off

The financial transaction subsystem has been audited, stress-tested under concurrent threads, and validated against all edge cases. The subsystem meets banking-grade standards for restaurant POS financial data integrity.
