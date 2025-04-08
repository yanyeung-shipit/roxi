import os
import logging
import datetime
import random
from dateutil.parser import parse as parse_date
import numpy as np
from celery import shared_task

from app import db
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.embeddings import generate_embeddings
from utils.doi_validator import extract_and_validate_doi
from utils.citation_generator import generate_apa_citation
from utils.system_monitor import update_system_metrics

logger = logging.getLogger(__name__)

@shared_task
def process_document(document_id):
    """Main task to process a document in the background"""
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
        upload_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
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
        chunks = chunk_text(text)
        
        # Process each chunk
        for i, chunk_text in enumerate(chunks):
            # Create text chunk record
            chunk = TextChunk(
                document_id=document.id,
                text=chunk_text,
                chunk_index=i
            )
            db.session.add(chunk)
            db.session.flush()  # Get the chunk ID
            
            # Generate embeddings
            embedding = generate_embeddings(chunk_text)
            
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

@shared_task
def process_next_document():
    """Check for pending documents and process the next one in queue"""
    try:
        # Find the oldest pending document
        queue_entry = ProcessingQueue.query.filter_by(status='pending').order_by(ProcessingQueue.queued_at).first()
        
        if queue_entry:
            # Process this document
            process_document.delay(queue_entry.document_id)
            return True
        
        return False
    
    except Exception as e:
        logger.exception(f"Error in process_next_document: {str(e)}")
        return False

@shared_task
def check_processing_queue():
    """Periodic task to check processing queue and keep the processing going"""
    try:
        # Count documents by status
        pending_count = ProcessingQueue.query.filter_by(status='pending').count()
        processing_count = ProcessingQueue.query.filter_by(status='processing').count()
        
        logger.info(f"Queue status: {pending_count} pending, {processing_count} processing")
        
        # If we have pending documents and less than 2 documents being processed, start processing more
        if pending_count > 0 and processing_count < 2:
            process_next_document.delay()
        
        return True
    
    except Exception as e:
        logger.exception(f"Error in check_processing_queue: {str(e)}")
        return False

@shared_task
def update_system_metrics_task():
    """Task to update system metrics"""
    try:
        return update_system_metrics()
    except Exception as e:
        logger.exception(f"Error in update_system_metrics_task: {str(e)}")
        return False

def generate_tags_from_content(text):
    """
    Generate tags from document content by using the centralized tag matching function
    from document_processor module, ensuring consistency across the application.
    
    Args:
        text (str): The text to generate tags from
        
    Returns:
        list: List of standardized tags from our predefined lists
    """
    # Import the centralized tag matching function
    from utils.document_processor import match_to_predefined_tags
    
    # Use our standardized tag matching function
    tags = match_to_predefined_tags(text_content=text)
    
    # The match_to_predefined_tags function already:
    # 1. Matches text against our standard disease/document type dictionaries
    # 2. Scores and sorts tags by relevance
    # 3. Limits to 6 tags maximum
    
    # If no tags were found, add some general ones for rheumatology
    if not tags:
        tags = ["Rheumatology", "Research Paper"]
    
    return tags