import os
import re
import logging
from werkzeug.utils import secure_filename
import PyPDF2
from flask import current_app

logger = logging.getLogger(__name__)

def clean_text(text):
    """
    Clean extracted text by removing XML/HTML-like tags and other formatting artifacts
    
    Args:
        text (str): Text to clean
        
    Returns:
        str: Cleaned text
    """
    if not text:
        return text
        
    # Remove <scp> tags (small caps formatting commonly found in medical PDFs)
    text = re.sub(r'</?scp>', '', text)
    
    # Remove other common formatting tags
    text = re.sub(r'</?[a-z]+>', '', text)  # Simple HTML-like tags
    
    return text

def extract_text_from_pdf(pdf_path):
    """
    Extract text content from a PDF file
    
    Args:
        pdf_path (str): Path to the PDF file
        
    Returns:
        str: Extracted text from the PDF, or None if extraction failed
    """
    try:
        text = ""
        with open(pdf_path, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            # Extract text from each page
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n\n"
        
        # Clean the text to remove formatting artifacts
        text = clean_text(text)
        
        return text
    except Exception as e:
        logger.exception(f"Error extracting text from PDF: {pdf_path}")
        return None

def chunk_text(text, chunk_size=1000, overlap=200):
    """
    Split text into overlapping chunks for processing
    
    Args:
        text (str): The text to split into chunks
        chunk_size (int): Target size of each chunk in characters
        overlap (int): Number of characters to overlap between chunks
        
    Returns:
        list: List of text chunks
    """
    if not text:
        return []
    
    # Clean the text by removing excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    chunks = []
    start = 0
    
    while start < len(text):
        # Calculate end position with potential overlap
        end = min(start + chunk_size, len(text))
        
        # If we're not at the end of the text, try to find a sentence boundary
        if end < len(text):
            # Look for sentence boundaries (.!?) followed by a space and capital letter
            sentence_match = re.search(r'[.!?]\s+[A-Z]', text[end-100:end+100])
            if sentence_match:
                # Adjust the end to the sentence boundary
                end = end - 100 + sentence_match.start() + 1  # Include the punctuation
        
        # Add the chunk to our list
        chunks.append(text[start:end])
        
        # Move start position for next chunk, considering overlap
        start = end - overlap if end < len(text) else end
    
    return chunks

def save_uploaded_pdf(uploaded_file, filename=None):
    """
    Save an uploaded PDF file to a temporary location
    
    Args:
        uploaded_file: The uploaded file object from Flask
        filename (str, optional): Custom filename to use
        
    Returns:
        str: Path to the saved PDF file
    """
    try:
        if filename is None:
            filename = secure_filename(uploaded_file.filename)
        
        # Get upload folder from config, or use a fallback
        upload_folder = current_app.config.get("UPLOAD_FOLDER")
        if not upload_folder:
            logger.warning("UPLOAD_FOLDER not configured, using default")
            upload_folder = os.path.join(os.getcwd(), "uploads")
            
        # Ensure upload directory exists
        os.makedirs(upload_folder, exist_ok=True)
        
        file_path = os.path.join(upload_folder, filename)
        
        # Check if we have write permissions
        try:
            with open(file_path, 'wb') as test_file:
                pass
            os.remove(file_path)
        except (IOError, PermissionError) as e:
            logger.error(f"File permission error: {str(e)}")
            # Fallback to a temp directory if we can't write to the configured one
            import tempfile
            temp_dir = tempfile.gettempdir()
            logger.info(f"Falling back to temp directory: {temp_dir}")
            file_path = os.path.join(temp_dir, filename)
        
        # Save the file
        uploaded_file.save(file_path)
        logger.info(f"PDF saved to: {file_path}")
        
        # Verify file exists and has content
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File {file_path} not found after saving")
        
        if os.path.getsize(file_path) == 0:
            raise IOError(f"File {file_path} saved but has zero size")
        
        return file_path
        
    except Exception as e:
        logger.exception(f"Error saving PDF file: {str(e)}")
        raise