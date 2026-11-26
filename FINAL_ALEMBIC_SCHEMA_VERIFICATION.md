# FINAL ALEMBIC SCHEMA & MIGRATION GRAPH VERIFICATION

**Audit Date:** November 26, 2026  
**Auditor Roles:** Principal Database Reliability Engineer, Alembic Migration Lead  
**Scope:** Verification of Alembic migration history, revision graph, parent-child links, and current head alignment.

---

## 1. REVISION GRAPH RECONCILIATION

### The Inconsistency Clarified:
- **Prior Report Mentions:** Older reports referenced migration `003_add_admin_and_crm_tables` or stopped at `004_floor_and_table_management`.
- **Root Cause:**
  - The JSON backup archive from Nov 25 captured the database at revision `003` (`2026_11_24_003_phase4_admin_and_operations.py`).
  - Subsequently on Nov 25, migration `004_floor_and_table_management` was created to support custom floor plans and table coordinates.
  - On Nov 26, migration `005_persistent_revocation_and_coupons` was created to support PostgreSQL token blacklisting (`revoked_tokens`) and promotional marketing coupons (`coupons`).

---

## 2. COMPLETE LINEAR REVISION GRAPH (DIRECTED ACYCLIC GRAPH)

Inspection of `backend/alembic/versions/` confirms a strictly linear DAG with **zero branches**, **zero merge points**, and **zero orphan revisions**:

```
[001_initial_schema] (Base)
         |
         v
[002_audit_and_ai] (Revises: 001)
         |
         v
[003_phase4_admin_and_operations] (Revises: 002)
         |
         v
[004_floor_and_table_management] (Revises: 003)
         |
         v
[005_persistent_revocation_and_coupons] (HEAD - Current Active)
```

---

## 3. MIGRATION REVISION DETAILS

| Revision ID | Parent Revision | Created Date | Migration Purpose & Schema Objects |
|---|---|:---:|---|
| `001_initial_schema` | `<base>` | 2026-11-22 | Core PostgreSQL schema: `restaurants`, `users`, `dining_tables`, `menu_categories`, `menu_items`, `orders`, `order_items`, `kots`, `kot_items`, `ingredients`, `recipe_items`, `payments`. |
| `002_audit_and_ai` | `001_initial_schema` | 2026-11-23 | Added `audit_logs` and `ai_conversations` tables for operational audit trails. |
| `003_phase4_admin_and_operations` | `002_audit_and_ai` | 2026-11-24 | Added `customers`, `loyalty_transactions`, `suppliers`, `purchase_orders`, `purchase_order_items`, `expenses`, `cash_registers`, `notifications`, `menu_item_variants`, and delivery security columns. |
| `004_floor_and_table_management` | `003_phase4_admin_and_operations` | 2026-11-25 | Added `floor_name` column with default `'Main AC Hall'` to `dining_tables` and created `floors` layout tracking. |
| `005_persistent_revocation_and_coupons` | `004_floor_and_table_management` | 2026-11-26 | Added `revoked_tokens` table (JTI, token hash, expires_at) and `coupons` table (code, discount_type, min_order, max_discount, valid_until). |

---

## 4. DEPLOYMENT & PRODUCTION AUTOMATION

- **Render Startup Hook:** Verified in `render.yaml`:
  ```yaml
  startCommand: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  Every production deployment on Render automatically executes `alembic upgrade head`, guaranteeing that all 5 revisions are applied before the FastAPI application begins serving incoming requests.
- **Head Alignment:** `alembic heads` confirms the active repository head is `005_persistent_revocation_and_coupons`.
- **Database Drift:** Zero schema drift detected between SQLAlchemy ORM model declarations in `backend/app/models/` and the migration chain.

---

## 5. AUDIT CONCLUSION
**ALEMBIC SCHEMA VERDICT: 100% VERIFIED & HEALTHY**  
The migration graph is unified, strictly ordered, and automatically upgraded in production to revision `005`.
