"""
Create a default admin user automatically
Email: admin@example.com
Password: admin123
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from backend.db import SessionLocal
from backend.models.users import User
from backend.core.security import hash_password

def create_default_admin():
    db = SessionLocal()
    
    email = "admin@example.com"
    password = "admin123"
    full_name = "System Administrator"
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"✅ Admin user already exists!")
            print(f"   Email: {existing_user.email}")
            print(f"   User ID: {existing_user.user_id}")
            print(f"   Role: {existing_user.role}")
            print(f"   Active: {existing_user.is_active}")
            
            # Update password
            existing_user.hashed_password = hash_password(password)
            existing_user.is_active = True
            db.commit()
            print(f"\n🔄 Password reset to: {password}")
            return
        
        # Create new admin user
        hashed_pw = hash_password(password)
        
        new_admin = User(
            email=email,
            username="admin",
            hashed_password=hashed_pw,
            full_name=full_name,
            role='admin',
            is_active=True,
            customer_id=None
        )
        
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        
        print(f"\n✅ Admin user created successfully!")
        print(f"   Email: {new_admin.email}")
        print(f"   Username: {new_admin.username}")
        print(f"   Full Name: {new_admin.full_name}")
        print(f"   User ID: {new_admin.user_id}")
        print(f"   Role: {new_admin.role}")
        print(f"\n🔐 Login credentials:")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n⚠️  IMPORTANT: Change this password after first login!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_admin()







