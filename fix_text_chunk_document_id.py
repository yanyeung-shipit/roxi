"""
Database migration script to ensure document_id in text_chunk is nullable.

This script addresses an issue where text chunks for webpages would fail to be created
due to a NOT NULL constraint on the document_id column in the text_chunk table.

Run this script to ensure the database schema is properly configured to allow
NULL values for the document_id column.
"""
import sys
import os
import logging
from sqlalchemy import text, create_engine

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def main():
    try:
        # Get database URL from environment variable
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            logger.error("DATABASE_URL environment variable is not set")
            sys.exit(1)
        
        # Handle Render's postgres vs postgresql prefix for SQLAlchemy
        if database_url and database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        
        # Create SQLAlchemy engine
        engine = create_engine(database_url)
        
        # Check if document_id column allows NULL values
        with engine.connect() as connection:
            # Check if column is nullable
            query = text("""
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_name = 'text_chunk'
                AND column_name = 'document_id';
            """)
            
            result = connection.execute(query)
            is_nullable = result.scalar()
            
            if is_nullable == 'NO':
                logger.info("The document_id column does not allow NULL values. Fixing now...")
                
                # Alter the table to make document_id nullable
                alter_query = text("ALTER TABLE text_chunk ALTER COLUMN document_id DROP NOT NULL;")
                connection.execute(alter_query)
                connection.commit()
                
                logger.info("Successfully altered document_id column to allow NULL values")
            else:
                logger.info("The document_id column already allows NULL values")
            
        logger.info("Database schema migration completed successfully")
        return True
    
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        return False

if __name__ == "__main__":
    main()