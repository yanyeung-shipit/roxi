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
from pprint import pprint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Command-line document search tool')
    parser.add_argument('query', type=str, 
                        help='The search query')
    parser.add_argument('--threshold', type=float, default=0.3,
                        help='Similarity threshold for chunk retrieval (default: 0.3)')
    parser.add_argument('--top-k', type=int, default=5,
                        help='Number of top chunks to retrieve (default: 5)')
    parser.add_argument('--full-text', '-f', action='store_true',
                        help='Display full text of chunks (default: truncated)')
    parser.add_argument('--verbose', '-v', action='store_true', 
                        help='Enable verbose output')
    return parser.parse_args()

def main():
    """Main function for CLI search"""
    args = parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    try:
        # Import required functionality in context
        from app import app
        from utils.embeddings import search_similar_chunks
        from models import TextChunk
        
        # Get terminal width for proper formatting
        try:
            terminal_width = os.get_terminal_size().columns
        except (AttributeError, OSError):
            terminal_width = 80
        
        width = min(terminal_width, 100)  # Limit to 100 chars for readability
        
        # Run the query within Flask context
        with app.app_context():
            # Search for similar chunks
            logger.info(f"Searching for: '{args.query}'")
            similar_chunks = search_similar_chunks(
                args.query, top_k=args.top_k, similarity_threshold=args.threshold
            )
            
            if not similar_chunks:
                print(f"\nNo results found for query: '{args.query}'")
                print("Try a different query or lower the similarity threshold (--threshold option)")
                return
            
            logger.info(f"Found {len(similar_chunks)} similar chunks")
            
            # Get chunk texts and documents
            chunk_ids = [chunk_id for chunk_id, similarity in similar_chunks]
            similarities = {chunk_id: similarity for chunk_id, similarity in similar_chunks}
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            # Display results
            print("\n" + "="*width)
            print(f"Search Query: '{args.query}'")
            print("="*width)
            print(f"\nFound {len(chunks)} matching results above threshold {args.threshold}\n")
            
            # Sort chunks by similarity score
            chunks_with_similarity = [(chunk, similarities[chunk.id]) for chunk in chunks]
            chunks_with_similarity.sort(key=lambda x: x[1], reverse=True)
            
            for i, (chunk, similarity) in enumerate(chunks_with_similarity):
                doc = chunk.document
                
                # Print document information
                print(f"\nResult {i+1} - Similarity: {similarity:.4f}")
                print("-"*width)
                print(f"Document: {doc.title}")
                print(f"Authors: {doc.authors}")
                if doc.doi:
                    print(f"DOI: {doc.doi}")
                
                # Print chunk text, with optional full text
                if args.full_text:
                    print("\nText:")
                    print(textwrap.fill(chunk.text, width=width))
                else:
                    # Show a preview of the text
                    preview_length = 250
                    preview = chunk.text[:preview_length]
                    if len(chunk.text) > preview_length:
                        preview += "..."
                    print("\nPreview:")
                    print(textwrap.fill(preview, width=width))
                
                print("-"*width)
            
    except Exception as e:
        logger.exception(f"Error searching documents: {str(e)}")
        print(f"\nError: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Import os for terminal width detection
    import os
    main()