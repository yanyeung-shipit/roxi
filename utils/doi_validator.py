import re
import logging
import datetime
import requests

logger = logging.getLogger(__name__)

# DOI pattern - relaxed to catch more potential DOIs
DOI_PATTERN = r'(?:doi:|https?://doi.org/|DOI\s*[:=]\s*)(10\.\d+(?:\.\d+)*[:/][^/\s]+)'

def extract_doi_from_text(text):
    """
    Extract DOI from text content using regex patterns
    
    Args:
        text (str): The text to search for DOI
        
    Returns:
        str: Extracted DOI or None if not found
    """
    if not text:
        return None
    
    # Look for DOI in text
    match = re.search(DOI_PATTERN, text, re.IGNORECASE)
    if match:
        doi = match.group(1)
        # Clean up the DOI
        doi = doi.strip().rstrip('.')
        logger.info(f"Extracted DOI: {doi}")
        return doi
    
    logger.info("No DOI found in text")
    return None

def validate_doi_with_crossref(doi):
    """
    Validate a DOI against the Crossref API and retrieve metadata
    
    Args:
        doi (str): The DOI to validate
        
    Returns:
        dict: Metadata from Crossref, or None if validation failed
    """
    if not doi:
        return None
    
    try:
        # Crossref API URL
        url = f"https://api.crossref.org/works/{doi}"
        
        # Make request with user agent (good practice for Crossref API)
        headers = {
            "User-Agent": "ROXI/0.1 (Research Organization and eXtraction Interface; mailto:admin@example.com)"
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract relevant metadata
            metadata = {}
            
            if 'message' in data:
                message = data['message']
                
                # Title
                if 'title' in message and message['title']:
                    metadata['title'] = message['title'][0]
                
                # Authors
                if 'author' in message:
                    authors = []
                    for author in message['author']:
                        if 'family' in author and 'given' in author:
                            authors.append(f"{author['family']}, {author['given']}")
                    metadata['authors'] = "; ".join(authors)
                
                # Journal
                if 'container-title' in message and message['container-title']:
                    metadata['journal'] = message['container-title'][0]
                
                # Publication date
                if 'published' in message and 'date-parts' in message['published']:
                    date_parts = message['published']['date-parts'][0]
                    if len(date_parts) >= 1:
                        year = date_parts[0]
                        month = date_parts[1] if len(date_parts) >= 2 else 1
                        day = date_parts[2] if len(date_parts) >= 3 else 1
                        
                        try:
                            metadata['publication_date'] = datetime.datetime(year, month, day)
                        except ValueError:
                            # Handle invalid dates
                            metadata['publication_date'] = None
                
                # Store the DOI
                metadata['doi'] = doi
                
                logger.info(f"Successfully validated DOI with Crossref: {doi}")
                return metadata
            
        else:
            logger.warning(f"Failed to validate DOI with Crossref (status {response.status_code}): {doi}")
            return None
    
    except Exception as e:
        logger.error(f"Error validating DOI with Crossref: {str(e)}")
        return None

def extract_and_validate_doi(text):
    """
    Extract DOI from text and validate it with Crossref
    
    Args:
        text (str): The text to extract DOI from
        
    Returns:
        dict: Metadata from Crossref, or None if extraction or validation failed
    """
    doi = extract_doi_from_text(text)
    if doi:
        return validate_doi_with_crossref(doi)
    return None