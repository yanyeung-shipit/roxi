import os
import logging
import datetime
import random
import threading
import time
import queue
from app import db, app
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.embeddings import generate_embeddings
from utils.doi_validator import extract_and_validate_doi, validate_doi_with_crossref
from utils.citation_generator import generate_apa_citation

logger = logging.getLogger(__name__)

# Global queue for document processing
document_queue = queue.Queue()
# Global flag to track if processor is running
processor_running = False
# Lock for thread safety
processor_lock = threading.Lock()

def process_document_job(document_id):
    """Add document to processing queue"""
    logger.info(f"Adding document {document_id} to processing queue")
    document_queue.put(document_id)
    
    # Start the background processor if not already running
    start_background_processor()
    return True

def start_background_processor():
    """Start the background document processor if not already running"""
    global processor_running
    
    with processor_lock:
        if not processor_running:
            logger.info("Starting background document processor")
            processor_thread = threading.Thread(target=background_processor)
            processor_thread.daemon = True
            processor_thread.start()
            processor_running = True

def background_processor():
    """Background thread to process documents from the queue"""
    global processor_running
    
    logger.info("Background processor started")
    
    try:
        while True:
            try:
                # Try to get a document ID from the queue with timeout
                # This allows the thread to check for any shutdown signals
                try:
                    document_id = document_queue.get(timeout=5)
                except queue.Empty:
                    # No documents in queue, check for pending ones in database
                    with app.app_context():
                        pending_queue = ProcessingQueue.query.filter_by(status='pending').all()
                        if pending_queue:
                            for entry in pending_queue:
                                document_queue.put(entry.document_id)
                            continue
                    # If no documents in queue or database, just continue the loop
                    continue
                
                logger.info(f"Processing document {document_id} from queue")
                
                # Process document with app context
                with app.app_context():
                    process_document(document_id)
                
                # Mark task as complete
                document_queue.task_done()
                
            except Exception as e:
                logger.exception(f"Error in background processor: {str(e)}")
                # Sleep briefly to avoid overwhelming the system in case of repeated errors
                time.sleep(1)
    
    finally:
        # Make sure to reset the running flag when the thread exits
        with processor_lock:
            processor_running = False
        logger.info("Background processor stopped")

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
        
        # Try to extract raw doi from text
        import re
        doi = None
        # Look for DOI in first 1000 characters (usually contains citation info)
        text_sample = text[:1000]
        
        # Try to extract DOI directly from text first
        from utils.doi_validator import DOI_WITH_PREFIX_REGEX
        doi_match = re.search(DOI_WITH_PREFIX_REGEX, text_sample, re.IGNORECASE)
        if doi_match:
            doi = doi_match.group(1)
            document.doi = doi
        
        # If we have a DOI, try to validate with Crossref and get more metadata
        metadata = None
        if doi:
            metadata = validate_doi_with_crossref(doi)
        else:
            # Otherwise try the standard extraction method
            metadata = extract_and_validate_doi(text)
        
        # If we can't get metadata from CrossRef, try direct extraction from text
        if not metadata:
            logger.info(f"Couldn't get metadata from CrossRef for document {document_id}, trying direct extraction")
            
            # Try to extract title directly
            if document.title and "_" in document.title and not " " in document.title:
                # Looks like a filename, try to find a better title
                title_match = re.search(r'(?:title|TITLE):?\s*([^\.]+?)(?:\n|\.)', text_sample)
                if not title_match:
                    # Try alternative patterns
                    title_match = re.search(r'EULAR recommendations for (.+?)(?:\n|\.)', text_sample)
                if title_match:
                    document.title = title_match.group(1).strip()
            
            # Try to extract authors
            author_match = re.search(r'((?:[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z]+(?:,|;|\s+and|\s+&)\s+)+(?:[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z]+))', text_sample)
            if author_match and not document.authors:
                document.authors = author_match.group(1).strip()
            
            # Try to extract journal
            journal_match = re.search(r'(?:journal|JOURNAL):?\s*([^\.]+?)(?:\n|\.)', text_sample)
            if not journal_match:
                # Common journal abbreviations
                journal_match = re.search(r'(?:Ann(?:als)?\.?\s+(?:of\s+)?Rheum(?:atic)?\s+Dis(?:eases)?|Arthritis\s+Rheum(?:atology)?|J(?:ournal)?\s+Rheumatol(?:ogy)?)', text_sample)
            if journal_match and not document.journal:
                document.journal = journal_match.group(0).strip()
            
            # Try to extract year
            year_match = re.search(r'\((\d{4})\)', text_sample)
            if year_match and not document.publication_date:
                year = int(year_match.group(1))
                document.publication_date = datetime.datetime(year, 1, 1)
        
        # Update document metadata if DOI validation succeeded
        elif metadata:
            # Update document with metadata from Crossref or other source
            document.doi = metadata.get('DOI')
            
            # Get title
            title = metadata.get('title')
            if title and isinstance(title, list) and len(title) > 0:
                # Use the full title, now that we've changed to TEXT type
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
    # This is a specialized tag generator for rheumatology documents
    # It looks for specific terms relevant to rheumatology research
    
    # Common rheumatology disease categories
    diseases = {
        "Rheumatoid Arthritis": ["rheumatoid arthritis", "ra ", "ra,", "ra.", "ra)", "ra-", "seropositive arthritis"],
        "Systemic Lupus Erythematosus": ["systemic lupus", "sle ", "sle,", "sle.", "sle)", "lupus nephritis", "lupus erythematosus"],
        "Psoriatic Arthritis": ["psoriatic arthritis", "psa ", "psa,", "psa.", "psa)"],
        "Ankylosing Spondylitis": ["ankylosing spondylitis", "as ", "as,", "as.", "as)", "axial spondyloarthritis"],
        "Osteoarthritis": ["osteoarthritis", "oa ", "oa,", "oa.", "oa)", "degenerative joint disease"],
        "Gout": ["gout", "gouty arthritis", "crystal arthropathy", "uric acid"],
        "Systemic Sclerosis": ["systemic sclerosis", "scleroderma", "sclerosis"],
        "Vasculitis": ["vasculitis", "anca", "giant cell arteritis", "takayasu", "polyarteritis"],
        "Sjögren's Syndrome": ["sjögren", "sjogren", "sicca syndrome"],
        "Polymyalgia Rheumatica": ["polymyalgia rheumatica", "pmr ", "pmr,", "pmr.", "pmr)"],
        "Polymyositis": ["polymyositis", "dermatomyositis", "inflammatory myopathy", "myositis"],
        "Fibromyalgia": ["fibromyalgia", "fibromyalgia syndrome", "fms ", "fms,", "fms.", "fms)"],
        "ILD": ["interstitial lung disease", "ild ", "ild,", "ild.", "ild)", "pulmonary fibrosis"]
    }
    
    # Treatment categories
    treatments = {
        "DMARDs": ["disease-modifying", "dmard", "conventional synthetic", "csdmard"],
        "Biologics": ["biologic", "tnf inhibitor", "tnf-alpha", "bDMARD"],
        "JAK Inhibitors": ["jak inhibitor", "janus kinase", "tofacitinib", "baricitinib", "upadacitinib"],
        "Corticosteroids": ["corticosteroid", "glucocorticoid", "prednisone", "methylprednisolone"],
        "NSAIDs": ["nsaid", "non-steroidal", "non steroidal", "anti-inflammatory", "ibuprofen", "naproxen"],
        "Methotrexate": ["methotrexate", "mtx ", "mtx,", "mtx.", "mtx)"],
        "Hydroxychloroquine": ["hydroxychloroquine", "hcq ", "hcq,", "hcq.", "hcq)", "plaquenil"],
        "Rituximab": ["rituximab", "anti-cd20"],
        "Immunosuppressants": ["immunosuppressant", "immunosuppressive", "cyclophosphamide", "azathioprine", "mycophenolate"]
    }
    
    # Document types
    document_types = {
        "Guidelines": ["guideline", "recommendation", "consensus", "eular", "acr criteria"],
        "Clinical Trial": ["clinical trial", "phase iii", "phase 3", "randomized", "randomised", "rct ", "rct,", "rct."],
        "Meta-Analysis": ["meta-analysis", "meta analysis", "systematic review"],
        "Cohort Study": ["cohort study", "longitudinal study", "observational study"],
        "Case Report": ["case report", "case series"],
        "Review": ["review", "literature review"]
    }
    
    # Convert text to lowercase for case-insensitive matching
    text_lower = text.lower()
    
    # Find matches
    tags = []
    
    # Check for disease terms
    for disease, terms in diseases.items():
        for term in terms:
            if term in text_lower:
                tags.append(disease)
                break
    
    # Check for treatment terms
    for treatment, terms in treatments.items():
        for term in terms:
            if term in text_lower:
                tags.append(treatment)
                break
    
    # Check for document type terms
    for doc_type, terms in document_types.items():
        for term in terms:
            if term in text_lower:
                tags.append(doc_type)
                break
    
    # Limit to 5 tags maximum
    if len(tags) > 5:
        # Prioritize disease tags, then treatment tags, then document type tags
        disease_tags = [tag for tag in tags if tag in diseases.keys()]
        treatment_tags = [tag for tag in tags if tag in treatments.keys()]
        doc_type_tags = [tag for tag in tags if tag in document_types.keys()]
        
        # Build final tag list with prioritization
        final_tags = []
        
        # Add up to 2 disease tags
        final_tags.extend(disease_tags[:2])
        
        # Add up to 2 treatment tags
        if len(final_tags) < 4:
            final_tags.extend(treatment_tags[:4-len(final_tags)])
        
        # Add 1 document type tag
        if len(final_tags) < 5 and doc_type_tags:
            final_tags.append(doc_type_tags[0])
        
        # If we still need more tags, add from the original list
        if len(final_tags) < 5:
            remaining_tags = [tag for tag in tags if tag not in final_tags]
            final_tags.extend(remaining_tags[:5-len(final_tags)])
        
        tags = final_tags
    
    # If no tags were found, add some general ones
    if not tags:
        tags = ["Rheumatology", "Research Paper"]
    
    return tags