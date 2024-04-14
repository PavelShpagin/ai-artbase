import re
from database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
def extract_username(email):
    pattern = r'^([^@]+)@'
    match = re.match(pattern, email)
    if match:
        return match.group(1)
    else:
        return None