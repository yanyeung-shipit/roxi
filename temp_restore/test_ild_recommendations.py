#!/usr/bin/env python
"""
Test script for retrieving information about ILD screening and treatment in scleroderma.

This script will:
1. Query the database for chunks related to ILD screening and treatment
2. Generate a comprehensive response about the recommendations
3. Display both the chunks and the generated response

Usage:
    python test_ild_recommendations.py
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
    """Main function for ILD recommendations test"""
    # Import in context to access Flask application
    from app import app
    from utils.embeddings import search_similar_chunks
    from utils.openai_utils import generate_answer_with_gpt
    from models import TextChunk, Document
    
    # Define specific queries about ILD screening and treatment
    queries = [
        "What is the recommended screening approach for ILD in scleroderma?",
        "What are the treatment options for systemic sclerosis-associated ILD?",
        "How should patients with subclinical ILD in scleroderma be managed?"
    ]
    
    with app.app_context():
        for query in queries:
            print("\n" + "="*80)
            print(f"QUERY: {query}")
            print("="*80 + "\n")
            
            # Search for similar chunks
            similar_chunks = search_similar_chunks(query, top_k=5, similarity_threshold=0.3)
            
            if not similar_chunks:
                print(f"No chunks found for query: {query}")
                continue
                
            # Get the actual chunk objects
            chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            # Print the chunk information
            print(f"Found {len(chunks)} chunks:\n")
            for i, chunk in enumerate(chunks):
                doc = chunk.document
                sim_score = next((sim for cid, sim in similar_chunks if cid == chunk.id), 0)
                
                print(f"Chunk {i+1} - Similarity: {sim_score:.4f}")
                print(f"Document: {doc.title}")
                print(f"Authors: {doc.authors}")
                if doc.doi:
                    print(f"DOI: {doc.doi}")
                print("\nPreview:")
                preview = chunk.text[:200] + "..." if len(chunk.text) > 200 else chunk.text
                print(textwrap.fill(preview, width=80))
                print("-"*80)
            
            # Generate and print the answer
            if chunks:
                print("\nGenerated Answer:\n")
                answer = generate_answer_with_gpt(query, chunks)
                print(textwrap.fill(answer, width=80))
                print("\n" + "="*80)
    
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.exception(f"Error running ILD recommendations test: {str(e)}")
        sys.exit(1)