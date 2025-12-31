"""
Generate a bcrypt password hash
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

password = input("Enter password to hash: ")
hashed = pwd_context.hash(password)

print(f"\nBcrypt Hash:\n{hashed}")
print(f"\nSQL to insert admin user:")
print(f"""
INSERT INTO users (email, username, hashed_password, full_name, role, is_active)
VALUES (
    'admin@example.com',
    'admin',
    '{hashed}',
    'Admin User',
    'admin',
    true
);
""")







