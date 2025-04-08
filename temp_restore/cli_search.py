#!/usr/bin/env python
"""
CLI tool for document retrieval

This script will:
1. Accept a search query as a command line argument
2. Find similar chunks based on the query
3. Display the results in a readable format

Usage:
    python cli_search.py "your search query"

Example:
    python cli_search.py "What is the recommendation for ILD screening in scleroderma?"
"""
import argparse
import logging
import sys
import textwrap

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='CLI search tool for document retrieval')
    parser.add_argument('query', type=str, help='Search query')
    parser.add_argument('--top-k', type=int, default=5, help='Number of chunks to retrieve (default: 5)')
    parser.add_argument('--threshold', type=float, default=0.3, help='Similarity threshold (default: 0.3)')
    parser.add_argument('--full-text', action='store_true', help='Show full text of chunks (default: show preview)')
    return parser.parse_args()

def main():
    """Main function for CLI search"""
    args = parse_args()
    
    # Import in function to avoid import errors outside Flask context
    from app import app
    from utils.embeddings import search_similar_chunks
    from models import TextChunk, Document
    
    with app.app_context():
        # Search for similar chunks
        print(f"\nSearching for: \"{args.query}\"")
        similar_chunks = search_similar_chunks(args.query, top_k=args.top_k, similarity_threshold=args.threshold)
        
        if not similar_chunks:
            print("No relevant chunks found for your query.")
            return 1
            
        # Get the chunk objects and sort by similarity
        chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
        similarities = {chunk_id: sim for chunk_id, sim in similar_chunks}
        chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
        
        # Sort chunks by similarity (highest first)
        chunks_with_scores = [(chunk, similarities.get(chunk.id, 0)) for chunk in chunks]
        chunks_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Print the results
        print(f"\nFound {len(chunks)} relevant chunks:\n")
        for i, (chunk, score) in enumerate(chunks_with_scores):
            doc = chunk.document
            
            print(f"Result {i+1} - Similarity: {score:.4f}")
            print(f"Document: {doc.title}")
            print(f"Authors: {doc.authors}")
            if doc.doi:
                print(f"DOI: {doc.doi}")
            if doc.publication_date:
                print(f"Published: {doc.publication_date.strftime('%Y-%m-%d')}")
            print(f"Page: {chunk.page_num if chunk.page_num else 'Unknown'}")
            
            print("\nContent:")
            if args.full_text:
                # Show full text wrapped at 80 chars
                print(textwrap.fill(chunk.text, width=80))
            else:
                # Show preview (first 200 chars)
                preview = chunk.text[:200] + "..." if len(chunk.text) > 200 else chunk.text
                print(textwrap.fill(preview, width=80))
            print("-" * 80)
        
        return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nSearch canceled.")
        sys.exit(130)
    except Exception as e:
        logger.exception(f"Error running search: {str(e)}")
        sys.exit(1)