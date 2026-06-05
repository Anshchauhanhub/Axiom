import os
import uuid
import logging
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from dotenv import load_dotenv

from database import get_db
from models import User

load_dotenv()

logger = logging.getLogger("axiom.auth")

# ─── JWT Configuration ───────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "1440"))

# Fail loudly if the secret is missing or still the placeholder
_WEAK_SECRETS = {None, "", "axiom-ai-secret", "axiom-ai-super-secret-change-me-in-production"}
if JWT_SECRET in _WEAK_SECRETS:
    if os.getenv("APP_ENV") != "development":
        raise RuntimeError(
            "FATAL: JWT_SECRET is not set or is using a weak default. "
            "Set a strong, random JWT_SECRET in your .env before running in production."
        )
    else:
        JWT_SECRET = JWT_SECRET or "dev-only-insecure-secret"
        logger.warning("⚠️  Using weak JWT_SECRET — acceptable in development only.")

security = HTTPBearer()

# Explicit bcrypt work factor (2^12 = 4096 iterations)
BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),  # Unique token ID for auditing
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_password_reset_token(email: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=15)
    payload = {
        "sub": email,
        "type": "reset",
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_password_reset_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "reset":
            raise HTTPException(status_code=401, detail="Invalid token type")
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")


async def verify_google_token(token: str) -> dict:
    import httpx
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="Google authentication is not configured.")
    
    # The frontend uses useGoogleLogin which returns an access_token.
    # We verify it and get the user's profile by calling the userinfo endpoint asynchronously.
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"}
        )
    
    if response.status_code != 200:
        logger.error(f"Google token verification failed: {response.text}")
        raise HTTPException(status_code=401, detail="Invalid Google token")
        
    return response.json()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
