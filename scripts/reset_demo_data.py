import os
import sys
from sqlalchemy import create_engine, text

def reset_demo_restaurant(db_url="postgresql+psycopg://postgres:postgres@localhost:5432/chotu_restro_ai", dry_run=True):
    engine = create_engine(db_url)
    print(f"Connecting to database: {db_url.split('@')[-1]}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE EXECUTION'}")
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Break circular FK: dining_tables.current_order_id -> orders.id
            conn.execute(text("UPDATE dining_tables SET current_order_id = NULL WHERE restaurant_id = 'rest-spice-jct'"))
            
            # 2. Delete order_items
            del_order_items = conn.execute(text("""
                DELETE FROM order_items WHERE order_id IN (
                    SELECT id FROM orders WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 3. Delete kot_items
            del_kot_items = conn.execute(text("""
                DELETE FROM kot_items WHERE kot_id IN (
                    SELECT id FROM kots WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 4. Delete kots
            del_kots = conn.execute(text("DELETE FROM kots WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 5. Delete payments
            del_payments = conn.execute(text("""
                DELETE FROM payments WHERE order_id IN (
                    SELECT id FROM orders WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 6. Delete orders
            del_orders = conn.execute(text("DELETE FROM orders WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 7. Delete purchase order items
            del_po_items = conn.execute(text("""
                DELETE FROM purchase_order_items WHERE purchase_order_id IN (
                    SELECT id FROM purchase_orders WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 8. Delete purchase orders
            del_pos = conn.execute(text("DELETE FROM purchase_orders WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 9. Delete stock transactions
            del_stock_tx = conn.execute(text("""
                DELETE FROM stock_transactions WHERE ingredient_id IN (
                    SELECT id FROM ingredients WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 10. Delete recipe items
            del_recipe_items = conn.execute(text("""
                DELETE FROM recipe_items WHERE menu_item_id IN (
                    SELECT id FROM menu_items WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 11. Delete menu item variants
            del_variants = conn.execute(text("""
                DELETE FROM menu_item_variants WHERE menu_item_id IN (
                    SELECT id FROM menu_items WHERE restaurant_id = 'rest-spice-jct'
                )
            """)).rowcount
            
            # 12. Delete menu items
            del_menu_items = conn.execute(text("DELETE FROM menu_items WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 13. Delete menu categories
            del_cats = conn.execute(text("DELETE FROM menu_categories WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 14. Delete dining tables
            del_tables = conn.execute(text("DELETE FROM dining_tables WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 15. Delete ingredients
            del_ingredients = conn.execute(text("DELETE FROM ingredients WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 16. Delete suppliers
            del_suppliers = conn.execute(text("DELETE FROM suppliers WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 17. Delete loyalty transactions
            del_loyalty = conn.execute(text("DELETE FROM loyalty_transactions WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 18. Delete customer feedback
            del_feedback = conn.execute(text("DELETE FROM customer_feedback WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 19. Delete customers
            del_customers = conn.execute(text("DELETE FROM customers WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 20. Delete notifications
            del_notifications = conn.execute(text("DELETE FROM notifications WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 21. Delete ai_conversations
            del_ai = conn.execute(text("DELETE FROM ai_conversations WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 22. Delete audit_logs
            del_audit = conn.execute(text("DELETE FROM audit_logs WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 23. Delete users (including user-mgr-01)
            del_users = conn.execute(text("DELETE FROM users WHERE restaurant_id = 'rest-spice-jct'")).rowcount
            
            # 24. Delete restaurant record
            del_restaurant = conn.execute(text("DELETE FROM restaurants WHERE id = 'rest-spice-jct'")).rowcount
            
            total_deleted = (
                del_order_items + del_kot_items + del_kots + del_payments + del_orders +
                del_po_items + del_pos + del_stock_tx + del_recipe_items + del_variants +
                del_menu_items + del_cats + del_tables + del_ingredients + del_suppliers +
                del_loyalty + del_feedback + del_customers + del_notifications + del_ai +
                del_audit + del_users + del_restaurant
            )
            
            print(f"Total records staged for deletion: {total_deleted}")
            print(f"  - Users (including manager): {del_users}")
            print(f"  - Restaurant: {del_restaurant}")
            print(f"  - Menu Items & Categories: {del_menu_items + del_cats}")
            print(f"  - Dining Tables: {del_tables}")
            print(f"  - Orders & Items: {del_orders + del_order_items}")
            print(f"  - Recipes & Ingredients: {del_recipe_items + del_ingredients}")
            print(f"  - Suppliers: {del_suppliers}")

            if dry_run:
                trans.rollback()
                print("\n[DRY RUN COMPLETE] Transaction rolled back safely. Zero changes made.")
            else:
                trans.commit()
                print("\n[SUCCESS] Transaction committed. All demo data and old manager account permanently deleted.")
                
            return total_deleted
        except Exception as e:
            trans.rollback()
            print(f"ERROR during reset: {e}")
            raise e

if __name__ == "__main__":
    is_live = "--execute" in sys.argv
    reset_demo_restaurant(dry_run=not is_live)
