# ROXI Deployment to Render

## Overview
This document provides step-by-step instructions for deploying the ROXI application to [Render](https://render.com). Render offers a simple way to host web services, workers, and databases.

## Prerequisites
- A Render account
- Your ROXI codebase pushed to GitHub
- A PostgreSQL database (can be provisioned on Render)
- Optional: Redis instance for background tasks (can be provisioned on Render)

## Deployment Steps

### 1. Deploy the PostgreSQL Database

1. Log in to your Render dashboard
2. Navigate to "New +" and select "PostgreSQL"
3. Configure your database:
   - **Name**: `roxi-database` (or your preferred name)
   - **Database**: `roxi`
   - **User**: Create a secure username
   - **Region**: Choose the closest to your users
   - **PostgreSQL Version**: 15 or higher
4. Click "Create Database"
5. Note the connection details provided (you'll need these later)

### 2. Deploy Redis (for background processing)

1. Navigate to "New +" and select "Redis"
2. Configure your Redis instance:
   - **Name**: `roxi-redis` (or your preferred name)
   - **Region**: Same as your database
3. Click "Create Redis"
4. Note the connection URL provided

### 3. Deploy the Web Service

#### Option 1: Manual Deployment

1. Navigate to "New +" and select "Web Service"
2. Connect your GitHub repository
3. Configure your web service:
   - **Name**: `roxi-web` (or your preferred name)
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --reuse-port main:app`
   - **Region**: Same as your database
4. Add environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection URL
   - `REDIS_URL`: Your Redis connection URL
   - `SESSION_SECRET`: A secure random string
   - `OPENAI_API_KEY`: Your OpenAI API key
5. Click "Create Web Service"

#### Option 2: Using render.yaml (Recommended)

1. Ensure you have the `render.yaml` file in your repository
2. In your Render dashboard, navigate to "New +" and select "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the blueprint configuration
5. Review the resources to be created and click "Apply"
6. Add any required environment variables

### 4. Deploy the Worker Service

If your application uses Celery for background tasks:

1. Navigate to "New +" and select "Background Worker"
2. Connect your GitHub repository
3. Configure your worker:
   - **Name**: `roxi-worker` (or your preferred name)
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `celery -A tasks.celery worker --loglevel=info`
   - **Region**: Same as your web service
4. Add the same environment variables as your web service
5. Click "Create Background Worker"

## Post-Deployment

### Database Initialization

After your first deployment, you may need to initialize your database:

1. Go to your Web Service in the Render dashboard
2. Navigate to the "Shell" tab
3. Run: `python -c "from app import app, db; import models; app.app_context().push(); db.create_all()"`

### Monitoring

1. Monitor your application logs in the Render dashboard
2. Set up alerts for errors or high resource usage
3. Configure custom health checks for your services

### Scaling

If you need to scale the application:

1. Go to your Web Service in the Render dashboard
2. Navigate to the "Settings" tab
3. Under "Instances", adjust the number or type of instances

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify your DATABASE_URL environment variable
   - Check if your database is running
   - Ensure your IP is allowed in the database firewall settings

2. **Application Startup Failures**:
   - Check your application logs
   - Verify that all required environment variables are set
   - Check if your start command is correct

3. **High Memory Usage**:
   - Consider optimizing your application
   - Increase the instance size in your service settings

## Maintenance

### Regular Updates

1. Push updates to your GitHub repository
2. Render will automatically deploy new changes

### Database Backups

Render automatically creates daily backups of your PostgreSQL database. To create a manual backup:

1. Go to your PostgreSQL service in the Render dashboard
2. Navigate to the "Backups" tab
3. Click "Create Backup"