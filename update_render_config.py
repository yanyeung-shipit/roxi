#!/usr/bin/env python3
"""
Script to update the render.yaml configuration file to include Redis and worker configuration.
"""
import os
import logging
import yaml

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def update_render_config():
    """Update the render.yaml file to include Redis and worker configuration."""
    render_yaml_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render.yaml')
    
    # Prepare the new configuration
    config = {
        'services': [
            {
                'type': 'web',
                'name': 'roxi-app',
                'env': 'python',
                'buildCommand': 'pip install -r requirements.txt',
                'startCommand': 'gunicorn --bind 0.0.0.0:$PORT --max-request-line 8190 --limit-request-field_size 8190 --limit-request-line 0 --limit-request-fields 0 main:app',
                'envVars': [
                    {
                        'key': 'DATABASE_URL',
                        'fromDatabase': {
                            'name': 'roxi-db',
                            'property': 'connectionString'
                        }
                    },
                    {
                        'key': 'REDIS_URL',
                        'fromService': {
                            'type': 'redis',
                            'name': 'roxi-redis',
                            'property': 'connectionString'
                        }
                    },
                    {
                        'key': 'SESSION_SECRET',
                        'generateValue': True
                    },
                    {
                        'key': 'OPENAI_API_KEY',
                        'sync': False
                    },
                    {
                        'key': 'WEB_CONCURRENCY',
                        'value': '3'
                    },
                    {
                        'key': 'MAX_CONTENT_LENGTH',
                        'value': '52428800'
                    }
                ]
            },
            {
                'type': 'worker',
                'name': 'roxi-worker',
                'env': 'python',
                'buildCommand': 'pip install -r requirements.txt',
                'startCommand': 'celery -A app.celery worker --loglevel=info',
                'envVars': [
                    {
                        'key': 'DATABASE_URL',
                        'fromDatabase': {
                            'name': 'roxi-db',
                            'property': 'connectionString'
                        }
                    },
                    {
                        'key': 'REDIS_URL',
                        'fromService': {
                            'type': 'redis',
                            'name': 'roxi-redis',
                            'property': 'connectionString'
                        }
                    },
                    {
                        'key': 'SESSION_SECRET',
                        'generateValue': True
                    },
                    {
                        'key': 'OPENAI_API_KEY',
                        'sync': False
                    },
                    {
                        'key': 'MAX_CONTENT_LENGTH',
                        'value': '52428800'
                    }
                ]
            },
            {
                'type': 'redis',
                'name': 'roxi-redis',
                'ipAllowList': [],
                'plan': 'free'
            }
        ],
        'databases': [
            {
                'name': 'roxi-db',
                'databaseName': 'roxi_production',
                'user': 'roxi',
                'plan': 'free'
            }
        ]
    }
    
    # Write the configuration to the render.yaml file
    try:
        with open(render_yaml_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)
        logger.info(f"Successfully updated {render_yaml_path}")
    except Exception as e:
        logger.error(f"Error updating render.yaml: {e}")
        return False
    
    return True

if __name__ == "__main__":
    try:
        # Make sure PyYAML is installed
        import yaml
    except ImportError:
        logger.error("PyYAML is required. Install it with: pip install pyyaml")
        exit(1)
    
    success = update_render_config()
    exit(0 if success else 1)