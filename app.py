import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Define base model class
class Base(DeclarativeBase):
    pass

# Initialize database
db = SQLAlchemy(model_class=Base)

# Create the Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "temporary_development_key")

# Configure database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize the app with the database extension
db.init_app(app)

# Configure Celery
app.config["CELERY_BROKER_URL"] = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
app.config["CELERY_RESULT_BACKEND"] = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Import Celery config
from celery_config import setup_celery
celery = setup_celery(app)

# Register blueprints
from routes import main_routes, document_routes, monitoring_routes

app.register_blueprint(main_routes.main_routes)
app.register_blueprint(document_routes.document_routes)
app.register_blueprint(monitoring_routes.monitoring_routes)

# Create database tables within app context (if they don't exist)
with app.app_context():
    # Import models here to avoid circular imports
    import models
    db.create_all()
    logger.info("Database tables created if they didn't exist")