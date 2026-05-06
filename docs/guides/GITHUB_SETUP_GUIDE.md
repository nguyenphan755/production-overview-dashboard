# GitHub Setup Guide

Your project is now initialized with Git! Follow these steps to push your code to GitHub.

## ✅ What's Already Done

1. ✅ Git repository initialized
2. ✅ `.gitignore` file created (excludes node_modules, .env files, etc.)
3. ✅ Initial commit created with all project files

## 📋 Next Steps: Connect to GitHub

### Step 1: Create a GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the repository details:
   - **Repository name**: `production-overview-dashboard` (or your preferred name)
   - **Description**: "Production Overview Dashboard - MES System"
   - **Visibility**: Choose Public or Private
   - **⚠️ IMPORTANT**: Do NOT initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

### Step 2: Connect Your Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these commands in your terminal:

**Option A: Using HTTPS (Recommended for beginners)**

```powershell
cd "C:\Users\Admin\Downloads\Production Overview Dashboard NEW"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
git branch -M main
git push -u origin main
```

**Option B: Using SSH (If you have SSH keys set up)**

```powershell
cd "C:\Users\Admin\Downloads\Production Overview Dashboard NEW"
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` and `YOUR_REPOSITORY_NAME` with your actual GitHub username and repository name.**

### Step 3: Authenticate (if using HTTPS)

If you're using HTTPS and GitHub prompts for authentication:
- **Personal Access Token**: Use a GitHub Personal Access Token (not your password)
- To create a token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
- Give it `repo` permissions

## 🔄 Daily Workflow: Making Changes

Once connected, here's how to work with version control:

### 1. Check Status
```powershell
git status
```

### 2. Stage Changes
```powershell
# Stage all changes
git add .

# Or stage specific files
git add src/App.tsx
```

### 3. Commit Changes
```powershell
git commit -m "Description of what you changed"
```

**Good commit messages:**
- ✅ `"Add machine status filtering feature"`
- ✅ `"Fix authentication bug in login"`
- ✅ `"Update API endpoints for production data"`
- ❌ `"fix"` or `"update"` (too vague)

### 4. Push to GitHub
```powershell
git push
```

### 5. Pull Latest Changes (if working with others)
```powershell
git pull
```

## 🌿 Branching (Advanced)

Create branches for new features:

```powershell
# Create and switch to a new branch
git checkout -b feature/new-dashboard

# Make changes, commit them
git add .
git commit -m "Add new dashboard feature"

# Push the branch
git push -u origin feature/new-dashboard

# Switch back to main
git checkout main

# Merge the feature branch
git merge feature/new-dashboard
```

## 📊 Useful Git Commands

```powershell
# View commit history
git log

# View changes in files
git diff

# Undo changes (before staging)
git checkout -- filename

# Undo staging (keep changes)
git reset HEAD filename

# View remote repositories
git remote -v

# Update remote URL if needed
git remote set-url origin NEW_URL
```

## 🔒 Security Reminders

- ✅ `.env` files are already in `.gitignore` (won't be committed)
- ✅ `node_modules` are excluded
- ⚠️ Never commit passwords, API keys, or secrets
- ⚠️ If you accidentally commit sensitive data, remove it immediately

## 🆘 Troubleshooting

### "Repository not found" error
- Check that the repository name and username are correct
- Verify you have access to the repository

### "Authentication failed"
- Use a Personal Access Token instead of password
- Check that your token has `repo` permissions

### "Updates were rejected"
- Someone else pushed changes. Pull first: `git pull`, then push again

### Want to start fresh?
```powershell
# Remove the remote connection
git remote remove origin

# Add it again with correct URL
git remote add origin YOUR_REPO_URL
```

## 📝 Quick Reference Card

```
Daily Workflow:
1. git status          # Check what changed
2. git add .           # Stage changes
3. git commit -m "msg" # Commit with message
4. git push            # Push to GitHub
```

---

**Need Help?** Check out [GitHub Docs](https://docs.github.com) or [Git Documentation](https://git-scm.com/doc)

