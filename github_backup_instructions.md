## GitHub Repository Files
The following files are recommended for inclusion in the GitHub repository:

### Core Application Files
- main.py
- app.py
- models.py
- tasks.py
- celery_config.py

### Application Directories
- static/ (CSS, JavaScript, images)
- templates/ (HTML templates)
- routes/ (API and page routes)
- utils/ (Utility functions)

### Support Files
- .gitignore
- requirements.txt or pyproject.toml
- README.md

### Utility Scripts
- clean_scp_tags.py
- cleanup.py
- fix_dois.py
- update_citation.py
- update_eular_document.py
- update_pubmed_data.py

### GitHub Backup Instructions
1. Create a new GitHub repository
2. Initialize Git in your project directory (if not already done):
   ```bash
   git init
   ```
3. Add all files to the staging area:
   ```bash
   git add .
   ```
4. Create an initial commit:
   ```bash
   git commit -m "Initial commit of ROXI: Rheumatology Optimized eXpert Intelligence"
   ```
5. Add your GitHub repository as a remote:
   ```bash
   git remote add origin https://github.com/yourusername/your-repo-name.git
   ```
6. Push your code to GitHub:
   ```bash
   git push -u origin master # or 'main' depending on your default branch
   ```

### Important Notes
- Make sure your .gitignore is properly configured to exclude uploads, database files, environment variables, and other sensitive information
- Don't commit any API keys or secrets
- For environment variables, consider using a .env.example file that shows what variables are needed but doesn't include actual values
