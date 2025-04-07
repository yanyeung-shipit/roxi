import logging
from flask import Blueprint, request, jsonify, current_app
from utils.webpage_processor import process_webpage, is_valid_url

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
webpage_routes = Blueprint('webpage_routes', __name__)

@webpage_routes.route('/api/webpage/process', methods=['POST'])
def handle_webpage_processing():
    """
    Handle webpage URL submission and processing
    """
    try:
        # Get request data
        data = request.json
        url = data.get('url')
        collection_id = data.get('collection_id')
        
        if not url:
            return jsonify({'success': False, 'error': 'URL is required'}), 400
        
        # Validate URL
        if not is_valid_url(url):
            return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
        
        # Process the webpage
        document_id = process_webpage(url, collection_id)
        
        if document_id:
            return jsonify({
                'success': True, 
                'message': 'Webpage processing started',
                'document_id': document_id
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to process webpage'}), 500
            
    except Exception as e:
        logger.exception(f"Error handling webpage processing: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500