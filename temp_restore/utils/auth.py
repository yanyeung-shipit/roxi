"""
Authentication utilities for the ROXI application.
Provides basic HTTP authentication functionality to protect admin routes.
"""

import os
import logging
from functools import wraps
from flask import request, Response

logger = logging.getLogger(__name__)

def requires_auth(f):
    """
    Decorator to require HTTP Basic Authentication for a route.
    
    Usage:
        @app.route('/admin')
        @requires_auth
        def admin():
            return 'Admin page'
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get authentication credentials from environment variables
        # Default values are used only for development
        admin_user = os.environ.get("ADMIN_USER", "admin")
        admin_pass = os.environ.get("ADMIN_PASS", "roxi_admin")
        
        # Check if authentication is provided and valid
        auth = request.authorization
        if not auth or auth.username != admin_user or auth.password != admin_pass:
            # Log failed authentication attempt
            if auth:
                logger.warning(f"Failed authentication attempt with username: {auth.username}")
            else:
                logger.info("Authentication required for protected route")
                
            # Return 401 response with WWW-Authenticate header
            return Response(
                'Authentication required to access this area',
                401,
                {'WWW-Authenticate': 'Basic realm="ROXI Admin Area"'}
            )
            
        # Authentication successful
        return f(*args, **kwargs)
    return decorated