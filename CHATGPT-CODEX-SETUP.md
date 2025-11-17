# ChatGPT Codex Setup Guide

This guide will help you set up ChatGPT Codex to work with this repository and create pull requests.

## Current Issue

This repository uses a git proxy with branch protection rules that only allow branches with specific naming patterns (e.g., `claude/*`). ChatGPT Codex needs different configuration to work properly.

## Solution: Two Approaches

### Approach 1: Use GitHub Codespaces (Recommended)

1. **Create a GitHub Codespace**
   - Go to your repository on GitHub: `https://github.com/RicardoAltmann/mtg-collection-sinergy`
   - Click the green "Code" button
   - Select "Codespaces" tab
   - Click "Create codespace on main" (or your preferred branch)

2. **Use ChatGPT with GitHub Copilot**
   - Install GitHub Copilot in your Codespace
   - Use ChatGPT to generate code
   - Copy the code into your Codespace
   - Commit and push directly from the Codespace terminal

3. **Create PRs from Codespace**
   ```bash
   # Create a new branch (use codex/ prefix for ChatGPT Codex work)
   git checkout -b codex/your-feature-name

   # Make your changes, then commit
   git add .
   git commit -m "feat: Your descriptive commit message"

   # Push to GitHub
   git push -u origin codex/your-feature-name

   # Create PR using GitHub CLI (if available)
   gh pr create --title "Your PR Title" --body "Description of changes"
   ```

### Approach 2: Configure Repository for Direct ChatGPT Codex Access

#### Step 1: Update GitHub Repository Settings

1. Go to your repository settings on GitHub
2. Navigate to **Settings > Branches**
3. If you have branch protection rules, modify them to allow branches with these prefixes:
   - `codex/*`
   - `chatgpt/*`
   - `openai/*`

#### Step 2: Create a GitHub Personal Access Token

1. Go to GitHub **Settings > Developer settings > Personal access tokens > Tokens (classic)**
2. Click "Generate new token (classic)"
3. Set the following permissions:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
4. Copy the token (you won't see it again!)

#### Step 3: Configure ChatGPT Codex

When using ChatGPT Codex, you'll need to provide it with:

```bash
# Repository URL
https://github.com/RicardoAltmann/mtg-collection-sinergy.git

# Branch naming convention
Use prefix: codex/<feature-name>

# Example workflow for ChatGPT Codex:
1. Clone the repository
2. Create a branch: codex/your-feature
3. Make changes
4. Commit with clear messages
5. Push to origin
6. Create PR via GitHub web interface
```

#### Step 4: GitHub Actions Support

This repository now includes a GitHub Actions workflow (`.github/workflows/codex-pr-helper.yml`) that:
- Automatically validates PRs from `codex/*`, `chatgpt/*`, and `openai/*` branches
- Runs tests on your changes
- Adds helpful comments to PRs

## Branch Naming Conventions

To avoid conflicts with the existing proxy setup, use these branch naming patterns:

- **For ChatGPT Codex**: `codex/feature-name`
- **For Claude Code**: `claude/feature-name-sessionID` (auto-generated)
- **For other AI tools**: `ai/tool-name/feature-name`

## Common Issues and Solutions

### Issue: "403 Forbidden" when pushing

**Solution**: Make sure your branch name follows the allowed patterns. The repository proxy may block branches that don't match expected patterns.

**Workaround**:
1. Create your changes locally
2. Push to a branch with the correct prefix (`codex/*`)
3. If still blocked, create the PR manually through GitHub's web interface

### Issue: Can't authenticate from ChatGPT Codex

**Solution**: ChatGPT Codex cannot directly authenticate with GitHub. You need to:
1. Use the code suggestions from ChatGPT
2. Apply them in a local environment (your machine or Codespaces)
3. Push from there

### Issue: No permission to create PRs

**Solution**: Ensure you have write access to the repository. If you're a collaborator, check with the repository owner.

## Recommended Workflow

1. **Use ChatGPT for Code Generation**
   - Ask ChatGPT to write the code you need
   - Copy the generated code

2. **Apply Changes in Your Local Environment**
   - Use VS Code, Codespaces, or your preferred IDE
   - Paste and test the code

3. **Use GitHub CLI or Web Interface for PRs**
   - Commit your changes locally
   - Push to a `codex/*` branch
   - Create PR via `gh pr create` or GitHub web interface

## Example: Complete Workflow

```bash
# 1. Clone the repository (first time only)
git clone https://github.com/RicardoAltmann/mtg-collection-sinergy.git
cd mtg-collection-sinergy

# 2. Create a new branch for your feature
git checkout -b codex/add-new-feature

# 3. Make changes (use ChatGPT to generate code, then apply it)
# ... edit files ...

# 4. Test your changes
npm test

# 5. Commit your changes
git add .
git commit -m "feat: Add new feature for X"

# 6. Push to GitHub
git push -u origin codex/add-new-feature

# 7. Create a PR
# Option A: Use GitHub CLI
gh pr create --title "Add new feature" --body "This PR adds..."

# Option B: Go to GitHub web interface
# https://github.com/RicardoAltmann/mtg-collection-sinergy/compare/codex/add-new-feature
```

## Need Help?

If you're still having issues:
1. Check that your branch name follows the `codex/*` pattern
2. Verify you have write access to the repository
3. Try creating the PR through GitHub's web interface instead
4. Contact the repository maintainer for access issues

## Alternative: Using GitHub's Native Features

Consider using:
- **GitHub Copilot** - Native AI coding assistant in VS Code/Codespaces
- **GitHub CLI (`gh`)** - Command-line tool for creating PRs
- **GitHub Desktop** - GUI tool for managing git operations

These tools have native GitHub integration and won't face authentication issues.
