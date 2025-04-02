import re
import logging
import requests

logger = logging.getLogger(__name__)

# Regular expression for DOI pattern
DOI_REGEX = r'(10\.\d{4,9}/[-._;()/:A-Z0-9]+)'
DOI_REGEX_CASE_INSENSITIVE = r'(10\.\d{4,9}/[-._;()/:a-zA-Z0-9]+)'

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
    
    # Try to find DOI with exact case first (more strict)
    match = re.search(DOI_REGEX, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Try with a more permissive pattern
    match = re.search(DOI_REGEX_CASE_INSENSITIVE, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
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
        # API endpoint for DOI metadata
        url = f"https://api.crossref.org/works/{doi}"
        
        # Send request to Crossref API
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'ROXI/0.1 (mailto:contact@example.com)'
        })
        
        # Check if request was successful
        if response.status_code == 200:
            data = response.json()
            return data.get('message', {})
        else:
            logger.warning(f"DOI validation failed with status code {response.status_code}: {doi}")
            return None
            
    except Exception as e:
        logger.exception(f"Error validating DOI: {doi}")
        return None

def extract_and_validate_doi(text):
    """
    Extract DOI from text and validate it with Crossref
    
    Args:
        text (str): The text to extract DOI from
        
    Returns:
        dict: Metadata from Crossref, or None if extraction or validation failed
    """
    # Extract DOI from text
    doi = extract_doi_from_text(text)
    
    if not doi:
        return None
    
    # Validate DOI with Crossref
    return validate_doi_with_crossref(doi)