import os
import logging
import uuid
import re
import datetime
from urllib.parse import urlparse
import trafilatura
import requests
from bs4 import BeautifulSoup

from app import db
from models import Document, TextChunk, VectorEmbedding, ProcessingQueue
from utils.pdf_processor import chunk_text, clean_text
from utils.embeddings import generate_embeddings

# Set up logging
logger = logging.getLogger(__name__)

def is_valid_url(url):
    """
    Check if a URL is valid
    
    Args:
        url (str): The URL to validate
        
    Returns:
        bool: True if the URL is valid, False otherwise
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
    except Exception:
        return False

def extract_text_from_webpage(url):
    """
    Extract text content from a webpage
    
    Args:
        url (str): URL of the webpage
        
    Returns:
        tuple: (text content, title, authors, date)
    """
    try:
        # Extract main content using trafilatura
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            logger.warning(f"Failed to download content from {url}")
            return None, None, None, None
        
        # Extract the content
        result = trafilatura.extract(downloaded, include_comments=False, include_tables=True, 
                                   include_links=True, include_images=False, 
                                   output_format='txt')
        
        # Extract metadata using trafilatura
        metadata = trafilatura.extract_metadata(downloaded)
        
        title = None
        authors = None
        date = None
        
        if metadata:
            title = metadata.title
            
            # Get authors if available
            if metadata.author:
                if isinstance(metadata.author, list):
                    authors = ', '.join(metadata.author)
                else:
                    authors = metadata.author
            
            # Get date if available
            if metadata.date:
                date = metadata.date
        
        # If content extraction failed, try a fallback approach with BeautifulSoup
        if not result:
            logger.warning(f"Primary extraction failed for {url}, trying fallback method")
            response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Remove unwanted elements
                for element in soup(['script', 'style', 'header', 'footer', 'nav']):
                    element.decompose()
                
                # Get text content
                result = soup.get_text(separator='\n\n')
                
                # Get title if not already found
                if not title and soup.title:
                    title = soup.title.text.strip()
                
                # Get authors if not already found
                if not authors:
                    author_meta = soup.find('meta', {'name': ['author', 'authors']})
                    if author_meta and author_meta.get('content'):
                        authors = author_meta.get('content')
        
        # Clean the result
        if result:
            result = clean_text(result)
            result = re.sub(r'\n{3,}', '\n\n', result)  # Remove excessive newlines
        
        return result, title, authors, date
    
    except Exception as e:
        logger.exception(f"Error extracting text from webpage {url}: {str(e)}")
        return None, None, None, None

def process_webpage(url, collection_id=None):
    """
    Process a webpage, extract its content, and store in database
    
    Args:
        url (str): URL of the webpage to process
        collection_id (int, optional): Collection ID to assign to the document
        
    Returns:
        int: ID of created document or None if failed
    """
    try:
        # Extract text and metadata from webpage
        text, title, authors, date = extract_text_from_webpage(url)
        
        if not text:
            logger.error(f"Failed to extract text from {url}")
            return None
        
        # Create a safe filename from the URL
        parsed_url = urlparse(url)
        domain = parsed_url.netloc
        path = parsed_url.path.replace('/', '_')
        if path == '_':
            path = 'index'
        
        # Generate a unique filename
        unique_id = uuid.uuid4().hex[:8]
        filename = f"webpage_{unique_id}_{domain}{path}"[:200]  # Limit length
        
        # Prepare publication date
        publication_date = None
        if date:
            try:
                if isinstance(date, datetime.datetime):
                    publication_date = date
                else:
                    # Try to parse the date string
                    from dateutil import parser
                    publication_date = parser.parse(date)
            except Exception as e:
                logger.warning(f"Failed to parse publication date: {date}, {str(e)}")
        
        # Create document record
        document = Document(
            filename=filename,
            title=title or f"Webpage: {domain}",
            authors=authors,
            publication_date=publication_date,
            journal=domain,
            tags=["webpage"],
            full_text=text,
            collection_id=collection_id if collection_id else None
        )
        
        db.session.add(document)
        db.session.commit()
        
        # Process the content immediately without using queue
        success = process_webpage_content(document.id, text)
        
        if success:
            logger.info(f"Successfully processed webpage: {url}")
            return document.id
        else:
            logger.error(f"Failed to process webpage content for {url}")
            return None
        
    except Exception as e:
        logger.exception(f"Error processing webpage {url}: {str(e)}")
        db.session.rollback()
        return None

def process_webpage_content(document_id, text):
    """
    Process webpage content, create chunks, and generate embeddings
    
    Args:
        document_id (int): Document ID
        text (str): Text content of the webpage
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Get the document
        document = Document.query.get(document_id)
        queue_entry = ProcessingQueue.query.filter_by(document_id=document_id).first()
        
        if not document:
            logger.error(f"Document not found for ID: {document_id}")
            return False
        
        # Create chunks from text
        chunks = chunk_text(text)
        logger.info(f"Created {len(chunks)} chunks for document {document_id}")
        
        # Store chunks in database
        for idx, chunk_text in enumerate(chunks):
            chunk = TextChunk(
                document_id=document_id,
                text=chunk_text,
                chunk_index=idx
            )
            db.session.add(chunk)
        
        db.session.commit()
        
        # Generate embeddings for each chunk
        text_chunks = TextChunk.query.filter_by(document_id=document_id).all()
        for chunk in text_chunks:
            embedding = generate_embeddings(chunk.text)
            
            if embedding:
                vector = VectorEmbedding(
                    chunk_id=chunk.id,
                    embedding=embedding
                )
                db.session.add(vector)
        
        db.session.commit()
        
        # Update document as processed
        document.processed = True
        
        # Update queue entry as completed if it exists
        if queue_entry:
            queue_entry.status = 'completed'
            queue_entry.completed_at = datetime.datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Successfully processed webpage document {document_id}")
        return True
        
    except Exception as e:
        logger.exception(f"Error processing webpage content for document {document_id}: {str(e)}")
        
        # Update queue entry as failed if it exists
        if queue_entry:
            queue_entry.status = 'failed'
            queue_entry.error_message = str(e)
            db.session.commit()
            
        return False