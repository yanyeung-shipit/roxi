"""
Webpage Processor Module

This module provides functionality to crawl webpages, extract content,
and process them for RAG.
"""

import os
import re
import logging
import datetime
import threading
import time
import queue
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import trafilatura

from app import db, app
from models import Webpage, TextChunk, VectorEmbedding, WebpageProcessingQueue
from utils.pdf_processor import clean_text
from utils.embeddings import generate_embeddings

# Set up logging
logger = logging.getLogger(__name__)

# Global variables for the background processor
webpage_queue = queue.Queue()
processor_running = False
processor_lock = threading.Lock()

def validate_url(url):
    """
    Validate that a URL is properly formatted
    
    Args:
        url (str): URL to validate
        
    Returns:
        bool: True if URL is valid, False otherwise
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def extract_content_with_trafilatura(url):
    """
    Extract the main content from a webpage using Trafilatura
    
    Args:
        url (str): URL of the webpage to extract content from
        
    Returns:
        tuple: (title, content) or (None, None) if extraction failed
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            result = trafilatura.extract(downloaded, include_comments=False, 
                                     include_tables=True, output_format='text')
            if result:
                # Try to extract title
                soup = BeautifulSoup(downloaded, 'html.parser')
                title = soup.title.string if soup.title else None
                
                return title, result
        return None, None
    except Exception as e:
        logger.exception(f"Error extracting content with Trafilatura: {str(e)}")
        return None, None

def extract_content_with_bs4(url):
    """
    Extract the main content from a webpage using BeautifulSoup as a fallback
    
    Args:
        url (str): URL of the webpage to extract content from
        
    Returns:
        tuple: (title, content) or (None, None) if extraction failed
    """
    try:
        headers = {
            'User-Agent': 'ROXI-Rheumatology/1.0 (Research Tool)'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract title
        title = soup.title.string if soup.title else None
        
        # Remove script and style elements
        for script in soup(["script", "style", "header", "footer", "nav"]):
            script.extract()
        
        # Get text and clean it
        text = soup.get_text(separator=' ', strip=True)
        
        # Clean the text
        text = re.sub(r'\s+', ' ', text).strip()
        
        return title, text
    except Exception as e:
        logger.exception(f"Error extracting content with BeautifulSoup: {str(e)}")
        return None, None

def extract_webpage_content(url):
    """
    Extract the content from a webpage using multiple methods
    
    Args:
        url (str): URL of the webpage to extract content from
        
    Returns:
        tuple: (title, content) or (None, None) if extraction failed
    """
    # First try with Trafilatura for best content extraction
    title, content = extract_content_with_trafilatura(url)
    
    # If that fails, try with BeautifulSoup
    if not content:
        title, content = extract_content_with_bs4(url)
    
    # Clean the content if we have it
    if content:
        content = clean_text(content)
    
    return title, content

def chunk_webpage_content(content, max_chunk_size=1000, overlap=200):
    """
    Split webpage content into overlapping chunks for processing
    
    Args:
        content (str): The text content to split into chunks
        max_chunk_size (int): Maximum size of each chunk in characters
        overlap (int): Number of characters to overlap between chunks
        
    Returns:
        list: List of text chunks
    """
    from utils.pdf_processor import chunk_text
    return chunk_text(content, chunk_size=max_chunk_size, overlap=overlap)

def create_chunks_for_webpage(webpage):
    """
    Create text chunks for a webpage and store them in the database
    
    Args:
        webpage (Webpage): The webpage model object
        
    Returns:
        list: List of created TextChunk objects
    """
    if not webpage.content:
        logger.error(f"No content to chunk for webpage {webpage.id}")
        return []
    
    # Chunk the content
    chunks = chunk_webpage_content(webpage.content)
    
    if not chunks:
        logger.error(f"Failed to create chunks for webpage {webpage.id}")
        return []
    
    # Store chunks in database
    created_chunks = []
    for idx, chunk_text in enumerate(chunks):
        chunk = TextChunk(
            webpage_id=webpage.id,
            text=chunk_text,
            chunk_index=idx
        )
        db.session.add(chunk)
        created_chunks.append(chunk)
    
    db.session.commit()
    logger.info(f"Created {len(created_chunks)} chunks for webpage {webpage.id}")
    
    return created_chunks

def create_embeddings_for_chunks(chunks):
    """
    Create vector embeddings for webpage chunks
    
    Args:
        chunks (list): List of TextChunk objects
        
    Returns:
        list: List of created VectorEmbedding objects
    """
    if not chunks:
        return []
    
    created_embeddings = []
    for chunk in chunks:
        embedding_vec = generate_embeddings(chunk.text)
        if embedding_vec is not None:
            embedding = VectorEmbedding(
                chunk_id=chunk.id,
                embedding=embedding_vec
            )
            db.session.add(embedding)
            created_embeddings.append(embedding)
    
    if created_embeddings:
        db.session.commit()
        logger.info(f"Created {len(created_embeddings)} embeddings for webpage chunks")
    
    return created_embeddings

def process_webpage(webpage_id):
    """
    Process a webpage's content and generate embeddings
    
    Args:
        webpage_id (int): ID of the webpage to process
        
    Returns:
        bool: True if processing succeeded, False otherwise
    """
    logger.info(f"Starting to process webpage: {webpage_id}")
    
    # Get the webpage and its queue entry
    webpage = Webpage.query.get(webpage_id)
    queue_entry = WebpageProcessingQueue.query.filter_by(webpage_id=webpage_id).first()
    
    if not webpage:
        logger.error(f"Webpage not found for ID: {webpage_id}")
        return False
    
    try:
        # Update queue status to processing if it exists
        if queue_entry:
            queue_entry.status = 'processing'
            queue_entry.started_at = datetime.datetime.utcnow()
            db.session.commit()
        
        # Extract content if not already extracted
        if not webpage.content:
            title, content = extract_webpage_content(webpage.url)
            
            if not content:
                raise ValueError(f"Failed to extract content from webpage: {webpage.url}")
            
            # Update the webpage with the extracted content
            if title and not webpage.title:
                webpage.title = title
            
            webpage.content = content
            webpage.last_updated = datetime.datetime.utcnow()
            db.session.commit()
        
        # Create chunks
        chunks = create_chunks_for_webpage(webpage)
        
        # Generate embeddings for chunks
        create_embeddings_for_chunks(chunks)
        
        # Mark webpage as processed
        webpage.processed = True
        
        # Update queue status to completed if it exists
        if queue_entry:
            queue_entry.status = 'completed'
            queue_entry.completed_at = datetime.datetime.utcnow()
        
        db.session.commit()
        logger.info(f"Successfully processed webpage: {webpage_id}")
        
        return True
        
    except Exception as e:
        logger.exception(f"Error processing webpage {webpage_id}: {str(e)}")
        
        # Update queue status to failed if it exists
        if queue_entry:
            queue_entry.status = 'failed'
            queue_entry.error_message = str(e)
            queue_entry.completed_at = datetime.datetime.utcnow()
            db.session.commit()
        
        return False

def background_processor():
    """Background thread to process webpages from the queue"""
    global processor_running
    
    logger.info("Background webpage processor started")
    
    try:
        while True:
            try:
                # Try to get a webpage ID from the queue with timeout
                try:
                    webpage_id = webpage_queue.get(timeout=5)
                except queue.Empty:
                    # No webpages in queue, check for pending ones in database
                    with app.app_context():
                        pending_queue = WebpageProcessingQueue.query.filter_by(status='pending').all()
                        if pending_queue:
                            for entry in pending_queue:
                                webpage_queue.put(entry.webpage_id)
                            continue
                    # If no webpages in queue or database, just continue the loop
                    continue
                
                logger.info(f"Processing webpage {webpage_id} from queue")
                
                # Process webpage with app context
                with app.app_context():
                    process_webpage(webpage_id)
                
                # Mark task as complete
                webpage_queue.task_done()
                
            except Exception as e:
                logger.exception(f"Error in background processor: {str(e)}")
            
    except Exception as e:
        logger.exception(f"Webpage processor thread terminated: {str(e)}")
        with processor_lock:
            processor_running = False

def process_webpage_job(webpage_id):
    """Add webpage to processing queue"""
    logger.info(f"Adding webpage {webpage_id} to processing queue")
    webpage_queue.put(webpage_id)
    
    # Start the background processor if not already running
    start_background_processor()
    return True

def start_background_processor():
    """Start the background webpage processor if not already running"""
    global processor_running
    
    with processor_lock:
        if not processor_running:
            logger.info("Starting background webpage processor")
            processor_thread = threading.Thread(target=background_processor)
            processor_thread.daemon = True
            processor_thread.start()
            processor_running = True
    return processor_running

def crawl_webpage(url, collection_id=None):
    """
    Crawl a webpage and add it to the database for processing
    
    Args:
        url (str): URL of the webpage to crawl
        collection_id (int, optional): ID of the collection to add the webpage to
        
    Returns:
        tuple: (success, message, webpage_id)
    """
    # Validate URL
    if not validate_url(url):
        return False, "Invalid URL format", None
    
    try:
        # Check if the webpage already exists
        existing_webpage = Webpage.query.filter_by(url=url).first()
        if existing_webpage:
            return False, f"Webpage already exists (ID: {existing_webpage.id})", existing_webpage.id
        
        # Verify collection exists if provided
        if collection_id:
            from models import Collection
            collection = Collection.query.get(collection_id)
            if not collection:
                collection_id = None
        
        # Create webpage record in database
        webpage = Webpage(
            url=url,
            crawl_date=datetime.datetime.utcnow(),
            collection_id=collection_id
        )
        db.session.add(webpage)
        db.session.flush()  # Get the webpage ID
        
        # Add to processing queue
        queue_entry = WebpageProcessingQueue(webpage_id=webpage.id)
        db.session.add(queue_entry)
        db.session.commit()
        
        # Start background processing
        process_webpage_job(webpage.id)
        
        return True, f"Webpage added to processing queue (ID: {webpage.id})", webpage.id
        
    except Exception as e:
        logger.exception(f"Error adding webpage: {str(e)}")
        db.session.rollback()
        return False, f"Error: {str(e)}", None