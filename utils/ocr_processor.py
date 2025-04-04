"""
OCR Processing Utility for PDF documents

This module provides OCR (Optical Character Recognition) functionality for PDF documents
that have limited or no text extraction using standard PDF parsing methods.
It uses pytesseract and pdf2image to convert PDF pages to images and extract text.
"""

import os
import logging
import datetime
from typing import List, Optional, Tuple

import pytesseract
from pdf2image import convert_from_path
from sqlalchemy.exc import SQLAlchemyError

from app import db
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue
from utils.pdf_processor import chunk_text, clean_text
from utils.embeddings import generate_embeddings

# Configure logger
logger = logging.getLogger(__name__)

def detect_text_extraction_quality(text: str) -> str:
    """
    Analyze the extracted text to determine its quality
    
    Args:
        text (str): The extracted text from a PDF
        
    Returns:
        str: Quality assessment ('good', 'limited', 'none')
    """
    if not text or len(text.strip()) < 100:
        return 'none'
    
    # Check if the text is mostly garbage or has very few actual words
    word_count = len([w for w in text.split() if len(w) > 2])
    if word_count < 50:
        return 'limited'
    
    # Basic heuristic: if the word-to-character ratio is very low, text quality is limited
    char_count = len(text.replace(' ', ''))
    word_char_ratio = word_count / max(1, char_count)
    
    if word_char_ratio < 0.1:
        return 'limited'
        
    return 'good'


def update_document_extraction_quality(document_id: int) -> None:
    """
    Evaluate and update the text extraction quality for a document
    
    Args:
        document_id (int): The document ID to evaluate
    """
    document = Document.query.get(document_id)
    if not document:
        logger.error(f"Document {document_id} not found")
        return
    
    quality = detect_text_extraction_quality(document.full_text or '')
    document.text_extraction_quality = quality
    
    try:
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to update extraction quality for document {document_id}: {str(e)}")


def perform_ocr_on_document(document_id: int) -> Tuple[bool, str]:
    """
    Perform OCR processing on a document
    
    Args:
        document_id (int): The document ID to process
        
    Returns:
        Tuple[bool, str]: Success flag and message/error
    """
    document = Document.query.get(document_id)
    if not document:
        return False, f"Document {document_id} not found"
    
    # Update OCR status
    document.ocr_status = 'processing'
    document.ocr_requested_at = datetime.datetime.utcnow()
    db.session.commit()
    
    try:
        # Get the PDF file path
        pdf_path = os.path.join('uploads', document.filename)
        if not os.path.exists(pdf_path):
            error_msg = f"PDF file not found: {pdf_path}"
            document.ocr_status = 'failed'
            document.ocr_error = error_msg
            db.session.commit()
            return False, error_msg
        
        try:
            # Convert PDF to images
            logger.info(f"Converting PDF to images: {pdf_path}")
            images = convert_from_path(pdf_path)
            
            # Extract text from each image using OCR
            extracted_texts = []
            for i, image in enumerate(images):
                logger.info(f"Processing page {i+1}/{len(images)} for document {document_id}")
                try:
                    text = pytesseract.image_to_string(image)
                    extracted_texts.append(text)
                except Exception as ocr_err:
                    logger.error(f"OCR error on page {i+1}: {str(ocr_err)}")
                    # Continue with other pages even if one fails
                    extracted_texts.append(f"[OCR ERROR ON PAGE {i+1}]")
            
            # If no text was extracted at all, fail the OCR
            if not extracted_texts or all(not text.strip() for text in extracted_texts):
                raise Exception("No text could be extracted from any page")
                
            # Combine and clean the extracted text
            full_text = "\n\n".join(extracted_texts)
            full_text = clean_text(full_text)
            
            # Update document with OCR text
            document.full_text = full_text
            document.processed = True
            document.ocr_status = 'completed'
            document.ocr_completed_at = datetime.datetime.utcnow()
            db.session.commit()
            
            # Delete existing chunks and embeddings if any
            existing_chunks = TextChunk.query.filter_by(document_id=document_id).all()
            for chunk in existing_chunks:
                embedding = VectorEmbedding.query.filter_by(chunk_id=chunk.id).first()
                if embedding:
                    db.session.delete(embedding)
                db.session.delete(chunk)
            db.session.commit()
            
            # Create new chunks and embeddings
            chunks = chunk_text(full_text)
            for i, chunk_text in enumerate(chunks):
                # Create text chunk
                chunk = TextChunk(
                    document_id=document_id,
                    text=chunk_text,
                    chunk_index=i
                )
                db.session.add(chunk)
                db.session.flush()  # Flush to get the chunk ID
                
                # Generate embedding for the chunk
                embedding_vector = generate_embeddings(chunk_text)
                if embedding_vector:
                    embedding = VectorEmbedding(
                        chunk_id=chunk.id,
                        embedding=embedding_vector
                    )
                    db.session.add(embedding)
            
            db.session.commit()
            logger.info(f"OCR processing completed for document {document_id}")
            return True, "OCR processing completed successfully"
            
        except Exception as ocr_err:
            error_msg = f"OCR processing error: {str(ocr_err)}"
            logger.error(f"OCR error for document {document_id}: {error_msg}")
            document.ocr_status = 'failed'
            document.ocr_error = error_msg
            db.session.commit()
            return False, error_msg
        
    except Exception as e:
        db.session.rollback()
        error_msg = str(e)
        logger.error(f"OCR processing failed for document {document_id}: {error_msg}")
        
        # Update document status
        document = Document.query.get(document_id)
        if document:
            document.ocr_status = 'failed'
            document.ocr_error = error_msg
            db.session.commit()
            
        return False, f"OCR processing failed: {error_msg}"


def add_to_ocr_queue(document_id: int) -> Tuple[bool, str]:
    """
    Add a document to the OCR processing queue
    
    Args:
        document_id (int): The document ID to add to queue
        
    Returns:
        Tuple[bool, str]: Success flag and message/error
    """
    document = Document.query.get(document_id)
    if not document:
        return False, f"Document {document_id} not found"
    
    # Check if document is already in the processing queue
    existing_queue = ProcessingQueue.query.filter(
        ProcessingQueue.document_id == document_id,
        ProcessingQueue.status.in_(['pending', 'processing'])
    ).first()
    
    if existing_queue:
        return False, f"Document {document_id} is already in the processing queue"
    
    # Update document OCR status
    document.ocr_status = 'pending'
    document.ocr_requested_at = datetime.datetime.utcnow()
    
    # Add to processing queue
    queue_entry = ProcessingQueue(
        document_id=document_id,
        status='pending',
        queued_at=datetime.datetime.utcnow()
    )
    
    try:
        db.session.add(queue_entry)
        db.session.commit()
        logger.info(f"Document {document_id} added to OCR processing queue")
        return True, "Document added to OCR processing queue"
    except SQLAlchemyError as e:
        db.session.rollback()
        error_msg = str(e)
        logger.error(f"Failed to add document {document_id} to OCR queue: {error_msg}")
        return False, f"Failed to add document to OCR queue: {error_msg}"