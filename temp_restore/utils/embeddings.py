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
    """
    Improved semantic embedder using word-level features for better semantic matching
    """
    
    def __init__(self, vector_size=128):
        self.vector_size = vector_size
        # Common words to ignore (stopwords)
        self.stopwords = {
            'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 
            'when', 'where', 'how', 'who', 'which', 'this', 'that', 'these', 'those',
            'to', 'of', 'in', 'for', 'on', 'by', 'with', 'at', 'from', 'is', 'are',
            'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
            'do', 'does', 'did', 'doing'
        }
    
    def _tokenize(self, text):
        """
        Split text into tokens (words)
        """
        # Convert to lowercase and split by whitespace
        return text.lower().split()
    
    def _get_word_features(self, word):
        """
        Get features for a word (simple but better than character-level encoding)
        """
        import hashlib
        
        # Skip stopwords
        if word in self.stopwords:
            return None
            
        # Simple hash to distribute words across the vector
        hash_val = int(hashlib.md5(word.encode()).hexdigest(), 16)
        position = hash_val % self.vector_size
        
        # For common medical terms, use specific positions
        medical_terms = {
            # Common rheumatology terms
            'arthritis': 0, 'rheumatoid': 1, 'autoimmune': 2, 'pain': 3, 
            'inflammation': 4, 'joint': 5, 'swelling': 6, 'stiffness': 7,
            'lupus': 8, 'scleroderma': 9, 'vasculitis': 10, 'gout': 11,
            'fibromyalgia': 12, 'osteoarthritis': 13, 'ankylosing': 14, 'spondylitis': 15,
            'psoriatic': 16, 'methotrexate': 17, 'prednisone': 18, 'biologics': 19,
            
            # ILD-specific terms
            'ild': 20, 'interstitial': 21, 'lung': 22, 'disease': 23, 
            'fibrosis': 24, 'pulmonary': 25, 'respiratory': 26, 'dyspnea': 27,
            'cough': 28, 'hrct': 29, 'pft': 30, 'fvc': 31, 
            'dlco': 32, 'screening': 33, 'diagnosis': 34, 'treatment': 35,
            'subclinical': 36, 'clinical': 37, 'progressive': 38, 'severe': 39
        }
        
        if word in medical_terms:
            position = medical_terms[word]
            
        return position
    
    def encode(self, text, normalize=True):
        """
        Convert text to a vector using word-level features
        
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
        
        # Process each word
        tokens = self._tokenize(text)
        for token in tokens:
            feature_pos = self._get_word_features(token)
            if feature_pos is not None:
                vector[feature_pos] += 1.0
        
        # Add bigram features for important phrase patterns
        for i in range(len(tokens) - 1):
            bigram = f"{tokens[i]}_{tokens[i+1]}"
            # Hash the bigram to get a position
            import hashlib
            bigram_hash = int(hashlib.md5(bigram.encode()).hexdigest(), 16)
            bigram_pos = (bigram_hash % (self.vector_size - 40)) + 40  # Use positions after medical terms
            vector[bigram_pos] += 0.5  # Lower weight than individual words
        
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

def search_similar_chunks(query_text, top_k=5, similarity_threshold=0.5):
    """
    Search for text chunks similar to the query
    
    Args:
        query_text (str): The query text to find similar chunks for
        top_k (int): Number of top results to return
        similarity_threshold (float): Minimum similarity score to include result
        
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
        logger.debug(f"Found {len(embeddings)} total embeddings in the database")
        
        # Calculate cosine similarity for each embedding
        similarities = []
        for emb in embeddings:
            if emb.embedding:
                # Convert stored embedding back to numpy array
                vector = np.array(emb.embedding)
                
                # Calculate similarity
                similarity = cosine_similarity(query_embedding, vector)
                
                # Add to list if above threshold
                if similarity >= similarity_threshold:
                    similarities.append((emb.chunk_id, similarity))
        
        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        logger.debug(f"Found {len(similarities)} similar chunks with similarity >= {similarity_threshold}")
        if similarities:
            logger.debug(f"Top similarity scores: {[score for _, score in similarities[:3]]}")
        
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

def regenerate_all_embeddings():
    """
    Regenerate all embeddings using the improved algorithm
    
    This function will:
    1. Delete all existing embeddings
    2. Regenerate embeddings for all text chunks
    3. Return statistics on the process
    
    Returns:
        dict: Statistics about regenerated embeddings
    """
    try:
        from app import db
        from models import TextChunk, VectorEmbedding
        
        # Delete all existing embeddings
        existing_count = VectorEmbedding.query.count()
        VectorEmbedding.query.delete()
        db.session.commit()
        logger.info(f"Deleted {existing_count} existing embeddings")
        
        # Get all text chunks
        chunks = TextChunk.query.all()
        chunk_count = len(chunks)
        logger.info(f"Found {chunk_count} text chunks to process")
        
        # Process each chunk
        success_count = 0
        error_count = 0
        
        for chunk in chunks:
            try:
                # Generate new embedding
                embedding = generate_embeddings(chunk.text)
                
                if embedding:
                    # Create embedding record
                    vector_embedding = VectorEmbedding(
                        chunk_id=chunk.id,
                        embedding=embedding
                    )
                    db.session.add(vector_embedding)
                    success_count += 1
                else:
                    error_count += 1
                    logger.warning(f"Failed to generate embedding for chunk {chunk.id}")
            
            except Exception as e:
                error_count += 1
                logger.exception(f"Error processing chunk {chunk.id}: {str(e)}")
        
        # Commit changes
        db.session.commit()
        logger.info(f"Successfully regenerated {success_count} embeddings with {error_count} errors")
        
        return {
            "deleted": existing_count,
            "total_chunks": chunk_count,
            "success": success_count,
            "errors": error_count
        }
    
    except Exception as e:
        logger.exception(f"Error regenerating embeddings: {str(e)}")
        return {
            "error": str(e)
        }