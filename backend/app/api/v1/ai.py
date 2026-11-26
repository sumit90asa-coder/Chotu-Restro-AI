from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.ai import AIChatRequest, AIChatResponse
from app.services.ai_service import AIService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_chotu(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    history_dicts = None
    if req.conversation_history:
        history_dicts = [{"role": h.role, "content": h.content} for h in req.conversation_history]
    return await AIService.chat(
        db=db,
        restaurant_id=current_user.restaurant_id,
        message=req.message,
        user_id=current_user.id,
        conversation_history=history_dicts
    )
