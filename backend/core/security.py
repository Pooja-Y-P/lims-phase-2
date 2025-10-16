# backend/core/security.py

from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, status
from typing import Optional

# 🛑 Import the settings instance from your config file
from backend.core.config import settings 

# Use the values loaded and validated by Pantic Settings
# Ensure this SECRET_KEY is the same one used to generate the login token!
SECRET_KEY = settings.JWT_SECRET
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES 
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS
REFRESH_TOKEN_SECRET = settings.REFRESH_TOKEN_SECRET

class InvalidTokenError(Exception):
    """Custom exception raised for invalid or expired tokens."""
    pass

def create_access_token(data: dict) -> str:
    """Generates a signed JWT access token."""
    if not SECRET_KEY:
        raise ValueError("JWT_SECRET is not configured.")
        
    to_encode = data.copy()
    
    # Set expiration and issued at timestamps (exp and iat claims)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes and validates a JWT access token, raising InvalidTokenError on failure.
    Includes a leeway option as a workaround for development environment clock skew.
    """
    if not SECRET_KEY:
        raise InvalidTokenError("Server misconfiguration: JWT_SECRET missing.")

    try:
        # --- START: CLOCK SKEW WORKAROUND ---
        # ⚠️ WARNING: This is a workaround for a development environment with an
        # incorrect system clock. It tells the decoder to accept tokens that are
        # issued up to 1 hour in the future.
        # This should NOT be used in production. The correct fix is to sync the system clock.
        leeway_in_seconds = 3600  # 1 hour
        # --- END: CLOCK SKEW WORKAROUND ---

        # The 'options' parameter is added to tolerate the time difference.
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            options={"leeway": leeway_in_seconds}
        )
        
        return payload
    except JWTError as e:
        # Catches SignatureError, ExpiredSignatureError, etc.
        raise InvalidTokenError(f"Token signature or claims are invalid: {e}")

# --- Refresh Token Functions (Optional, but good practice) ---
def create_refresh_token(data: dict) -> str:
    """Generates a signed JWT refresh token."""
    if not REFRESH_TOKEN_SECRET:
        raise ValueError("REFRESH_TOKEN_SECRET is not configured.")
        
    to_encode = data.copy()
    
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(to_encode, REFRESH_TOKEN_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def decode_refresh_token(token: str) -> dict:
    """
    Decodes and validates a JWT refresh token.
    Includes leeway for development clock skew.
    """
    if not REFRESH_TOKEN_SECRET:
        raise InvalidTokenError("Server misconfiguration: REFRESH_TOKEN_SECRET missing.")

    try:
        # Applying the same leeway workaround for consistency.
        leeway_in_seconds = 3600  # 1 hour

        payload = jwt.decode(
            token, 
            REFRESH_TOKEN_SECRET, 
            algorithms=[ALGORITHM],
            options={"leeway": leeway_in_seconds}
        )
        return payload
    except JWTError:
        raise InvalidTokenError("Refresh token signature or claims are invalid.")