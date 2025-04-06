# Deploying ROXI to Render

This document outlines the steps to deploy the ROXI application to Render.

## Prerequisites

- A Render account (https://render.com)
- Your existing PostgreSQL database on Render

## Deployment Steps

### 1. Create a New Web Service

1. Log in to your Render dashboard
2. Click on "New" and select "Web Service"
3. Connect your repository (GitHub/GitLab/Bitbucket)
4. If using the Render Dashboard directly, you can use the "Upload Files" option

### 2. Configure Your Web Service

- **Name**: Choose a name for your application (e.g., "roxi-app")
- **Environment**: Python
- **Region**: Choose the region closest to your users
- **Branch**: main (or your preferred branch)
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn --bind 0.0.0.0:$PORT main:app`

### 3. Set Environment Variables

The following environment variables are required:

- `DATABASE_URL`: Your PostgreSQL connection string (from your existing Render PostgreSQL)
- `SESSION_SECRET`: A secure random string for Flask sessions
- `OPENAI_API_KEY`: Your OpenAI API key for GPT-4o integration

Additional optional environment variables:
- Add any other API keys or configuration needed by your application

### 4. Connect to Your PostgreSQL Database

- In your Render Dashboard, note the connection details of your PostgreSQL database
- Use these to set up the DATABASE_URL environment variable in the format:
  ```
  postgresql://username:password@host:port/database_name
  ```

### 5. Deploy Your Application

Click "Create Web Service" and Render will build and deploy your application automatically.

## Post-Deployment

- Monitor the deployment logs to ensure everything starts correctly
- Once deployed, you can access your application at the URL provided by Render
- If needed, set up a custom domain in the Render dashboard

## Important Notes

- The application uses Celery for background tasks. For production, consider adding a Redis instance or using Render's background workers
- Make sure all required folders (uploads, backups) exist and are writable
- For large-scale deployments, consider upgrading your Render plan as needed