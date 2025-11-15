import bcrypt
password = b"1"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed.decode())