"""
Test script to verify webpage crawling functionality.
"""
import os
import sys
import logging
from flask import Flask
from app import app, db
from models import Webpage, TextChunk, WebpageProcessingQueue
from utils.webpage_processor import crawl_webpage, process_webpage

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def test_crawl():
    """Test crawling a webpage"""
    # Test URL - use a valid URL
    test_url = "https://rheumatology.org/about"
    
    with app.app_context():
        # First, check if the webpage already exists
        existing = Webpage.query.filter_by(url=test_url).first()
        if existing:
            logger.info(f"Webpage already exists with ID: {existing.id}")
            # Check if it has chunks
            chunk_count = TextChunk.query.filter_by(webpage_id=existing.id).count()
            logger.info(f"Webpage has {chunk_count} chunks")
            
            # If it's partially processed, we can delete it and start over
            if not existing.processed:
                logger.info(f"Deleting partially processed webpage {existing.id}")
                # Delete any queue entries
                WebpageProcessingQueue.query.filter_by(webpage_id=existing.id).delete()
                # Delete any chunks
                TextChunk.query.filter_by(webpage_id=existing.id).delete()
                # Delete the webpage
                db.session.delete(existing)
                db.session.commit()
                logger.info("Partially processed webpage deleted")
            else:
                logger.info("Webpage already fully processed")
                return
        
        # Try to crawl the webpage
        success, message, webpage_id = crawl_webpage(test_url)
        
        if success:
            logger.info(f"Successfully initiated crawl for {test_url} with ID: {webpage_id}")
        else:
            if webpage_id:
                # If it returned a webpage ID despite "failure", it might mean the webpage already exists
                logger.info(f"Webpage already exists with ID: {webpage_id}")
                # Try to process it directly
                process_result = process_webpage(webpage_id)
                logger.info(f"Direct processing result: {process_result}")
            else:
                logger.error(f"Failed to crawl webpage: {message}")

if __name__ == "__main__":
    with app.app_context():
        test_crawl()