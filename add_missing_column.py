from backend.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE srfs ADD COLUMN IF NOT EXISTS certificate_issue_adress TEXT'))
    conn.commit()
    print('Column certificate_issue_adress added successfully')

