import os
import logging
import datetime
import random
import numpy as np
import celery
from app import celery as celery_app
from models import db, Document, TextChunk, ProcessingQueue, VectorEmbedding
from utils.pdf_processor import extract_text_from_pdf, chunk_text
from utils.embeddings import generate_embeddings
from utils.doi_validator import extract_and_validate_doi
from utils.citation_generator import generate_apa_citation
from utils.system_monitor import update_system_metrics

logger = logging.getLogger(__name__)

@celery_app.task
def process_document(document_id):
    """Main task to process a document in the background"""
    logger.info(f"Starting processing for document_id: {document_id}")
    
    try:
        # Get document and queue entry
        document = Document.query.get(document_id)
        queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
        
        if not document or not queue_entry:
            logger.error(f"Document or queue entry not found for id: {document_id}")
            return False
        
        # Update queue status
        queue_entry.status = 'processing'
        queue_entry.started_at = datetime.datetime.utcnow()
        db.session.commit()
        
        # Step 1: Extract text from PDF
        pdf_path = document.filename
        if not os.path.isfile(pdf_path):
            logger.error(f"PDF file not found: {pdf_path}")
            queue_entry.status = 'failed'
            queue_entry.error_message = "PDF file not found"
            db.session.commit()
            return False
        
        text = extract_text_from_pdf(pdf_path)
        if not text:
            logger.error(f"Failed to extract text from PDF: {pdf_path}")
            queue_entry.status = 'failed'
            queue_entry.error_message = "Failed to extract text from PDF"
            db.session.commit()
            return False
        
        # Store full text in document
        document.full_text = text
        db.session.commit()
        
        # Step 2: Try to extract and validate DOI
        metadata = extract_and_validate_doi(text)
        if metadata:
            logger.info(f"DOI metadata found for document: {document_id}")
            # Update document with metadata
            document.title = metadata.get('title', document.title)
            document.authors = metadata.get('authors', document.authors)
            document.journal = metadata.get('journal', document.journal)
            document.publication_date = metadata.get('publication_date', document.publication_date)
            document.doi = metadata.get('doi', document.doi)
            db.session.commit()
        
        # Step 3: Generate citation
        citation = generate_apa_citation(document)
        document.citation_apa = citation
        db.session.commit()
        
        # Step 4: Split text into chunks
        chunks = chunk_text(text)
        if not chunks:
            logger.error(f"Failed to create text chunks for document: {document_id}")
            queue_entry.status = 'failed'
            queue_entry.error_message = "Failed to create text chunks"
            db.session.commit()
            return False
        
        # Step 5: Store chunks and generate embeddings
        for i, chunk_text_content in enumerate(chunks):
            # Create text chunk
            chunk = TextChunk(
                document_id=document_id,
                text=chunk_text_content,
                page_num=0,  # Would calculate actual page in a real implementation
                chunk_index=i
            )
            db.session.add(chunk)
            db.session.flush()  # Get chunk ID
            
            # Generate and store embedding
            embedding_vector = generate_embeddings(chunk_text_content)
            if embedding_vector:
                embedding = VectorEmbedding(
                    chunk_id=chunk.id,
                    embedding=embedding_vector
                )
                db.session.add(embedding)
        
        # Step 6: Generate tags for document
        tags = generate_tags_from_content(text)
        document.tags = tags
        
        # Mark document as processed
        document.processed = True
        
        # Update queue status
        queue_entry.status = 'completed'
        queue_entry.completed_at = datetime.datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Successfully processed document: {document_id}")
        
        # Process next document
        process_next_document.delay()
        
        return True
    
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {str(e)}")
        
        try:
            # Update queue status with error
            queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
            if queue_entry:
                queue_entry.status = 'failed'
                queue_entry.error_message = str(e)
                db.session.commit()
        except Exception as inner_e:
            logger.error(f"Error updating queue entry: {str(inner_e)}")
        
        return False

@celery_app.task
def process_next_document():
    """Check for pending documents and process the next one in queue"""
    try:
        # Find the next pending document
        next_queue = ProcessingQueue.query.filter_by(status='pending').order_by(ProcessingQueue.queued_at).first()
        
        if next_queue:
            logger.info(f"Found next document to process: {next_queue.document_id}")
            # Process the document
            process_document.delay(next_queue.document_id)
            return True
        else:
            logger.info("No pending documents in queue")
            return False
    
    except Exception as e:
        logger.error(f"Error processing next document: {str(e)}")
        return False

@celery_app.task
def check_processing_queue():
    """Periodic task to check processing queue and keep the processing going"""
    try:
        # Check and update system metrics
        update_system_metrics()
        
        # Count active processes
        active_count = ProcessingQueue.query.filter_by(status='processing').count()
        
        # If no active processes, start processing next document
        if active_count == 0:
            process_next_document.delay()
        
        return True
    except Exception as e:
        logger.error(f"Error checking processing queue: {str(e)}")
        return False

@celery_app.task
def update_system_metrics_task():
    """Task to update system metrics"""
    return update_system_metrics()

def generate_tags_from_content(text):
    """Generate tags from document content using NLP techniques"""
    # In a real implementation, this would use NLP to extract keywords
    # For simplicity, we'll extract some random words from the text
    
    # Basic preprocessing
    words = text.lower().split()
    
    # Filter out short words and remove punctuation
    filtered_words = [
        word.strip('.,;:()[]{}"\'-').lower()
        for word in words
        if len(word.strip('.,;:()[]{}"\'-')) > 5
    ]
    
    # Count word frequency
    word_count = {}
    for word in filtered_words:
        if word in word_count:
            word_count[word] += 1
        else:
            word_count[word] = 1
    
    # Sort by frequency and take top words
    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
    
    # Get top 5-10 words as tags
    tag_count = min(10, len(sorted_words))
    if tag_count > 5:
        tag_count = random.randint(5, tag_count)
    
    tags = [word for word, count in sorted_words[:tag_count]]
    
    # In a real implementation, would filter out common words, 
    # use stemming, lemmatization and proper NER
    
    logger.info(f"Generated {len(tags)} tags from content")
    return tags