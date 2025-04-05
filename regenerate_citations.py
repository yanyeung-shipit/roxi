"""
Utility script to regenerate all citations for documents regardless of their current state
"""
from app import app, db
from models import Document
import logging
import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def generate_citation(document):
    """
    Generate an APA style citation for a document (improved version)
    
    Args:
        document: The Document model object containing metadata
        
    Returns:
        str: APA-formatted citation
    """
    try:
        # Extract document metadata - ensure we have values for everything
        authors = document.authors or "Unknown Author"
        title = document.title or "Untitled Document"
        journal = document.journal or ""
        publication_date = document.publication_date
        doi = document.doi or ""
        
        # Format authors (APA style - Last name, First initial)
        # In a real implementation, we'd parse the names more carefully
        formatted_authors = authors
        
        # Format publication year
        year = publication_date.year if publication_date else "n.d."
        
        # Build the citation
        citation = f"{formatted_authors} ({year}). {title}."
        
        # Add journal if available
        if journal:
            citation += f" {journal}."
        
        # Add DOI if available
        if doi:
            citation += f" https://doi.org/{doi}"
        
        return citation
    
    except Exception as e:
        logger.exception(f"Error generating citation: {str(e)}")
        # Fallback to a very basic citation format
        return f"{document.authors or 'Unknown'} ({document.publication_date.year if document.publication_date else 'n.d.'}). {document.title or 'Untitled Document'}."

def regenerate_all_citations(force=True):
    """
    Find and regenerate citations for all documents
    
    Args:
        force (bool): If True, regenerate all citations regardless of current value
    """
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
                old_citation = doc.citation_apa or ""
                
                # Always regenerate the citation
                new_citation = generate_citation(doc)
                
                # Print document metadata
                logger.info(f"Document {doc_id}:")
                logger.info(f"  Title: {doc.title}")
                logger.info(f"  Authors: {doc.authors}")
                logger.info(f"  Journal: {doc.journal}")
                logger.info(f"  Date: {doc.publication_date}")
                logger.info(f"  DOI: {doc.doi}")
                logger.info(f"  Old citation: {old_citation}")
                logger.info(f"  New citation: {new_citation}")
                
                if force or not old_citation or old_citation.strip() == "" or old_citation == "Citation not available":
                    doc.citation_apa = new_citation
                    logger.info(f"Force-updated citation for document {doc_id}")
                    updated_count += 1
                elif old_citation != new_citation:
                    # Update the citation even if it changed slightly
                    doc.citation_apa = new_citation
                    logger.info(f"Updated citation for document {doc_id}")
                    updated_count += 1
                else:
                    logger.info(f"Citation unchanged for document {doc_id}")
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
    # Force regenerate all citations
    regenerate_all_citations(force=True)