from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class ChatMessageContext(BaseModel):
    role: str  # "user" | "assistant"
    content: str

class AIChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = "general"
    conversation_history: Optional[List[ChatMessageContext]] = None

class AIChatResponse(BaseModel):
    reply: str
    intent: Optional[str] = None
    suggested_action: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    data_context: Optional[Dict[str, Any]] = None
