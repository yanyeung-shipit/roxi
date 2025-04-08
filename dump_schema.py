"""
Script to dump the database schema using SQLAlchemy.
This avoids PostgreSQL version mismatch issues with pg_dump.
"""
import os
import datetime
from sqlalchemy import create_engine, inspect, MetaData
from sqlalchemy.schema import CreateTable

# Get database URL from environment
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    print("Error: DATABASE_URL environment variable not set")
    exit(1)

# Create SQLAlchemy engine and connect
engine = create_engine(database_url)
inspector = inspect(engine)
metadata = MetaData()
metadata.reflect(bind=engine)

# Generate timestamp for the filename
timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
filename = f"pre_restore_schema_backup_{timestamp}.sql"

# Open file for writing
with open(filename, 'w') as f:
    f.write(f"-- Database schema dump created at {datetime.datetime.now()}\n")
    f.write(f"-- Database: {database_url.split('@')[-1].split('/')[1] if '@' in database_url else 'unknown'}\n\n")
    
    # Dump schema for each table
    for table_name in inspector.get_table_names():
        table = metadata.tables[table_name]
        create_table = str(CreateTable(table).compile(engine))
        f.write(f"-- Table: {table_name}\n")
        f.write(f"{create_table};\n\n")
        
        # Get column information
        columns = inspector.get_columns(table_name)
        f.write(f"-- Columns for {table_name}:\n")
        for column in columns:
            nullable = "NULL" if column['nullable'] else "NOT NULL"
            default = f"DEFAULT {column['default']}" if column['default'] else ""
            f.write(f"-- {column['name']} {column['type']} {nullable} {default}\n")
        
        # Get primary keys
        pk = inspector.get_pk_constraint(table_name)
        if pk['constrained_columns']:
            f.write(f"-- Primary Key: {', '.join(pk['constrained_columns'])}\n")
        
        # Get foreign keys
        fks = inspector.get_foreign_keys(table_name)
        if fks:
            f.write("-- Foreign Keys:\n")
            for fk in fks:
                f.write(f"-- {', '.join(fk['constrained_columns'])} -> {fk['referred_table']}.{', '.join(fk['referred_columns'])}\n")
        
        # Get indexes
        indexes = inspector.get_indexes(table_name)
        if indexes:
            f.write("-- Indexes:\n")
            for index in indexes:
                unique = "UNIQUE " if index['unique'] else ""
                f.write(f"-- {index['name']}: {unique}({', '.join(index['column_names'])})\n")
        
        f.write("\n\n")

print(f"Schema backup created: {filename}")