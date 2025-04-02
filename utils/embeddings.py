import logging
import numpy as np
from flask import current_app
from sqlalchemy import text

from app import db
from models import TextChunk, VectorEmbedding

logger = logging.getLogger(__name__)

# Global embedding model instance
_embedding_model = None

def get_embedding_model():
    """
    Get or initialize the embedding model
    
    Returns:
        object: The embedding model
    """
    # Since we can't install sentence-transformers in this environment, 
    # we'll use a simple numpy-based solution for demonstration purposes
    global _embedding_model
    
    if _embedding_model is None:
        _embedding_model = SimpleEmbedder()
    
    return _embedding_model

class SimpleEmbedder:
    """Simple embedder that uses a deterministic algorithm for demonstration purposes"""
    
    def __init__(self, vector_size=128):
        self.vector_size = vector_size
    
    def encode(self, text, normalize=True):
        """
        Convert text to a vector using a simple hashing approach
        
        Args:
            text (str): Text to encode
            normalize (bool): Whether to normalize the vector
            
        Returns:
            np.ndarray: Embedding vector
        """
        if not text:
            return np.zeros(self.vector_size)
        
        # Initialize a vector
        vector = np.zeros(self.vector_size, dtype=np.float32)
        
        # Simple hash-based embedding (for demonstration only)
        for i, char in enumerate(text):
            vector[i % self.vector_size] += ord(char) / 128.0
        
        # Normalize the vector
        if normalize and np.sum(np.abs(vector)) > 0:
            vector = vector / np.linalg.norm(vector)
        
        return vector

def generate_embeddings(text):
    """
    Generate vector embeddings for a text chunk
    
    Args:
        text (str): The text to generate embeddings for
        
    Returns:
        list: Vector embedding as a list of floats, or None if generation failed
    """
    try:
        if not text:
            return None
        
        # Get the embedding model
        model = get_embedding_model()
        
        # Generate embeddings
        embedding = model.encode(text)
        
        # Convert to Python list for database storage
        return embedding.tolist()
    
    except Exception as e:
        logger.exception(f"Error generating embeddings: {str(e)}")
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
        model = get_embedding_model()
        query_embedding = model.encode(query_text)
        
        # Get all embeddings from the database
        # In a real application, this would be optimized with vector search extensions
        embeddings = VectorEmbedding.query.all()
        
        # Calculate cosine similarity for each embedding
        similarities = []
        for emb in embeddings:
            if emb.embedding:
                # Convert stored embedding back to numpy array
                vector = np.array(emb.embedding)
                
                # Calculate similarity
                similarity = cosine_similarity(query_embedding, vector)
                
                similarities.append((emb.chunk_id, similarity))
        
        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Return top-k results
        return similarities[:top_k]
    
    except Exception as e:
        logger.exception(f"Error searching for similar chunks: {str(e)}")
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
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0
    
    return np.dot(a, b) / (norm_a * norm_b)