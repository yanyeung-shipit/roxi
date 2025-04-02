"""
Database recreation script to add the parent_id column to the collection table.
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
    # Recreate tables without data
    print("Dropping collection table...")
    session.execute(text("DROP TABLE IF EXISTS collection CASCADE"))
    
    # Commit changes
    session.commit()
    print("Done! You can now restart the application to recreate the tables.")
    
except Exception as e:
    print(f"Error: {e}")
    session.rollback()
finally:
    session.close()