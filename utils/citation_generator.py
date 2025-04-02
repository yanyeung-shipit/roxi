import logging

logger = logging.getLogger(__name__)

def generate_apa_citation(document):
    """
    Generate an APA style citation for a document
    
    Args:
        document: The Document model object containing metadata
        
    Returns:
        str: APA-formatted citation
    """
    try:
        # Extract document metadata
        authors = document.authors or "Unknown Author"
        title = document.title or "Untitled Document"
        journal = document.journal
        publication_date = document.publication_date
        doi = document.doi
        
        # Format authors (Last name, First initial)
        # This is a simplified approach - a real implementation would parse names properly
        author_list = authors.split(',')
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
        return f"{document.authors or 'Unknown'} ({document.publication_date.year if document.publication_date else 'n.d.'}). {document.title or 'Untitled Document'}."

def format_citation_for_response(citation, document_id, chunk_id=None):
    """
    Format a citation for including in API responses
    
    Args:
        citation (str): The full citation text
        document_id (int): The document ID
        chunk_id (int, optional): The specific text chunk ID
        
    Returns:
        dict: Formatted citation object for API responses
    """
    return {
        'citation': citation,
        'document_id': document_id,
        'chunk_id': chunk_id,
        'snippet': extract_citation_snippet(citation)
    }

def extract_citation_snippet(citation, max_length=100):
    """
    Extract a shortened version of a citation for inline display
    
    Args:
        citation (str): The full citation text
        max_length (int): Maximum length of the snippet
        
    Returns:
        str: Shortened citation snippet
    """
    if len(citation) <= max_length:
        return citation
    
    # Find a good breaking point
    cutoff = max_length - 3  # Allow space for ellipsis
    
    # Try to break at a space
    space_index = citation.rfind(' ', 0, cutoff)
    if space_index > cutoff // 2:
        return citation[:space_index] + '...'
    
    # If no good space found, just cut at the max length
    return citation[:cutoff] + '...'