import logging
import numpy as np
from models import TextChunk, VectorEmbedding

logger = logging.getLogger(__name__)

def get_embedding_model():
    """
    Get or initialize the sentence embedding model
    
    Returns:
        SentenceTransformer: The embedding model
    """
    try:
        # Import here to avoid loading at module level
        from sentence_transformers import SentenceTransformer
        
        # Initialize model
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        return model
    
    except Exception as e:
        logger.error(f"Error loading embedding model: {str(e)}")
        return None

def generate_embeddings(text):
    """
    Generate vector embeddings for a text chunk
    
    Args:
        text (str): The text to generate embeddings for
        
    Returns:
        list: Vector embedding as a list of floats, or None if generation failed
    """
    if not text:
        return None
    
    try:
        model = get_embedding_model()
        if model is None:
            logger.error("Embedding model could not be loaded")
            return None
        
        # Generate embedding
        embedding = model.encode(text)
        
        # Convert to native Python list for storage
        embedding_list = embedding.tolist()
        
        logger.info(f"Generated embedding with {len(embedding_list)} dimensions")
        return embedding_list
    
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return None

def search_similar_chunks(query_text, top_k=5):
    """
    Search for text chunks similar to the query
    
    Args:
        query_text (str): The query text to find similar chunks for
        top_k (int): Number of top results to return
        
    Returns:
        list: List of (chunk_id, similarity_score) tuples
    """
    try:
        # Generate query embedding
        query_embedding = generate_embeddings(query_text)
        if not query_embedding:
            logger.error("Failed to generate query embedding")
            return []
        
        # Convert to numpy array
        query_vector = np.array(query_embedding)
        
        # Get all embeddings from database
        results = []
        
        # This is not scalable for large databases, but simple for demonstration
        # In production, use a vector database or more efficient search
        embeddings = VectorEmbedding.query.all()
        
        for embedding_obj in embeddings:
            if not embedding_obj.embedding:
                continue
            
            # Convert stored embedding to numpy array
            stored_vector = np.array(embedding_obj.embedding)
            
            # Calculate similarity
            similarity = cosine_similarity(query_vector, stored_vector)
            
            results.append((embedding_obj.chunk_id, similarity))
        
        # Sort by similarity (highest first) and take top_k
        results.sort(key=lambda x: x[1], reverse=True)
        top_results = results[:top_k]
        
        logger.info(f"Found {len(top_results)} similar chunks for query")
        return top_results
    
    except Exception as e:
        logger.error(f"Error searching similar chunks: {str(e)}")
        return []

def cosine_similarity(a, b):
    """
    Calculate cosine similarity between two vectors
    
    Args:
        a (numpy.ndarray): First vector
        b (numpy.ndarray): Second vector
        
    Returns:
        float: Cosine similarity between vectors a and b
    """
    # Handle zero vectors
    if np.all(a == 0) or np.all(b == 0):
        return 0.0
    
    # Calculate cosine similarity
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    similarity = dot_product / (norm_a * norm_b)
    
    return float(similarity)