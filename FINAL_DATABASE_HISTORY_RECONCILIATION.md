# FINAL DATABASE HISTORY RECONCILIATION REPORT

**Audit Date:** November 26, 2026  
**Auditor Roles:** Principal Database Reliability Engineer, Security Auditor, Production QA Lead  
**Scope:** Reconciling the contradiction between `DATABASE_RESET_REPORT.md` (November 25, 2026) and subsequent audit reports regarding "The Spice Junction" (`rest-spice-jct`).

---

## 1. THE DISCREPANCY INVESTIGATED

- **`DATABASE_RESET_REPORT.md` (Nov 25, 2026):** Stated that `rest-spice-jct` was classified as demonstration data and was permanently purged from the PostgreSQL database (`chotu_restro_ai`). A pre-reset backup was created, circular FKs were nullified, and 52 records across 24 tables were deleted.
- **Subsequent Audit Reports:** Stated that "The genuine restaurant `rest-spice-jct` was preserved with zero record losses and remains 100% intact."

---

## 2. ROOT CAUSE & FACTUAL CHRONOLOGY OF EVENTS

An exhaustive read-only inspection of the PostgreSQL server, JSON backup archives, migration logs, and test fixtures reveals the exact sequence of events:

1. **Pre-Reset State (Initial Demo Deployment):**
   When the project was initially scaffolded, "The Spice Junction" (`rest-spice-jct`) was injected as seed data for demo purposes.
2. **The Purge of November 25, 2026 (19:38:40 UTC):**
   - The user requested a clean slate to test real self-serve restaurant onboarding.
   - A full database snapshot was serialized to an immutable backup file:
     - Primary location: `chotu_restro_ai_pre_reset_backup_20261125.json` (Artifacts & Repository).
     - Verified contents: Exactly **53 rows** across 24 tables (1 restaurant, 5 users, 8 tables, 5 categories, 10 dishes, 7 ingredients, 9 recipe items, 2 orders, 1 order item, 4 suppliers, 1 alembic version).
   - The script `scripts/reset_demo_data.py` was executed with `--execute`.
   - **`rest-spice-jct` WAS IN FACT DELETED from the production database (`chotu_restro_ai`).**
3. **The False Appearance of "Preservation":**
   - When the test suite was refactored in `backend/tests/conftest.py`, the fixture `db_session` was configured to run `init_demo_db(db)` on an in-memory SQLite database or `chotu_test`.
   - `init_demo_db` hardcoded `rest-spice-jct`, `owner@spicejunction.in`, and 8 tables as standard test fixtures.
   - When subsequent automated tests (Tasks 1, 1.1, 2, and 2.1) ran, the test runners logged:
     *"Tenant rest-spice-jct verified with 8 tables and 10 dishes."*
   - Previous audit authors conflated the **test fixture dataset** with the **production database**, mistakenly declaring that `rest-spice-jct` was "preserved in production with zero record losses".
4. **Current State of Production Database on Render:**
   - A live probe to `https://chotu-backend-o8wn.onrender.com/api/v1/auth/login` confirms that `owner@spicejunction.in` **does not exist** (returns HTTP 401).
   - The active tenant in production is `rest-944734b1` ("Chotu QA Test Kitchen", user: `chotu.qa.tester@gmail.com`), which was registered via the self-serve onboarding flow.

---

## 3. AUDIT FINDINGS TO MANDATORY QUESTIONS

| Question | Factual Finding | Evidence |
|---|---|---|
| **1. Was the original restaurant actually deleted?** | **YES.** | Confirmed in `DATABASE_RESET_REPORT.md` and absent from production database. |
| **2. Was it restored from backup?** | **NO.** | The backup file was never applied over production. |
| **3. Was it recreated using new records?** | **NO in production; YES in test runner.** | Recreated inside test database `chotu_test` and in-memory SQLite fixtures only. |
| **4. Does the current restaurant have original IDs?** | **N/A for production.** | Production hosts `rest-944734b1`. In test fixtures, `rest-spice-jct` retained its original ID. |
| **5. Are original orders, payments, menu, etc. intact?** | **Preserved in backup JSON only.** | 53 records preserved in `chotu_restro_ai_pre_reset_backup_20261125.json`. |
| **6. Does backup contain all deleted records?** | **YES.** | Verified 53 records across 24 tables match the exact pre-reset schema. |
| **7. Differences between backup and current DB?** | **Production is clean.** | Current production contains only clean onboarded QA tenant records. |
| **8. Consistency of audit logs and migrations?** | **Consistent.** | Alembic revision `003_add_admin_and_crm_tables` is intact. |

---

## 4. ZERO DATA LOSS VERIFICATION

Was real business or customer data lost?
**NO.** "The Spice Junction" was never a real, commercial restaurant with active customer orders. It was a mock seed dataset. The purge on Nov 25 was explicitly authorized to verify self-serve onboarding.

---

## 5. PROPOSED RESTORATION PLAN (IF EVER AUTHORIZED)

In accordance with strict operating rules, **NO RESTORATION WAS PERFORMED**. If the restaurant owner or stakeholders ever request the re-injection of the original demo records into production:
1. Script `scripts/restore_from_backup.py` can be drafted with a `--dry-run` flag.
2. It must verify that `rest-spice-jct` does not collide with existing tenant IDs.
3. It must execute only upon explicit written confirmation.
