#!/usr/bin/env python
"""
Comprehensive ILD Test Script

This script will:
1. Generate a series of detailed queries about ILD in scleroderma
2. Create a summary of retrieval and response quality
3. Output debug information for system improvement

Usage:
    python test_comprehensive_ild.py
"""
import logging
import sys
import textwrap
import time
from pprint import pprint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main function for comprehensive ILD testing"""
    # Import in context to access Flask application
    from app import app
    from utils.embeddings import search_similar_chunks
    from utils.openai_utils import generate_answer_with_gpt
    from models import TextChunk, Document
    
    # Define test queries covering different aspects of ILD
    test_queries = [
        "What is the recommended screening approach for ILD in scleroderma?",
        "What are the first-line treatment options for SSc-ILD?",
        "How should subclinical ILD in scleroderma be managed?",
        "What is the role of tocilizumab in scleroderma-associated ILD?",
        "What is the role of nintedanib in scleroderma-associated ILD?"
    ]
    
    # Results storage
    results = {}
    
    with app.app_context():
        for query in test_queries:
            print(f"\nProcessing query: {query}")
            start_time = time.time()
            
            # Search for similar chunks
            similar_chunks = search_similar_chunks(query, top_k=5, similarity_threshold=0.3)
            retrieval_time = time.time() - start_time
            
            if not similar_chunks:
                print(f"No chunks found for query: {query}")
                results[query] = {
                    "success": False,
                    "retrieval_time": retrieval_time,
                    "chunks_found": 0,
                    "reason": "No chunks found"
                }
                continue
                
            # Get the actual chunk objects
            chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
            similarities = {chunk_id: sim for chunk_id, sim in similar_chunks}
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            # Print the similarity scores
            chunks_with_scores = [(chunk, similarities.get(chunk.id, 0)) for chunk in chunks]
            chunks_with_scores.sort(key=lambda x: x[1], reverse=True)
            
            print(f"Found {len(chunks)} chunks with average similarity: {sum(similarities.values())/len(similarities):.4f}")
            for i, (chunk, score) in enumerate(chunks_with_scores):
                print(f"  Chunk {i+1}: Similarity {score:.4f}")
            
            # Generate answer if chunks were found
            if chunks:
                print("Generating answer...")
                answer_start = time.time()
                answer = generate_answer_with_gpt(query, chunks)
                answer_time = time.time() - answer_start
                total_time = time.time() - start_time
                
                # Store results for this query
                results[query] = {
                    "success": True,
                    "retrieval_time": retrieval_time,
                    "answer_time": answer_time,
                    "total_time": total_time,
                    "chunks_found": len(chunks),
                    "avg_similarity": sum(similarities.values())/len(similarities),
                    "answer_length": len(answer),
                    "answer_preview": answer[:100] + "..." if len(answer) > 100 else answer
                }
                
                print(f"Answer generated in {answer_time:.2f} seconds, {len(answer)} characters")
            else:
                results[query] = {
                    "success": False,
                    "retrieval_time": retrieval_time,
                    "chunks_found": 0,
                    "reason": "No chunks found"
                }
        
        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        success_count = sum(1 for r in results.values() if r.get("success", False))
        print(f"Queries tested: {len(test_queries)}")
        print(f"Successful retrievals: {success_count}/{len(test_queries)}")
        
        if success_count > 0:
            avg_retrieval = sum(r["retrieval_time"] for r in results.values() if r.get("success", False)) / success_count
            print(f"Average retrieval time: {avg_retrieval:.2f} seconds")
            
            avg_chunks = sum(r["chunks_found"] for r in results.values() if r.get("success", False)) / success_count
            print(f"Average chunks retrieved: {avg_chunks:.1f}")
            
            if all("answer_time" in r for r in results.values() if r.get("success", False)):
                avg_answer = sum(r["answer_time"] for r in results.values() if r.get("success", False)) / success_count
                print(f"Average answer generation time: {avg_answer:.2f} seconds")
        
        print("\nIndividual Query Results:")
        for i, (query, result) in enumerate(results.items()):
            print(f"\n{i+1}. {query}")
            if result.get("success", False):
                print(f"   Status: Success")
                print(f"   Chunks: {result['chunks_found']}")
                print(f"   Avg. Similarity: {result['avg_similarity']:.4f}")
                print(f"   Answer Preview: {result['answer_preview']}")
            else:
                print(f"   Status: Failed - {result.get('reason', 'Unknown error')}")
    
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.exception(f"Error running comprehensive ILD test: {str(e)}")
        sys.exit(1)