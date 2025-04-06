#!/usr/bin/env python
"""
Test script for making a direct query to the RAG system and displaying the full output.

This script will:
1. Accept a query as a command line argument
2. Send the query directly to the system without going through the API
3. Display the full response and citations

Usage:
    python test_rag.py "your query here"

Example:
    python test_rag.py "What is the treatment for ILD in scleroderma?"
"""
import argparse
import logging
import sys
import json
from pprint import pprint
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Test the RAG system with a direct query')
    parser.add_argument('query', type=str, 
                        help='The query to test with the RAG system')
    parser.add_argument('--threshold', type=float, default=0.3,
                        help='Similarity threshold for chunk retrieval (default: 0.3)')
    parser.add_argument('--top-k', type=int, default=5,
                        help='Number of top chunks to retrieve (default: 5)')
    parser.add_argument('--verbose', '-v', action='store_true', 
                        help='Enable verbose output')
    return parser.parse_args()

def main():
    """Main function to run a direct RAG query"""
    args = parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    try:
        # Import required functionality
        from app import app, db
        from utils.embeddings import search_similar_chunks
        from utils.citation_generator import format_citation_for_response
        from utils.openai_utils import generate_answer_with_gpt
        from models import TextChunk, QueryHistory
        import uuid
        
        # Generate a new conversation ID
        conversation_id = f"test_{uuid.uuid4().hex[:8]}"
        
        # Run the query within the Flask app context
        with app.app_context():
            # Step 1: Search for similar chunks
            logger.info(f"Processing query: '{args.query}'")
            similar_chunks = search_similar_chunks(
                args.query, top_k=args.top_k, similarity_threshold=args.threshold
            )
            
            if not similar_chunks:
                logger.warning("No similar chunks found for the query.")
                print("\nNo information found that matches your query. Please try a different question.")
                return
            
            logger.info(f"Found {len(similar_chunks)} similar chunks")
            
            # Step 2: Get chunk texts and documents
            citations = []
            chunks = []
            
            chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            # Prepare citations
            for chunk in chunks:
                doc = chunk.document
                citation = format_citation_for_response(
                    doc.citation_apa or "Citation not available",
                    doc.id,
                    chunk.id
                )
                # Add additional fields
                citation['title'] = doc.title
                citation['authors'] = doc.authors
                citation['journal'] = doc.journal
                citation['doi'] = doc.doi
                citation['snippet'] = chunk.text[:150] + "..." if len(chunk.text) > 150 else chunk.text
                citations.append(citation)
            
            # Step 3: Generate response using GPT
            if chunks:
                logger.info(f"Generating answer with GPT for query: {args.query}")
                response_text = generate_answer_with_gpt(args.query, chunks)
            else:
                response_text = "No relevant information found. Please try a different query."
            
            # Step 4: Store the query history
            query_history = QueryHistory(
                query_text=args.query,
                response=response_text,
                citations=citations,
                conversation_id=conversation_id
            )
            db.session.add(query_history)
            db.session.commit()
            
            # Step 5: Display the response
            print("\n" + "="*80)
            print(f"QUERY: {args.query}")
            print("="*80)
            print("\nRESPONSE:")
            print("-"*80)
            print(response_text)
            print("\n" + "="*80)
            print("CITATIONS:")
            print("-"*80)
            
            for i, citation in enumerate(citations):
                print(f"\n[{i+1}] {citation['title']}")
                print(f"    Authors: {citation['authors']}")
                if citation.get('journal'):
                    print(f"    Journal: {citation['journal']}")
                if citation.get('doi'):
                    print(f"    DOI: {citation['doi']}")
                print(f"    Snippet: {citation['snippet']}")
            
            print("\n" + "="*80)
            
    except Exception as e:
        logger.exception(f"Error in RAG system: {str(e)}")
        print(f"\nError: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()