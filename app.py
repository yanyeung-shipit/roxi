import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create SQLAlchemy models base class
class Base(DeclarativeBase):
    pass

# Initialize SQLAlchemy
db = SQLAlchemy(model_class=Base)

# Create Flask app
app = Flask(__name__)

# Configure app
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB max upload size

# Ensure upload directory exists
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Initialize SQLAlchemy with app
db.init_app(app)

# Import celery configuration
from celery_config import setup_celery
celery = setup_celery(app)

# Import and register blueprints
from routes import main_routes, document_routes, monitoring_routes, ocr_routes
app.register_blueprint(main_routes)
app.register_blueprint(document_routes)
app.register_blueprint(monitoring_routes)
app.register_blueprint(ocr_routes)

# Create database tables
with app.app_context():
    import models
    db.create_all()
    logger.info("Database tables created")
    
    # Start background document processor
    from utils.document_processor import start_background_processor
    start_background_processor()
    logger.info("Background document processor started")