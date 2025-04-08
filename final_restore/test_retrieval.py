#!/usr/bin/env python
"""
Test script for retrieving relevant chunks without calling the OpenAI API.

This script will:
1. Accept a query as a command line argument
2. Find similar chunks based on the query
3. Display the chunks and their metadata

Usage:
    python test_retrieval.py "your query here"

Example:
    python test_retrieval.py "What is the treatment for ILD in scleroderma?"
"""
import argparse
import logging
import sys
from pprint import pprint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Test chunk retrieval for a query')
    parser.add_argument('query', type=str, 
                        help='The query to test')
    parser.add_argument('--threshold', type=float, default=0.3,
                        help='Similarity threshold for chunk retrieval (default: 0.3)')
    parser.add_argument('--top-k', type=int, default=5,
                        help='Number of top chunks to retrieve (default: 5)')
    parser.add_argument('--verbose', '-v', action='store_true', 
                        help='Enable verbose output')
    return parser.parse_args()

def main():
    """Main function to retrieve chunks for a query"""
    args = parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    try:
        # Import required functionality
        from app import app
        from utils.embeddings import search_similar_chunks
        from models import TextChunk
        
        # Run the query within the Flask app context
        with app.app_context():
            # Search for similar chunks
            logger.info(f"Processing query: '{args.query}'")
            similar_chunks = search_similar_chunks(
                args.query, top_k=args.top_k, similarity_threshold=args.threshold
            )
            
            if not similar_chunks:
                logger.warning("No similar chunks found for the query.")
                print("\nNo information found that matches your query. Please try a different question.")
                return
            
            logger.info(f"Found {len(similar_chunks)} similar chunks")
            
            # Get chunk texts and documents
            chunk_ids = [chunk_id for chunk_id, similarity in similar_chunks]
            similarities = {chunk_id: similarity for chunk_id, similarity in similar_chunks}
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            # Display results
            print("\n" + "="*80)
            print(f"QUERY: {args.query}")
            print("="*80)
            print(f"\nFound {len(chunks)} chunks with similarity above threshold {args.threshold}")
            print("-"*80)
            
            # Sort chunks by similarity score
            chunks_with_similarity = [(chunk, similarities[chunk.id]) for chunk in chunks]
            chunks_with_similarity.sort(key=lambda x: x[1], reverse=True)
            
            for i, (chunk, similarity) in enumerate(chunks_with_similarity):
                doc = chunk.document
                print(f"\n[{i+1}] Chunk ID: {chunk.id}, Similarity: {similarity:.4f}")
                print(f"Document: {doc.title}")
                print(f"Authors: {doc.authors}")
                if doc.doi:
                    print(f"DOI: {doc.doi}")
                print(f"Text: {chunk.text[:300]}{'...' if len(chunk.text) > 300 else ''}")
                print("-"*80)
            
    except Exception as e:
        logger.exception(f"Error retrieving chunks: {str(e)}")
        print(f"\nError: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()