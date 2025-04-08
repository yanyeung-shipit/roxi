"""
Database migration script to add the webpage_id column to the text_chunk table if it doesn't exist.
"""
import sys
import os
import logging
from sqlalchemy import Column, Integer, text, create_engine, ForeignKey, MetaData, Table
from sqlalchemy.sql import select
from sqlalchemy.exc import OperationalError, ProgrammingError

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def check_column_exists(engine, table_name, column_name):
    """Check if a column exists in a table."""
    try:
        # Create a connection
        with engine.connect() as connection:
            # Use PostgreSQL's information_schema to check if the column exists
            query = text("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                    AND column_name = :column_name
                );
            """)
            
            result = connection.execute(query, {"table_name": table_name, "column_name": column_name})
            return result.scalar()
    except Exception as e:
        logger.error(f"Error checking if column exists: {e}")
        return False

def add_column_to_table(engine, table_name, column_name, column_type, nullable=True, foreign_key=None):
    """Add a column to a table."""
    try:
        # Prepare the ALTER TABLE statement
        if foreign_key:
            # For foreign key columns
            alter_stmt = text(f"""
                ALTER TABLE {table_name}
                ADD COLUMN {column_name} {column_type} {"NOT NULL" if not nullable else "NULL"} REFERENCES {foreign_key[0]} ({foreign_key[1]});
            """)
        else:
            # For regular columns
            alter_stmt = text(f"""
                ALTER TABLE {table_name}
                ADD COLUMN {column_name} {column_type} {"NOT NULL" if not nullable else "NULL"};
            """)
        
        with engine.connect() as connection:
            connection.execute(alter_stmt)
            connection.commit()
        
        logger.info(f"Added column {column_name} to table {table_name}")
        return True
    except Exception as e:
        logger.error(f"Error adding column to table: {e}")
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
        
        # Check if the webpage_id column exists in the text_chunk table
        column_exists = check_column_exists(engine, "text_chunk", "webpage_id")
        
        if not column_exists:
            logger.info("The webpage_id column does not exist in the text_chunk table. Adding it now...")
            
            # Add the webpage_id column to the text_chunk table
            add_column_to_table(
                engine,
                "text_chunk",
                "webpage_id",
                "INTEGER",
                nullable=True,
                foreign_key=("webpage", "id")
            )
            logger.info("Successfully added webpage_id column to text_chunk table")
        else:
            logger.info("The webpage_id column already exists in the text_chunk table")
            
        logger.info("Database schema migration completed successfully")
        return True
    
    except Exception as e:
        logger.error(f"Migration error: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)