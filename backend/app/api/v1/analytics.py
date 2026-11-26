from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.analytics import AnalyticsOverview
from app.services.analytics_service import AnalyticsService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics_overview(
    period: Optional[str] = Query("today", description="Period: today, yesterday, last_7_days, this_month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return AnalyticsService.get_overview(db, current_user.restaurant_id, period or "today")
