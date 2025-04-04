import os
import logging
import datetime
import pytesseract
import pdf2image
import threading
import numpy as np
import time
from models import Document
from app import db
from utils.document_processor import update_document_chunks

logger = logging.getLogger(__name__)

# Global OCR processor thread instance and control flag
ocr_processor_thread = None
ocr_processor_running = False

def estimate_text_quality(text):
    """
    Estimate the quality of extracted text to determine if OCR is needed
    
    Args:
        text (str): The extracted text to evaluate
        
    Returns:
        str: Quality estimation ('normal', 'low', or 'ocr_needed')
    """
    if not text or len(text) < 100:
        return 'ocr_needed'
    
    # Check for common indicators of poor text extraction
    issues = 0
    
    # Check for non-alphanumeric characters ratio
    non_alnum = sum(1 for c in text if not c.isalnum() and not c.isspace())
    total_chars = len(text)
    non_alnum_ratio = non_alnum / total_chars if total_chars > 0 else 0
    
    if non_alnum_ratio > 0.4:  # More than 40% non-alphanumeric characters
        issues += 1
    
    # Check for lack of spaces (indicates words running together)
    space_ratio = text.count(' ') / total_chars if total_chars > 0 else 0
    if space_ratio < 0.05:  # Less than 5% spaces
        issues += 1
    
    # Check for an unusual number of special Unicode characters
    unusual_chars = sum(1 for c in text if ord(c) > 127)
    unusual_ratio = unusual_chars / total_chars if total_chars > 0 else 0
    if unusual_ratio > 0.2:  # More than 20% unusual characters
        issues += 2
    
    # Check for common OCR artifacts or text extraction errors
    error_markers = ['�', '□', '■', '▪', '○', '●', '©', '®', '™']
    for marker in error_markers:
        if marker in text:
            issues += 1
    
    # Decide based on issues found
    if issues >= 3:
        return 'ocr_needed'
    elif issues >= 1:
        return 'low'
    else:
        return 'normal'

def extract_text_via_ocr(pdf_path):
    """
    Extract text from a PDF using OCR processing
    
    Args:
        pdf_path (str): Path to the PDF file
        
    Returns:
        str: Extracted text from OCR
    """
    logger.info(f"Starting OCR extraction for: {pdf_path}")
    
    try:
        # Convert PDF to images
        images = pdf2image.convert_from_path(pdf_path, dpi=300)
        
        if not images:
            logger.error(f"Failed to convert PDF to images: {pdf_path}")
            return ""
        
        extracted_text = []
        
        # Process each page with pytesseract
        for i, image in enumerate(images):
            logger.info(f"Processing page {i+1}/{len(images)} with OCR")
            
            # Convert to numpy array for OpenCV processing (grayscale)
            image_np = np.array(image)
            
            # Extract text from image
            page_text = pytesseract.image_to_string(image_np, lang='eng')
            extracted_text.append(page_text)
            
            # Log progress for every page
            if (i+1) % max(1, len(images)//10) == 0:
                logger.info(f"OCR progress: {i+1}/{len(images)} pages processed")
        
        # Combine all pages
        full_text = "\n\n".join(extracted_text)
        
        logger.info(f"OCR extraction completed for: {pdf_path}")
        return full_text
        
    except Exception as e:
        logger.exception(f"Error during OCR extraction: {str(e)}")
        return ""

def request_ocr_processing(document_id):
    """
    Request OCR processing for a document
    
    Args:
        document_id (int): The ID of the document to process
        
    Returns:
        bool: True if request was successful, False otherwise
    """
    try:
        # Get the document
        document = Document.query.get(document_id)
        
        if not document:
            logger.error(f"Document not found for OCR request: {document_id}")
            return False
        
        # Update document status
        document.ocr_status = 'pending'
        document.ocr_requested_at = datetime.datetime.utcnow()
        document.ocr_error = None
        db.session.commit()
        
        # Start the OCR processor if not already running
        start_ocr_processor()
        
        logger.info(f"OCR processing requested for document: {document_id}")
        return True
        
    except Exception as e:
        logger.exception(f"Error requesting OCR processing: {str(e)}")
        db.session.rollback()
        return False

def start_ocr_processor():
    """Start the background OCR processor if not already running"""
    global ocr_processor_thread, ocr_processor_running
    
    if ocr_processor_thread is None or not ocr_processor_thread.is_alive():
        ocr_processor_running = True
        ocr_processor_thread = threading.Thread(target=ocr_background_processor, daemon=True)
        ocr_processor_thread.start()
        logger.info("OCR background processor started")

def ocr_background_processor():
    """Background thread to process OCR requests from the queue"""
    global ocr_processor_running
    logger.info("OCR background processor is running")
    
    while ocr_processor_running:
        try:
            # Find the next pending OCR document
            with db.create_scoped_session() as session:
                document = session.query(Document).filter_by(ocr_status='pending').order_by(Document.ocr_requested_at).first()
                
                if document:
                    logger.info(f"Processing OCR for document: {document.id}")
                    
                    # Process the document
                    document.ocr_status = 'processing'
                    session.commit()
                    
                    # Process in a separate context to avoid session issues
                    process_document_ocr(document.id)
                    
                else:
                    # No documents to process, sleep before checking again
                    time.sleep(5)
                    
        except Exception as e:
            logger.exception(f"Error in OCR background processor: {str(e)}")
            time.sleep(5)
    
    logger.info("OCR background processor stopped")

def process_document_ocr(document_id):
    """
    Process a document using OCR
    
    Args:
        document_id (int): The ID of the document to process
        
    Returns:
        bool: True if processing was successful, False otherwise
    """
    try:
        # Get the document
        document = Document.query.get(document_id)
        
        if not document:
            logger.error(f"Document not found for OCR processing: {document_id}")
            return False
        
        # Get the file path
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        file_path = os.path.join(upload_folder, document.filename)
        
        if not os.path.exists(file_path):
            logger.error(f"PDF file not found for OCR processing: {file_path}")
            document.ocr_status = 'failed'
            document.ocr_error = f"PDF file not found: {document.filename}"
            document.ocr_completed_at = datetime.datetime.utcnow()
            db.session.commit()
            return False
        
        # Extract text using OCR
        ocr_text = extract_text_via_ocr(file_path)
        
        if not ocr_text:
            logger.error(f"OCR extraction failed for document: {document_id}")
            document.ocr_status = 'failed'
            document.ocr_error = "OCR extraction failed"
            document.ocr_completed_at = datetime.datetime.utcnow()
            db.session.commit()
            return False
        
        # Update document with OCR text
        document.full_text = ocr_text
        document.text_extraction_quality = 'ocr_processed'
        document.ocr_status = 'completed'
        document.ocr_completed_at = datetime.datetime.utcnow()
        db.session.commit()
        
        # Update document chunks and embeddings
        update_document_chunks(document_id)
        
        logger.info(f"OCR processing completed for document: {document_id}")
        return True
        
    except Exception as e:
        logger.exception(f"Error during OCR processing: {str(e)}")
        try:
            document = Document.query.get(document_id)
            if document:
                document.ocr_status = 'failed'
                document.ocr_error = str(e)
                document.ocr_completed_at = datetime.datetime.utcnow()
                db.session.commit()
        except:
            logger.exception("Failed to update document with OCR error status")
        return False