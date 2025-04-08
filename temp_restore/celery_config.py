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

    # Configure Celery
    celery_app = celery.Celery(
        app.import_name,
        backend='rpc://',
        broker='redis://localhost:6379/0',
        include=['tasks']
    )

    # Update Celery configuration
    celery_app.conf.update(
        result_expires=3600,  # Results expire in 1 hour
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        task_time_limit=1800,  # 30 minute time limit
        task_soft_time_limit=1500,  # 25 minute soft time limit
        broker_connection_retry_on_startup=True,
    )

    # Schedule periodic tasks
    celery_app.conf.beat_schedule = {
        'check-processing-queue-every-minute': {
            'task': 'tasks.check_processing_queue',
            'schedule': 60.0,  # Every minute
        },
        'update-system-metrics-every-minute': {
            'task': 'tasks.update_system_metrics_task',
            'schedule': 60.0,  # Every minute
        },
    }

    # Set base task for context
    celery_app.Task = ContextTask
    
    logger.info("Celery configured with app context")
    
    return celery_app