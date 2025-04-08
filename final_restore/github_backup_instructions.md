# GitHub Backup Instructions for ROXI

## Overview
This document provides step-by-step instructions for backing up the ROXI codebase to GitHub. Regular backups are essential to maintain version history and safeguard against data loss.

## Prerequisites
- GitHub account with access to the repository `github.com/yanyeung-shipit/roxi.git`
- Git installed on the local machine
- Basic Git knowledge

## Step-by-Step Instructions

### 1. Initial Setup (First-time only)
If you haven't configured Git on your machine:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2. Clone the Repository (First-time only)
If you don't have the repository locally:

```bash
git clone https://github.com/yanyeung-shipit/roxi.git
cd roxi
```

### 3. Regular Backup Process

#### a. Ensure you're in the project directory
```bash
cd /path/to/roxi
```

#### b. Add all changes to staging
```bash
git add .
```

#### c. Commit changes with a descriptive message
```bash
git commit -m "Backup [DATE]: [Brief description of changes]"
```
For example: `git commit -m "Backup 2025-04-08: Added webpage processing and fixed schema issues"`

#### d. Push changes to GitHub
```bash
git push origin main
```

### 4. Creating a Release (for major versions)

For significant milestones or versions:

#### a. Create a tag
```bash
git tag -a v1.0.0 -m "Version 1.0.0 - [Brief description]"
```

#### b. Push the tag
```bash
git push origin v1.0.0
```

#### c. Create a release on GitHub
1. Go to the repository on GitHub
2. Click on "Releases"
3. Click "Draft a new release"
4. Select your tag
5. Add a title and description
6. Click "Publish release"

### 5. Backup Schedule Recommendations

- **Daily automatic commits**: For active development
- **Weekly tagged releases**: For stable points
- **Monthly comprehensive backups**: Including database schema

### 6. Handling Sensitive Data

- Ensure `.env` files are in `.gitignore`
- Do not commit API keys, passwords, or other secrets
- Use environment variables for sensitive data

### 7. Troubleshooting

If you encounter issues pushing to GitHub:
- Ensure your account has write access to the repository
- Check if you need to authenticate with a token or SSH key
- Pull the latest changes first with `git pull origin main`

## Additional Resources
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)