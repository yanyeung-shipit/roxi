import logging
import celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

def setup_celery(app):
    """Setup Celery with Flask app context"""
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    # Create Celery instance
    celery_app = celery.Celery(
        app.import_name,
        backend=app.config['CELERY_RESULT_BACKEND'],
        broker=app.config['CELERY_BROKER_URL']
    )
    
    # Configure Celery
    celery_app.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        enable_utc=True,
    )
    
    # Set up periodic tasks
    celery_app.conf.beat_schedule = {
        'check-processing-queue-every-minute': {
            'task': 'tasks.check_processing_queue',
            'schedule': crontab(minute='*'),
        },
        'update-system-metrics-every-5-minutes': {
            'task': 'tasks.update_system_metrics',
            'schedule': crontab(minute='*/5'),
        },
    }
    
    # Update task base class with context
    celery_app.Task = ContextTask
    
    # Register tasks
    celery_app.autodiscover_tasks(['tasks'])
    
    logger.info("Celery configured with app context")
    return celery_app