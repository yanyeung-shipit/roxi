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
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

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
    print(f"Processing document ID {document.id}: {document.title}")
    
    # Skip documents without DOI
    if not document.doi:
        print(f"  Skipping - no DOI available")
        return False
        
    # Get PubMed metadata
    pubmed_data = get_paper_details_by_doi(document.doi)
    
    if not pubmed_data:
        print(f"  No PubMed data found for DOI: {document.doi}")
        return False
        
    print(f"  Found PubMed data: {pubmed_data.get('title')}")
    
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
        except (ValueError, TypeError):
            pass
    
    # Generate updated citation
    citation = get_article_citation(pubmed_data)
    if citation:
        document.citation_apa = citation
    else:
        # Fallback to our own citation generator
        document.citation_apa = generate_apa_citation(document)
    
    # Get PMID for the document
    pmid = doi_to_pmid(document.doi)
    
    # If we found a PMID, get MeSH terms for better tagging
    if pmid:
        print(f"  Found PMID: {pmid}")
        pubmed_tags = generate_tags_from_pubmed(pmid)
        
        # Merge with existing tags and remove duplicates
        existing_tags = document.tags or []
        all_tags = list(set(existing_tags + pubmed_tags))
        document.tags = all_tags
        print(f"  Added tags: {', '.join(pubmed_tags)}")
    
    return True

def main():
    args = parse_args()
    
    if not args.all and args.doc_id is None:
        print("Error: Please specify either --all or --doc_id=ID")
        return
    
    # Using application context for Flask-SQLAlchemy
    with app.app_context():
        # Get documents to process
        if args.all:
            documents = Document.query.all()
            print(f"Processing all {len(documents)} documents...")
        else:
            documents = [Document.query.get(args.doc_id)]
            if not documents[0]:
                print(f"Error: Document with ID {args.doc_id} not found")
                return
            print(f"Processing document {args.doc_id}...")
        
        # Update each document
        updated_count = 0
        for document in documents:
            try:
                if update_document_with_pubmed_data(document):
                    updated_count += 1
            except Exception as e:
                print(f"Error processing document {document.id}: {e}")
        
        # Commit changes
        try:
            db.session.commit()
            print(f"\nUpdated {updated_count} documents successfully")
        except Exception as e:
            db.session.rollback()
            print(f"Error committing changes: {e}")

if __name__ == "__main__":
    main()