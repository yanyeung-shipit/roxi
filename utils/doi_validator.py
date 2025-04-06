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

# Dictionary of journal-specific DOI patterns for rheumatology journals
# Format: 'Journal Name': (regex_pattern, journal_identifier_patterns)
JOURNAL_DOI_PATTERNS = {
    # Annals of the Rheumatic Diseases (ARD)
    'Annals of the Rheumatic Diseases': (
        [r'10\.1136/annrheumdis-\d{4}-\d+', r'10\.1136/ard\.\d+\.\d+\.\d+', r'10\.1136/ard\.\d+\.\d+'],
        ['annals rheum', 'ann rheum dis', 'ARD', 'annrheumdis']
    ),
    
    # Arthritis & Rheumatology
    'Arthritis & Rheumatology': (
        [r'10\.1002/art\.\d+'],
        ['arthritis rheumatol', 'arthritis rheum', 'arth rheum']
    ),
    
    # Nature Reviews Rheumatology
    'Nature Reviews Rheumatology': (
        [r'10\.1038/s41584-\d{3}-\d{5}-\d', r'10\.1038/nrrheum\.\d{4}\.\d+'],
        ['nat rev rheumatol', 'nature rev rheum', 'nrrheum']
    ),
    
    # Rheumatology (Oxford)
    'Rheumatology': (
        [r'10\.1093/rheumatology/ke[a-z]{2}\d{3}', r'10\.1093/rheumatology/\d+\.\d+\.\d+', r'10\.1093/rheumatology/[a-z]\.\d+\.\d+'],
        ['rheumatology oxford', 'rheumatology']
    ),
    
    # Seminars in Arthritis and Rheumatism
    'Seminars in Arthritis and Rheumatism': (
        [r'10\.1016/j\.semarthrit\.\d{4}\.\d{6}', r'10\.1016/s0049-0172\(\d{2}\)\d{5}-\d'],
        ['semin arthritis rheum', 'sem arth rheum', 'semarthrit']
    ),
    
    # Journal of Rheumatology
    'Journal of Rheumatology': (
        [r'10\.3899/jrheum\.\d{6}'],
        ['j rheumatol', 'journal rheumatol', 'jrheum']
    ),
    
    # Clinical and Experimental Rheumatology
    'Clinical and Experimental Rheumatology': (
        [r'10\.55563/cer\.\d{4}\.\d{4}'],
        ['clin exp rheumatol', 'clinical exp rheum', 'cer']
    ),
    
    # Current Opinion in Rheumatology
    'Current Opinion in Rheumatology': (
        [r'10\.1097/BOR\.\d{16}'],
        ['curr opin rheumatol', 'current opinion rheum', 'bor']
    ),
    
    # Arthritis Research & Therapy
    'Arthritis Research & Therapy': (
        [r'10\.1186/s13075-\d{3}-\d{5}-\d'],
        ['arthritis res ther', 'arth res therapy', 's13075']
    ),
    
    # Scandinavian Journal of Rheumatology
    'Scandinavian Journal of Rheumatology': (
        [r'10\.1080/03009742\.\d{4}\.\d{7}'],
        ['scand j rheumatol', 'scandinavian j rheum', '03009742']
    ),
    
    # Best Practice & Research Clinical Rheumatology
    'Best Practice & Research Clinical Rheumatology': (
        [r'10\.1016/j\.berh\.\d{4}\.\d{6}'],
        ['best pract res clin rheumatol', 'best practice research', 'berh']
    ),
    
    # Lupus
    'Lupus': (
        [r'10\.1177/\d{14}'],
        ['lupus', '09612033']
    ),
    
    # Osteoarthritis and Cartilage
    'Osteoarthritis and Cartilage': (
        [r'10\.1016/j\.joca\.\d{4}\.\d{2}\.\d{3}'],
        ['osteoarthritis cartilage', 'osteoarth cartil', 'joca']
    ),
    
    # Journal of Clinical Rheumatology
    'Journal of Clinical Rheumatology': (
        [r'10\.1097/RHU-\d{2}-\d{4}'],
        ['j clin rheumatol', 'journal clinical rheum', 'rhu']
    ),
    
    # Arthritis Care & Research
    'Arthritis Care & Research': (
        [r'10\.1002/acr\.\d{5}'],
        ['arthritis care res', 'arth care research', 'acr']
    ),
    
    # Rheumatology International
    'Rheumatology International': (
        [r'10\.1007/s00296-\d{3}-\d{5}-\d'],
        ['rheumatol int', 'rheumatology international', 's00296']
    ),
    
    # Modern Rheumatology
    'Modern Rheumatology': (
        [r'10\.1080/14397595\.\d{4}\.\d{6}'],
        ['mod rheumatol', 'modern rheumatology', '14397595']
    ),
    
    # Pediatric Rheumatology
    'Pediatric Rheumatology': (
        [r'10\.1186/s12969-\d{3}-\d{5}-\d'],
        ['pediatr rheumatol', 'paediatric rheum', 's12969']
    ),
    
    # BMC Musculoskeletal Disorders
    'BMC Musculoskeletal Disorders': (
        [r'10\.1186/s12891-\d{3}-\d{5}-\d'],
        ['bmc musculoskelet disord', 'bmc muscul', 's12891']
    ),
    
    # Open Rheumatology Journal
    'Open Rheumatology Journal': (
        [r'10\.2174/\d{13}'],
        ['open rheumatol j', 'open rheum', '1874312']
    ),
    
    # Clinical Rheumatology
    'Clinical Rheumatology': (
        [r'10\.1007/s10067-\d{3}-\d{5}-\d'],
        ['clin rheumatol', 'clinical rheum', 's10067']
    ),
    
    # Reumatología Clínica
    'Reumatología Clínica': (
        [r'10\.1016/j\.reuma\.\d{4}\.\d{6}'],
        ['reumatol clin', 'reumatologia clinica', 'reuma']
    ),
    
    # International Journal of Rheumatology
    'International Journal of Rheumatology': (
        [r'10\.1155/\d{4}/\d{7}'],
        ['int j rheumatol', 'international journal rheum', '1155']
    ),
    
    # Journal of Autoimmunity
    'Journal of Autoimmunity': (
        [r'10\.1016/j\.jaut\.\d{4}\.\d{6}'],
        ['j autoimmun', 'journal autoimmunity', 'jaut']
    ),
    
    # Autoimmunity Reviews
    'Autoimmunity Reviews': (
        [r'10\.1016/j\.autrev\.\d{4}\.\d{6}'],
        ['autoimmun rev', 'autoimmunity reviews', 'autrev']
    ),
    
    # Journal of Scleroderma and Related Disorders
    'Journal of Scleroderma and Related Disorders': (
        [r'10\.1177/\d{14}'],
        ['j scleroderma relat disord', 'scleroderma related', '23971983']
    ),
    
    # RMD Open
    'RMD Open': (
        [r'10\.1136/rmdopen-\d{4}-\d{6}'],
        ['rmd open', 'rmdopen']
    ),
    
    # Arthritis & Rheumatology Reports
    'Arthritis & Rheumatology Reports': (
        [r'10\.1002/arr2\.\d{5}'],
        ['arthritis rheumatol rep', 'arth rheum rep', 'arr2']
    ),
    
    # Journal of Inflammation Research
    'Journal of Inflammation Research': (
        [r'10\.2147/JIR\.S\d{6}'],
        ['j inflamm res', 'journal inflammation research', 'jir']
    ),
    
    # Therapeutic Advances in Musculoskeletal Disease
    'Therapeutic Advances in Musculoskeletal Disease': (
        [r'10\.1177/1759720X\d{9}'],
        ['ther adv musculoskelet dis', 'therapeutic advances musc', '1759720x']
    )
}

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

def extract_journal_specific_doi(text, max_chars=5000):
    """
    Extract DOIs using journal-specific patterns based on known rheumatology journals.
    First attempts to identify the journal, then applies appropriate patterns.
    
    Args:
        text (str): The text to search for DOIs
        max_chars (int): Maximum characters to search through
        
    Returns:
        list: List of potential DOI candidates from journal-specific patterns
    """
    if not text:
        return []
    
    # Limit the text length for performance
    text_sample = text[:max_chars].lower()
    
    # List to store found DOIs
    journal_specific_dois = []
    
    # Check if we can identify any known journals in the text
    detected_journals = []
    for journal_name, (patterns, identifiers) in JOURNAL_DOI_PATTERNS.items():
        # Check if any of the journal identifiers are in the text
        for identifier in identifiers:
            if identifier.lower() in text_sample:
                detected_journals.append(journal_name)
                break
    
    # If we found known journals, apply their specific patterns
    for journal_name in detected_journals:
        patterns, _ = JOURNAL_DOI_PATTERNS[journal_name]
        for pattern in patterns:
            matches = re.finditer(pattern, text_sample, re.IGNORECASE)
            for match in matches:
                doi = match.group(0)
                # Clean the DOI
                doi = doi.strip()
                # Remove any trailing punctuation or words
                doi = re.sub(r'[,;.)\]"\'\s]+$', '', doi)
                # Remove any non-DOI text attached (e.g., "First", "Clinical", etc.)
                doi_parts = re.split(r'(?<=[a-z0-9])(?=[A-Z][a-z])', doi)
                if doi_parts:
                    doi = doi_parts[0]
                # Add to candidates
                if doi and doi not in journal_specific_dois and doi.startswith('10.'):
                    journal_specific_dois.append(doi)
                    logger.info(f"Found journal-specific DOI ({journal_name}): {doi}")
    
    return journal_specific_dois

def extract_dois(text, max_chars=5000):
    """
    Extract all potential DOI candidates from a text using multiple approaches.
    
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
    
    # First try journal-specific patterns (higher accuracy)
    journal_specific_dois = extract_journal_specific_doi(text, max_chars)
    doi_candidates.extend(journal_specific_dois)
    
    # Then try generic patterns
    patterns = [
        DOI_REGEX,                   # Base DOI pattern
        DOI_WITH_PREFIX_REGEX,       # DOI with prefix (doi:)
        DOI_URL_REGEX,               # DOI in URL form
        # Use the ARD pattern directly
        r'(10\.\d{4}/annrheumdis-\d{4}-\d+)',  # ARD journal pattern
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
            
            # Remove common word suffixes that might be attached to DOIs
            common_suffixes = ['First', 'Article', 'Clinical', 'Full', 'Paper', 'Published']
            for suffix in common_suffixes:
                if suffix in doi and not suffix.lower() in doi.lower()[:15]:  # Only if suffix is not part of actual DOI
                    doi = doi.split(suffix)[0]
            
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