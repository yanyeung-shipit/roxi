"""
Utility script to regenerate missing citations for documents
"""
from app import app, db
from models import Document
from utils.citation_generator import generate_apa_citation
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def regenerate_all_citations():
    """Find and regenerate citations for all documents"""
    with app.app_context():
        # Count total documents
        total_documents = Document.query.count()
        logger.info(f"Found {total_documents} documents in database")
        
        # Get all documents
        documents = Document.query.all()
        
        # Track stats
        updated_count = 0
        unchanged_count = 0
        error_count = 0
        
        for doc in documents:
            try:
                doc_id = doc.id
                old_citation = doc.citation_apa
                
                # Always regenerate the citation
                new_citation = generate_apa_citation(doc)
                
                if not old_citation:
                    doc.citation_apa = new_citation
                    logger.info(f"Generated new citation for document {doc_id}")
                    updated_count += 1
                elif old_citation != new_citation:
                    # Update the citation even if it changed slightly
                    doc.citation_apa = new_citation
                    logger.info(f"Updated citation for document {doc_id}")
                    updated_count += 1
                else:
                    logger.debug(f"Citation unchanged for document {doc_id}")
                    unchanged_count += 1
                    
            except Exception as e:
                logger.error(f"Error processing document {doc.id}: {str(e)}")
                error_count += 1
                continue
        
        # Commit all changes if any updates were made
        if updated_count > 0:
            db.session.commit()
            logger.info(f"Committed changes to {updated_count} documents")
            
        logger.info(f"Citation regeneration complete. Updated: {updated_count}, Unchanged: {unchanged_count}, Errors: {error_count}")

if __name__ == "__main__":
    regenerate_all_citations()