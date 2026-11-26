import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import jwt
import bcrypt
from app.core.config import settings

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None, extra_claims: Optional[dict] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "jti": uuid.uuid4().hex}
    if extra_claims:
        to_encode.update(extra_claims)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

REVOKED_TOKENS: set[str] = set()

def get_token_identifier(token: str) -> str:
    """Extract JTI claim from token or fallback to SHA-256 hash."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False, "verify_signature": False}
        )
        jti = payload.get("jti")
        if jti:
            return str(jti)
    except Exception:
        pass
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def revoke_token(token: str, db: Optional[Any] = None, user_id: Optional[str] = None) -> None:
    """
    Persistently revoke token in PostgreSQL and hot-cache in process memory.
    Ensures revocation survives backend container restarts and multi-worker scaleout.
    """
    if not token:
        return
    token_id = get_token_identifier(token)
    REVOKED_TOKENS.add(token)
    REVOKED_TOKENS.add(token_id)

    if db is not None:
        try:
            from app.models.revoked_token import RevokedToken
            existing = db.query(RevokedToken).filter(RevokedToken.id == token_id).first()
            if not existing:
                exp_dt = None
                try:
                    payload = jwt.decode(
                        token,
                        settings.SECRET_KEY,
                        algorithms=[settings.ALGORITHM],
                        options={"verify_exp": False, "verify_signature": False}
                    )
                    exp_ts = payload.get("exp")
                    if exp_ts:
                        exp_dt = datetime.utcfromtimestamp(exp_ts)
                    uid = payload.get("sub") or user_id
                except Exception:
                    uid = user_id

                revoked_rec = RevokedToken(
                    id=token_id,
                    token=token,
                    user_id=uid,
                    revoked_at=datetime.utcnow(),
                    expires_at=exp_dt
                )
                db.add(revoked_rec)
                db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

def is_token_revoked(token: str, db: Optional[Any] = None) -> bool:
    """
    Check revocation against in-memory hot cache first, then PostgreSQL database.
    """
    if not token:
        return True
    token_id = get_token_identifier(token)
    if token in REVOKED_TOKENS or token_id in REVOKED_TOKENS:
        return True

    # Check shared persistent PostgreSQL database
    if db is not None:
        try:
            from app.models.revoked_token import RevokedToken
            record = db.query(RevokedToken).filter(
                (RevokedToken.id == token_id) | (RevokedToken.token == token)
            ).first()
            if record:
                REVOKED_TOKENS.add(token)
                REVOKED_TOKENS.add(token_id)
                return True
        except Exception:
            pass

    return False

def clear_revoked_tokens() -> None:
    REVOKED_TOKENS.clear()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
