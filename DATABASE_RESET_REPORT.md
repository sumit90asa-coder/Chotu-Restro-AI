# DATABASE RESET & PURGE REPORT
**Project:** Chotu Restro AI  
**Target Database:** PostgreSQL 16 (`chotu_restro_ai`)  
**Target Demonstration Tenant:** "The Spice Junction" (`rest-spice-jct`) & Manager `user-mgr-01`  
**DBA & Security Execution Date:** November 25, 2026  
**Status:** BACKUP VERIFIED, RESET EXECUTED, ZERO REMAINING ARTIFACTS

---

## 1. PRE-RESET BACKUP CONFIRMATION

Prior to executing any irreversible DELETE commands, a full snapshot of the target database records was serialized to an immutable JSON backup file.

- **Primary Repository Backup:** `database/backups/chotu_restro_ai_backup_20261125_193840.json`
- **Secondary Artifact Storage:** `C:\Users\lenovo\.gemini\antigravity\brain\dd7f86a2-7623-453b-b4bd-8daf45e9aec4\chotu_restro_ai_pre_reset_backup_20261125.json`
- **Record Integrity:** 53 total records across 24 tables verified before purge.
- **Explicit User Authorization:** User explicitly approved the execution plan with command confirmation: `"yes approve"`.

---

## 2. MANIFEST OF PURGED DEMONSTRATION DATA

The complete record manifest purged during the reset is detailed below:

| Database Table | Purged Record Count | Description of Deleted Records |
| :--- | :---: | :--- |
| `restaurants` | 1 | `rest-spice-jct` ("The Spice Junction") |
| `users` | 5 | `user-own-01` (Owner), `user-mgr-01` (Manager), `user-csh-01` (Cashier), `user-chef-01` (Chef), `user-wtr-01` (Waiter) |
| `dining_tables` | 8 | Demo tables `T-01` through `T-08` |
| `menu_categories` | 5 | Categories: Mains, Breads, Starters, Desserts, Beverages |
| `menu_items` | 10 | Demo dishes: Butter Chicken, Paneer Tikka, Dal Makhani, Naan, Roti, Biryani, Frappe, etc. |
| `menu_item_variants` | 0 | No previous variants registered |
| `ingredients` | 7 | Demo raw stock: Chicken, Paneer, Urad Dal, Maida, Butter, Basmati Rice, Mawa |
| `recipe_items` | 3 | Demo bill of materials |
| `stock_transactions` | 0 | No transactions recorded |
| `orders` | 2 | Mock orders `ord-demo-01` and `ord-demo-02` |
| `order_items` | 4 | Mock line items |
| `kots` | 2 | Demo kitchen tickets `kot-demo-01` and `kot-demo-02` |
| `kot_items` | 4 | Demo station items |
| `payments` | 1 | Mock payment record |
| `customers` | 0 | No customer records |
| `loyalty_transactions` | 0 | No loyalty records |
| `delivery_orders` | 0 | No delivery orders |
| `suppliers` | 0 | No suppliers registered |
| `purchase_orders` | 0 | No PO records |
| `purchase_order_items`| 0 | No PO items |
| `expenses` | 0 | No expense records |
| `notifications` | 0 | No notifications |
| `ai_conversations` | 0 | No persistent logs |
| **TOTAL PURGED** | **52 Records** | **All demo tenant footprints eradicated** |

---

## 3. REFERENTIAL INTEGRITY HANDLING & CIRCULAR FK RESOLUTION

In PostgreSQL, a bidirectional foreign key relationship existed between `dining_tables` and `orders`:
- `dining_tables.current_order_id` references `orders.id` (FK constraint: `dining_tables_current_order_id_fkey`).
- `orders.table_id` references `dining_tables.id` (FK constraint: `orders_table_id_fkey`).

Attempting to delete `orders` or `dining_tables` directly resulted in constraint violations (`psycopg.errors.ForeignKeyViolation`).

### Resolution Algorithm Executed:
1. **Nullify Circular Links:** Set `dining_tables.current_order_id = NULL` for all tables belonging to `rest-spice-jct`.
2. **Delete Dependent Children:** Delete in strict topological dependency order:
   - `order_items` -> `orders`
   - `kot_items` -> `kots`
   - `payments` -> `orders`
   - `recipe_items` -> `menu_items`
   - `menu_items` -> `menu_categories`
   - `ingredients`
   - `dining_tables`
   - `users`
   - `restaurants`
3. **Atomic Commit:** Wrapped all deletions inside a single transactional block `BEGIN ... COMMIT` ensuring zero partial states.

---

## 4. PRESERVATION OF SCHEMA & ALEMBIC MIGRATION HISTORY

The reset intentionally preserved the entire database schema, table definitions, indexes, foreign keys, triggers, and Alembic version history:

- **Current Revision in `alembic_version`:** `003_add_admin_and_crm_tables`
- **Migration History Preserved:**
  1. `001_initial_schema` (Core restaurant, tables, menu, pos, kds, inventory)
  2. `002_add_qr_security_columns` (HMAC token security, rotation audit)
  3. `003_add_admin_and_crm_tables` (CRM, loyalty, delivery OTP, suppliers, notifications)
- **Zero Schema Drift:** Future database migrations will execute cleanly from revision `003`.

---

## 5. POST-RESET VERIFICATION MANIFEST

Post-reset inspection was executed via `scripts/inspect_reset_manifest.py`:

```
================================================================================
CHOTU RESTRO AI — POST-RESET DATABASE VERIFICATION
================================================================================
Target Restaurant ID: rest-spice-jct
Total Tables Inspected: 24

[restaurants]              Remaining Records: 0  (Verified Empty)
[users]                    Remaining Records: 0  (Verified Empty)
[dining_tables]            Remaining Records: 0  (Verified Empty)
[menu_categories]          Remaining Records: 0  (Verified Empty)
[menu_items]               Remaining Records: 0  (Verified Empty)
[ingredients]              Remaining Records: 0  (Verified Empty)
[orders]                   Remaining Records: 0  (Verified Empty)
[kots]                     Remaining Records: 0  (Verified Empty)
[alembic_version]          Current Revision:  003_add_admin_and_crm_tables

STATUS: ZERO OLD DEMO DATA REMAINING. DATABASE IS 100% READY FOR FRESH RESTAURANT ONBOARDING.
================================================================================
```

---

## 6. SCRIPT REFERENCE

The automated script used to perform the reset is preserved at:
- `scripts/reset_demo_data.py` (Transactional purge script with `--dry-run` and `--execute` modes)
- `scripts/inspect_reset_manifest.py` (Database inspection and verification utility)
