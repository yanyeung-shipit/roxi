"""
Utility script to clean <scp> tags and other formatting artifacts from document titles and text.
This script will:
1. Find all documents with <scp> tags in their titles
2. Clean the tags from the titles
3. Update the database records
"""

import re
import logging
from app import app, db
from models import Document
from utils.pdf_processor import clean_text

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_document_titles():
    """Find and clean documents with formatting tags in their titles"""
    with app.app_context():
        # Find documents with <scp> tags in titles
        documents_with_tags = Document.query.filter(
            Document.title.like('%<scp>%')
        ).all()
        
        logger.info(f"Found {len(documents_with_tags)} documents with <scp> tags in their titles")
        
        # Process each document
        for document in documents_with_tags:
            old_title = document.title
            new_title = clean_text(old_title)
            
            if old_title != new_title:
                document.title = new_title
                logger.info(f"Cleaned title for document {document.id}: {old_title} -> {new_title}")
        
        # Commit changes if any were made
        if documents_with_tags:
            db.session.commit()
            logger.info(f"Successfully updated {len(documents_with_tags)} document titles")
        else:
            logger.info("No documents needed updates")

def clean_all_document_content():
    """Clean all document content to remove any formatting tags"""
    with app.app_context():
        # Get all documents
        documents = Document.query.all()
        
        logger.info(f"Checking {len(documents)} documents for content cleaning")
        
        # Track number of documents updated
        updated_count = 0
        
        # Process each document
        for document in documents:
            if document.full_text and ('<' in document.full_text and '>' in document.full_text):
                old_text = document.full_text
                new_text = clean_text(old_text)
                
                if old_text != new_text:
                    document.full_text = new_text
                    updated_count += 1
        
        # Commit changes if any were made
        if updated_count > 0:
            db.session.commit()
            logger.info(f"Successfully cleaned content in {updated_count} documents")
        else:
            logger.info("No document content needed cleaning")

if __name__ == "__main__":
    logger.info("Starting to clean <scp> tags from document titles and content")
    clean_document_titles()
    clean_all_document_content()
    logger.info("Completed cleaning process")