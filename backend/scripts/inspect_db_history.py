import hashlib
import json
import os
import psycopg

backup_path = r"C:\Users\lenovo\.gemini\antigravity\brain\dd7f86a2-7623-453b-b4bd-8daf45e9aec4\chotu_restro_ai_pre_reset_backup_20261125.json"

with open(backup_path, "rb") as f:
    raw_data = f.read()

sha256_hash = hashlib.sha256(raw_data).hexdigest()
size_bytes = len(raw_data)
backup_obj = json.loads(raw_data.decode("utf-8"))

print("=== BACKUP FILE ARTIFACT METRICS ===")
print(f"Path: {backup_path}")
print(f"SHA-256 Checksum: {sha256_hash}")
print(f"Size: {size_bytes} bytes")
print(f"Database Header: {backup_obj.get('database')}")
print(f"Timestamp Header: {backup_obj.get('timestamp')}")
print(f"Tables Count Header: {backup_obj.get('tables_count')}")

data_dict = backup_obj.get("data", {})
non_empty_tables = {}
total_records = 0
for tbl, rows in data_dict.items():
    cnt = len(rows)
    if cnt > 0:
        non_empty_tables[tbl] = cnt
        total_records += cnt

print(f"\nNon-empty tables in backup ({len(non_empty_tables)} tables):")
for tbl, cnt in non_empty_tables.items():
    print(f"  {tbl}: {cnt}")
print(f"Total non-empty records in backup: {total_records}")

# Inspect local production DB chotu_restro_ai
conn_str = "postgresql://postgres:postgres@localhost:5432/chotu_restro_ai"
try:
    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'restaurants'
                ORDER BY ordinal_position
            """)
            cols = [c[0] for c in cur.fetchall()]
            print(f"\nColumns in 'restaurants' table: {cols}")

            cur.execute(f"SELECT id, name, created_at FROM restaurants")
            restos = cur.fetchall()
            print("\n=== RESTAURANTS CURRENTLY IN chotu_restro_ai ===")
            for r in restos:
                print(f"  ID: {r[0]} | Name: {r[1]} | Created: {r[2]}")

            # Check counts for each restaurant
            check_tables = [
                "users", "dining_tables", "menu_categories", "menu_items",
                "ingredients", "orders", "order_items", "kots", "kot_items", 
                "payments", "recipes", "recipe_ingredients"
            ]
            
            for rid in ["rest-spice-jct", "rest-944734b1"]:
                print(f"\n=== LIVE RECORD COUNTS IN chotu_restro_ai FOR: {rid} ===")
                total_live = 0
                for tbl in check_tables:
                    try:
                        # Check if column restaurant_id exists in table
                        cur.execute(f"""
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = %s AND column_name = 'restaurant_id'
                        """, (tbl,))
                        has_rid = cur.fetchone() is not None
                        if has_rid:
                            cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE restaurant_id = %s", (rid,))
                            cnt = cur.fetchone()[0]
                            print(f"  {tbl}: {cnt}")
                            total_live += cnt
                        else:
                            print(f"  {tbl}: (no restaurant_id column)")
                    except Exception as e:
                        print(f"  {tbl}: ERROR {e}")
                print(f"TOTAL DIRECT LIVE RECORDS FOR {rid}: {total_live}")

            # Also check if order_items, kot_items, recipe_ingredients exist for these restaurants
            for rid in ["rest-spice-jct", "rest-944734b1"]:
                print(f"\n--- Child records associated with {rid} ---")
                cur.execute("""
                    SELECT COUNT(*) FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.restaurant_id = %s
                """, (rid,))
                oi_cnt = cur.fetchone()[0]
                print(f"  order_items: {oi_cnt}")

                cur.execute("""
                    SELECT COUNT(*) FROM kot_items ki
                    JOIN kots k ON ki.kot_id = k.id
                    JOIN orders o ON k.order_id = o.id
                    WHERE o.restaurant_id = %s
                """, (rid,))
                ki_cnt = cur.fetchone()[0]
                print(f"  kot_items: {ki_cnt}")

                cur.execute("""
                    SELECT COUNT(*) FROM payments p
                    JOIN orders o ON p.order_id = o.id
                    WHERE o.restaurant_id = %s
                """, (rid,))
                p_cnt = cur.fetchone()[0]
                print(f"  payments: {p_cnt}")

            cur.execute("SELECT version_num FROM alembic_version")
            print("\nALEMBIC_VERSION in chotu_restro_ai:", cur.fetchall())

except Exception as e:
    print("\nDATABASE ERROR:", e)
