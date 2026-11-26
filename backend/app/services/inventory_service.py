import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.inventory import Ingredient, RecipeItem, StockTransaction, TransactionType
from app.models.menu import MenuItem

class InventoryService:
    @staticmethod
    def deduct_stock_for_order(db: Session, restaurant_id: str, order_items: List[Any], order_id: str):
        """
        Deducts raw ingredient stock based on recipe items configured for each menu item.
        """
        for item in order_items:
            m_id = getattr(item, "menu_item_id", None) or getattr(item, "dish_id", None)
            if not m_id:
                continue
            recipe_items = db.query(RecipeItem).filter(RecipeItem.menu_item_id == m_id).all()
            for r_item in recipe_items:
                ingredient = db.query(Ingredient).filter(
                    Ingredient.id == r_item.ingredient_id,
                    Ingredient.restaurant_id == restaurant_id
                ).with_for_update().first()
                if ingredient:
                    total_needed = Decimal(str(r_item.quantity_required)) * Decimal(str(item.quantity))
                    new_stock = Decimal(str(ingredient.current_stock)) - total_needed
                    deficit_note = ""
                    if new_stock < Decimal("0.000"):
                        shortage = abs(new_stock)
                        deficit_note = f" [DEFICIT WARNING: consumed {total_needed} with only {ingredient.current_stock} in stock (shortage: {shortage})]"
                        new_stock = Decimal("0.000")
                    ingredient.current_stock = new_stock
                    
                    # Record transaction with unique primary key
                    txn = StockTransaction(
                        id=f"stxn-{uuid.uuid4().hex[:10]}",
                        restaurant_id=restaurant_id,
                        ingredient_id=ingredient.id,
                        transaction_type=TransactionType.CONSUMPTION,
                        quantity=-total_needed,
                        reference_id=order_id,
                        notes=f"Consumed by order {order_id} ({item.name} x{item.quantity}){deficit_note}"
                    )
                    db.add(txn)
                    
                    # If ingredient reaches 0 or below, automatically toggle dish out-of-stock
                    if ingredient.current_stock <= Decimal("0.000"):
                        dish = db.query(MenuItem).filter(MenuItem.id == m_id).first()
                        if dish:
                            dish.is_in_stock = False

        db.commit()

    @staticmethod
    def adjust_stock(db: Session, restaurant_id: str, ingredient_id: str, delta: Decimal, txn_type: Any, notes: str = ""):
        ingredient = db.query(Ingredient).filter(
            Ingredient.id == ingredient_id, 
            Ingredient.restaurant_id == restaurant_id
        ).with_for_update().first()
        if not ingredient:
            raise ValueError("Ingredient not found")
            
        # Proper accounting validation: prevent manual deduction greater than available stock
        if delta < Decimal("0.000") and abs(delta) > ingredient.current_stock:
            raise ValueError(f"Cannot deduct {abs(delta)} {ingredient.unit}. Current available stock is only {ingredient.current_stock} {ingredient.unit}.")

        new_stock = Decimal(str(ingredient.current_stock)) + delta
        if new_stock < Decimal("0.000"):
            new_stock = Decimal("0.000")
        ingredient.current_stock = new_stock

        resolved_type = TransactionType.ADJUSTMENT
        if isinstance(txn_type, TransactionType):
            resolved_type = txn_type
        elif str(txn_type).lower() in ("intake", "purchase"):
            resolved_type = TransactionType.PURCHASE
        elif str(txn_type).lower() == "wastage":
            resolved_type = TransactionType.WASTAGE
        elif str(txn_type).lower() == "consumption":
            resolved_type = TransactionType.CONSUMPTION

        txn = StockTransaction(
            id=f"stxn-adj-{int(datetime.now().timestamp())}-{ingredient.id[-4:]}",
            restaurant_id=restaurant_id,
            ingredient_id=ingredient.id,
            transaction_type=resolved_type,
            quantity=delta,
            reference_id=None,
            notes=notes
        )
        db.add(txn)

        # Auto-replenish dishes that were out of stock if all ingredients are now available
        if ingredient.current_stock > Decimal("0.000"):
            recipe_items = db.query(RecipeItem).filter(RecipeItem.ingredient_id == ingredient.id).all()
            for r in recipe_items:
                dish = db.query(MenuItem).filter(MenuItem.id == r.menu_item_id).first()
                if dish and not dish.is_in_stock:
                    all_recipes = db.query(RecipeItem).filter(RecipeItem.menu_item_id == dish.id).all()
                    can_stock = True
                    for other_r in all_recipes:
                        other_ing = db.query(Ingredient).filter(Ingredient.id == other_r.ingredient_id).first()
                        if other_ing and other_ing.current_stock <= Decimal("0.000"):
                            can_stock = False
                            break
                    if can_stock:
                        dish.is_in_stock = True

        db.commit()
        db.refresh(ingredient)
        return ingredient

    @staticmethod
    def get_low_stock_alerts(db: Session, restaurant_id: str) -> List[Dict[str, Any]]:
        ingredients = db.query(Ingredient).filter(Ingredient.restaurant_id == restaurant_id).all()
        alerts = []
        for ing in ingredients:
            if Decimal(str(ing.current_stock)) <= Decimal(str(ing.reorder_threshold)):
                alerts.append({
                    "ingredient_id": ing.id,
                    "name": ing.name,
                    "current_stock": float(ing.current_stock),
                    "reorder_threshold": float(ing.reorder_threshold),
                    "unit": ing.unit,
                    "supplier": ing.supplier_name or "Local Supplier"
                })
        return alerts
