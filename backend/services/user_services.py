# backend/services/user_services.py

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from backend.models.users import User 
from typing import List, Optional 
# Import for the purpose of full structure, although not directly used here
from fastapi.security import OAuth2PasswordRequestForm 


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

# --- Primary Authentication Service (Used by JWT Login Route) ---
def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    Authenticates a user by username (email) and password.
    Returns the User ORM object on success, or None on failure.
    """
    # Note: Using 'username' here corresponds to the email in your database/User model.
    user = db.query(User).filter(User.email == username).first()

    if not user:
        return None # User not found

    # 🛑 FIX: Check if the hash exists before verification to prevent a 500 error 
    # if the database column is NULL/None.
    if not user.password_hash or not verify_password(password, user.password_hash):
        return None # Invalid password or missing hash

    if not user.is_active:
        # A user being inactive should fail authentication
        return None 

    # Returning the full ORM object ensures all fields are present for Pydantic serialization.
    return user


# --- Helper Services ---

def get_all_users(db: Session) -> List[User]:
    """Retrieves all users from the database."""
    return db.query(User).all()

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieves a user by their ID."""
    return db.query(User).filter(User.user_id == user_id).first()

# --- Legacy/Mock Token Service (To be replaced by JWT decoding) ---
def get_current_user_id(token: Optional[str] = None) -> int:
    """
    Placeholder dependency to extract the user ID from a mock token (MOCK_TOKEN_{role}_{id}).
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Token missing."
        )
    
    # MOCK: Extract user ID from the mock token string
    try:
        parts = token.split('_')
        user_id = int(parts[-1])
        return user_id
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format."
        )