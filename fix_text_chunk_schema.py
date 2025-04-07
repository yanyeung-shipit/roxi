"""
Database migration script to modify the text_chunk table's document_id to allow NULL values.
"""
import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Create a connection to the database
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL environment variable not set")
    sys.exit(1)

# Create engine and session
engine = create_engine(db_url)
Session = sessionmaker(bind=engine)
session = Session()

try:
    # Alter the text_chunk table to allow NULL values for document_id
    print("Altering text_chunk table to allow NULL values for document_id...")
    session.execute(text("ALTER TABLE text_chunk ALTER COLUMN document_id DROP NOT NULL"))
    
    # Commit changes
    session.commit()
    print("Done! The text_chunk table has been updated to allow NULL document_id values.")
    
except Exception as e:
    print(f"Error: {e}")
    session.rollback()
finally:
    session.close()