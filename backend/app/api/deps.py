from typing import Optional, Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.permissions import UserRole, has_permission
from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import TokenPayload

# Enforce OAuth2PasswordBearer strictly: auto_error=True
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=True
)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Strictly validates JWT token and returns authenticated user from PostgreSQL.
    Enforces cryptographic signature, expiration, and user active status verification.
    Missing, invalid, expired, or tampered tokens return HTTP 401.
    Zero demo fallbacks. Zero hardcoded users.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token or token == "demo-token":
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        if not token_data.sub:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    except Exception:
        raise credentials_exception

    user = db.query(User).filter(User.id == token_data.sub).first()
    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive. Please contact your restaurant administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def check_permission(required_perm: str):
    def permission_checker(current_user: User = Depends(get_current_user)):
        if not has_permission(current_user.role, required_perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions for {required_perm}"
            )
        return current_user
    return permission_checker
