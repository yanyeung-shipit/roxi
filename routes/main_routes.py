import os
import logging
import uuid
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, current_app
from werkzeug.utils import secure_filename

from app import db
from models import Document, QueryHistory, ProcessingQueue
from tasks import process_document
from utils.pdf_processor import save_uploaded_pdf
from utils.embeddings import search_similar_chunks
from utils.citation_generator import format_citation_for_response

logger = logging.getLogger(__name__)

# Create blueprint
main_routes = Blueprint('main', __name__)

@main_routes.route('/')
def index():
    """Render the main page of the application"""
    return render_template('index.html')

@main_routes.route('/upload', methods=['POST'])
def upload_documents():
    """
    Handle document uploads, save them, and queue for processing
    """
    if 'files[]' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No files uploaded'
        }), 400
    
    files = request.files.getlist('files[]')
    if len(files) == 0:
        return jsonify({
            'success': False,
            'error': 'No files selected'
        }), 400
    
    if len(files) > 50:
        return jsonify({
            'success': False,
            'error': f'Too many files. Maximum 50 allowed, got {len(files)}'
        }), 400
    
    # Process each uploaded file
    success_count = 0
    errors = []
    
    for file in files:
        if file.filename == '':
            errors.append(f'Empty filename')
            continue
        
        # Check file extension
        if not file.filename.lower().endswith('.pdf'):
            errors.append(f'Invalid file: {file.filename} (only PDFs allowed)')
            continue
        
        try:
            # Save the uploaded file
            filename = secure_filename(file.filename)
            unique_filename = f"{str(uuid.uuid4())[:8]}_{filename}"
            saved_path = save_uploaded_pdf(file, unique_filename)
            
            # Create document record in database
            document = Document(
                filename=unique_filename,
                title=os.path.splitext(filename)[0][:500],  # Use filename as initial title (will be updated during processing)
                upload_date=datetime.utcnow()
            )
            db.session.add(document)
            db.session.flush()  # Get the document ID
            
            # Add to processing queue
            queue_entry = ProcessingQueue(document_id=document.id)
            db.session.add(queue_entry)
            db.session.commit()
            
            # Start background processing
            process_document.delay(document.id)
            
            success_count += 1
            
        except Exception as e:
            logger.exception(f"Error processing file {file.filename}")
            errors.append(f'Error processing {file.filename}: {str(e)}')
            db.session.rollback()
    
    if success_count > 0:
        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {success_count} document(s)',
            'errors': errors
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Failed to upload any documents',
            'errors': errors
        }), 400

@main_routes.route('/query', methods=['POST'])
def query():
    """
    Process a user query and return results with citations
    """
    data = request.json
    if not data or 'query' not in data:
        return jsonify({
            'success': False,
            'error': 'Query is required'
        }), 400
    
    query_text = data.get('query')
    conversation_id = data.get('conversation_id')
    
    if not conversation_id:
        conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
    
    try:
        # Search for similar chunks
        similar_chunks = search_similar_chunks(query_text, top_k=5)
        
        # TODO: In a real RAG system, we would fetch these chunks and use an LLM to generate a response
        # For demonstration, we'll return a canned response with real citations
        
        # Get chunk texts and documents
        citations = []
        if similar_chunks:
            from models import TextChunk
            
            chunk_ids = [chunk_id for chunk_id, _ in similar_chunks]
            chunks = TextChunk.query.filter(TextChunk.id.in_(chunk_ids)).all()
            
            for chunk in chunks:
                doc = chunk.document
                citation = format_citation_for_response(
                    doc.citation_apa or "Citation not available",
                    doc.id,
                    chunk.id
                )
                citation['title'] = doc.title
                citation['authors'] = doc.authors
                citation['journal'] = doc.journal
                citation['doi'] = doc.doi
                citation['snippet'] = chunk.text[:150] + "..." if len(chunk.text) > 150 else chunk.text
                citations.append(citation)
        
        # Store the query and response in history
        response_text = "This is a placeholder response for your query. In a real RAG system, the retrieved document chunks would be sent to an LLM to generate a coherent answer."
        
        query_history = QueryHistory(
            query_text=query_text,
            response=response_text,
            citations=citations,
            conversation_id=conversation_id
        )
        db.session.add(query_history)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'response': response_text,
            'citations': citations,
            'conversation_id': conversation_id
        })
    
    except Exception as e:
        logger.exception(f"Error processing query: {query_text}")
        return jsonify({
            'success': False,
            'error': f"Error processing query: {str(e)}"
        }), 500

@main_routes.route('/conversation/<conversation_id>')
def get_conversation(conversation_id):
    """
    Get the history of a conversation
    """
    if not conversation_id:
        return jsonify([])
    
    try:
        # Get conversation history ordered by timestamp
        history = QueryHistory.query.filter_by(conversation_id=conversation_id).order_by(QueryHistory.timestamp).all()
        
        # Format history for response
        formatted_history = []
        for entry in history:
            formatted_history.append({
                'role': 'user',
                'content': entry.query_text,
                'timestamp': entry.timestamp.isoformat()
            })
            formatted_history.append({
                'role': 'assistant',
                'content': entry.response,
                'citations': entry.citations,
                'timestamp': entry.timestamp.isoformat()
            })
        
        return jsonify(formatted_history)
    
    except Exception as e:
        logger.exception(f"Error fetching conversation: {conversation_id}")
        return jsonify([]), 500