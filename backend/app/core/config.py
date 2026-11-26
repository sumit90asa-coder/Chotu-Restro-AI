import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

def _normalize_db_url(url: str) -> str:
    if not url:
        return "postgresql+psycopg://postgres:postgres@localhost:5432/chotu_restro_ai"
    # Render and Heroku provide postgres:// URLs; SQLAlchemy 2 + psycopg 3 requires postgresql+psycopg://
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url

def _parse_cors_origins() -> List[str]:
    raw = os.getenv("BACKEND_CORS_ORIGINS") or os.getenv("CORS_ORIGINS")
    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    if not raw:
        return default_origins
    if raw.startswith("["):
        import json
        try:
            return json.loads(raw)
        except Exception:
            pass
    return [o.strip() for o in raw.split(",") if o.strip()]

class Settings(BaseSettings):
    PROJECT_NAME: str = "Chotu Restro AI Backend"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "chotu_restro_ai_super_secret_jwt_key_2026_modern_hospitality")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database: PostgreSQL with psycopg 3 driver as primary source of truth
    DATABASE_URL: str = _normalize_db_url(os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/chotu_restro_ai"))
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = _parse_cors_origins()
    
    # Groq AI Configuration (Primary LLM) & Optional Gemini Fallback
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()
