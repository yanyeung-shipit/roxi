"""
Production Fix for ROXI Application

This script fixes the issue with the text_chunk table's document_id constraint.
Run this script on the production server to resolve the 502 errors when crawling webpages.

Usage:
    python production_fix.py
"""
import sys
import os
import logging
from sqlalchemy import text, create_engine

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def fix_document_id_constraint(engine):
    """Make the document_id column nullable in the text_chunk table."""
    try:
        # Create a connection
        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Use PostgreSQL's ALTER TABLE to modify the column constraint
                query = text("""
                    ALTER TABLE text_chunk ALTER COLUMN document_id DROP NOT NULL;
                """)
                
                connection.execute(query)
                
        logger.info("Successfully made document_id nullable in text_chunk table")
        return True
    except Exception as e:
        logger.error(f"Error modifying document_id constraint: {e}")
        return False

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
        
        # Fix the document_id constraint
        success = fix_document_id_constraint(engine)
        
        if success:
            logger.info("Database schema migration completed successfully")
            logger.info("ROXI application should now be able to process webpages correctly.")
            return True
        else:
            logger.error("Failed to modify the document_id constraint")
            logger.error("The application may continue to experience errors with webpage processing.")
            return False
    
    except Exception as e:
        logger.exception(f"Unexpected error during migration: {e}")
        return False

if __name__ == "__main__":
    print("="*80)
    print("ROXI Production Fix - Text Chunk Constraint")
    print("="*80)
    print("This script will modify the database schema to fix the webpage crawling issue.")
    print("The application may need to be restarted after this fix is applied.")
    print("-"*80)
    
    # Ask for confirmation before proceeding
    confirm = input("Do you want to continue? (y/n): ")
    if confirm.lower() != 'y':
        print("Operation cancelled.")
        sys.exit(0)
    
    print("Applying fix...")
    success = main()
    sys.exit(0 if success else 1)