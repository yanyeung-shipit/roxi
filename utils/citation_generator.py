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
        
        # Check if we need to extract metadata from title
        # For example, if title is just a filename like "eular_2023_ra_guidelines"
        if (not doi or not journal) and title and "_" in title and not " " in title:
            # Title might be just a filename
            # Try to extract DOI from full_text if available
            if document.full_text:
                import re
                # Look for DOI in first 1000 characters of text (usually contains citation info)
                text_sample = document.full_text[:1000]
                doi_match = re.search(r'doi:?\s*(10\.\d{4,9}/[-._;()/:a-zA-Z0-9]+)', text_sample, re.IGNORECASE)
                if doi_match and not document.doi:
                    document.doi = doi_match.group(1)
                    doi = document.doi
                
                # Try to extract a better title
                # Look for paper title in first part of document
                title_match = re.search(r'(?:Title|TITLE):?\s*([^\.]+?)(?:\n|\.)', text_sample)
                if title_match:
                    document.title = title_match.group(1).strip()
                    title = document.title
                
                # Try to extract better authors list
                # Common author pattern at beginning of papers
                author_match = re.search(r'((?:[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z]+(?:,|;|\s+and|\s+&)\s+)+(?:[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z]+))', text_sample)
                if author_match:
                    document.authors = author_match.group(1).strip()
                    authors = document.authors
        
        # Format authors (Last name, First initial)
        # This is a simplified approach - a real implementation would parse names properly
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