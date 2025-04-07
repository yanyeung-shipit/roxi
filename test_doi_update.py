"""
Test script for updating document metadata from DOI

This script will:
1. Find a document with a DOI in the database
2. Test the update_document_from_doi function directly (bypassing auth)
3. Verify the update works correctly

Usage:
    python test_doi_update.py
"""

import json
import sys
import importlib
from flask import jsonify
from app import app, db
from models import Document

def test_doi_update_function():
    print("Testing the DOI update functionality directly...")
    
    # Import the function directly
    from routes.document_routes import update_document_from_doi
    
    # Find a document with a DOI in the database
    with app.app_context():
        document = Document.query.filter(Document.doi.isnot(None)).first()
        
        if not document:
            print("No documents with DOIs found in the database. Please add a document with a DOI first.")
            return False
        
        print(f"Found document: ID={document.id}, Title='{document.title}', DOI='{document.doi}'")
        
        # Save the original metadata
        original_metadata = {
            'title': document.title,
            'authors': document.authors,
            'doi': document.doi,
            'journal': document.journal,
            'publication_date': document.publication_date,
            'citation_apa': document.citation_apa
        }
        
        # Call the function directly
        try:
            print("Calling update_document_from_doi function...")
            
            # Create a test request with proper content type
            with app.test_request_context(
                f'/documents/api/documents/{document.id}/update-from-doi',
                method='POST',
                content_type='application/json',
                json={'doi': document.doi}  # Include the DOI in the request
            ):
                # Patch the requires_auth decorator to do nothing
                import utils.auth
                original_requires_auth = utils.auth.requires_auth
                utils.auth.requires_auth = lambda f: f
                
                try:
                    # Call the function directly
                    result = update_document_from_doi(document.id)
                    
                    # Convert Flask response to dict
                    if hasattr(result, 'get_json'):
                        data = result.get_json()
                    elif isinstance(result, tuple) and len(result) >= 2:
                        data = result[0].json
                        status_code = result[1]
                    else:
                        try:
                            data = json.loads(result.get_data(as_text=True))
                        except (AttributeError, TypeError):
                            if isinstance(result, dict):
                                data = result
                            else:
                                print(f"Could not parse response: {type(result)}, {result}")
                                data = {'success': False, 'error': 'Could not parse response'}
                    
                    print(f"Response data: {json.dumps(data, indent=2) if data else 'No data'}")
                    
                    if data and data.get('success'):
                        print("Test passed: DOI update function is working correctly!")
                        
                        # Verify the document was updated
                        updated_doc = Document.query.get(document.id)
                        print(f"Updated document metadata:")
                        print(f"  Title: {updated_doc.title}")
                        print(f"  Authors: {updated_doc.authors}")
                        print(f"  DOI: {updated_doc.doi}")
                        print(f"  Journal: {updated_doc.journal}")
                        print(f"  Publication date: {updated_doc.publication_date}")
                        print(f"  Citation: {updated_doc.citation_apa}")
                        
                        # Check if any fields were updated
                        fields_updated = 0
                        for field in ['title', 'authors', 'doi', 'journal', 'citation_apa']:
                            if original_metadata.get(field) != getattr(updated_doc, field):
                                fields_updated += 1
                                
                        print(f"{fields_updated} fields were updated")
                        
                        return True
                    else:
                        error_msg = data.get('error', 'Unknown error') if data else 'No response data'
                        print(f"Test failed: DOI update returned an error: {error_msg}")
                        return False
                finally:
                    # Restore the original auth decorator
                    utils.auth.requires_auth = original_requires_auth
                
        except Exception as e:
            print(f"Error testing DOI update function: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = test_doi_update_function()
    sys.exit(0 if success else 1)
