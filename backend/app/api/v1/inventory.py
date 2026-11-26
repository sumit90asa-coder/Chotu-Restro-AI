import uuid
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.inventory import Ingredient, StockTransaction, RecipeItem
from app.schemas.inventory import (
    IngredientCreate,
    IngredientUpdate,
    IngredientResponse,
    StockAdjustment,
    StockTransactionResponse,
    RecipeLink
)
from app.services.inventory_service import InventoryService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/ingredients", response_model=List[IngredientResponse])
def get_ingredients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ingredients = db.query(Ingredient).filter(Ingredient.restaurant_id == current_user.restaurant_id).order_by(Ingredient.name).all()
    res = []
    for ing in ingredients:
        is_low = Decimal(str(ing.current_stock)) <= Decimal(str(ing.reorder_threshold))
        item = IngredientResponse(
            id=ing.id,
            restaurant_id=ing.restaurant_id,
            name=ing.name,
            unit=ing.unit,
            current_stock=ing.current_stock,
            reorder_threshold=ing.reorder_threshold,
            cost_per_unit=ing.cost_per_unit,
            supplier_name=ing.supplier_name,
            is_low_stock=is_low
        )
        res.append(item)
    return res

@router.post("/ingredients", response_model=IngredientResponse)
def create_ingredient(
    data: IngredientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ing = Ingredient(
        id=f"ing-{uuid.uuid4().hex[:8]}",
        restaurant_id=current_user.restaurant_id,
        name=data.name,
        unit=data.unit,
        current_stock=data.current_stock,
        reorder_threshold=data.reorder_threshold,
        cost_per_unit=data.cost_per_unit,
        supplier_name=data.supplier_name
    )
    db.add(ing)
    db.commit()
    db.refresh(ing)
    return IngredientResponse(
        id=ing.id,
        restaurant_id=ing.restaurant_id,
        name=ing.name,
        unit=ing.unit,
        current_stock=ing.current_stock,
        reorder_threshold=ing.reorder_threshold,
        cost_per_unit=ing.cost_per_unit,
        supplier_name=ing.supplier_name,
        is_low_stock=ing.current_stock <= ing.reorder_threshold
    )

@router.post("/ingredients/{ingredient_id}/adjust", response_model=IngredientResponse)
def adjust_ingredient_stock(
    ingredient_id: str,
    adj: StockAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        ing = InventoryService.adjust_stock(
            db, current_user.restaurant_id, ingredient_id, adj.quantity, adj.transaction_type, adj.notes or ""
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    return IngredientResponse(
        id=ing.id,
        restaurant_id=ing.restaurant_id,
        name=ing.name,
        unit=ing.unit,
        current_stock=ing.current_stock,
        reorder_threshold=ing.reorder_threshold,
        cost_per_unit=ing.cost_per_unit,
        supplier_name=ing.supplier_name,
        is_low_stock=ing.current_stock <= ing.reorder_threshold
    )

@router.put("/ingredients/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(
    ingredient_id: str,
    data: IngredientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ing = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == current_user.restaurant_id
    ).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
        
    if data.name is not None:
        ing.name = data.name.strip()
    if data.unit is not None:
        ing.unit = data.unit.strip()
    if data.current_stock is not None:
        ing.current_stock = data.current_stock
    if data.reorder_threshold is not None:
        ing.reorder_threshold = data.reorder_threshold
    if data.cost_per_unit is not None:
        ing.cost_per_unit = data.cost_per_unit
    if data.supplier_name is not None:
        ing.supplier_name = data.supplier_name.strip() if data.supplier_name else None
        
    db.commit()
    db.refresh(ing)
    return IngredientResponse(
        id=ing.id,
        restaurant_id=ing.restaurant_id,
        name=ing.name,
        unit=ing.unit,
        current_stock=ing.current_stock,
        reorder_threshold=ing.reorder_threshold,
        cost_per_unit=ing.cost_per_unit,
        supplier_name=ing.supplier_name,
        is_low_stock=ing.current_stock <= ing.reorder_threshold
    )

@router.delete("/ingredients/{ingredient_id}")
def delete_ingredient(
    ingredient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ing = db.query(Ingredient).filter(
        Ingredient.id == ingredient_id,
        Ingredient.restaurant_id == current_user.restaurant_id
    ).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
        
    # Check if linked to recipes
    recipe_count = db.query(RecipeItem).filter(RecipeItem.ingredient_id == ingredient_id).count()
    if recipe_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete ingredient '{ing.name}' as it is linked to {recipe_count} recipe(s). Remove recipe links first."
        )
        
    db.delete(ing)
    db.commit()
    return {"success": True, "message": f"Ingredient '{ing.name}' deleted successfully."}

@router.get("/transactions", response_model=List[StockTransactionResponse])
def get_stock_transactions(
    ingredient_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(StockTransaction).filter(
        StockTransaction.restaurant_id == current_user.restaurant_id
    )
    if ingredient_id:
        query = query.filter(StockTransaction.ingredient_id == ingredient_id)
    txs = query.order_by(StockTransaction.created_at.desc()).limit(100).all()
    return txs

@router.get("/alerts")
def get_inventory_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return InventoryService.get_low_stock_alerts(db, current_user.restaurant_id)

@router.post("/recipes/link")
def link_recipe_ingredient(
    link: RecipeLink,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(RecipeItem).filter(
        RecipeItem.menu_item_id == link.menu_item_id,
        RecipeItem.ingredient_id == link.ingredient_id
    ).first()
    if existing:
        existing.quantity_required = link.quantity_required
    else:
        new_recipe = RecipeItem(
            id=f"rec-{uuid.uuid4().hex[:8]}",
            menu_item_id=link.menu_item_id,
            ingredient_id=link.ingredient_id,
            quantity_required=link.quantity_required
        )
        db.add(new_recipe)
    db.commit()
    return {"status": "success", "message": "Recipe ingredient linked"}
