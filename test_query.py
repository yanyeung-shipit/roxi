#!/usr/bin/env python
"""
Test script for querying the system with a test query, useful for debugging.

This script will:
1. Regenerate all embeddings if requested
2. Make a test query to verify the system
3. Output the results including similarity scores and chunks retrieved

Usage:
    python test_query.py [--regenerate-embeddings] [--query "your test query"]

Example:
    python test_query.py --query "What is the treatment for ILD in scleroderma?"
"""
import argparse
import logging
import sys
from pprint import pprint
from flask import jsonify

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Test the query system')
    parser.add_argument('--regenerate-embeddings', action='store_true', 
                        help='Regenerate embeddings before testing')
    parser.add_argument('--query', type=str, required=True,
                        help='The test query to use')
    parser.add_argument('--threshold', type=float, default=0.3,
                        help='Similarity threshold for chunk retrieval (default: 0.3)')
    parser.add_argument('--verbose', '-v', action='store_true', 
                        help='Enable verbose output')
    return parser.parse_args()

def main():
    """Main function to run a test query"""
    args = parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    try:
        # Import here to ensure Flask app context is available
        from app import app
        from utils.embeddings import regenerate_all_embeddings, search_similar_chunks
        from models import TextChunk
        
        # Run inside Flask app context
        with app.app_context():
            # Regenerate embeddings if requested
            if args.regenerate_embeddings:
                logger.info("Regenerating embeddings...")
                results = regenerate_all_embeddings()
                logger.info(f"Regeneration complete: {results}")
            
            # Run the test query
            logger.info(f"Testing query: '{args.query}' with threshold {args.threshold}")
            similar_chunks = search_similar_chunks(args.query, top_k=5, similarity_threshold=args.threshold)
            
            if not similar_chunks:
                logger.warning("No similar chunks found for the query.")
                return
            
            logger.info(f"Found {len(similar_chunks)} similar chunks")
            
            # Get the full chunks
            chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            # Output results
            print("\n----- TEST QUERY RESULTS -----")
            print(f"Query: '{args.query}'")
            print(f"Threshold: {args.threshold}")
            print(f"Found {len(chunks)} chunks")
            print("\n----- SIMILARITY SCORES -----")
            
            # Create a mapping for chunks
            chunk_map = {chunk.id: chunk for chunk in chunks}
            
            # Print similarity scores and chunk information
            for i, (chunk_id, similarity) in enumerate(similar_chunks):
                chunk = chunk_map.get(chunk_id)
                if chunk:
                    doc = chunk.document
                    print(f"\n--- Chunk {i+1} (ID: {chunk_id}, Score: {similarity:.4f}) ---")
                    print(f"Document: {doc.title or 'Untitled'}")
                    print(f"Authors: {doc.authors or 'Unknown'}")
                    print("Text snippet:")
                    print(f"{chunk.text[:300]}...")  # Show first 300 chars
    
    except Exception as e:
        logger.exception(f"Error testing query: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()