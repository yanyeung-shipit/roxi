import re
import logging
import requests

logger = logging.getLogger(__name__)

# Regular expression for DOI pattern
# Format: 10.NNNN/any_characters_here
# Using a simpler approach to ensure we capture DOIs correctly

# Base DOI pattern - simpler but effective approach
DOI_REGEX = r'(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)'

# Same pattern but stored for case insensitive searches
DOI_REGEX_CASE_INSENSITIVE = r'(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)'

# DOI with prefix pattern
DOI_WITH_PREFIX_REGEX = r'(?:doi|DOI):?\s*(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)'

# DOI in URL format (common in PDFs)
DOI_URL_REGEX = r'https?://(?:dx\.)?doi\.org/(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)'

# Additional specific pattern for Annals of the Rheumatic Diseases journal DOIs
ARD_DOI_REGEX = r'(10\.\d{4}/annrheumdis-\d{4}-\d+)'

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
    
    # Try to find DOI with 'doi:' prefix first (common in academic papers)
    match = re.search(DOI_WITH_PREFIX_REGEX, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Try to find DOI with exact case (more strict)
    match = re.search(DOI_REGEX, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Try with a more permissive pattern
    match = re.search(DOI_REGEX_CASE_INSENSITIVE, text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    return None

def check_doi_exists(doi):
    """
    Check if a DOI exists by attempting to resolve it through the DOI.org system
    
    Args:
        doi (str): The DOI to check
    
    Returns:
        bool: True if the DOI exists, False otherwise
    """
    if not doi:
        return False
        
    try:
        # Clean the DOI to ensure no invalid characters
        doi = doi.strip()
        
        # Try to resolve the DOI through the central DOI resolver
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'ROXI/0.1 (mailto:contact@example.com)'
        }
        response = requests.head(f"https://doi.org/{doi}", 
                               headers=headers, 
                               timeout=10,
                               allow_redirects=True)
        
        # If we get a 200 or a redirect, the DOI exists
        return response.status_code in (200, 302, 301)
            
    except Exception as e:
        logger.exception(f"Error checking DOI existence: {doi}")
        return False

def validate_doi_with_crossref(doi):
    """
    Validate a DOI against the Crossref API and retrieve metadata
    First checks if the DOI exists using the DOI.org resolution service
    
    Args:
        doi (str): The DOI to validate
        
    Returns:
        dict: Metadata from Crossref, or None if validation failed
    """
    if not doi:
        return None
    
    try:
        # First verify the DOI exists at all using the central registry
        if not check_doi_exists(doi):
            logger.warning(f"DOI does not exist or could not be resolved: {doi}")
            return None
            
        # If DOI exists, proceed with metadata retrieval from Crossref
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
            # The DOI exists but isn't in Crossref - it might be registered with another agency
            # Return a minimal metadata dictionary so we know it's a valid DOI
            if check_doi_exists(doi):
                return {"DOI": doi, "valid": True, "source": "doi.org"}
            return None
            
    except Exception as e:
        logger.exception(f"Error validating DOI: {doi}")
        return None

def extract_dois(text, max_chars=5000):
    """
    Extract all potential DOI candidates from a text using a simpler, more direct approach.
    
    Args:
        text (str): The text to search for DOIs
        max_chars (int): Maximum characters to search through
        
    Returns:
        list: List of potential DOI candidates
    """
    if not text:
        return []
    
    # Limit the text length to avoid excessive processing
    text_sample = text[:max_chars]
    
    # List to store all found DOIs
    doi_candidates = []
    
    # Search using all our patterns
    patterns = [
        DOI_REGEX,                   # Base DOI pattern
        DOI_WITH_PREFIX_REGEX,       # DOI with prefix (doi:)
        DOI_URL_REGEX,               # DOI in URL form
        ARD_DOI_REGEX,               # Special ARD journal pattern
        r'(?:10\.\d{4,9}/\S{4,})'    # More permissive pattern as fallback
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text_sample, re.IGNORECASE)
        for match in matches:
            # Get the DOI from the first capturing group or the entire match
            doi = match.group(1) if match.lastindex else match.group(0)
            
            # Clean the DOI
            doi = doi.strip()
            
            # Remove any trailing punctuation
            doi = re.sub(r'[,;.)\]"\'\s]+$', '', doi)
            
            # Some DOIs might have words attached at the end
            # Split at any capital letter followed by lowercase (CamelCase boundary)
            doi_parts = re.split(r'(?<=[a-z0-9])(?=[A-Z][a-z])', doi)
            if doi_parts:
                doi = doi_parts[0]
            
            # Add to candidates if not already there
            if doi and doi not in doi_candidates and doi.startswith('10.'):
                doi_candidates.append(doi)
    
    return doi_candidates

def extract_and_validate_doi(text):
    """
    Extract DOI from text and validate it with DOI.org and Crossref
    Uses a simpler, more direct approach to find DOIs
    
    Args:
        text (str): The text to extract DOI from
        
    Returns:
        dict: Metadata from Crossref, or None if extraction or validation failed
    """
    if not text:
        return None
    
    # First try the simple extract_doi_from_text function for common cases
    doi = extract_doi_from_text(text)
    if doi:
        # Remove any trailing punctuation
        doi = re.sub(r'[,;.)\]"\'\s]+$', '', doi)
        
        # Check if this DOI is valid
        if check_doi_exists(doi):
            metadata = validate_doi_with_crossref(doi)
            if metadata:
                return metadata
            return {"DOI": doi, "valid": True, "source": "doi.org"}
    
    # Try the more comprehensive extraction method
    dois = extract_dois(text, max_chars=5000)
    
    # No DOIs found
    if not dois:
        return None
        
    # Try each candidate DOI until we find a valid one
    for doi in dois:
        if check_doi_exists(doi):
            metadata = validate_doi_with_crossref(doi)
            if metadata:
                return metadata
            return {"DOI": doi, "valid": True, "source": "doi.org"}
    
    # If we get here, we couldn't find a valid DOI
    return None