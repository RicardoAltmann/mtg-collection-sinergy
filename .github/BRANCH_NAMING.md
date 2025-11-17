# Branch Naming Conventions

This repository supports multiple AI coding assistants and tools. Please use the appropriate branch prefix based on your tool:

## Supported Prefixes

| Tool/Assistant | Branch Pattern | Example |
|----------------|----------------|---------|
| Claude Code | `claude/<feature>-<sessionID>` | `claude/add-feature-01ABC123...` |
| ChatGPT Codex | `codex/<feature>` | `codex/add-card-synergy` |
| OpenAI Tools | `openai/<feature>` | `openai/improve-algorithm` |
| Generic ChatGPT | `chatgpt/<feature>` | `chatgpt/fix-bug` |
| Manual/Developer | `feature/<name>` or `bugfix/<name>` | `feature/user-auth` |

## Branch Protection

- Branches with the above prefixes are allowed through the git proxy
- Other branch names may be blocked with a 403 error
- Always use descriptive feature names

## Creating a Branch

```bash
# For ChatGPT Codex
git checkout -b codex/your-feature-name

# For Claude Code (auto-generated with session ID)
git checkout -b claude/your-feature-sessionID

# For general development
git checkout -b feature/your-feature-name
```

## Pull Request Requirements

- PRs should target the `main` branch (or specified base branch)
- Include a clear description of changes
- Ensure tests pass before requesting review
- Follow conventional commit message format when possible

## Notes

- Session IDs are automatically generated for Claude Code
- ChatGPT Codex users should manually create branches with the `codex/` prefix
- All branches should have descriptive names that indicate the feature or fix
