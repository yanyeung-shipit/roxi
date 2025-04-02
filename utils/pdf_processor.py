import os
import tempfile
import logging
from werkzeug.utils import secure_filename
import PyPDF2

logger = logging.getLogger(__name__)

def extract_text_from_pdf(pdf_path):
    """
    Extract text content from a PDF file
    
    Args:
        pdf_path (str): Path to the PDF file
        
    Returns:
        str: Extracted text from the PDF, or None if extraction failed
    """
    try:
        logger.info(f"Extracting text from PDF: {pdf_path}")
        
        text = ""
        
        with open(pdf_path, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            # Extract text from each page
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                
                if page_text:
                    text += page_text + "\n\n"
        
        logger.info(f"Successfully extracted {len(text)} characters from PDF")
        return text
    
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
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
    
    chunks = []
    start = 0
    
    while start < len(text):
        # Get chunk of target size or remainder of text
        end = min(start + chunk_size, len(text))
        
        # If not at the end of text, try to find a natural break point
        if end < len(text):
            # Look for paragraph, then sentence, then word boundary
            paragraph_break = text.rfind('\n\n', start, end)
            sentence_break = text.rfind('. ', start, end)
            space_break = text.rfind(' ', start, end)
            
            if paragraph_break != -1 and paragraph_break > start + chunk_size * 0.7:
                end = paragraph_break + 2  # Include the newlines
            elif sentence_break != -1 and sentence_break > start + chunk_size * 0.7:
                end = sentence_break + 2  # Include the period and space
            elif space_break != -1:
                end = space_break + 1  # Include the space
        
        # Add the chunk to the list
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        
        # Move to the next chunk, accounting for overlap
        start = max(start, end - overlap)
    
    logger.info(f"Split text into {len(chunks)} chunks")
    return chunks

def save_uploaded_pdf(uploaded_file):
    """
    Save an uploaded PDF file to a temporary location
    
    Args:
        uploaded_file: The uploaded file object from Flask
        
    Returns:
        str: Path to the saved PDF file
    """
    try:
        # Create temporary directory if it doesn't exist
        upload_dir = os.path.join(tempfile.gettempdir(), 'roxi_uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Secure filename and create full path
        filename = secure_filename(uploaded_file.filename)
        file_path = os.path.join(upload_dir, filename)
        
        # Save the file
        uploaded_file.save(file_path)
        logger.info(f"Saved uploaded PDF to {file_path}")
        
        return file_path
    
    except Exception as e:
        logger.error(f"Error saving uploaded PDF: {str(e)}")
        raise