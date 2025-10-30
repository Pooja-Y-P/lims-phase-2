import bcrypt
password = b"1234"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed.decode())