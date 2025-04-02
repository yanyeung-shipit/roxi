import logging
import datetime

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
        # Get document metadata
        authors = document.authors or "Unknown Author"
        title = document.title or "Untitled Document"
        journal = document.journal
        year = None
        
        if document.publication_date:
            year = document.publication_date.year
        
        # Format authors
        if authors and "," in authors:
            # Authors list is likely in the format "Last, First M.; Last, First M."
            author_list = authors.split(";")
            formatted_authors = ""
            
            for i, author in enumerate(author_list):
                author = author.strip()
                if not author:
                    continue
                
                # Check if author is in "Last, First" format
                if "," in author:
                    last_name = author.split(",")[0].strip()
                    initials = author.split(",")[1].strip()
                    
                    # Format initials
                    if len(initials) > 0:
                        initials = " " + "".join([f"{i.strip()[0]}." for i in initials.split() if i.strip()])
                    
                    formatted_author = last_name + initials
                else:
                    # Assume it's just a name
                    formatted_author = author
                
                # Add to the formatted authors string
                if i == 0:
                    formatted_authors = formatted_author
                elif i == len(author_list) - 1:
                    formatted_authors += f", & {formatted_author}"
                else:
                    formatted_authors += f", {formatted_author}"
            
            authors = formatted_authors
        
        # Build the citation
        citation = ""
        
        # Authors and year
        if year:
            citation += f"{authors} ({year}). "
        else:
            citation += f"{authors} (n.d.). "
        
        # Title - italicized if no journal
        if not journal:
            citation += f"*{title}*. "
        else:
            citation += f"{title}. "
        
        # Journal and other details
        if journal:
            citation += f"*{journal}*"
            
            # Volume, issue, pages would go here in a real implementation
            citation += "."
        
        # DOI
        if document.doi:
            citation += f" https://doi.org/{document.doi}"
        
        logger.info(f"Generated APA citation for document {document.id}")
        return citation
    
    except Exception as e:
        logger.error(f"Error generating APA citation: {str(e)}")
        return f"{document.title or 'Unknown document'}"

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
        'document_id': document_id,
        'chunk_id': chunk_id,
        'full_citation': citation,
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
    
    # Try to cut at a logical point
    cut_point = citation.rfind('. ', 0, max_length - 3)
    
    if cut_point != -1:
        return citation[:cut_point + 1] + '...'
    else:
        return citation[:max_length - 3] + '...'