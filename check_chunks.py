"""
Script to check if text chunks were properly created for the webpage.
"""
import os
import sys
import logging
from app import app, db
from models import Webpage, TextChunk

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def check_chunks():
    """Check if chunks were created for webpages"""
    with app.app_context():
        # Get all webpages
        webpages = Webpage.query.all()
        
        if not webpages:
            logger.info("No webpages found in the database")
            return
        
        logger.info(f"Found {len(webpages)} webpages in the database")
        
        for webpage in webpages:
            # Count chunks
            chunk_count = TextChunk.query.filter_by(webpage_id=webpage.id).count()
            
            logger.info(f"Webpage {webpage.id} ({webpage.url[:50]}...) has {chunk_count} chunks")
            
            # Show a sample chunk if available
            if chunk_count > 0:
                sample_chunk = TextChunk.query.filter_by(webpage_id=webpage.id).first()
                logger.info(f"Sample chunk text: {sample_chunk.text[:100]}...")

if __name__ == "__main__":
    check_chunks()