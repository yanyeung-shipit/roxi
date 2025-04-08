from app import app, db
from models import Document
from utils.citation_generator import generate_apa_citation

# Run within Flask app context
with app.app_context():
    # Get the document with ID 28 (the EULAR guideline)
    doc = Document.query.get(28)
    
    if doc:
        # Generate new citation with corrected DOI
        old_citation = doc.citation_apa
        doc.citation_apa = generate_apa_citation(doc)
        
        # Commit changes
        db.session.commit()
        
        print(f"Document ID: {doc.id}")
        print(f"Filename: {doc.filename}")
        print(f"DOI: {doc.doi}")
        print(f"Old citation: {old_citation}")
        print(f"Updated citation: {doc.citation_apa}")
    else:
        print("Document not found")