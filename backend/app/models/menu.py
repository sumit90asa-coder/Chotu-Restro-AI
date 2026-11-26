from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Numeric, Text
from sqlalchemy.orm import relationship
from app.database.session import Base

class DietaryType(str, enum.Enum):
    VEG = "veg"
    NONVEG = "nonveg"

class StationType(str, enum.Enum):
    TANDOOR = "tandoor"
    CURRY = "curry"
    BAR = "bar"
    PANTRY = "pantry"

class MenuCategory(Base):
    __tablename__ = "menu_categories"
    
    id = Column(String, primary_key=True, index=True)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    restaurant = relationship("Restaurant", back_populates="categories")
    items = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan")

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(String, primary_key=True, index=True)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False, index=True)
    category_id = Column(String, ForeignKey("menu_categories.id"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    dietary = Column(SQLEnum(DietaryType), default=DietaryType.VEG, nullable=False)
    station = Column(SQLEnum(StationType), default=StationType.CURRY, nullable=False)
    spice_level = Column(Integer, default=1)
    is_bestseller = Column(Boolean, default=False)
    is_in_stock = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    photo_url = Column(String, nullable=True)
    preparation_time_minutes = Column(Integer, default=15, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    restaurant = relationship("Restaurant", back_populates="menu_items")
    category = relationship("MenuCategory", back_populates="items")
    recipe_items = relationship("RecipeItem", back_populates="menu_item", cascade="all, delete-orphan")
    variants = relationship("MenuItemVariant", back_populates="menu_item", cascade="all, delete-orphan")

    @property
    def category_name(self) -> str:
        if self.category and self.category.name:
            return self.category.name
        return "Mains"

class MenuItemVariant(Base):
    __tablename__ = "menu_item_variants"
    
    id = Column(String(36), primary_key=True, index=True)
    menu_item_id = Column(String(36), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(64), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    is_in_stock = Column(Boolean, default=True, nullable=False)
    
    menu_item = relationship("MenuItem", back_populates="variants")
