import secrets
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from jose import jwt, JWTError
from passlib.context import CryptContext
from typing import Optional

# Import the settings instance from your config file
from backend.core.config import settings

# ====================================================================
# CONFIGURATION
# ====================================================================

# --- JWT Settings ---
SECRET_KEY = settings.JWT_SECRET
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_MINUTES = settings.REFRESH_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_SECRET = settings.REFRESH_TOKEN_SECRET
LOCAL_TIMEZONE = ZoneInfo(settings.TIMEZONE)

# --- Password Hashing ---
# Create a Passlib context for hashing and verifying passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ====================================================================
# CUSTOM EXCEPTION
# ====================================================================

class InvalidTokenError(Exception):
    """Custom exception raised for invalid or expired tokens."""
    pass

# ====================================================================
# 🚀 NEW: PASSWORD HASHING UTILITIES
# Centralize password management here for consistent security.
# ====================================================================

def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    # Check if a hash exists to avoid errors with None values
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)

# ====================================================================
# 🚀 NEW: INVITATION TOKEN UTILITY
# For generating secure, non-JWT tokens for one-time actions like account activation.
# ====================================================================

def create_invitation_token() -> str:
    """
    Generates a cryptographically secure, URL-safe random string.
    
    This token is NOT a JWT. It's meant to be stored in the 'invitations' table
    and verified by a direct database lookup. This is a simple and secure pattern
    for one-time use links.
    """
    return secrets.token_urlsafe(32) # Generates a 32-byte (43-character) random token

# ====================================================================
# JWT AUTHENTICATION TOKEN FUNCTIONS (UNCHANGED)
# Your existing, well-structured logic for access and refresh tokens.
# ====================================================================

def create_access_token(data: dict) -> str:
    """Generates a signed JWT access token."""
    if not SECRET_KEY:
        raise ValueError("JWT_SECRET is not configured.")
        
    to_encode = data.copy()
    
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes and validates a JWT access token, raising InvalidTokenError on failure.
    Includes leeway for development environment clock skew.
    """
    if not SECRET_KEY:
        raise InvalidTokenError("Server misconfiguration: JWT_SECRET missing.")

    try:
        # ⚠️ WARNING: Leeway is a workaround for dev environments with clock skew.
        # This should NOT be used in production. The correct fix is to sync the system clock.
        leeway_in_seconds = 3600  # 1 hour

        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            options={"leeway": leeway_in_seconds}
        )
        return payload
    except JWTError as e:
        raise InvalidTokenError(f"Token signature or claims are invalid: {e}")

# --- Refresh Token Functions ---
def create_refresh_token(data: dict) -> str:
    """Generates a signed JWT refresh token."""
    if not REFRESH_TOKEN_SECRET:
        raise ValueError("REFRESH_TOKEN_SECRET is not configured.")
        
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(to_encode, REFRESH_TOKEN_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def decode_refresh_token(token: str) -> dict:
    """Decodes and validates a JWT refresh token."""
    if not REFRESH_TOKEN_SECRET:
        raise InvalidTokenError("Server misconfiguration: REFRESH_TOKEN_SECRET missing.")

    try:
        leeway_in_seconds = 3600
        payload = jwt.decode(
            token, 
            REFRESH_TOKEN_SECRET, 
            algorithms=[ALGORITHM],
            options={"leeway": leeway_in_seconds}
        )
        return payload
    except JWTError:
        raise InvalidTokenError("Refresh token signature or claims are invalid.")