#!/usr/bin/env python
"""
Test script for retrieving ILD screening recommendations in scleroderma.

This script will:
1. Query the database for chunks related to ILD screening in scleroderma
2. Display the full text of the retrieved chunks
"""
import logging
import sys
import textwrap

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main function for ILD screening test"""
    # Import in context to access Flask application
    from app import app
    from utils.embeddings import search_similar_chunks
    from models import TextChunk, Document
    
    query = "What is the recommended screening approach for ILD in scleroderma?"
    
    with app.app_context():
        print("\n" + "="*80)
        print(f"QUERY: {query}")
        print("="*80 + "\n")
        
        # Search for similar chunks
        similar_chunks = search_similar_chunks(query, top_k=5, similarity_threshold=0.3)
        
        if not similar_chunks:
            print(f"No chunks found for query: {query}")
            return
            
        # Get the actual chunk objects
        chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
        chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
        
        # Print the chunk information with full text
        print(f"Found {len(chunks)} chunks:\n")
        for i, chunk in enumerate(chunks):
            doc = chunk.document
            sim_score = next((sim for cid, sim in similar_chunks if cid == chunk.id), 0)
            
            print(f"Chunk {i+1} - Similarity: {sim_score:.4f}")
            print(f"Document: {doc.title}")
            print(f"Authors: {doc.authors}")
            if doc.doi:
                print(f"DOI: {doc.doi}")
            print("\nFull Text:")
            print(textwrap.fill(chunk.text, width=80))
            print("-"*80)
    
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.exception(f"Error running ILD screening test: {str(e)}")
        sys.exit(1)