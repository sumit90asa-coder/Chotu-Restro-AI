import sys
from sqlalchemy import create_engine, text

def get_manifest(db_url="postgresql+psycopg://postgres:postgres@localhost:5432/chotu_restro_ai"):
    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Check restaurant exists
        rest = conn.execute(text("SELECT id, name, code FROM restaurants WHERE id = 'rest-spice-jct'")).fetchone()
        if not rest:
            print("No restaurant 'rest-spice-jct' found in database.")
            return

        print(f"Target Restaurant Found: ID={rest[0]}, Name='{rest[1]}', Code='{rest[2]}'")
        
        tables = [
            ('order_items', "SELECT COUNT(*) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.restaurant_id = 'rest-spice-jct'"),
            ('kot_items', "SELECT COUNT(*) FROM kot_items ki JOIN kots k ON ki.kot_id = k.id WHERE k.restaurant_id = 'rest-spice-jct'"),
            ('kots', "SELECT COUNT(*) FROM kots WHERE restaurant_id = 'rest-spice-jct'"),
            ('payments', "SELECT COUNT(*) FROM payments p JOIN orders o ON p.order_id = o.id WHERE o.restaurant_id = 'rest-spice-jct'"),
            ('orders', "SELECT COUNT(*) FROM orders WHERE restaurant_id = 'rest-spice-jct'"),
            ('purchase_order_items', "SELECT COUNT(*) FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE po.restaurant_id = 'rest-spice-jct'"),
            ('purchase_orders', "SELECT COUNT(*) FROM purchase_orders WHERE restaurant_id = 'rest-spice-jct'"),
            ('stock_transactions', "SELECT COUNT(*) FROM stock_transactions st JOIN ingredients i ON st.ingredient_id = i.id WHERE i.restaurant_id = 'rest-spice-jct'"),
            ('recipe_items', "SELECT COUNT(*) FROM recipe_items ri JOIN menu_items mi ON ri.menu_item_id = mi.id WHERE mi.restaurant_id = 'rest-spice-jct'"),
            ('menu_item_variants', "SELECT COUNT(*) FROM menu_item_variants miv JOIN menu_items mi ON miv.menu_item_id = mi.id WHERE mi.restaurant_id = 'rest-spice-jct'"),
            ('menu_items', "SELECT COUNT(*) FROM menu_items WHERE restaurant_id = 'rest-spice-jct'"),
            ('menu_categories', "SELECT COUNT(*) FROM menu_categories WHERE restaurant_id = 'rest-spice-jct'"),
            ('dining_tables', "SELECT COUNT(*) FROM dining_tables WHERE restaurant_id = 'rest-spice-jct'"),
            ('ingredients', "SELECT COUNT(*) FROM ingredients WHERE restaurant_id = 'rest-spice-jct'"),
            ('suppliers', "SELECT COUNT(*) FROM suppliers WHERE restaurant_id = 'rest-spice-jct'"),
            ('loyalty_transactions', "SELECT COUNT(*) FROM loyalty_transactions WHERE restaurant_id = 'rest-spice-jct'"),
            ('customer_feedback', "SELECT COUNT(*) FROM customer_feedback WHERE restaurant_id = 'rest-spice-jct'"),
            ('customers', "SELECT COUNT(*) FROM customers WHERE restaurant_id = 'rest-spice-jct'"),
            ('notifications', "SELECT COUNT(*) FROM notifications WHERE restaurant_id = 'rest-spice-jct'"),
            ('ai_conversations', "SELECT COUNT(*) FROM ai_conversations WHERE restaurant_id = 'rest-spice-jct'"),
            ('audit_logs', "SELECT COUNT(*) FROM audit_logs WHERE restaurant_id = 'rest-spice-jct'"),
            ('users', "SELECT COUNT(*) FROM users WHERE restaurant_id = 'rest-spice-jct'"),
            ('restaurants', "SELECT COUNT(*) FROM restaurants WHERE id = 'rest-spice-jct'"),
        ]

        total = 0
        manifest = {}
        for name, query in tables:
            cnt = conn.execute(text(query)).scalar()
            manifest[name] = cnt
            total += cnt

        print("\n=== EXACT DELETION MANIFEST ===")
        for name, cnt in manifest.items():
            print(f"  {name:25}: {cnt} rows")
        print(f"Total demo records targeted for reset: {total}")
        return manifest

if __name__ == "__main__":
    get_manifest()
