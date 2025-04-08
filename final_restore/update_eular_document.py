from app import app, db
from models import Document
import re

# Run within Flask app context
with app.app_context():
    # Get the EULAR document
    doc = Document.query.get(28)
    
    if doc:
        print(f"Current document data:")
        print(f"ID: {doc.id}")
        print(f"Filename: {doc.filename}")
        print(f"Title: {doc.title}")
        print(f"DOI: {doc.doi}")
        print(f"Journal: {doc.journal}")
        print(f"Citation: {doc.citation_apa}")
        
        # Update the title with proper EULAR format
        doc.title = "EULAR recommendations for the management of rheumatoid arthritis"
        
        # Set journal to ARD if not already set
        if not doc.journal or doc.journal == "Ann Rheum Dis":
            doc.journal = "Annals of the Rheumatic Diseases"
            
        # Regenerate citation using our existing function
        from utils.citation_generator import generate_apa_citation
        doc.citation_apa = generate_apa_citation(doc)
        
        # Commit changes
        db.session.commit()
        
        print("\nUpdated document data:")
        print(f"Title: {doc.title}")
        print(f"DOI: {doc.doi}")
        print(f"Journal: {doc.journal}")
        print(f"Citation: {doc.citation_apa}")
    else:
        print("EULAR document not found")