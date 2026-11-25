import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.menu import MenuItem, MenuCategory, MenuItemVariant
from app.schemas.menu import (
    MenuItemResponse, MenuCategoryResponse, StockStatusUpdate,
    MenuItemUpdate, MenuItemCreate, MenuItemVariantCreate, MenuItemVariantResponse
)
from app.api.deps import get_current_user
from app.models.user import User
from app.websocket.manager import ws_manager
from app.websocket.events import WSEventType, create_ws_message

router = APIRouter()

@router.get("/items", response_model=List[MenuItemResponse])
def get_menu_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(MenuItem).filter(MenuItem.restaurant_id == current_user.restaurant_id, MenuItem.is_active == True).all()

@router.get("/categories", response_model=List[MenuCategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    categories = db.query(MenuCategory).filter(MenuCategory.restaurant_id == current_user.restaurant_id, MenuCategory.is_active == True).order_by(MenuCategory.display_order).all()
    return categories

@router.patch("/items/{dish_id}/stock", response_model=MenuItemResponse)
async def toggle_dish_stock(
    dish_id: str,
    stock_data: StockStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dish = db.query(MenuItem).filter(MenuItem.id == dish_id, MenuItem.restaurant_id == current_user.restaurant_id).first()
    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")
        
    dish.is_in_stock = stock_data.is_in_stock
    db.commit()
    db.refresh(dish)

    # Broadcast stock change
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.DISH_STOCK_TOGGLED, {"dish_id": dish.id, "is_in_stock": dish.is_in_stock})
    )
    return dish

@router.patch("/items/{dish_id}", response_model=MenuItemResponse)
async def update_menu_item(
    dish_id: str,
    update_data: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dish = db.query(MenuItem).filter(MenuItem.id == dish_id, MenuItem.restaurant_id == current_user.restaurant_id).first()
    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")
        
    if update_data.is_in_stock is not None:
        dish.is_in_stock = update_data.is_in_stock
    if update_data.price is not None:
        dish.price = update_data.price
        
    db.commit()
    db.refresh(dish)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.DISH_STOCK_TOGGLED, {"dish_id": dish.id, "is_in_stock": dish.is_in_stock, "price": float(dish.price)})
    )
    return dish

@router.post("/items", response_model=MenuItemResponse)
def create_menu_item(
    req: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cat_identifier = req.category_id or req.category or "starters"
    cat = db.query(MenuCategory).filter(
        (MenuCategory.id == cat_identifier) | (MenuCategory.slug == cat_identifier.lower()) | (MenuCategory.name.ilike(cat_identifier)),
        MenuCategory.restaurant_id == current_user.restaurant_id
    ).first()
    
    if not cat:
        # Dynamically create category for this restaurant
        cat_id = f"cat-{uuid.uuid4().hex[:6]}"
        display_name = cat_identifier.replace("-", " ").replace("_", " ").title()
        cat = MenuCategory(
            id=cat_id,
            restaurant_id=current_user.restaurant_id,
            name=display_name,
            slug=cat_identifier.lower().replace(" ", "-"),
            display_order=db.query(MenuCategory).filter(MenuCategory.restaurant_id == current_user.restaurant_id).count() + 1,
            is_active=True
        )
        db.add(cat)
        db.flush()

    new_dish = MenuItem(
        id=f"dish-{uuid.uuid4().hex[:8]}",
        restaurant_id=current_user.restaurant_id,
        category_id=cat.id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        price=req.price,
        dietary=req.dietary,
        station=req.station,
        spice_level=req.spice_level,
        is_bestseller=req.is_bestseller,
        is_in_stock=True,
        is_active=True,
        photo_url=req.photo_url,
        preparation_time_minutes=req.preparation_time_minutes
    )
    db.add(new_dish)
    db.commit()
    db.refresh(new_dish)
    return new_dish

@router.delete("/items/{dish_id}", status_code=200)
async def delete_menu_item(
    dish_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dish = db.query(MenuItem).filter(
        MenuItem.id == dish_id,
        MenuItem.restaurant_id == current_user.restaurant_id
    ).first()
    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")
        
    dish.is_active = False
    db.commit()
    
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.DISH_STOCK_TOGGLED, {"dish_id": dish.id, "is_active": False})
    )
    return {"success": True, "message": f"Dish '{dish.name}' deactivated successfully"}

@router.post("/items/{dish_id}/variants", response_model=MenuItemVariantResponse)
def add_item_variant(
    dish_id: str,
    req: MenuItemVariantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dish = db.query(MenuItem).filter(
        MenuItem.id == dish_id,
        MenuItem.restaurant_id == current_user.restaurant_id
    ).first()
    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")

    variant = MenuItemVariant(
        id=f"var-{uuid.uuid4().hex[:8]}",
        menu_item_id=dish.id,
        name=req.name,
        price=req.price,
        is_in_stock=req.is_in_stock
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant
