# Deploying ROXI to Render

This document outlines the steps to deploy the ROXI application to Render.

## Prerequisites

- A Render account (https://render.com)
- An OpenAI API key for GPT-4o integration

## Automated Deployment with Blueprint

The easiest way to deploy ROXI is using the `render.yaml` blueprint included in the repository:

1. Log in to your Render dashboard
2. Click on "New" and select "Blueprint"
3. Connect your repository (GitHub/GitLab/Bitbucket)
4. Render will automatically detect the `render.yaml` file and set up:
   - The main web application
   - A Redis instance for background task queuing
   - A Celery worker for background processing
   - A PostgreSQL database

5. After confirming the configuration, Render will deploy all services automatically.

## Manual Deployment Components

If you prefer to set up the components manually, you'll need to create:

### 1. PostgreSQL Database

1. From your Render dashboard, click "New" and select "PostgreSQL"
2. Configure your database (name, region, etc.)
3. Note the connection details for the next steps

### 2. Redis Service

1. From your Render dashboard, click "New" and select "Redis"
2. Configure your Redis instance (name, region, etc.)
3. Note the connection URL for the next steps

### 3. Web Application Service

1. From your Render dashboard, click "New" and select "Web Service"
2. Connect your repository (or upload your files)
3. Configure:
   - **Name**: Choose a name (e.g., "roxi-app")
   - **Environment**: Python
   - **Region**: Choose the region closest to your users
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --max-request-line 8190 --limit-request-field_size 8190 --limit-request-fields 0 main:app`

4. Set Environment Variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `REDIS_URL`: Redis connection string
   - `SESSION_SECRET`: A secure random string for Flask sessions
   - `OPENAI_API_KEY`: Your OpenAI API key for GPT-4o integration
   - `MAX_CONTENT_LENGTH`: `52428800` (for 50MB file uploads)

### 4. Background Worker Service

1. From your Render dashboard, click "New" and select "Background Worker"
2. Connect to the same repository as your web service
3. Configure:
   - **Name**: Choose a name (e.g., "roxi-worker")
   - **Environment**: Python
   - **Region**: Same as your web service
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `celery -A app.celery worker --loglevel=info`

4. Set the same environment variables as your web service.

## Database Migrations

### Initial Setup
 
When first deploying, the application will create necessary database tables automatically.

### Schema Updates

If you encounter a schema mismatch error like:
```
ERROR: column text_chunk.webpage_id does not exist
```

You can resolve it by running the included migration script:

1. SSH into your web service through the Render dashboard
2. Run: `python fix_text_chunk_schema.py`

## Post-Deployment

- Monitor the deployment logs to ensure everything starts correctly
- Check the `/monitoring/health-check` endpoint to verify all components are working
- Once deployed, you can access your application at the URL provided by Render
- If needed, set up a custom domain in the Render dashboard

## Troubleshooting

### Redis Connection Issues
- Verify your Redis connection URL format in environment variables
- Check that both web and worker services are using the same Redis URL
- Use the health check endpoint to verify Redis connectivity

### Database Issues
- Check PostgreSQL connection string format
- Verify the database exists and is accessible
- Run migration scripts if tables are missing columns

### File Storage Issues
- Render's file system is ephemeral - files uploaded to the service will be lost on redeploy
- For production, consider using a persistent storage solution like S3 or Render's Disk service
- Make sure the application creates necessary directories at startup