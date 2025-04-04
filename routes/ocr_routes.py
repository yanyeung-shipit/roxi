import os
import logging
from flask import Blueprint, jsonify, request, current_app
from models import Document
from app import db
from utils.ocr_processor import request_ocr_processing

logger = logging.getLogger(__name__)

ocr_routes = Blueprint('ocr_routes', __name__)

@ocr_routes.route('/api/documents/<int:document_id>/ocr', methods=['POST'])
def request_document_ocr(document_id):
    """
    Request OCR processing for a document
    """
    logger.info(f"OCR processing requested for document: {document_id}")
    
    # Check if document exists
    document = Document.query.get(document_id)
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    # Check if OCR processing is already in progress
    if document.ocr_status in ('pending', 'processing'):
        return jsonify({'error': 'OCR processing already in progress for this document'}), 400
        
    # Request OCR processing
    success = request_ocr_processing(document_id)
    
    if success:
        return jsonify({
            'message': 'OCR processing requested successfully',
            'status': document.ocr_status,
            'document_id': document_id
        })
    else:
        return jsonify({'error': 'Failed to request OCR processing'}), 500


@ocr_routes.route('/api/documents/<int:document_id>/ocr/status', methods=['GET'])
def get_ocr_status(document_id):
    """
    Get the OCR processing status for a document
    """
    document = Document.query.get(document_id)
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    return jsonify({
        'document_id': document_id,
        'ocr_status': document.ocr_status,
        'text_extraction_quality': document.text_extraction_quality,
        'ocr_requested_at': document.ocr_requested_at.isoformat() if document.ocr_requested_at else None,
        'ocr_completed_at': document.ocr_completed_at.isoformat() if document.ocr_completed_at else None,
        'ocr_error': document.ocr_error
    })