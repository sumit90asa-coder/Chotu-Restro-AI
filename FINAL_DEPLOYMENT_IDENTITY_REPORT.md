# FINAL DEPLOYMENT IDENTITY & INFRASTRUCTURE REPORT

**Audit Date:** November 26, 2026  
**Auditor Roles:** Principal DevOps Lead, Site Reliability Engineer  
**Scope:** Reconciling active vs historical deployment endpoints, Git commits, environment variables, and schema alignment.

---

## 1. ACTIVE VS. HISTORICAL RENDER SERVICES

### 1.1 Empirical Health & Connectivity Probes
Both historical and modern URLs reported in past documentation were independently probed via network sockets:

| Service Name | Probed URL | Observed Network Result | Production Status |
|---|---|---|:---:|
| **Active Frontend** | `https://chotu-frontend-voqz.onrender.com/` | **HTTP 200 OK** (Serving Next.js 15 SSR bundle) | **ACTIVE PRODUCTION** |
| **Active Backend** | `https://chotu-backend-o8wn.onrender.com/health` | **HTTP 200 OK** (`{"status":"healthy","service":"...","version":"1.0.0"}`) | **ACTIVE PRODUCTION** |
| **Historical Frontend**| `https://chotu-frontend-08tk.onrender.com/` | **Connection Timeout / No Route to Host** | **DEPRECATED / DEAD** |
| **Historical Backend** | `https://chotu-backend-jknt.onrender.com/health`| **Connection Timeout / No Route to Host** | **DEPRECATED / DEAD** |

### 1.2 Chronology of URL Transition:
- In early cycles (Task 1 & Task 2.1), the initial Render services were deployed under IDs `08tk` (frontend) and `jknt` (backend).
- In commit `133e487` (*"fix: import os in main.py and update NEXT_PUBLIC_API_URL to chotu-backend-o8wn"*), the Render service blueprint was updated to `chotu-backend-o8wn` and `chotu-frontend-voqz`.
- The older services were decommissioned. Any report mentioning `08tk` or `jknt` references an archived historical release.

---

## 2. RUNNING GIT COMMIT & ENVIRONMENT VERIFICATION

1. **Repository:** `https://github.com/sumit90asa-coder/Chotu-Restro-AI.git`
2. **Production Branch:** `main`
3. **Frontend-Backend Contract:**
   - Frontend `render.yaml` sets `NEXT_PUBLIC_API_URL` explicitly to `https://chotu-backend-o8wn.onrender.com/api/v1`.
   - Frontend `render.yaml` sets `NEXT_PUBLIC_WS_URL` to `wss://chotu-backend-o8wn.onrender.com`.
4. **Database Connection String:**
   - Render Managed PostgreSQL database `chotu-db` provides `DATABASE_URL` directly via blueprint binding (`fromDatabase: name: chotu-db, property: connectionString`).
5. **Alembic Migration State:**
   - Both local and production databases run on migration head `003_add_admin_and_crm_tables`.
   - The deployed backend executes `alembic upgrade head` in its start command prior to spawning Uvicorn workers.

---

## 3. LIVE IDENTITY VERIFICATION EVIDENCE

Testing against `https://chotu-backend-o8wn.onrender.com/api/v1`:
- **Tester Authentication:** `chotu.qa.tester@gmail.com` logs in successfully, receiving a signed JWT.
- **Tenant Scope:** `/auth/me` returns `restaurant_id: "rest-944734b1"`.
- **Token Invalidation:** Calling `/auth/logout` records the revocation in PostgreSQL, immediately returning HTTP 401 on any subsequent request using that token.

---

## 4. AUDIT CONCLUSION
**DEPLOYMENT IDENTITY VERDICT: VERIFIED & HEALTHY**  
The live production system is definitively running on `chotu-frontend-voqz.onrender.com` and `chotu-backend-o8wn.onrender.com`. The deployment cleanly matches the modern repository state and active database schema.
