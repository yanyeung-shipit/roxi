#!/usr/bin/env python
"""
Utility script to regenerate all document embeddings with the improved algorithm.

This script will:
1. Delete all existing embeddings
2. Regenerate embeddings for all text chunks using the improved algorithm
3. Report statistics on the process

Usage:
    python regenerate_embeddings.py

Note: This script needs to be run in the Flask application context
"""
import argparse
import logging
from datetime import datetime
from flask import current_app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Regenerate all document embeddings')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose output')
    return parser.parse_args()

def main():
    """Main function to regenerate all embeddings"""
    args = parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    start_time = datetime.now()
    logger.info(f"Starting embedding regeneration at {start_time}")
    
    try:
        # Import here to ensure Flask app context is available
        from app import app
        from utils.embeddings import regenerate_all_embeddings
        
        # Run inside Flask app context
        with app.app_context():
            logger.info("Starting regeneration process...")
            results = regenerate_all_embeddings()
            
            if 'error' in results:
                logger.error(f"Error regenerating embeddings: {results['error']}")
            else:
                logger.info(f"Successfully regenerated {results.get('success', 0)} embeddings")
                logger.info(f"Statistics: {results}")
    
    except Exception as e:
        logger.exception(f"Error regenerating embeddings: {str(e)}")
    
    end_time = datetime.now()
    duration = end_time - start_time
    logger.info(f"Completed embedding regeneration at {end_time}")
    logger.info(f"Total duration: {duration}")

if __name__ == "__main__":
    main()