from datetime import datetime, timezone
from typing import List
from sqlalchemy.orm import Session
from app.models.kot import KOT, KOTItem, KOTStatus
from app.models.order import Order, OrderStatus

class KitchenService:
    @staticmethod
    def get_kots(db: Session, restaurant_id: str, status_filter: str = "active") -> List[KOT]:
        query = db.query(KOT).filter(KOT.restaurant_id == restaurant_id)
        if status_filter == "active":
            query = query.filter(KOT.status != KOTStatus.BUMPED)
        elif status_filter == "completed":
            query = query.filter(KOT.status == KOTStatus.BUMPED)
        return query.order_by(KOT.created_at.desc()).all()

    @staticmethod
    def toggle_kot_item_prepared(db: Session, item_id: str) -> KOTItem:
        item = db.query(KOTItem).filter(KOTItem.id == item_id).first()
        if not item:
            raise ValueError("KOT Item not found")
        item.is_prepared = not item.is_prepared
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def bump_kot(db: Session, kot_id: str) -> KOT:
        kot = db.query(KOT).filter(KOT.id == kot_id).first()
        if not kot:
            raise ValueError("KOT not found")
        kot.status = KOTStatus.BUMPED
        kot.completed_at = datetime.now(timezone.utc)
        db.flush()
        
        # Check if all KOTs for the associated order are completed, update order status to READY ONLY IF currently PREPARING
        order = db.query(Order).filter(Order.id == kot.order_id).first()
        if order and order.status == OrderStatus.PREPARING:
            remaining_kots = db.query(KOT).filter(KOT.order_id == order.id, KOT.status != KOTStatus.BUMPED).count()
            if remaining_kots == 0:
                order.status = OrderStatus.READY

        db.commit()
        db.refresh(kot)
        return kot

    @staticmethod
    def recall_kot(db: Session, kot_id: str) -> KOT:
        kot = db.query(KOT).filter(KOT.id == kot_id).first()
        if not kot:
            raise ValueError("KOT not found")
        kot.status = KOTStatus.COOKING
        kot.completed_at = None
        db.commit()
        db.refresh(kot)
        return kot
