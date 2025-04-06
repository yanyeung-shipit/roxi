"""
Local backup utility for the ROXI application.
Creates a backup of essential code files and database schema.
"""

import os
import sys
import shutil
import datetime
import logging
import glob
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_backup():
    """Create a backup of essential code files"""
    # Get current timestamp for the backup filename
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = "backups"
    code_backup_dir = os.path.join(backup_dir, f"code_backup_{timestamp}")
    
    # Create backup directories if they don't exist
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        logger.info(f"Created backup directory: {backup_dir}")
    
    if not os.path.exists(code_backup_dir):
        os.makedirs(code_backup_dir)
    
    # Get the root directory of the project
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # List of essential files to backup
    essential_files = [
        "*.py",                     # Python files in root directory
        "routes/*.py",              # Route modules
        "utils/*.py",               # Utility modules
        "static/**/*.js",           # JavaScript files
        "static/**/*.css",          # CSS files
        "templates/**/*.html",      # HTML templates
        "requirements.txt",         # Dependencies
        "*.json",                   # JSON configuration files
    ]
    
    try:
        # Copy essential files
        for pattern in essential_files:
            for filepath in glob.glob(os.path.join(root_dir, pattern), recursive=True):
                # Get relative path to maintain directory structure
                relpath = os.path.relpath(filepath, root_dir)
                dest_path = os.path.join(code_backup_dir, relpath)
                
                # Create parent directories if needed
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                
                # Copy the file
                shutil.copy2(filepath, dest_path)
                logger.info(f"Backed up: {relpath}")
        
        # Create a summary file
        with open(os.path.join(code_backup_dir, "backup_info.txt"), "w") as f:
            f.write(f"ROXI Backup created on: {datetime.datetime.now()}\n")
            f.write(f"Backup includes essential code files and configurations\n")
        
        logger.info(f"Code backup created successfully: {code_backup_dir}")
        return code_backup_dir
    except Exception as e:
        logger.error(f"Error creating code backup: {str(e)}")
        return None

def create_database_schema_dump():
    """Create a dump of the database schema (not data)"""
    try:
        from app import app, db
        from sqlalchemy.schema import CreateTable
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = "backups"
        schema_filename = f"schema_backup_{timestamp}.sql"
        schema_path = os.path.join(backup_dir, schema_filename)
        
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        
        # Create a schema backup file
        with open(schema_path, 'w') as f:
            f.write("-- ROXI Database Schema Backup\n")
            f.write(f"-- Generated on: {datetime.datetime.now()}\n\n")
            
            # Get all tables
            with app.app_context():
                tables = db.metadata.tables
                
                # Write CREATE TABLE statements
                for table_name, table in tables.items():
                    create_stmt = str(CreateTable(table).compile(db.engine))
                    f.write(f"-- Table: {table_name}\n")
                    f.write(f"{create_stmt};\n\n")
        
        logger.info(f"Database schema backup created successfully: {schema_path}")
        return schema_path
    except Exception as e:
        logger.error(f"Error creating database schema backup: {str(e)}")
        return None

if __name__ == "__main__":
    print("Creating local backup of ROXI application...")
    
    # Create code backup
    backup_file = create_backup()
    if backup_file:
        print(f"✓ Code backup created: {backup_file}")
    else:
        print("✗ Failed to create code backup")
        sys.exit(1)
    
    # Create database schema dump
    schema_dump = create_database_schema_dump()
    if schema_dump:
        print(f"✓ Database schema backup created: {schema_dump}")
    else:
        print("✗ Failed to create database schema backup")
    
    print("\nBackup process completed!")
    print(f"Backup files stored in the 'backups' directory")