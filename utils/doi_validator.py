import re
import logging
import requests

logger = logging.getLogger(__name__)

# Regular expression for DOI pattern
# Format: 10.NNNN/any_characters_here
# Note: We're careful about capturing parentheses in the DOI and ensuring proper word boundaries
# Opening parentheses are allowed in the middle, but not capturing closing parentheses at the end
# We also make sure not to capture words that may follow the DOI like "Recommendation", "Article", "Clinical", etc.

# Improved pattern to more strictly match DOI format and avoid appending words like "Clinical"
# Core DOI pattern: 10.NNNN/suffix with careful handling of word boundaries
# The key improvement is adding more specific patterns to handle capitalized words that might be appended

# Base DOI pattern, with strict word boundary handling
DOI_REGEX = r'(10\.\d{4,9}/[-._;\(\)/:A-Z0-9-]+?)(?:[^a-zA-Z0-9\-\._\/]|$|(?=[A-Z][a-z]+))'

# Case-insensitive version for more permissive matching
DOI_REGEX_CASE_INSENSITIVE = r'(10\.\d{4,9}/[-._;\(\)/:a-zA-Z0-9-]+?)(?:[^a-zA-Z0-9\-\._\/]|$|(?=[A-Z][a-z]+))'

# Format with 'doi:' prefix, using the same boundary handling
DOI_WITH_PREFIX_REGEX = r'doi:?\s*(10\.\d{4,9}/[-._;\(\)/:a-zA-Z0-9-]+?)(?:[^a-zA-Z0-9\-\._\/]|$|(?=[A-Z][a-z]+))'

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

def extract_and_validate_doi(text):
    """
    Extract DOI from text and validate it with DOI.org and Crossref
    Uses multiple extraction patterns and validation methods
    
    Args:
        text (str): The text to extract DOI from
        
    Returns:
        dict: Metadata from Crossref, or None if extraction or validation failed
    """
    if not text:
        return None
        
    # Strategy 1: Extract with standard pattern and validate
    doi = extract_doi_from_text(text)
    if doi:
        metadata = validate_doi_with_crossref(doi)
        if metadata:
            return metadata
            
    # Strategy 2: Try more aggressive extraction for the first 5000 chars
    # This looks for anything that might be a DOI in a larger chunk of text
    sample = text[:5000]
    
    # Common DOI prefixes we might find
    patterns = [
        # With 'doi:' prefix
        r'doi:?\s*(10\.\d{4,9}/[^\s\)\]\"\']+)',
        # Without prefix, just looking for the DOI pattern
        r'(?<!\w)(10\.\d{4,9}/[^\s\)\]\"\']+)',
        # DOI in URL format
        r'https?://doi\.org/(10\.\d{4,9}/[^\s\)\]\"\']+)',
        # Specific pattern for Annals of Rheumatic Diseases (ARD) journal
        r'(10\.\d{4}/ard-\d{4}-\d+)[^\d]',
        # Another common ARD pattern 
        r'(10\.\d{4}/annrheumdis-\d{4}-\d+)[^\d]'
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, sample, re.IGNORECASE)
        for match in matches:
            candidate_doi = match.group(1)
            # Check this candidate DOI
            if check_doi_exists(candidate_doi):
                # It exists, try to get metadata
                metadata = validate_doi_with_crossref(candidate_doi)
                if metadata:
                    return metadata
                # If we can't get metadata but DOI exists, return minimal info
                return {"DOI": candidate_doi, "valid": True, "source": "doi.org"}
    
    # Try searching for DOI reference explicitly mentioned
    doi_ref_pattern = r'(?:doi|DOI)[\s:]*(10\.\d{4,9}/\S+)'
    match = re.search(doi_ref_pattern, text)
    if match:
        # Extract just the DOI part without trailing punctuation
        candidate_doi = re.sub(r'[,;\.\)\]\"\']+$', '', match.group(1))
        # Further clean the DOI - specifically look for common patterns in rheumatology papers
        # Remove words like "Recommendation", "Article", etc. that might be appended to the DOI
        if "Recommendation" in candidate_doi:
            candidate_doi = candidate_doi.split("Recommendation")[0]
        elif "Article" in candidate_doi:
            candidate_doi = candidate_doi.split("Article")[0]
        
        # Specific handling for EULAR guidelines DOIs which often have this pattern
        ard_pattern = r'(10\.\d{4}/ard-\d{4}-\d+)'
        ard_match = re.search(ard_pattern, candidate_doi)
        if ard_match:
            candidate_doi = ard_match.group(1)
            
        if check_doi_exists(candidate_doi):
            metadata = validate_doi_with_crossref(candidate_doi)
            if metadata:
                return metadata
            return {"DOI": candidate_doi, "valid": True, "source": "doi.org"}
    
    # If we get here, we couldn't find a valid DOI
    return None