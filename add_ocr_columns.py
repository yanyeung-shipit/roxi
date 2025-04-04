"""
Script to add OCR-related columns to the document table
"""
import os
import sys
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable is not set.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

# List of columns to add
columns_to_add = [
    "text_extraction_quality VARCHAR(20) DEFAULT 'normal'",
    "ocr_status VARCHAR(20)",
    "ocr_requested_at TIMESTAMP WITHOUT TIME ZONE",
    "ocr_completed_at TIMESTAMP WITHOUT TIME ZONE",
    "ocr_error TEXT"
]

# Connect to the database and add the columns
with engine.connect() as conn:
    for column_def in columns_to_add:
        column_name = column_def.split()[0]
        
        # Check if the column already exists
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'document' AND column_name = :column_name"
        ), {"column_name": column_name})
        
        if result.fetchone() is None:
            # Add the column if it doesn't exist
            print(f"Adding column: {column_name}")
            conn.execute(text(f"ALTER TABLE document ADD COLUMN {column_def}"))
        else:
            print(f"Column {column_name} already exists, skipping.")
    
    # Commit the transaction
    conn.commit()

print("Database update completed successfully.")