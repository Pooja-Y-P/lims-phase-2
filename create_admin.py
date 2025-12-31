"""
Script to create an admin user with properly hashed password
Run this from the project root: python create_admin.py
"""
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from backend.db import SessionLocal
from backend.models.users import User
from backend.core.security import hash_password

def create_admin_user(email: str, password: str, full_name: str):
    """Create an admin user with hashed password"""
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"❌ User with email '{email}' already exists!")
            print(f"   User ID: {existing_user.user_id}")
            print(f"   Role: {existing_user.role}")
            print(f"   Active: {existing_user.is_active}")
            
            # Update password if user exists
            update = input("\n Do you want to update the password? (yes/no): ")
            if update.lower() == 'yes':
                existing_user.hashed_password = hash_password(password)
                existing_user.is_active = True
                db.commit()
                print(f"✅ Password updated for '{email}'")
            return
        
        # Create new admin user
        hashed_pw = hash_password(password)
        
        new_admin = User(
            email=email,
            username=email.split('@')[0],  # Use email prefix as username
            hashed_password=hashed_pw,
            full_name=full_name,
            role='admin',
            is_active=True,
            customer_id=None  # Admins don't have customer_id
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
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("  LIMS Admin User Creation")
    print("=" * 60)
    
    # Get user input
    email = input("\nEnter admin email: ").strip()
    password = input("Enter admin password: ").strip()
    full_name = input("Enter admin full name: ").strip()
    
    if not email or not password or not full_name:
        print("❌ All fields are required!")
        sys.exit(1)
    
    # Confirm
    print(f"\n📝 Creating admin user:")
    print(f"   Email: {email}")
    print(f"   Password: {'*' * len(password)}")
    print(f"   Full Name: {full_name}")
    
    confirm = input("\nProceed? (yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ Cancelled")
        sys.exit(0)
    
    create_admin_user(email, password, full_name)







