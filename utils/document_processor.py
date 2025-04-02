import os
import logging
import datetime
import random
import threading
from app import db, app
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.embeddings import generate_embeddings
from utils.doi_validator import extract_and_validate_doi
from utils.citation_generator import generate_apa_citation

logger = logging.getLogger(__name__)

def process_document_job(document_id):
    """Process a document in a separate thread with proper application context"""
    def process_with_app_context(doc_id):
        with app.app_context():
            process_document(doc_id)
    
    thread = threading.Thread(target=process_with_app_context, args=(document_id,))
    thread.daemon = True
    thread.start()
    return thread

def process_document(document_id):
    """Process a document's content, extract metadata, and generate embeddings"""
    logger.info(f"Starting to process document: {document_id}")
    
    # Get the document and its queue entry
    document = Document.query.get(document_id)
    queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
    
    if not document or not queue_entry:
        logger.error(f"Document or queue entry not found for ID: {document_id}")
        return False
    
    try:
        # Update queue status to processing
        queue_entry.status = 'processing'
        queue_entry.started_at = datetime.datetime.utcnow()
        db.session.commit()
        
        # Get the file path
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        file_path = os.path.join(upload_folder, document.filename)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")
        
        # Extract text from the PDF
        text = extract_text_from_pdf(file_path)
        
        if not text:
            raise ValueError("Failed to extract text from PDF")
        
        # Store the full text in the document
        document.full_text = text
        
        # Try to extract and validate DOI
        metadata = extract_and_validate_doi(text)
        
        # Update document metadata if DOI validation succeeded
        if metadata:
            # Update document with metadata from Crossref or other source
            document.doi = metadata.get('DOI')
            
            # Get title
            title = metadata.get('title')
            if title and isinstance(title, list) and len(title) > 0:
                document.title = title[0]
            
            # Get authors
            authors = metadata.get('author', [])
            if authors:
                author_names = []
                for author in authors:
                    given = author.get('given', '')
                    family = author.get('family', '')
                    if given and family:
                        author_names.append(f"{family}, {given}")
                    elif family:
                        author_names.append(family)
                
                if author_names:
                    document.authors = '; '.join(author_names)
            
            # Get journal
            container = metadata.get('container-title')
            if container and isinstance(container, list) and len(container) > 0:
                document.journal = container[0]
            
            # Get publication date
            published_date = None
            if 'published' in metadata and 'date-parts' in metadata['published']:
                date_parts = metadata['published']['date-parts']
                if date_parts and isinstance(date_parts, list) and len(date_parts) > 0:
                    parts = date_parts[0]
                    if len(parts) >= 3:
                        # Year, month, day
                        published_date = datetime.datetime(parts[0], parts[1], parts[2])
                    elif len(parts) == 2:
                        # Year, month
                        published_date = datetime.datetime(parts[0], parts[1], 1)
                    elif len(parts) == 1:
                        # Just year
                        published_date = datetime.datetime(parts[0], 1, 1)
            
            if published_date:
                document.publication_date = published_date
        
        # Generate APA citation
        document.citation_apa = generate_apa_citation(document)
        
        # Generate tags based on content
        document.tags = generate_tags_from_content(text)
        
        # Split text into chunks
        from utils.pdf_processor import chunk_text
        chunks = chunk_text(text)
        
        # Process each chunk
        for i, chunk_content in enumerate(chunks):
            # Create text chunk record
            chunk = TextChunk(
                document_id=document.id,
                text=chunk_content,
                chunk_index=i
            )
            db.session.add(chunk)
            db.session.flush()  # Get the chunk ID
            
            # Generate embeddings
            embedding = generate_embeddings(chunk_content)
            
            if embedding:
                # Create embedding record
                vector_embedding = VectorEmbedding(
                    chunk_id=chunk.id,
                    embedding=embedding
                )
                db.session.add(vector_embedding)
        
        # Mark document as processed
        document.processed = True
        
        # Update queue entry
        queue_entry.status = 'completed'
        queue_entry.completed_at = datetime.datetime.utcnow()
        
        # Commit all changes
        db.session.commit()
        
        logger.info(f"Successfully processed document: {document_id}")
        
        return True
    
    except Exception as e:
        # Log the error
        logger.exception(f"Error processing document {document_id}: {str(e)}")
        
        # Update queue entry
        queue_entry.status = 'failed'
        queue_entry.error_message = str(e)
        
        # Rollback and try to save the error
        db.session.rollback()
        try:
            db.session.add(queue_entry)
            db.session.commit()
        except:
            logger.exception("Failed to update queue entry with error status")
        
        return False

def generate_tags_from_content(text):
    """Generate tags from document content using NLP techniques"""
    # This is a placeholder for demo purposes
    # In a real system, you would use NLP to extract keywords
    
    # Some common academic fields
    fields = [
        "Rheumatology", "Arthritis", "Inflammation", "Autoimmune", 
        "Lupus", "Scleroderma", "Osteoarthritis", "Gout", "Fibromyalgia",
        "Medicine", "Immunology", "Orthopedics", "Radiology", "Clinical Trials",
        "Patient Care", "Treatment", "Therapy", "Biologics", "Diagnostics"
    ]
    
    # Sample common technical terms
    techniques = [
        "DMARDs", "NSAIDs", "Corticosteroids", "TNF Inhibitors", "JAK Inhibitors",
        "Methotrexate", "Ultrasound", "MRI", "X-ray", "Synovial Fluid",
        "Biomarkers", "Remission", "Flare", "Comorbidity", "Pathogenesis",
        "Randomized Trial", "Meta-Analysis", "Review", "Guidelines"
    ]
    
    # Convert text to lowercase for matching
    text_lower = text.lower()
    
    # Find matches
    tags = []
    
    # Check each field
    for field in fields:
        if field.lower() in text_lower:
            tags.append(field)
    
    # Check each technique
    for technique in techniques:
        if technique.lower() in text_lower:
            tags.append(technique)
    
    # Limit to 5 tags maximum
    if len(tags) > 5:
        # Randomize which tags we keep
        random.shuffle(tags)
        tags = tags[:5]
    
    # If no tags were found, add some general ones
    if not tags:
        tags = ["Research Paper", "Rheumatology"]
    
    return tags