import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from alembic.config import Config
from alembic import script
from app.database.session import engine, Base
import psycopg

alembic_cfg = Config("backend/alembic.ini")
alembic_cfg.set_main_option("script_location", os.path.abspath("backend/alembic"))
script_dir = script.ScriptDirectory.from_config(alembic_cfg)

print("=" * 70)
print("ALEMBIC REVISION GRAPH & SCHEMA INTEGRITY AUDIT")
print("=" * 70)

print("\n--- REPOSITORY REVISION GRAPH ---")
heads = script_dir.get_heads()
print(f"Repository Head(s): {heads}")

revisions = list(script_dir.walk_revisions())
print(f"Total Revisions in Repository: {len(revisions)}")
for r in reversed(revisions):
    print(f"  Revision ID: {r.revision:<35} | Down Revision: {str(r.down_revision):<25} | Message: {r.doc}")

# Inspect live PostgreSQL alembic_version table
conn_str = "postgresql://postgres:postgres@localhost:5432/chotu_restro_ai"
try:
    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version_num FROM alembic_version")
            db_revs = [row[0] for row in cur.fetchall()]
            print(f"\nLive Database `alembic_version` in chotu_restro_ai: {db_revs}")
            
            # Compare db_revs with repo head
            for head in heads:
                if head in db_revs:
                    print(f"[MATCH] Database revision matches repository HEAD: {head}")
                else:
                    print(f"[NOTE] Database revision {db_revs} vs Head {head}")

            # Verify schema tables
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            db_tables = set(r[0] for r in cur.fetchall())
            model_tables = set(Base.metadata.tables.keys())

            print(f"\nDatabase Tables Count: {len(db_tables)}")
            print(f"SQLAlchemy Models Table Count: {len(model_tables)}")

            missing_in_db = model_tables - db_tables
            extra_in_db = db_tables - model_tables

            print(f"Missing in DB: {missing_in_db if missing_in_db else 'NONE (100% matched)'}")
            print(f"Extra in DB (e.g. alembic_version): {extra_in_db}")

            # Verify specific critical tables and columns
            critical_checks = [
                ("revoked_tokens", ["jti", "token_type", "user_id", "expires_at", "revoked_at"]),
                ("coupons", ["id", "restaurant_id", "code", "discount_type", "discount_value", "is_active"]),
                ("dining_tables", ["id", "restaurant_id", "label", "floor_name", "status"]),
                ("orders", ["id", "delivery_otp_attempts", "payment_status", "status"])
            ]

            print("\n--- CRITICAL COLUMN VERIFICATION ---")
            for tbl, cols in critical_checks:
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = %s
                """, (tbl,))
                actual_cols = set(r[0] for r in cur.fetchall())
                for col in cols:
                    if col in actual_cols:
                        print(f"  [OK] {tbl}.{col} present")
                    else:
                        print(f"  [MISSING] {tbl}.{col} NOT FOUND!")

except Exception as e:
    print(f"ERROR: {e}")
