"""
PubMed Data Update Script

This script updates document metadata using the PubMed API integration.
It:
1. Retrieves existing documents from the database
2. For documents with DOIs, fetches enriched metadata from PubMed
3. Updates the document records with improved metadata
4. Regenerates APA citations
5. Enhances document tagging with MeSH terms

Usage:
    python update_pubmed_data.py [--all] [--doc_id=ID]
    
Options:
    --all     Process all documents in the database
    --doc_id  Process a specific document by ID
"""

import sys
import argparse
import time
import logging
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from models import Document
from utils.pubmed_integration import (
    get_paper_details_by_doi, 
    get_article_citation,
    doi_to_pmid,
    generate_tags_from_pubmed
)
from utils.citation_generator import generate_apa_citation

def parse_args():
    parser = argparse.ArgumentParser(description='Update document metadata using PubMed API')
    parser.add_argument('--all', action='store_true', help='Process all documents')
    parser.add_argument('--doc_id', type=int, help='Process a specific document by ID')
    return parser.parse_args()

def update_document_with_pubmed_data(document):
    """
    Update a document's metadata using PubMed API.
    
    Args:
        document (Document): The document to update
        
    Returns:
        bool: True if document was updated, False otherwise
    """
    logger.info(f"Processing document ID {document.id}: {document.title}")
    
    # Skip documents without DOI
    if not document.doi:
        logger.info(f"  Skipping - no DOI available")
        return False
    
    # Clean the DOI to ensure consistent format
    doi = document.doi.strip()
    if doi.startswith('doi:'):
        doi = doi[4:].strip()
    elif doi.startswith('https://doi.org/'):
        doi = doi[16:].strip()
        
    try:
        # Get PubMed metadata with improved retry mechanism
        pubmed_data = get_paper_details_by_doi(doi, max_retries=5)
        
        if not pubmed_data:
            logger.warning(f"  No PubMed data found for DOI: {doi}")
            return False
            
        logger.info(f"  Found PubMed data: {pubmed_data.get('title')}")
        
        # Update document metadata
        if pubmed_data.get('title'):
            document.title = pubmed_data['title']
            
        if pubmed_data.get('authors'):
            document.authors = ", ".join(pubmed_data['authors'])
            
        if pubmed_data.get('journal'):
            document.journal = pubmed_data['journal']
            
        if pubmed_data.get('publication_date'):
            try:
                if 'T' in pubmed_data['publication_date']:
                    pub_date = datetime.fromisoformat(pubmed_data['publication_date'])
                else:
                    pub_date = datetime.strptime(pubmed_data['publication_date'], '%Y-%m-%d')
                document.publication_date = pub_date
            except (ValueError, TypeError) as e:
                logger.warning(f"  Error parsing publication date: {e}")
        
        # Generate updated citation
        citation = get_article_citation(pubmed_data)
        if citation:
            document.citation_apa = citation
            logger.info(f"  Generated PubMed citation")
        else:
            # Fallback to our own citation generator
            document.citation_apa = generate_apa_citation(document)
            logger.info(f"  Using fallback citation generator")
        
        # Get PMID for the document with retry mechanism
        pmid = doi_to_pmid(doi, max_retries=3)
        
        # If we found a PMID, get MeSH terms for better tagging
        if pmid:
            logger.info(f"  Found PMID: {pmid}")
            
            # Add delay before making another API call to avoid rate limits
            time.sleep(1)
            
            try:
                pubmed_tags = generate_tags_from_pubmed(pmid)
                
                # Merge with existing tags and remove duplicates
                existing_tags = document.tags or []
                all_tags = list(set(existing_tags + pubmed_tags))
                document.tags = all_tags
                logger.info(f"  Added tags: {', '.join(pubmed_tags)}")
            except Exception as e:
                logger.warning(f"  Error generating tags from PubMed: {e}")
        
        return True
        
    except Exception as e:
        logger.error(f"  Error processing document with DOI {doi}: {e}")
        return False

def main():
    args = parse_args()
    
    if not args.all and args.doc_id is None:
        logger.error("Error: Please specify either --all or --doc_id=ID")
        return
    
    # Using application context for Flask-SQLAlchemy
    with app.app_context():
        # Get documents to process
        if args.all:
            documents = Document.query.all()
            logger.info(f"Processing all {len(documents)} documents...")
        else:
            documents = [Document.query.get(args.doc_id)]
            if not documents[0]:
                logger.error(f"Error: Document with ID {args.doc_id} not found")
                return
            logger.info(f"Processing document {args.doc_id}...")
        
        # Update each document
        updated_count = 0
        error_count = 0
        for idx, document in enumerate(documents):
            try:
                # Add a delay between documents to avoid rate limiting
                if idx > 0:
                    time.sleep(1)  # 1-second pause between documents
                
                if update_document_with_pubmed_data(document):
                    updated_count += 1
                    
                    # Commit changes in smaller batches to avoid large transactions
                    if updated_count % 10 == 0:
                        logger.info(f"Committing intermediate batch ({updated_count} documents so far)")
                        try:
                            db.session.commit()
                        except Exception as e:
                            logger.error(f"Error committing intermediate batch: {e}")
                            db.session.rollback()
                            
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing document {document.id}: {e}")
                
                # If we hit multiple errors in a row, give the API a longer break
                if error_count > 3:
                    logger.warning(f"Multiple errors detected, pausing for 30 seconds")
                    time.sleep(30)
                    error_count = 0  # Reset error counter after the pause
        
        # Commit final changes
        try:
            db.session.commit()
            logger.info(f"\nUpdated {updated_count} documents successfully")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error committing changes: {e}")

if __name__ == "__main__":
    main()