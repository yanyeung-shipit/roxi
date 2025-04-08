"""
Database cleanup utility to reset all documents, chunks, embeddings, and processing queue.
"""

import os
import logging
from app import app, db
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue, QueryHistory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_upload_folder():
    """Delete all PDF files from the uploads folder"""
    upload_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    count = 0
    
    for filename in os.listdir(upload_folder):
        if filename.lower().endswith('.pdf'):
            file_path = os.path.join(upload_folder, filename)
            try:
                os.remove(file_path)
                count += 1
                logger.info(f"Deleted file: {filename}")
            except Exception as e:
                logger.error(f"Error deleting file {filename}: {str(e)}")
    
    return count

def clean_database():
    """Delete all records from the database tables in proper order"""
    with app.app_context():
        try:
            # Delete embeddings first (child records)
            embedding_count = VectorEmbedding.query.delete()
            logger.info(f"Deleted {embedding_count} vector embeddings")
            
            # Delete text chunks
            chunk_count = TextChunk.query.delete()
            logger.info(f"Deleted {chunk_count} text chunks")
            
            # Delete processing queue entries
            queue_count = ProcessingQueue.query.delete()
            logger.info(f"Deleted {queue_count} processing queue entries")
            
            # Delete query history
            history_count = QueryHistory.query.delete()
            logger.info(f"Deleted {history_count} query history entries")
            
            # Delete documents last (parent records)
            document_count = Document.query.delete()
            logger.info(f"Deleted {document_count} documents")
            
            # Commit the changes
            db.session.commit()
            logger.info("Database cleanup completed successfully")
            
            return {
                "embeddings": embedding_count,
                "chunks": chunk_count,
                "queue": queue_count,
                "history": history_count,
                "documents": document_count
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error during database cleanup: {str(e)}")
            raise

if __name__ == "__main__":
    # Clean the database
    db_results = clean_database()
    
    # Clean the upload folder
    file_count = clean_upload_folder()
    
    print(f"Cleanup summary:")
    print(f"- {db_results['documents']} documents deleted")
    print(f"- {db_results['chunks']} text chunks deleted")
    print(f"- {db_results['embeddings']} vector embeddings deleted")
    print(f"- {db_results['queue']} processing queue entries deleted")
    print(f"- {db_results['history']} query history entries deleted")
    print(f"- {file_count} PDF files deleted from uploads folder")