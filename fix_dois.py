"""
Utility script to check and fix DOIs that may have incorrect formats.
This script will:
1. Check all DOIs in the database for common formatting issues
2. Validate DOIs against the DOI.org registry
3. Fix DOIs that have common issues and regenerate citations
"""

from app import app, db
from models import Document
from utils.doi_validator import check_doi_exists
from utils.citation_generator import generate_apa_citation
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common patterns to fix DOIs
DOI_CLEANUP_PATTERNS = [
    # Pattern for incorrectly attached words
    (r'(10\.\d{4}/[^A-Z\s]+)([A-Z][a-z]+)', r'\1'),
    # Remove any whitespace in DOIs
    (r'(10\.\d{4}/\S*)\s+(\S*)', r'\1\2'),
    # Fix common typos in DOI prefixes
    (r'10,(\d{4}/)', r'10.\1'),
    # Remove trailing punctuation
    (r'(10\.\d{4}/[^.,;:]+)[.,;:]', r'\1'),
]

def clean_doi(doi):
    """Apply cleanup patterns to fix common DOI format issues"""
    if not doi:
        return None
    
    cleaned_doi = doi.strip()
    
    # Apply each cleanup pattern
    for pattern, replacement in DOI_CLEANUP_PATTERNS:
        cleaned_doi = re.sub(pattern, replacement, cleaned_doi)
    
    # Check if the doi has any common suffixes that need to be removed
    common_suffixes = ['Recommendation', 'Article', 'Published', 'ePub']
    for suffix in common_suffixes:
        if suffix in cleaned_doi:
            # Split at the suffix and take the first part
            parts = cleaned_doi.split(suffix)
            cleaned_doi = parts[0]
    
    return cleaned_doi.strip()

def fix_doi(document):
    """Fix a document's DOI and regenerate its citation"""
    if not document.doi:
        logger.info(f"Document {document.id} has no DOI to fix")
        return False
    
    original_doi = document.doi
    cleaned_doi = clean_doi(original_doi)
    
    if cleaned_doi == original_doi:
        # No changes needed
        return False
    
    # Check if the cleaned DOI is valid
    if check_doi_exists(cleaned_doi):
        logger.info(f"Fixing DOI for document {document.id}: {original_doi} -> {cleaned_doi}")
        document.doi = cleaned_doi
        document.citation_apa = generate_apa_citation(document)
        return True
    else:
        logger.warning(f"Cleaned DOI {cleaned_doi} is invalid for document {document.id}")
        return False

def check_all_documents():
    """Check all documents in the database for DOI issues"""
    with app.app_context():
        documents = Document.query.all()
        fixed_count = 0
        
        for doc in documents:
            if fix_doi(doc):
                fixed_count += 1
        
        if fixed_count > 0:
            logger.info(f"Fixed DOIs for {fixed_count} documents. Committing changes...")
            db.session.commit()
            logger.info(f"Changes committed successfully.")
        else:
            logger.info(f"No DOIs needed fixing.")

if __name__ == "__main__":
    logger.info("Starting DOI check and fix utility...")
    check_all_documents()
    logger.info("DOI check and fix utility completed.")